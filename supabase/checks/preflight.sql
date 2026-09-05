-- Neon Maze 云榜只读结构检查。建议在专用空项目完成 001、002 后运行。
-- 本文件只查询系统目录和权限；不读取成绩、不执行 submit_score、不写入任何数据。
-- PASS 仅代表对应结构条件满足，不能替代真实 API / 并发 / 防刷验收。
-- 客户端版本如变更，必须同步本文件的 expected_client_version 和迁移白名单。

-- 1. 底表存在、开启 RLS，且两个浏览器角色没有表级或列级读写权限。
with target as (
  select pg_catalog.to_regclass('public.leaderboard_scores') as table_oid
), expected_roles(role_name) as (
  values ('anon'), ('authenticated')
), inspected as (
  select e.role_name, r.oid as role_oid, c.oid as table_oid,
         c.relkind, c.relrowsecurity as rls_enabled,
         pg_catalog.pg_get_userbyid(c.relowner) as table_owner,
         pg_catalog.has_table_privilege(r.oid, c.oid,
           'SELECT,INSERT,UPDATE,DELETE,TRUNCATE,REFERENCES,TRIGGER')
           as has_any_table_privilege,
         pg_catalog.has_any_column_privilege(r.oid, c.oid,
           'SELECT,INSERT,UPDATE,REFERENCES') as has_any_column_privilege,
         exists (
           select 1 from pg_catalog.pg_attribute a
           where a.attrelid = c.oid and a.attname = 'validation_version'
             and a.attnum > 0 and not a.attisdropped
         ) as validation_version_column_exists
  from target t
  cross join expected_roles e
  left join pg_catalog.pg_roles r on r.rolname = e.role_name
  left join pg_catalog.pg_class c on c.oid = t.table_oid
)
select case when role_oid is not null and table_oid is not null
                 and relkind = 'r' and rls_enabled
                 and not has_any_table_privilege and not has_any_column_privilege
                 and validation_version_column_exists
            then 'PASS' else 'FAIL' end as result,
       role_name, table_owner, rls_enabled,
       has_any_table_privilege, has_any_column_privilege,
       validation_version_column_exists
from inspected;

-- 2. 公开视图仅有约定六列，不能泄漏 id / player_id / run_id；两个角色可读不可改。
with target as (
  select pg_catalog.to_regclass('public.leaderboard_public') as view_oid
), expected_roles(role_name) as (
  values ('anon'), ('authenticated')
), columns as (
  select array_agg(a.attname::text order by a.attnum) as exposed_columns
  from target t
  join pg_catalog.pg_attribute a on a.attrelid = t.view_oid
  where a.attnum > 0 and not a.attisdropped
), inspected as (
  select e.role_name, r.oid as role_oid, c.oid as view_oid, c.relkind,
         pg_catalog.pg_get_userbyid(c.relowner) as view_owner,
         c.reloptions as view_options, cols.exposed_columns,
         cols.exposed_columns = array[
           'player_name','score','level','max_combo','won','played_at'
         ]::text[] as exact_public_columns,
         pg_catalog.has_table_privilege(r.oid, c.oid, 'SELECT') as can_read,
         pg_catalog.has_table_privilege(r.oid, c.oid,
           'INSERT,UPDATE,DELETE,TRUNCATE,REFERENCES,TRIGGER') as has_write_grant,
         pg_catalog.has_any_column_privilege(r.oid, c.oid,
           'INSERT,UPDATE,REFERENCES') as has_column_write_grant
  from target t
  cross join expected_roles e
  cross join columns cols
  left join pg_catalog.pg_roles r on r.rolname = e.role_name
  left join pg_catalog.pg_class c on c.oid = t.view_oid
)
select case when role_oid is not null and view_oid is not null and relkind = 'v'
                 and exact_public_columns and can_read
                 and not has_write_grant and not has_column_write_grant
            then 'PASS' else 'FAIL' end as result,
       role_name, view_owner, view_options, exposed_columns,
       can_read, has_write_grant, has_column_write_grant
from inspected;

-- 3. RPC 精确签名存在、采用显式搜索路径、仅指定角色可执行；检查版本常量。
-- definition_versions / function_settings 需人工复核；匹配字符串不证明完整校验有效。
with target as (
  select pg_catalog.to_regprocedure(
    'public.submit_score(uuid,uuid,text,bigint,smallint,integer,boolean,integer,integer,integer,integer,text)'
  ) as function_oid,
  'web-2026.09.04'::text as expected_client_version
), inspected as (
  select t.expected_client_version, p.oid as function_oid, p.prosecdef,
         p.proconfig as function_settings,
         pg_catalog.pg_get_userbyid(p.proowner) as function_owner,
         pg_catalog.has_function_privilege(a.oid, p.oid, 'EXECUTE') as anon_can_execute,
         pg_catalog.has_function_privilege(u.oid, p.oid, 'EXECUTE') as authenticated_can_execute,
         exists (
           select 1 from pg_catalog.aclexplode(
             coalesce(p.proacl, pg_catalog.acldefault('f', p.proowner))
           ) acl where acl.grantee = 0 and acl.privilege_type = 'EXECUTE'
         ) as public_can_execute,
         exists (
           select 1 from unnest(p.proconfig) setting
           where setting like 'search_path=%'
         ) as explicit_search_path,
         pg_catalog.pg_get_functiondef(p.oid) as definition
  from target t
  left join pg_catalog.pg_proc p on p.oid = t.function_oid
  left join pg_catalog.pg_roles a on a.rolname = 'anon'
  left join pg_catalog.pg_roles u on u.rolname = 'authenticated'
)
select case when function_oid is not null and prosecdef and explicit_search_path
                 and anon_can_execute and authenticated_can_execute
                 and not public_can_execute
                 and strpos(definition, expected_client_version) > 0
            then 'PASS' else 'FAIL' end as result,
       function_owner, prosecdef as security_definer, function_settings,
       anon_can_execute, authenticated_can_execute, public_can_execute,
       expected_client_version,
       array(select distinct m[1]
             from pg_catalog.regexp_matches(definition,
               '(web-[0-9]{4}\.[0-9]{2}\.[0-9]{2})', 'g') m) as definition_versions
from inspected;

-- 4. public schema 不应允许匿名角色创建对象，避免影响 SECURITY DEFINER 名称解析。
with expected_roles(role_name) as (
  values ('anon'), ('authenticated')
)
select case when r.oid is not null and n.oid is not null
                 and not pg_catalog.has_schema_privilege(r.oid, n.oid, 'CREATE')
            then 'PASS' else 'FAIL' end as result,
       e.role_name,
       pg_catalog.has_schema_privilege(r.oid, n.oid, 'USAGE') as schema_usage,
       pg_catalog.has_schema_privilege(r.oid, n.oid, 'CREATE') as schema_create
from expected_roles e
left join pg_catalog.pg_roles r on r.rolname = e.role_name
left join pg_catalog.pg_namespace n on n.nspname = 'public';

-- PUBLIC 是隐式角色集合，单独显示其 schema CREATE 授权。
select case when not exists (
         select 1 from pg_catalog.aclexplode(
           coalesce(n.nspacl, pg_catalog.acldefault('n', n.nspowner))
         ) acl where acl.grantee = 0 and acl.privilege_type = 'CREATE'
       ) then 'PASS' else 'FAIL' end as result,
       'PUBLIC schema CREATE' as check_name
from pg_catalog.pg_namespace n where n.nspname = 'public';

-- 5. 输出视图定义供人工核对：应为每名玩家最高分的公开字段投影。
-- 不访问该视图里的任何玩家记录。
select pg_catalog.pg_get_viewdef(
  pg_catalog.to_regclass('public.leaderboard_public'), true
) as public_view_definition;
