-- Phase 1: a bounded, snapshot-consistent, read-only competitive hall.
-- No score rewrite/backfill, new public identifiers, or change to submit_score.
-- web-2026.09.04 first shipped AFTER the combo +30% / 1.76s / uniform-pace
-- changes (6832958 -> 9e502bb). Unknown versions remain a separate archive.

create index if not exists leaderboard_scores_rule_player_best_idx
  on public.leaderboard_scores (client_version, player_id, score desc, played_at asc, id asc);

create or replace function public.leaderboard_hall(
  p_player_id uuid default null,
  p_scope text default 'current',
  p_offset integer default 0,
  p_limit integer default 25,
  p_near boolean default false
) returns jsonb
language plpgsql
stable
security definer
set search_path = pg_catalog, pg_temp
as $$
declare
  response jsonb;
begin
  if p_scope is null or p_scope not in ('current', 'history')
     or p_offset is null or p_offset < 0 or p_offset > 1000000
     or p_limit is null or p_limit < 1 or p_limit > 100
     or p_near is null
     or p_player_id = '00000000-0000-0000-0000-000000000000'::uuid then
    raise exception 'invalid leaderboard query' using errcode = '22023';
  end if;

  -- IDs remain inside the function. Every exposed statistic belongs to the
  -- chosen single run; never combine a player's best combo and best score.
  with scoped as (
    select s.*,
           row_number() over (
             partition by s.player_id
             order by s.score desc, s.played_at asc, s.id asc
           ) as personal_position
    from public.leaderboard_scores s
    where (p_scope = 'current' and s.client_version = 'web-2026.09.04')
       or (p_scope = 'history' and s.client_version <> 'web-2026.09.04')
  ), ranked as (
    select s.*,
           rank() over (order by s.score desc) as rank,
           row_number() over (order by s.score desc, s.played_at asc, s.id asc) as position
    from scoped s where personal_position = 1
  ), exposed as (
    select r.*,
           jsonb_build_object(
             'rank', r.rank, 'position', r.position,
             'name', r.player_name, 'score', r.score,
             'level', r.level, 'combo', r.max_combo,
             'won', r.won, 'played_at', r.played_at,
             'is_me', coalesce(r.player_id = p_player_id, false)
           ) as item
    from ranked r
  ), mine as (
    select * from exposed where player_id = p_player_id
  ), target as (
    -- A tie is not a score to chase. Pick the nearest STRICTLY higher score;
    -- +1 below states the points needed to beat it, rather than merely tie it.
    select e.* from exposed e cross join mine m
    where e.score > m.score
    order by e.score asc, e.played_at asc, e.id asc limit 1
  ), bounds as (
    select case when p_near then coalesce((select greatest(0, position - 4) from mine), 0)
                else p_offset end as start_offset,
           case when p_near then (select position + 3 from mine)
                else p_offset::bigint + p_limit end as end_position
  ), page as (
    select e.* from exposed e cross join bounds b
    where e.position > b.start_offset and e.position <= b.end_position
    order by e.position
  )
  select jsonb_build_object(
    'scope', p_scope,
    'rule_version', case when p_scope = 'current' then 'web-2026.09.04' else 'unverified-history' end,
    -- Equality token for paginated public snapshots, not a signature or ETag.
    -- Excludes read time and every private ID; nickname/best-run/rank changes
    -- invalidate it. Lower unlisted runs do not. Caller identity affects is_me.
    'revision', md5(p_scope || ':' || coalesce((
      select string_agg(item::text, E'\n' order by position) from exposed
    ), '')),
    'total', (select count(*) from exposed),
    -- Server snapshot/read time, not an invented score-record modification time.
    'updated_at', statement_timestamp(),
    'rows', coalesce((select jsonb_agg(item order by position) from page), '[]'::jsonb),
    'podium', coalesce((select jsonb_agg(item order by position) from exposed where position <= 3), '[]'::jsonb),
    'mine', (select item from mine),
    'next', (select item from target),
    'next_gap', (select t.score - m.score + 1 from target t cross join mine m),
    'offset', (select start_offset from bounds),
    'has_more', case when p_near then false else exists (
      select 1 from exposed e cross join bounds b where e.position > b.end_position
    ) end
  ) into response;

  return response;
end;
$$;

-- Explicit revokes also cover permissive Supabase project default privileges.
revoke all on function public.leaderboard_hall(uuid,text,integer,integer,boolean)
  from public, anon, authenticated;
grant execute on function public.leaderboard_hall(uuid,text,integer,integer,boolean)
  to anon, authenticated;

comment on function public.leaderboard_hall(uuid,text,integer,integer,boolean) is
  'Read-only best-single-run hall. Competition rank (1,1,3); anonymous identity is browser-bound, not authenticated. Unknown rules are a separate historical archive.';
