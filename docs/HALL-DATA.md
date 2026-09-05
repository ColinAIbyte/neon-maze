# 全球竞技大厅：第一阶段数据契约

状态：经所有者本次“发布”授权，`004_leaderboard_hall.sql` 已于 2026-09-05 在生产安装并通过真实只读 HTTP 验证；没有向正式榜写测试数据。开发阶段 PostgreSQL WASM 测试与下文独立生产核验分开记录，不代表真机验收。

## 已核对的基线与规则边界

- 现有底表 `leaderboard_scores` 按唯一 `run_id` 存储每局。匿名 `player_id` 是稳定去重依据，昵称不是身份。重复提交同一局只更新昵称，较低分的另一局不会覆盖最佳局。
- Git `6832958` 已引入连击项目再加 30%、连击基础时间 1.76 秒、敌人基础速度 2.35 格/秒等规则。`9e502bb` 在这些改动之后合并云榜代码，并使用 `CLIENT_VERSION = 'web-2026.09.04'`；当前生产提交 `6e452ee` 保留这些计分常量及版本。
- 首版当前规则榜只接受数据库记录中 `client_version = 'web-2026.09.04'` 的已存成绩。其他版本不推测规则、不乘 1.3，放在 `history` 归档。`unverified-history` 意味着规则未核实，不是一个统一竞技规则；历史页不得宣传为与当前规则可比的正式比赛。
- **客户端版本是规则分组声明，不是可信反作弊证明。** 现有写入口做基本时长、事件数量、速率检查，但匿名静态客户端仍可能伪造请求；不能用于有奖强对抗赛事。
- “同关失败三次后慢 10%”辅助仍然包含在当前规则中。现有记录没有是否触发辅助的字段，不能推断某位玩家是否使用，也不能显示“无辅助”荣誉。本次不改玩法、不偷偷排除既有成绩。
- 练习和每日挑战继续只保存本机，不提交正式榜。每关星星、图鉴、解锁是本机资料，不能拿来展示其他玩家的云端成就。

## 请求与返回

使用现有公开客户端密钥，`POST /rest/v1/rpc/leaderboard_hall`：

```json
{
  "p_player_id": null,
  "p_scope": "current",
  "p_offset": 0,
  "p_limit": 25,
  "p_near": false
}
```

`p_player_id` 可为空；有值时只用于计算本人和附近位置。不是登录凭据，清除浏览器数据或换设备不会自动找回身份。中英文同域共用同一本机玩家 UUID。

- `p_scope`：仅 `current` / `history`。
- `p_offset`：0–1,000,000；`p_limit`：1–100。非法或显式空值拒绝（SQLSTATE `22023`），不静默扩大查询。
- `p_near=true`：忽略常规分页位置，返回本人前后各最多三名；本人不存在时返回空 `rows`，不能推断为第 0 名。`has_more=false`，不把附近窗口当作整榜分页。
- 普通分页 `has_more` 由服务端完整数据计算。`mine` 不受当前页限制，不能因本人不在当前页而显示未上榜。

返回字段：

| 字段 | 含义 |
|---|---|
| `scope` / `rule_version` | 查询范围和已核实规则标识；归档为 `unverified-history` |
| `revision` | 当前范围完整公开榜单的稳定 MD5 等值标记，用于拒绝跨快照拼接分页；不是安全签名 |
| `total` | 范围内有记录的去重玩家数，不是总对局数或网站访客数 |
| `updated_at` | **服务器本次读取快照时间**，不是最后一局提交/昵称修改时间 |
| `rows` | 此页或本人附近的真实最好单局记录 |
| `podium` | 位置 1–3 的最多三条真实记录；人数不足不补假数据 |
| `mine` | 本人该范围的最佳单局及全榜排名；没有则 `null` |
| `next` | 分数严格高于本人、且差距最小的目标；没有则 `null` |
| `next_gap` | `next.score - mine.score + 1`，明确为**严格超过**目标所需分数 |
| `offset` / `has_more` | 当前输出窗口位置、普通分页是否还有更多 |

每条记录只返回：`rank, position, name, score, level, combo, won, played_at, is_me`。

- `rank` 为竞争排名：例如 1、1、3。同分并列，不以用时或日期区别竞技名次。
- `position` 是稳定展示次序：总分降序，服务器记录时间升序，再按内部记录 ID 升序。后两项仅用于确定页边界和展示顺序。领奖台可能出现两位并列冠军，UI 不得把第二个位置错误标为“排名第二”。
- 每位玩家只取该范围的一局：最高分，若同分则保留较早局，再以 ID 稳定选择。所有通关、连击等字段均来自该局，不拼接生涯最佳指标。
- `played_at` 是现有服务器首次接收该局的时间，不是经可信计时证明的实际游戏完成时间。客户端延迟提交时必须避免过度解释。
- JSON 不包含其他人的 `player_id` / `run_id` / 内部 ID。长昵称属于不可信数据，前端必须以 `textContent` 等安全方式呈现，禁止把昵称直接拼入 HTML。
- 最大合法分数 1,000,000,000,000 可精确表示为 JavaScript 安全整数，主成绩应展示完整千位分隔数字。

同一次 RPC 的全部列表、冠军、本人、目标和总人数在同一读取快照中计算。`revision` 对范围名称及按 `position` 排序的全部公开记录计算，包括公开昵称、排名、分数和 `is_me`，不含私有 ID，也不含每次变化的读取时间。公开最佳局、昵称、名次、玩家集合变化时 revision 改变；未上榜的较低局不改变。此标记仅用于检测等值，不用于反作弊或身份验证；包含 `is_me`，不能跨玩家身份共用缓存。

翻页期间真实榜单可能改变；客户端追加页前必须比对 revision，若不同，丢弃旧页并重载首屏，不能拼接出重复/遗漏后再将新 `updated_at` 当作整个列表的新鲜时间。相同 revision 才允许追加，并防重复。`updated_at` 必须随缓存保留；使用缓存时标明更新时间，不能以旧读取结果宣称刚提交的局已改变排名。

## 第一阶段字段范围

已真实接入并公开：昵称、最佳单局总分、到达关卡、是否通关、该局最高连击、服务器记录时间，以及从这些行计算的名次、参赛人数、下一名差分。

已在底表采集但**本阶段不新增公开**：`duration_ms`、`deaths`、`ghosts_eaten`、`sweeps`。因此其他玩家成绩详情不能杜撰这些内容，也不能把昵称相同的本机对局拼进去。

目前未采集/不能可靠还原：剩余生命、能量点数量、无伤关卡数、受伤次数独立于死亡次数、各计分项目总和、辅助触发标记、规则签名、跨设备账号、历史排名快照。隐藏这些字段或标注暂无记录，不生成虚假成绩分解/全程无伤荣誉。

本周榜和真实排名变化属于第二阶段。首版不把历史最好成绩自动放进本周榜，也不从本机排名冒充全球排名提升。排行榜按一局最终总分排名，不展示为终身累积分数。

## 安全边界与迁移

004 新增一个规则/玩家/分数索引和只读 `SECURITY DEFINER` 函数，不改 001–003、不回填/重算/删除成绩，不改变 `submit_score` 参数或验证逻辑。

函数固定 `search_path = pg_catalog, pg_temp`，显式使用 `public.leaderboard_scores`，无动态 SQL，撤销 `PUBLIC`、`anon`、`authenticated` 默认执行权限后仅向后两者授予 EXECUTE。底表 RLS 和拒绝浏览器角色直接读写的权限保持不变。公开行只由显式 JSON 白名单构造。

当前项目 001–003 是 SQL Editor 手动安装，CLI 迁移历史可能为空；不能因此重新初始化数据库。发布前应核对实际对象，授权后只安装 004，执行 `supabase/checks/hall-preflight.sql` 的只读检查，再用公开角色验证真实 RPC。第一阶段 UI 没有 004 时必须显示“服务待升级/读取失败”，不能回退到不分规则的旧视图并宣称真实本人排名。

此函数限制输出最多 100 行，但准确的全榜排名仍需扫描/排序范围内成绩。首版适合少量真实玩家；增长后应监测查询时延并考虑受控缓存/物化读模型。不能因为有分页就宣称已完成大规模压测或强抗滥用。

## 可复现的隔离 SQL 测试

测试依赖仅安装在外部临时目录，**不是游戏运行依赖**；不修改仓库锁文件、不执行第三方安装脚本。已核实的固定版本为 `@electric-sql/pglite@0.5.8`，npm 分发完整性：

```text
sha512-n9tsbUOhwx2epK1V0ZG9Ar4SHWUju04dhmzZXiSBXwBoleOvIfals33NAaWgagQVAL4Rbvx/Ptsu3P+pA09f6Q==
```

先以 `mktemp -d` 创建专用测试目录，在该目录安装上述固定依赖（`npm install --ignore-scripts --no-audit --no-fund --save-exact @electric-sql/pglite@0.5.8`）。然后运行：

```bash
NEON_PGLITE_MODULE=/absolute/test-directory/node_modules/@electric-sql/pglite/dist/index.js node 源码/工具/test_hall_database.mjs
```

脚本无远程 URL/连接参数，只能创建内存数据库；缺少引擎直接报错，不假装跳过为通过。它在 PostgreSQL WASM 引擎实际执行 001–004 两次、匿名/认证角色权限、0/1/2/3/100 人、并列、完整大分数、长昵称、分页、本人榜外、附近、版本隔离、请求约束、唯一对局重试、低分不覆盖等测试。仅合成内存数据会被清理，不接触正式玩家。

PGlite 是 PostgreSQL 的单进程 WASM 构建，因此这是实际 SQL/角色执行测试，但**不是**真实 Supabase API、HTTP 权限令牌、并发多连接、网络或生产验收。参考：[PGlite API](https://pglite.dev/docs/api)、[PostgreSQL 窗口函数](https://www.postgresql.org/docs/current/functions-window.html)、[安全 SECURITY DEFINER](https://www.postgresql.org/docs/current/sql-createfunction.html)。

### 本次执行证据（2026-09-05）

- 执行环境：`PostgreSQL 18.3 (PGlite 0.5.8)`，内存单连接。生产为 PostgreSQL 17.6，本次未连接生产。
- 大厅数据库测试：28 项全部通过（包括 001–004 在宽松默认权限下重复应用两次，以及 revision 稳定、分页一致、新玩家/更好局/同局改名变更、较低局不变）。
- 既有 `supabase/checks/transaction-tests.sql`：23 项全部通过，32 条合成数据在内存事务中回滚。
- `supabase/checks/hall-preflight.sql`：4 项结构/权限结果全部 PASS。
- `node 源码/工具/test_cloud_security.mjs`：通过。
- 004 迁移 SHA-256：`ff0b8ee3b91e6cc22f7608ff21a117cf9f5417a9162eeed34abcb54604e80b9a`。
- 大厅数据库测试脚本 SHA-256：`2485e0e17bcf14f6fa72a0d900b6cf966f98671a4d4fd04e260d24df5e7983a7`。

以上为隔离开发测试，不与下列真实生产核验混称。仍未验证并发读写快照压力、大规模性能、真实手机与国内微信网络。

### 授权发布的生产核验（2026-09-05）

- 生产 PostgreSQL 17.6：仅新增 004；事务内临时摘要前后比对，现有 1 条成绩逐行不变。
- 函数 owner 非浏览器角色、稳定只读、固定 search_path、PUBLIC 无 EXECUTE；anon/authenticated 只拥有 RPC EXECUTE，底表与列无直接读写权限，视图无写权限，RLS 保持启用。
- 真实公开 HTTP 共 8 项通过：当前榜、相同 revision、历史空榜、榜外分页、未上榜附近、非法 scope 拒绝、底表读取拒绝、旧公开视图成绩不变。
- 正式当前榜 1 位玩家，最佳单局 12,663,021，已通关，连击 ×159。没有生成测试对局，也没有调用生产 `submit_score`。
- 原始证据在项目持久目录 `交付/2026-09-05/排行榜大厅验收/`：`production-install-result.txt`、`production-permissions.txt`、`production-api.json`。迁移 SHA-256 同上。
