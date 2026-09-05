-- Supabase may grant default table/view privileges to browser roles.
-- Revoking PUBLIC alone does not remove explicit anon/authenticated grants.
-- The public leaderboard must expose SELECT only, regardless of project defaults.
revoke all on table public.leaderboard_public from public, anon, authenticated;
grant select on table public.leaderboard_public to anon, authenticated;
