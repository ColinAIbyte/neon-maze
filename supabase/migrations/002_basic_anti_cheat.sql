-- 基础防刷：所有判断都在 security definer 写入口执行，不能由浏览器绕过。
-- 阈值刻意宽松，只拦明显不可能的成绩；纯静态匿名客户端无法实现强对抗安全。

alter table public.leaderboard_scores
  add column if not exists validation_version smallint not null default 1;

create index if not exists leaderboard_scores_player_time_idx
  on public.leaderboard_scores (player_id, played_at desc);

create or replace function public.submit_score(
  p_player_id uuid,
  p_run_id uuid,
  p_player_name text,
  p_score bigint,
  p_level smallint,
  p_max_combo integer,
  p_won boolean,
  p_duration_ms integer,
  p_deaths integer,
  p_ghosts_eaten integer,
  p_sweeps integer,
  p_client_version text
) returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  safe_name text;
  existing_player uuid;
  recent_submissions integer;
  max_plausible_score bigint;
begin
  if p_player_id is null or p_player_id = '00000000-0000-0000-0000-000000000000'::uuid
     or p_run_id is null or p_run_id = '00000000-0000-0000-0000-000000000000'::uuid then
    raise exception 'invalid anonymous id' using errcode = '22023';
  end if;

  safe_name := left(trim(regexp_replace(coalesce(p_player_name, ''), '[<>&"'']', '', 'g')), 8);
  if safe_name = '' then safe_name := '无名豆豆'; end if;

  -- 同一玩家的并发提交串行化，避免同时请求一起穿过频率检查。
  perform pg_advisory_xact_lock(hashtext(p_player_id::text)::bigint);

  -- 同一个 run_id 再交一次只允许同一 player_id 改名字，不重复计入频率限制。
  select player_id into existing_player
  from public.leaderboard_scores
  where run_id = p_run_id;
  if found then
    if existing_player <> p_player_id then
      raise exception 'run id belongs to another player' using errcode = '42501';
    end if;
    update public.leaderboard_scores set player_name = safe_name where run_id = p_run_id;
    return jsonb_build_object('accepted', true, 'duplicate', true, 'run_id', p_run_id);
  end if;

  if p_score is null or p_score <= 0 or p_score > 1000000000000
     or p_level is null or p_level not between 1 and 6
     or p_max_combo is null or p_max_combo not between 1 and 1000000
     or p_duration_ms is null or p_duration_ms not between 1000 and 86400000
     or p_deaths is null or p_deaths not between 0 and 100000
     or p_ghosts_eaten is null or p_ghosts_eaten not between 0 and 1000000
     or p_sweeps is null or p_sweeps not between 0 and 100000
     or p_client_version <> 'web-2026.09.04' then
    raise exception 'invalid score payload' using errcode = '22023';
  end if;

  -- 通关只能发生在第 6 关；到达越后面的关卡，至少需要越长的活跃游戏时间。
  if (coalesce(p_won, false) and p_level <> 6)
     or p_duration_ms < 2500 + ((p_level - 1) * 7500) then
    raise exception 'impossible level timing' using errcode = '22023';
  end if;

  -- 玩家最高约 8 格/秒。这里按 10 次计分动作/秒再加 50 的余量，避免误伤。
  if p_max_combo > 50 + (p_duration_ms / 100) then
    raise exception 'impossible combo rate' using errcode = '22023';
  end if;

  -- 无敌时间和能量持续时间决定了死亡、反击、全灭不可能无限快地增长。
  if p_deaths > 3 + (p_duration_ms / 1500)
     or p_ghosts_eaten > 7 + (p_duration_ms / 500)
     or (p_sweeps::bigint * 4) > p_ghosts_eaten then
    raise exception 'impossible event counts' using errcode = '22023';
  end if;

  -- 15 万分/秒远高于正常连击与敌人悬赏速度，只拦改成天文数字的请求。
  max_plausible_score := 250000 + ((p_duration_ms::bigint * 150000) / 1000);
  if p_score > max_plausible_score then
    raise exception 'impossible score rate' using errcode = '22023';
  end if;

  select count(*) into recent_submissions
  from public.leaderboard_scores
  where player_id = p_player_id
    and played_at >= now() - interval '1 hour';
  if recent_submissions >= 30 then
    raise exception 'submission rate limit exceeded' using errcode = 'P0001';
  end if;

  insert into public.leaderboard_scores (
    run_id, player_id, player_name, score, level, max_combo, won, duration_ms,
    deaths, ghosts_eaten, sweeps, client_version, validation_version
  ) values (
    p_run_id, p_player_id, safe_name, p_score, p_level, p_max_combo, coalesce(p_won, false),
    p_duration_ms, p_deaths, p_ghosts_eaten, p_sweeps, p_client_version, 2
  );

  return jsonb_build_object('accepted', true, 'duplicate', false, 'run_id', p_run_id);
end;
$$;

revoke all on function public.submit_score(uuid,uuid,text,bigint,smallint,integer,boolean,integer,integer,integer,integer,text) from public;
grant execute on function public.submit_score(uuid,uuid,text,bigint,smallint,integer,boolean,integer,integer,integer,integer,text) to anon, authenticated;
