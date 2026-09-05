-- Read-only structural acceptance after 004. Does not read real player scores,
-- call submit_score, modify grants, or create/delete any test data.
with target as (
  select to_regprocedure('public.leaderboard_hall(uuid,text,integer,integer,boolean)') as oid
), inspected as (
  select p.oid, p.prosecdef, p.provolatile, p.proconfig,
         pg_get_userbyid(p.proowner) as owner,
         not exists (
           select 1 from aclexplode(coalesce(p.proacl, acldefault('f',p.proowner))) a
           where a.grantee=0 and a.privilege_type='EXECUTE'
         ) as no_public_execute
  from target t left join pg_proc p on p.oid=t.oid
)
select case when oid is not null and prosecdef and provolatile='s'
                 and proconfig @> array['search_path=pg_catalog, pg_temp']::text[]
                 and owner not in ('anon','authenticated') and no_public_execute
            then 'PASS' else 'FAIL' end as result,
       'hall function ownership/search path/read stability' as check_name, owner, proconfig
from inspected;

with roles(name) as (values ('anon'),('authenticated')),
inspected as (
  select name,
    has_function_privilege(name,'public.leaderboard_hall(uuid,text,integer,integer,boolean)','EXECUTE') as can_execute,
    has_table_privilege(name,'public.leaderboard_scores','SELECT,INSERT,UPDATE,DELETE,TRUNCATE,REFERENCES,TRIGGER') as table_access,
    has_any_column_privilege(name,'public.leaderboard_scores','SELECT,INSERT,UPDATE,REFERENCES') as column_access,
    has_table_privilege(name,'public.leaderboard_public','INSERT,UPDATE,DELETE,TRUNCATE,REFERENCES,TRIGGER') as view_write,
    has_schema_privilege(name,'public','CREATE') as schema_create
  from roles
)
select case when can_execute and not table_access and not column_access and not view_write and not schema_create
            then 'PASS' else 'FAIL' end as result,
       name, can_execute, table_access, column_access, view_write, schema_create
from inspected;

select case when relrowsecurity then 'PASS' else 'FAIL' end as result,
       'base table RLS remains enabled' as check_name
from pg_class where oid='public.leaderboard_scores'::regclass;

select pg_get_functiondef(to_regprocedure('public.leaderboard_hall(uuid,text,integer,integer,boolean)'))
  as hall_definition_for_review;
