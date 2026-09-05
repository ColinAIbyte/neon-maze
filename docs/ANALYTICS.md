# 基础分析配置

分析功能默认关闭。`config.js` 中没有有效 ID 或 token 时，不会加载 Google 或
Cloudflare 的第三方脚本。

## Cloudflare Web Analytics

如果 `playneonmaze.com` 已由 Cloudflare 代理，可直接在 Cloudflare 控制台为该
域名开启 Web Analytics 自动注入，此时 `cloudflareBeaconToken` 保持空白，避免
重复加载。若未使用自动注入，则从 Web Analytics 的 Manage site 复制站点 token，
填入 `config.js`。

Cloudflare 负责页面访问和性能指标；本项目不会向它发送自定义游戏事件。

## GA4

创建 GA4 Web 数据流，把 `G-...` Measurement ID 填入 `ga4MeasurementId`。代码会
关闭 Google Signals 和广告个性化信号，并从 `page_location` 移除查询参数，避免
挑战链接中的名字/分数被发送。默认 `ga4ConsentGranted: false`，即分析存储为拒绝；
如果站点以后加入了符合所在地要求的同意界面，可在用户同意后调用：

```js
window.NeonAnalytics.setConsent(true)
```

自定义事件仅包含：模式、关卡、是否通关、分数区间、活跃时长区间和云榜同步状态。
不会发送精确分数、昵称、匿名 `player_id` 或挑战链接参数。启用 GA4 前仍应根据站点
面向地区核对隐私政策与同意要求。
