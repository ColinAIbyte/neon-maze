// 打一份能上传到 CrazyGames 的整站目录（Full Launch）。
//   用法: node build_crazygames.mjs
//   产物: crazygames上传包/neon-maze/   —— 整个文件夹拖进他们的上传框
//
// 为什么是**目录**不是 zip：CrazyGames 的上传框是个 webkitdirectory 的文件夹
// 选择器，前端靠每个文件的 webkitRelativePath 还原目录结构，而且他们代码里
// 明写着「Archive files are not supported」。传 zip 会被直接拒。
//
// 这份包和其他渠道的唯一区别，全部集中在下面注入的三行 <script> 里：
//   1. NEON_CHANNEL='crazygames' —— 成绩写进共用榜时带上渠道标记，
//      否则三个网页渠道写的 client_version 一模一样，永远分不出谁在玩。
//   2. CrazyGames SDK —— Full Launch 的前提，没有它拿不到广告分成。
//   3. crazygames-adapter.js —— 把 NeonGame 的状态翻译成 SDK 事件，
//      并在一局结束时插一条中插广告。
//
// 隔离是靠「别的构建根本不打包这些东西」实现的，不是靠运行时 if。
// test_channel_isolation.mjs 会反过来验证：web / 微信 / itch 三个产物里
// 不许出现 SDK 地址、适配层文件名或 NEON_CHANNEL。
//
// NEON_DIR_INDEX 沿用 itch 那套：他们的 CDN 同样不把 `dir/` 映射到
// `dir/index.html`，不补这一手，语言路由一跳 en/ 就 404。
import { fileURLToPath } from 'node:url';
import { readFileSync, writeFileSync, mkdirSync, rmSync, existsSync, cpSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';

const here = p => fileURLToPath(new URL(p, import.meta.url));
const ROOT = here('../../');
const OUT_DIR = here('../../crazygames上传包');
const STAGE = `${OUT_DIR}/neon-maze`;

const SDK_URL = 'https://sdk.crazygames.com/crazygames-sdk-v3.js';
/* 适配层的**源头**在 源码/渠道/，不在 assets/ —— 那个目录会被 itch 和网页版
   整目录拷贝，放那里等于把广告代码发到所有渠道。进包后才落到 assets/ 下。 */
const ADAPTER_SRC = here('../渠道/crazygames-adapter.js');
const ADAPTER = 'assets/crazygames-adapter.js';

const FILES = ['index.html', '404.html', 'config.js', 'analytics.js'];
const DIRS  = ['assets', 'en', 'leaderboard', 'privacy'];

for (const f of [...FILES, ...DIRS]){
  if (!existsSync(join(ROOT, f))){
    console.error(`缺 ${f} —— 先跑 node build_web.mjs`);
    process.exit(1);
  }
}
if (!existsSync(ADAPTER_SRC)){
  console.error('缺 源码/渠道/crazygames-adapter.js');
  process.exit(1);
}

rmSync(STAGE, { recursive: true, force: true });
mkdirSync(STAGE, { recursive: true });
for (const f of FILES) cpSync(join(ROOT, f), join(STAGE, f));
for (const d of DIRS)  cpSync(join(ROOT, d), join(STAGE, d), { recursive: true });
cpSync(ADAPTER_SRC, join(STAGE, ADAPTER));

function walk(dir){
  return readdirSync(dir).flatMap(name => {
    const full = join(dir, name);
    return statSync(full).isDirectory() ? walk(full) : [full];
  });
}

/* 调试钩子绝不能上线。整包扫一遍，不只扫 index.html。 */
const pages = walk(STAGE).filter(f => f.endsWith('.html'));
for (const f of pages){
  if (readFileSync(f, 'utf8').includes('__dbg')){
    console.error(`${f.replace(STAGE + '/', '')} 里有调试钩子，不能上传。先重跑 build_web.mjs。`);
    process.exit(1);
  }
}

/* 页面里写死的导航链接是目录形式（href="en/leaderboard/"），
   NEON_DIR_INDEX 管不到这些 <a>。跟 itch 同一个坑，同一个补法。 */
function fixLinks(html){
  return html.replace(/<a\b[^>]*>/g, tag =>
    tag.replace(/href="([^"]+\/)"/g, (m, url) =>
      /^(?:[a-z]+:|\/\/|#)/i.test(url) ? m : `href="${url}index.html"`));
}
for (const f of pages) writeFileSync(f, fixLinks(readFileSync(f, 'utf8')));

const head = [
  `<script>window.NEON_DIR_INDEX='index.html';window.NEON_CHANNEL='crazygames';</script>`,
  `<script src="${SDK_URL}"></script>`,
];
/* 适配层只挂在真正的游戏页上。排行榜页和隐私页没有 NeonGame，挂上去也
   只是白白多两个请求，而且会让 gameplayStart 在没有游戏的页面上乱报。 */
const gamePages = pages.filter(f => /(^|\/)index\.html$/.test(f)
  && !/\/(leaderboard|privacy)\/index\.html$/.test(f) && !/404\.html$/.test(f));

for (const f of pages){
  let html = readFileSync(f, 'utf8');
  const at = html.indexOf('<head>');
  if (at < 0) continue;
  const depth = f.replace(STAGE + '/', '').split('/').length - 1;
  const inject = gamePages.includes(f)
    ? [...head, `<script src="${'../'.repeat(depth)}${ADAPTER}" defer></script>`]
    : head;
  writeFileSync(f, html.slice(0, at + 6) + '\n' + inject.join('\n') + html.slice(at + 6));
}

const all = walk(STAGE).map(f => f.replace(STAGE + '/', ''));
const kb = (all.reduce((n, f) => n + statSync(join(STAGE, f)).size, 0) / 1024).toFixed(0);
console.log(`已生成 ${STAGE}（${kb} KB，${all.length} 个文件）`);
console.log(all.includes('index.html') ? '✓ index.html 在根目录' : '✗ index.html 不在根目录');
for (const need of ['config.js', ADAPTER, 'en/index.html', 'privacy/index.html']){
  console.log(all.includes(need) ? `✓ ${need}` : `✗ 缺 ${need}`);
}
const g = readFileSync(join(STAGE, 'index.html'), 'utf8');
console.log(g.includes(SDK_URL) ? '✓ SDK 已注入' : '✗ SDK 没注入');
console.log(g.includes("NEON_CHANNEL='crazygames'") ? '✓ 渠道标记已注入' : '✗ 渠道标记没注入');
console.log(`\n把整个 ${STAGE.split('/').pop()} 文件夹拖进 CrazyGames 的上传框（不是 zip）。`);
