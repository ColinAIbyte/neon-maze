-- Neon Maze 匿名排行榜基础表、只读视图与唯一写入口。
-- 在 Supabase SQL Editor 中执行；浏览器只使用 anon key 调用 submit_score。

create table if not exists public.leaderboard_scores (
  id bigint generated always as identity primary key,
  run_id uuid not null unique,
  player_id uuid not null,
  player_name text not null,
  score bigint not null check (score > 0 and score <= 1000000000000),
  level smallint not null check (level between 1 and 6),
  max_combo integer not null check (max_combo between 1 and 1000000),
  won boolean not null,
  duration_ms integer not null check (duration_ms between 1000 and 86400000),
  deaths integer not null check (deaths between 0 and 100000),
  ghosts_eaten integer not null check (ghosts_eaten between 0 and 1000000),
  sweeps integer not null check (sweeps between 0 and 100000),
  client_version text not null check (char_length(client_version) between 1 and 32),
  played_at timestamptz not null default now()
);

create index if not exists leaderboard_scores_score_idx
  on public.leaderboard_scores (score desc, played_at asc);
create index if not exists leaderboard_scores_player_idx
  on public.leaderboard_scores (player_id, score desc);

alter table public.leaderboard_scores enable row level security;
revoke all on table public.leaderboard_scores from anon, authenticated;

create or replace view public.leaderboard_public
with (security_invoker = false)
as
select player_name, score, level, max_combo, won, played_at
from (
  select player_name, score, level, max_combo, won, played_at,
         row_number() over (partition by player_id order by score desc, played_at asc) as player_place
  from public.leaderboard_scores
) ranked
where player_place = 1;

revoke all on table public.leaderboard_public from public;
grant select on table public.leaderboard_public to anon, authenticated;

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
begin
  if p_player_id is null or p_player_id = '00000000-0000-0000-0000-000000000000'::uuid
     or p_run_id is null or p_run_id = '00000000-0000-0000-0000-000000000000'::uuid then
    raise exception 'invalid anonymous id' using errcode = '22023';
  end if;
  if p_score is null or p_score <= 0 or p_score > 1000000000000
     or p_level is null or p_level not between 1 and 6
     or p_max_combo is null or p_max_combo not between 1 and 1000000
     or p_duration_ms is null or p_duration_ms not between 1000 and 86400000
     or p_deaths is null or p_deaths not between 0 and 100000
     or p_ghosts_eaten is null or p_ghosts_eaten not between 0 and 1000000
     or p_sweeps is null or p_sweeps not between 0 and 100000
     or p_client_version is null or char_length(p_client_version) not between 1 and 32 then
    raise exception 'invalid score payload' using errcode = '22023';
  end if;

  safe_name := left(trim(regexp_replace(coalesce(p_player_name, ''), '[<>&"'']', '', 'g')), 8);
  if safe_name = '' then safe_name := '无名豆豆'; end if;

  insert into public.leaderboard_scores (
    run_id, player_id, player_name, score, level, max_combo, won, duration_ms,
    deaths, ghosts_eaten, sweeps, client_version
  ) values (
    p_run_id, p_player_id, safe_name, p_score, p_level, p_max_combo, coalesce(p_won, false),
    p_duration_ms, p_deaths, p_ghosts_eaten, p_sweeps, left(p_client_version, 32)
  )
  on conflict (run_id) do update
    set player_name = excluded.player_name
    where leaderboard_scores.player_id = excluded.player_id;

  if not found then
    raise exception 'run id belongs to another player' using errcode = '42501';
  end if;
  return jsonb_build_object('accepted', true, 'run_id', p_run_id);
end;
$$;

revoke all on function public.submit_score(uuid,uuid,text,bigint,smallint,integer,boolean,integer,integer,integer,integer,text) from public;
grant execute on function public.submit_score(uuid,uuid,text,bigint,smallint,integer,boolean,integer,integer,integer,integer,text) to anon, authenticated;
