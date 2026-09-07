// 打一个能上传到 GameMonetize 的 zip。
//   用法: node build_gamemonetize.mjs <gameId>
//   例:   node build_gamemonetize.mjs 8f3c1a2b...
//
// gameId 是每个游戏一个的哈希，在 GameMonetize 后台 Game Management 里拿。
// 不写死在代码里：写死了就没法给第二个游戏复用，而且会跟着源码进到别的渠道。
//
// 他们要 **zip**，根目录必须有 index.html —— 跟 CrazyGames 要文件夹正好相反，
// 别搞混了（CrazyGames 明说 "Archive files are not supported"）。
//
// 上传后还要在后台点 "Verify Game" 验证 SDK，再点 "REQUEST ACTIVATION" 提交。
import { fileURLToPath } from 'node:url';
import { readFileSync, writeFileSync, mkdirSync, rmSync, existsSync, cpSync, readdirSync, statSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { join } from 'node:path';

const here = p => fileURLToPath(new URL(p, import.meta.url));
const ROOT = here('../../');
const OUT_DIR = here('../../gamemonetize上传包');
const STAGE = `${OUT_DIR}/game`;
const ZIP = `${OUT_DIR}/neon-maze-gamemonetize.zip`;

const gameId = (process.argv[2] || '').trim();
if (!/^[A-Za-z0-9-]{6,64}$/.test(gameId)){
  console.error('用法: node build_gamemonetize.mjs <gameId>\n'
    + 'gameId 在 GameMonetize 后台 Game Management > My games > 选中游戏 里。');
  process.exit(1);
}

const ADAPTER_SRC = here('../渠道/gamemonetize-adapter.js');
const ADAPTER = 'assets/gamemonetize-adapter.js';
const FILES = ['index.html', '404.html', 'config.js', 'analytics.js'];
const DIRS  = ['assets', 'en', 'leaderboard', 'privacy'];

for (const f of [...FILES, ...DIRS]){
  if (!existsSync(join(ROOT, f))){ console.error(`缺 ${f} —— 先跑 node build_web.mjs`); process.exit(1); }
}
if (!existsSync(ADAPTER_SRC)){ console.error('缺 源码/渠道/gamemonetize-adapter.js'); process.exit(1); }

rmSync(STAGE, { recursive: true, force: true });
rmSync(ZIP, { force: true });
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
const pages = walk(STAGE).filter(f => f.endsWith('.html'));
for (const f of pages){
  if (readFileSync(f, 'utf8').includes('__dbg')){
    console.error(`${f.replace(STAGE + '/', '')} 里有调试钩子，不能上传。`); process.exit(1);
  }
}

/* 目录式导航链接要补 index.html —— 跟 itch / CrazyGames 同一个坑。 */
function fixLinks(html){
  return html.replace(/<a\b[^>]*>/g, tag =>
    tag.replace(/href="([^"]+\/)"/g, (m, url) =>
      /^(?:[a-z]+:|\/\/|#)/i.test(url) ? m : `href="${url}index.html"`));
}
for (const f of pages) writeFileSync(f, fixLinks(readFileSync(f, 'utf8')));

/* 适配层只挂在游戏页。排行榜页和隐私页没有 NeonGame，挂上去只会白白多请求。 */
const gamePages = pages.filter(f => /(^|\/)index\.html$/.test(f)
  && !/\/(leaderboard|privacy)\/index\.html$/.test(f) && !/404\.html$/.test(f));

for (const f of pages){
  let html = readFileSync(f, 'utf8');
  const at = html.indexOf('<head>');
  if (at < 0) continue;
  const depth = f.replace(STAGE + '/', '').split('/').length - 1;
  const head = [`<script>window.NEON_DIR_INDEX='index.html';window.NEON_CHANNEL='gamemonetize';</script>`];
  if (gamePages.includes(f)){
    head.push(`<script>window.NEON_GM_ID=${JSON.stringify(gameId)};</script>`);
    /* defer 是必须的：适配层注入在 <head>，而 window.NeonGame 是在 <body>
       末尾才定义的。第一版漏了它，脚本在 head 里同步执行时游戏还不存在，
       SDK 从头到尾没加载，玩家玩到结束也不出广告 —— 线上实测才发现。
       适配层本身也加了等待逻辑兜底，两道都要有。 */
    head.push(`<script src="${'../'.repeat(depth)}${ADAPTER}" defer></script>`);
  }
  writeFileSync(f, html.slice(0, at + 6) + '\n' + head.join('\n') + html.slice(at + 6));
}

execFileSync('zip', ['-r', '-q', ZIP, '.'], { cwd: STAGE });
rmSync(STAGE, { recursive: true, force: true });

const listing = execFileSync('unzip', ['-Z1', ZIP], { encoding: 'utf8' }).trim().split('\n');
const kb = (readFileSync(ZIP).length / 1024).toFixed(0);
console.log(`已生成 ${ZIP}（${kb} KB，${listing.length} 个文件）`);
console.log(listing.includes('index.html') ? '✓ index.html 在 zip 根目录' : '✗ index.html 不在根目录，会被拒');
console.log(listing.includes(ADAPTER) ? `✓ ${ADAPTER}` : `✗ 缺 ${ADAPTER}`);
console.log(`✓ gameId 已注入: ${gameId.slice(0, 8)}…`);
console.log('\n上传后记得在后台点 Verify Game，再点 REQUEST ACTIVATION。');
