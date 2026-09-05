# Supabase 匿名排行榜

正式网页版已配置排行榜。自建部署请从 `config.example.js` 的关闭配置开始。
未配置或云服务暂时不可用时，游戏本体仍可运行，并继续保存本机纪录。

## 全球竞技大厅

新页面需要额外的只读 RPC `leaderboard_hall`。新增的 `004_leaderboard_hall.sql`
只创建索引和读取函数，不改分、不删旧记录、不改变现有写入校验。经所有者授权，
2026-09-05 已在正式项目安装，生产 PostgreSQL 17.6 权限和 8 项真实只读 HTTP
检查通过；事务内逐行摘要确认现有 1 条成绩未变。自建项目也需先安装 004 并核验。

查询支持当前规则/历史归档、并列名次、分页、真实本人和附近排名。`revision` 用于
防止翻页期间把变化前后的排名拼接。各指标均属于所选的同一最佳单局。完整字段、
版本归属证据及隔离 SQL 验收见 [HALL-DATA.md](HALL-DATA.md)。

结算页先自动保存本机成绩，再由玩家确认公开昵称后提交。网络重试沿用
同一 `run_id`；确认界面加载失败时不会退回自动公开。旧客户端自动提交已由此流程替代。

## 开启步骤

1. 登录 Supabase 并创建 Neon Maze 专用空项目，优先选择 Free 套餐。
2. 确认目标项目后，在同一事务内依次执行 `supabase/migrations/` 下的 `001`、`002`、`003` SQL。`003` 会收回项目默认授予匿名角色的视图写权限，再仅授予 SELECT；已执行前两条的项目也需要补上。
3. 运行 `supabase/checks/preflight.sql` 做只读权限检查，并在隔离测试数据上验证 RPC 的正常提交、重复改名及拒绝非法分数。
4. 在项目 Connect 窗口或 Settings → API Keys 获取 Project URL 和 `sb_publishable_*` 公开密钥。
5. 将 URL 填入 `config.js` 的 `supabase.url`，公开密钥填入 `supabase.publishableKey`。
   `anonKey` 仅供现有旧项目兼容。不要使用或提交 `sb_secret_*` / `service_role`。
6. 安装 `004_leaderboard_hall.sql`，运行 `supabase/checks/hall-preflight.sql` 并只读核验真实 RPC。已有 001–003 的项目仅补装 004，不要因为 CLI 迁移历史为空重新初始化。
7. 真实接口验收后，重新运行 `node 源码/工具/build_web.mjs`，再部署生成的站点。

新版公开密钥只作为 `apikey` 请求头发送，不作为 Bearer JWT；旧 `anonKey` 请求方式保持兼容。
参见 [Supabase 官方密钥说明](https://supabase.com/docs/guides/getting-started/api-keys)。
完整开通步骤和网络验证清单见 [CLOUD-LAUNCH-CHECKLIST.md](CLOUD-LAUNCH-CHECKLIST.md)。

浏览器只能读取 `leaderboard_public` 视图和只读 `leaderboard_hall` RPC，并只能通过 `submit_score` 函数写入。
底表没有开放直接读写权限，公开榜单不会返回完整匿名 `player_id`。练习模式与每日
挑战不上传，正式挑战才会提交成绩。

`002_basic_anti_cheat.sql` 会在数据库写入口校验：

- 同一 `run_id` 只能由原匿名玩家重复提交，重复请求只更新昵称；
- 每个 `player_id` 每小时最多接收 30 个新成绩；
- 通关关卡、最低活跃用时、连击增长速度、死亡/反击/全灭数量必须合理；
- 分数不能超过一个非常宽松的单位时间上限；
- 只接受当前客户端版本，升级游戏时需要同步更新 SQL 中的版本白名单。

这些规则能挡住开发者工具直接改一个天文数字、重复请求和普通脚本刷榜，但匿名
`player_id` 和请求内容最终仍由浏览器提供。纯静态网页无法做到绝对防作弊；若未来
有奖品、现金或竞赛权益，应改为由可信服务端签发一次性运行令牌并复算事件日志。
