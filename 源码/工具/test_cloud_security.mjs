import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';

const first = readFileSync(new URL('../../supabase/migrations/001_leaderboard.sql', import.meta.url),'utf8');
const second = readFileSync(new URL('../../supabase/migrations/002_basic_anti_cheat.sql', import.meta.url),'utf8');
const third = readFileSync(new URL('../../supabase/migrations/003_public_view_readonly.sql', import.meta.url),'utf8');

assert.match(first,/enable row level security/i);
assert.match(first,/revoke all on table public\.leaderboard_scores from anon, authenticated/i);
assert.match(first,/security definer/i);
assert.match(third,/revoke all on table public\.leaderboard_public from public, anon, authenticated/i);
assert.match(third,/grant select on table public\.leaderboard_public to anon, authenticated/i);
assert.doesNotMatch(first,/service_role|secret/i);
assert.match(second,/pg_advisory_xact_lock/i);
assert.match(second,/recent_submissions\s*>=\s*30/i);
assert.match(second,/p_client_version\s*<>\s*'web-2026\.09\.04'/i);
assert.match(second,/p_duration_ms\s*<\s*2500/i);
assert.match(second,/p_max_combo\s*>\s*50/i);
assert.match(second,/p_sweeps::bigint \* 4/i);
assert.match(second,/impossible score rate/i);
assert.match(second,/validation_version\)\s*\n\s*\) values|validation_version\s*\n\s*\) values/i);

console.log('✓ 云端底表无匿名直写；RPC 含幂等、串行限频、版本与成绩合理性校验');
