// 网页外壳：<!DOCTYPE> + <head> + 整页样式。
//
// 单独抽出来，是因为它有两个使用者，而它们必须一模一样：
//   build_web.mjs      → 根目录 index.html，并镜像到 发布到网站/
//   make_testbuild.mjs → 工具/测试版.html（用来验排版的）
//
// 之前测试版是直接写 neon_maze_fragment.html 的裸片段，没有 <meta viewport>。
// 后果很隐蔽：测试版在手机宽度下按 980px 桌面宽排版，量出来的坐标、发现的
// 排版问题，跟真正发布的那份根本不是一回事——拿一个排版不对的构建去验排版，
// 等于白验。共用同一个 wrap()，测试版和线上版的外壳就不可能再走偏。
const TITLE = 'Neon Maze · 豆豆';
const DESC  = '原创霓虹迷宫游戏，六关递进。收集 · 强化 · 智取。';
const AUTHOR = '超级奶爸';
const SITE_URL = 'https://playneonmaze.com/';
const SOCIAL_IMAGE = SITE_URL + 'assets/neon-maze-share.jpg';

export { TITLE, DESC, AUTHOR, SITE_URL, SOCIAL_IMAGE };

// Keep source commentary for maintainers, but do not ship HTML-only notes.
// Raw script/style blocks are returned byte-for-byte, including comment-like
// strings. No JS minification, execution-order changes, or new build dependencies.
export function stripBuildComments(fragment){
  return fragment.replace(/<script\b[^>]*>[\s\S]*?<\/script>|<style\b[^>]*>[\s\S]*?<\/style>|(?:^[\t ]*)?<!--[\s\S]*?-->(?:[\t ]*(?=\r?$))?|<(?:"[^"]*"|'[^']*'|[^'">])*?>/gim,
    part=>part.trimStart().startsWith('<!--') ? '' : part);
}

/**
 * 把游戏片段包成一个完整网页。
 * @param {string} fragment  neon_maze_fragment.html 的内容（可能已注入测试钩子）
 * @param {string} titleSuffix  测试版加个后缀，免得跟正式版的标签页混淆
 */
export function wrap(fragment, titleSuffix = ''){
  const title = TITLE + titleSuffix;
  return `<!DOCTYPE html>
<html lang="zh-CN">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1, minimum-scale=1, user-scalable=no, viewport-fit=cover">
<title>${title}</title>
<meta name="description" content="${DESC}">
<meta name="author" content="${AUTHOR}">
<meta name="theme-color" content="#020218">
<link rel="canonical" href="${SITE_URL}">
<link rel="alternate" hreflang="zh-Hans" href="${SITE_URL}">
<link rel="alternate" hreflang="en" href="${SITE_URL}en/">
<link rel="alternate" hreflang="x-default" href="${SITE_URL}">
<link rel="icon" href="assets/favicon.svg" type="image/svg+xml">
<link rel="icon" href="assets/favicon-32.png" type="image/png" sizes="32x32">
<link rel="apple-touch-icon" href="assets/apple-touch-icon.png" sizes="180x180">
<!-- 不根据 IP 强制跳转，也不把访客 IP 发给第三方。首次访问只参考浏览器
     语言显示轻提示；玩家手动点过中 / EN 后，手动选择永远优先。 -->
<script src="assets/language-router.js" data-current-language="zh"></script>
<!-- 加到手机主屏后按全屏应用打开，而不是套一层浏览器地址栏 -->
<meta name="apple-mobile-web-app-capable" content="yes">
<meta name="apple-mobile-web-app-status-bar-style" content="black-translucent">
<meta name="mobile-web-app-capable" content="yes">
<!-- 分享到微信/群里时的卡片。缺了这些，别人看到的只有一条光秃秃的网址 -->
<meta property="og:type" content="website">
<meta property="og:title" content="${TITLE}">
<meta property="og:description" content="${DESC}">
<meta property="og:url" content="${SITE_URL}">
<meta property="og:locale" content="zh_CN">
<meta property="og:locale:alternate" content="en_US">
<meta property="og:image" content="${SOCIAL_IMAGE}">
<meta property="og:image:secure_url" content="${SOCIAL_IMAGE}">
<meta property="og:image:type" content="image/jpeg">
<meta property="og:image:width" content="1200">
<meta property="og:image:height" content="630">
<meta property="og:image:alt" content="Neon Maze 与原创主角豆豆">
<meta name="twitter:card" content="summary_large_image">
<meta name="twitter:title" content="${TITLE}">
<meta name="twitter:description" content="${DESC}">
<meta name="twitter:image" content="${SOCIAL_IMAGE}">
<meta name="twitter:image:alt" content="Neon Maze 与原创主角豆豆">
<!-- Optional cloud and analytics configuration, disabled by default. -->
<script src="config.js"></script>
<script src="analytics.js"></script>
<link rel="stylesheet" href="assets/leaderboard-hall.css">
<link rel="stylesheet" href="assets/leaderboard-entry.css">
<style>
/* 整页锁死不滚动。手机上边玩边让页面上下弹是最影响手感的一件事，
   而 iOS Safari 的橡皮筋回弹默认就会这么干。
   touch-action:manipulation 是锁死缩放的第一道——它明确关掉双击放大，
   而 viewport 里的 user-scalable=no 在 iOS Safari 上是被无视的。 */
html, body {
  margin:0; padding:0;
  width:100%; height:100%;
  background:#020218;
  overscroll-behavior:none;
  -webkit-text-size-adjust:100%;
  touch-action:manipulation;
}
body {
  display:flex; align-items:center; justify-content:center;
  padding:env(safe-area-inset-top) env(safe-area-inset-right) env(safe-area-inset-bottom) env(safe-area-inset-left);
  box-sizing:border-box;
  overflow:hidden;
}
/* 连点方向键时那层灰色高亮很碍眼 */
* { -webkit-tap-highlight-color:transparent; }
.language-suggestion {
  position:fixed;
  top:calc(env(safe-area-inset-top) + 8px);
  right:calc(env(safe-area-inset-right) + 112px);
  z-index:119;
  display:flex;
  align-items:center;
  gap:8px;
  max-width:calc(100vw - 128px);
  min-height:38px;
  padding:3px 4px 3px 12px;
  box-sizing:border-box;
  border:1px solid rgba(255,207,92,.55);
  border-radius:999px;
  color:#f5f2ff;
  background:rgba(5,7,31,.96);
  box-shadow:0 7px 24px rgba(0,0,0,.38),0 0 16px rgba(255,207,92,.12);
  font:600 12px/1.2 system-ui,-apple-system,"Segoe UI",sans-serif;
}
.in-game .language-suggestion { display:none; }
.language-suggestion a {
  color:#ffdb72;
  white-space:nowrap;
  text-decoration:none;
}
.language-suggestion a:hover,.language-suggestion a:focus-visible { text-decoration:underline; }
.language-suggestion button {
  width:30px;
  height:30px;
  flex:0 0 auto;
  padding:0;
  border:0;
  border-radius:50%;
  color:#c9c4e7;
  background:transparent;
  font:400 20px/30px system-ui,sans-serif;
  cursor:pointer;
}
.language-suggestion button:hover,.language-suggestion button:focus-visible {
  color:#fff;
  background:rgba(255,255,255,.09);
}
@media (max-width:639px) {
  .language-suggestion span { display:none; }
}
</style>
</head>
<body>
${stripBuildComments(fragment)}
<script src="assets/leaderboard-hall.js"></script>
<script src="assets/leaderboard-bridge.js"></script>
</body>
</html>
`;
}
