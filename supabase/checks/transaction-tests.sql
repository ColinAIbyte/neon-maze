-- Neon Maze PostgreSQL integration acceptance: synthetic rows are always rolled back.
-- Run the COMPLETE file in SQL Editor as the trusted migration owner, after 001 + 002 + 003.
-- With psql, use: psql --set=ON_ERROR_STOP=1 --file=transaction-tests.sql
-- To test migrations before installing them, use ONE outer transaction containing:
-- BEGIN; [001] [002] [003] [the marked TEST BODY below] ROLLBACK;
-- Do not copy this file's BEGIN/ROLLBACK wrapper into that existing transaction.
-- Any unexpected result raises an exception and aborts the transaction. If the client
-- stops on an error, run ROLLBACK before continuing. Never replace ROLLBACK with COMMIT.
-- TEMP helpers disappear on rollback; no real player data is selected or deleted.
-- An existing identity sequence can advance even on rollback, leaving harmless ID gaps.
-- This checks PostgreSQL behavior as anon, not HTTP credentials, concurrent sessions,
-- browser/network behavior, or phone connectivity. Those require separate acceptance.

BEGIN;

-- BEGIN TEST BODY
SET LOCAL statement_timeout = '30s';
SET LOCAL lock_timeout = '5s';

CREATE TEMP TABLE neon_maze_acceptance_context ON COMMIT DROP AS
SELECT gen_random_uuid() AS player_id,
       gen_random_uuid() AS other_player_id,
       gen_random_uuid() AS rate_player_id,
       gen_random_uuid() AS first_run_id,
       gen_random_uuid() AS first_rate_run_id,
       gen_random_uuid() AS rejected_run_id,
       gen_random_uuid() AS other_run_id,
       ('N' || left(replace(gen_random_uuid()::text, '-', ''), 7)) AS first_name,
       ('R' || left(replace(gen_random_uuid()::text, '-', ''), 7)) AS renamed_name;

CREATE TEMP TABLE neon_maze_acceptance_results (
  check_name text NOT NULL
) ON COMMIT DROP;

-- Helper grants only affect this session's temporary tables, never production tables.
GRANT SELECT ON pg_temp.neon_maze_acceptance_context TO anon;
GRANT SELECT, INSERT ON pg_temp.neon_maze_acceptance_results TO anon;

DO $preconditions$
DECLARE
  browser_role text;
  rpc_oid oid := to_regprocedure(
    'public.submit_score(uuid,uuid,text,bigint,smallint,integer,boolean,integer,integer,integer,integer,text)');
BEGIN
  IF current_setting('server_version_num')::integer < 150000 THEN
    RAISE EXCEPTION 'Acceptance requires PostgreSQL 15 or later';
  END IF;
  IF rpc_oid IS NULL OR to_regclass('public.leaderboard_public') IS NULL
     OR NOT EXISTS (
       SELECT 1 FROM pg_catalog.pg_class
       WHERE oid = to_regclass('public.leaderboard_scores') AND relrowsecurity
     ) THEN
    RAISE EXCEPTION 'Missing migrations, public view, or enabled RLS';
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_catalog.pg_proc
    WHERE oid = rpc_oid AND prosecdef
      AND proconfig @> ARRAY['search_path=public']::text[]
      AND pg_catalog.pg_get_userbyid(proowner) NOT IN ('anon', 'authenticated')
  ) OR EXISTS (
    SELECT 1 FROM pg_catalog.pg_proc p,
      LATERAL pg_catalog.aclexplode(coalesce(p.proacl, pg_catalog.acldefault('f', p.proowner))) a
    WHERE p.oid = rpc_oid AND a.grantee = 0 AND a.privilege_type = 'EXECUTE'
  ) THEN
    RAISE EXCEPTION 'RPC ownership, SECURITY DEFINER search path, or PUBLIC execution is unsafe';
  END IF;
  FOREACH browser_role IN ARRAY ARRAY['anon', 'authenticated'] LOOP
    IF NOT pg_catalog.has_schema_privilege(browser_role, 'public', 'USAGE')
       OR pg_catalog.has_schema_privilege(browser_role, 'public', 'CREATE')
       OR pg_catalog.has_table_privilege(browser_role, 'public.leaderboard_scores',
         'SELECT,INSERT,UPDATE,DELETE,TRUNCATE,REFERENCES,TRIGGER')
       OR pg_catalog.has_any_column_privilege(browser_role, 'public.leaderboard_scores',
         'SELECT,INSERT,UPDATE,REFERENCES')
       OR NOT pg_catalog.has_table_privilege(browser_role, 'public.leaderboard_public', 'SELECT')
       OR pg_catalog.has_table_privilege(browser_role, 'public.leaderboard_public',
         'INSERT,UPDATE,DELETE,TRUNCATE,REFERENCES,TRIGGER')
       OR pg_catalog.has_any_column_privilege(browser_role, 'public.leaderboard_public',
         'INSERT,UPDATE,REFERENCES')
       OR NOT pg_catalog.has_function_privilege(browser_role, rpc_oid, 'EXECUTE') THEN
      RAISE EXCEPTION 'Unexpected effective schema/table/view/RPC grants for %', browser_role;
    END IF;
  END LOOP;
  IF EXISTS (
    SELECT 1 FROM public.leaderboard_scores s
    CROSS JOIN pg_temp.neon_maze_acceptance_context c
    WHERE s.player_id IN (c.player_id, c.other_player_id, c.rate_player_id)
       OR s.run_id IN (c.first_run_id, c.first_rate_run_id, c.rejected_run_id, c.other_run_id)
  ) THEN
    RAISE EXCEPTION 'Synthetic UUID collision; roll back and retry';
  END IF;
  INSERT INTO pg_temp.neon_maze_acceptance_results(check_name)
  VALUES ('effective anon/authenticated grants, RLS, RPC owner/search path');
END
$preconditions$;

SET LOCAL ROLE anon;

DO $anonymous_acceptance$
DECLARE
  c record;
  payload jsonb;
  base_payload jsonb;
  response jsonb;
  test_case record;
  actual_state text;
  actual_message text;
  column_names text[];
  denied boolean;
  i integer;
  new_run_id uuid;
BEGIN
  IF current_user <> 'anon' THEN
    RAISE EXCEPTION 'Acceptance must exercise the real anon database role';
  END IF;
  SELECT * INTO STRICT c FROM pg_temp.neon_maze_acceptance_context;

  SELECT array_agg(attname::text ORDER BY attnum) INTO column_names
  FROM pg_catalog.pg_attribute
  WHERE attrelid = 'public.leaderboard_public'::regclass AND attnum > 0 AND NOT attisdropped;
  IF column_names IS DISTINCT FROM
    ARRAY['player_name','score','level','max_combo','won','played_at']::text[] THEN
    RAISE EXCEPTION 'Public view exposes unexpected columns: %', column_names;
  END IF;
  PERFORM player_name, score, level, max_combo, won, played_at
  FROM public.leaderboard_public LIMIT 0;
  INSERT INTO pg_temp.neon_maze_acceptance_results(check_name)
  VALUES ('actual anon role; public view readable with exactly six public columns');

  response := public.submit_score(c.player_id, c.first_run_id,
    ' <&>' || c.first_name || '<&> ', 1000::bigint, 1::smallint, 10,
    false, 10000, 0, 0, 0, 'web-2026.09.04');
  IF response IS DISTINCT FROM jsonb_build_object(
    'accepted', true, 'duplicate', false, 'run_id', c.first_run_id) THEN
    RAISE EXCEPTION 'Valid anonymous submit returned unexpected result: %', response;
  END IF;
  IF (SELECT count(*) FROM public.leaderboard_public
      WHERE player_name = c.first_name AND score = 1000 AND level = 1
        AND max_combo = 10 AND NOT won AND played_at = now()) <> 1 THEN
    RAISE EXCEPTION 'New anonymous score not visible with sanitized nickname';
  END IF;
  INSERT INTO pg_temp.neon_maze_acceptance_results(check_name)
  VALUES ('valid new submit, nickname sanitization, and anonymous public read');

  -- Duplicate requests intentionally only rename: none of these changed score fields
  -- may replace the original. A stale/invalid payload must not alter stored metadata.
  response := public.submit_score(c.player_id, c.first_run_id,
    '<&>' || c.renamed_name || 'EXTRA', 999999999999::bigint, 6::smallint, 999999,
    true, 1000, 100000, 1000000, 100000, 'obsolete-client');
  IF response IS DISTINCT FROM jsonb_build_object(
    'accepted', true, 'duplicate', true, 'run_id', c.first_run_id) THEN
    RAISE EXCEPTION 'Duplicate rename returned unexpected result: %', response;
  END IF;
  INSERT INTO pg_temp.neon_maze_acceptance_results(check_name)
  VALUES ('same player/run idempotent rename and eight-character nickname limit');

  base_payload := jsonb_build_object(
    'player_id', c.player_id, 'run_id', c.first_run_id, 'player_name', c.first_name,
    'score', 1000, 'level', 1, 'max_combo', 10, 'won', false,
    'duration_ms', 10000, 'deaths', 0, 'ghosts_eaten', 0, 'sweeps', 0,
    'client_version', 'web-2026.09.04');

  FOR test_case IN
    SELECT * FROM (VALUES
      ('different player cannot reuse run', jsonb_build_object('player_id', c.other_player_id, 'run_id', c.first_run_id), '42501', 'run id belongs to another player'),
      ('null player id', '{"player_id":null}'::jsonb, '22023', 'invalid anonymous id'),
      ('zero run id', '{"run_id":"00000000-0000-0000-0000-000000000000"}'::jsonb, '22023', 'invalid anonymous id'),
      ('null score', '{"score":null}'::jsonb, '22023', 'invalid score payload'),
      ('negative score', '{"score":-1}'::jsonb, '22023', 'invalid score payload'),
      ('invalid level', '{"level":7}'::jsonb, '22023', 'invalid score payload'),
      ('invalid duration', '{"duration_ms":999}'::jsonb, '22023', 'invalid score payload'),
      ('wrong client version', '{"client_version":"web-1900.01.01"}'::jsonb, '22023', 'invalid score payload'),
      -- 002 currently rejects NULL version via its NOT NULL constraint, not the IF.
      ('null client version safely rejected', '{"client_version":null}'::jsonb, '23502', 'client_version'),
      ('level timing', '{"level":6,"duration_ms":39999}'::jsonb, '22023', 'impossible level timing'),
      ('win before final level', '{"won":true}'::jsonb, '22023', 'impossible level timing'),
      ('combo growth', '{"max_combo":151}'::jsonb, '22023', 'impossible combo rate'),
      ('death event count', '{"deaths":10}'::jsonb, '22023', 'impossible event counts'),
      ('ghost event count', '{"ghosts_eaten":28}'::jsonb, '22023', 'impossible event counts'),
      ('sweep event count', '{"ghosts_eaten":3,"sweeps":1}'::jsonb, '22023', 'impossible event counts'),
      ('score growth', '{"score":1750001}'::jsonb, '22023', 'impossible score rate')
    ) cases(check_name, patch, expected_state, expected_message)
  LOOP
    payload := base_payload || jsonb_build_object('run_id', gen_random_uuid()) || test_case.patch;
    actual_state := NULL;
    actual_message := NULL;
    BEGIN
      response := public.submit_score(
        (payload->>'player_id')::uuid, (payload->>'run_id')::uuid,
        payload->>'player_name', (payload->>'score')::bigint,
        (payload->>'level')::smallint, (payload->>'max_combo')::integer,
        (payload->>'won')::boolean, (payload->>'duration_ms')::integer,
        (payload->>'deaths')::integer, (payload->>'ghosts_eaten')::integer,
        (payload->>'sweeps')::integer, payload->>'client_version');
    EXCEPTION WHEN OTHERS THEN
      GET STACKED DIAGNOSTICS actual_state = RETURNED_SQLSTATE, actual_message = MESSAGE_TEXT;
    END;
    IF actual_state IS DISTINCT FROM test_case.expected_state
       OR position(test_case.expected_message IN coalesce(actual_message, '')) = 0 THEN
      RAISE EXCEPTION 'FAIL %: expected % / %, got % / %', test_case.check_name,
        test_case.expected_state, test_case.expected_message, actual_state, actual_message;
    END IF;
    INSERT INTO pg_temp.neon_maze_acceptance_results(check_name) VALUES (test_case.check_name);
  END LOOP;

  FOR i IN 1..30 LOOP
    new_run_id := CASE WHEN i = 1 THEN c.first_rate_run_id ELSE gen_random_uuid() END;
    response := public.submit_score(c.rate_player_id, new_run_id, 'RateTest',
      1000::bigint, 1::smallint, 10, false, 10000, 0, 0, 0, 'web-2026.09.04');
    IF response IS DISTINCT FROM jsonb_build_object(
      'accepted', true, 'duplicate', false, 'run_id', new_run_id) THEN
      RAISE EXCEPTION 'Rate test valid submission % was not accepted: %', i, response;
    END IF;
  END LOOP;
  actual_state := NULL;
  actual_message := NULL;
  BEGIN
    PERFORM public.submit_score(c.rate_player_id, c.rejected_run_id, 'RateTest',
      1000::bigint, 1::smallint, 10, false, 10000, 0, 0, 0, 'web-2026.09.04');
  EXCEPTION WHEN OTHERS THEN
    GET STACKED DIAGNOSTICS actual_state = RETURNED_SQLSTATE, actual_message = MESSAGE_TEXT;
  END;
  IF actual_state IS DISTINCT FROM 'P0001'
     OR actual_message IS DISTINCT FROM 'submission rate limit exceeded' THEN
    RAISE EXCEPTION '31st score not rejected by rate limit: % / %', actual_state, actual_message;
  END IF;
  response := public.submit_score(c.rate_player_id, c.first_rate_run_id, 'RateName',
    1000::bigint, 1::smallint, 10, false, 10000, 0, 0, 0, 'web-2026.09.04');
  IF response IS DISTINCT FROM jsonb_build_object(
    'accepted', true, 'duplicate', true, 'run_id', c.first_rate_run_id) THEN
    RAISE EXCEPTION 'Duplicate rename should still succeed at the hourly limit';
  END IF;
  response := public.submit_score(c.other_player_id, c.other_run_id, 'OtherID',
    1000::bigint, 1::smallint, 10, false, 10000, 0, 0, 0, 'web-2026.09.04');
  IF response IS DISTINCT FROM jsonb_build_object(
    'accepted', true, 'duplicate', false, 'run_id', c.other_run_id) THEN
    RAISE EXCEPTION 'Rate limiting incorrectly blocked a different player';
  END IF;
  INSERT INTO pg_temp.neon_maze_acceptance_results(check_name) VALUES
    ('30 new scores accepted; 31st rejected; duplicate allowed; other player unaffected');

  FOREACH actual_message IN ARRAY ARRAY['SELECT','INSERT','UPDATE','DELETE'] LOOP
    denied := false;
    BEGIN
      CASE actual_message
        WHEN 'SELECT' THEN
          PERFORM 1 FROM public.leaderboard_scores LIMIT 0;
        WHEN 'INSERT' THEN
          INSERT INTO public.leaderboard_scores(
            run_id, player_id, player_name, score, level, max_combo, won,
            duration_ms, deaths, ghosts_eaten, sweeps, client_version)
          VALUES (c.rejected_run_id, c.player_id, 'Forbidden', 1000, 1, 10,
            false, 10000, 0, 0, 0, 'web-2026.09.04');
        WHEN 'UPDATE' THEN
          UPDATE public.leaderboard_scores SET player_name = 'Forbidden'
          WHERE run_id = c.first_run_id;
        WHEN 'DELETE' THEN
          DELETE FROM public.leaderboard_scores WHERE run_id = c.first_run_id;
      END CASE;
    EXCEPTION WHEN insufficient_privilege THEN
      denied := true;
    END;
    IF NOT denied THEN
      RAISE EXCEPTION 'anon direct bottom-table % unexpectedly succeeded', actual_message;
    END IF;
  END LOOP;
  INSERT INTO pg_temp.neon_maze_acceptance_results(check_name)
  VALUES ('anon direct bottom-table SELECT/INSERT/UPDATE/DELETE denied');
END
$anonymous_acceptance$;

RESET ROLE;

-- Trusted owner verifies stored synthetic rows; its writes are never used as proof of
-- anonymous RPC access. Every score above was attempted while current_user = anon.
DO $stored_integrity$
DECLARE
  c record;
BEGIN
  SELECT * INTO STRICT c FROM pg_temp.neon_maze_acceptance_context;
  IF (SELECT count(*) FROM public.leaderboard_scores WHERE player_id = c.player_id) <> 1
     OR NOT EXISTS (
       SELECT 1 FROM public.leaderboard_scores
       WHERE run_id = c.first_run_id AND player_id = c.player_id
         AND player_name = c.renamed_name AND score = 1000 AND level = 1
         AND max_combo = 10 AND NOT won AND duration_ms = 10000 AND deaths = 0
         AND ghosts_eaten = 0 AND sweeps = 0 AND client_version = 'web-2026.09.04'
         AND validation_version = 2 AND played_at = now()
     ) THEN
    RAISE EXCEPTION 'Duplicate rename changed original metadata, copied a row, or accepted malformed data';
  END IF;
  IF (SELECT count(*) FROM public.leaderboard_scores WHERE player_id = c.rate_player_id) <> 30
     OR EXISTS (SELECT 1 FROM public.leaderboard_scores WHERE run_id = c.rejected_run_id)
     OR (SELECT count(*) FROM public.leaderboard_scores WHERE player_id = c.other_player_id) <> 1
     OR NOT EXISTS (
       SELECT 1 FROM public.leaderboard_scores
       WHERE run_id = c.first_rate_run_id AND player_id = c.rate_player_id
         AND player_name = 'RateName' AND score = 1000 AND validation_version = 2
     ) THEN
    RAISE EXCEPTION 'Stored rate-limit/idempotency/player-isolation results are incorrect';
  END IF;
  INSERT INTO pg_temp.neon_maze_acceptance_results(check_name)
  VALUES ('owner verifies exactly 32 synthetic rows; original score metadata unchanged');
END
$stored_integrity$;

-- One result column for narrow SQL Editor screens. PASS means all assertions ran;
-- the ROLLBACK immediately below is still mandatory. No synthetic identifiers leak.
SELECT jsonb_build_object(
  'status', 'PASS',
  'rpc_role', 'anon',
  'checks_passed', count(*),
  'synthetic_rows_to_rollback', 32,
  'checks', jsonb_agg(check_name ORDER BY check_name),
  'scope', 'single-session PostgreSQL acceptance; HTTP/concurrency/mobile not covered'
) AS acceptance_result
FROM pg_temp.neon_maze_acceptance_results;
-- END TEST BODY

ROLLBACK;
