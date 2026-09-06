// 打一个能直接上传到 itch.io 的 zip。
//   用法: node build_itch.mjs [itch 页面地址]
//   例:   node build_itch.mjs https://superdadgames.itch.io/neon-maze
//
// itch.io 的 HTML5 游戏有一条硬要求：**zip 解开后根目录必须有 index.html**。
// 放进子文件夹就传不上去（它说找不到 index.html），这是最常见的一次性失败。
//
// 2026-09 重写。旧版只打包 index.html 一个文件 —— 那是游戏还是单文件那会儿
// 写的。现在页面依赖 assets/ 下十几个文件（logo、背景、敌人贴图、排行榜、
// 导航）外加 config.js（Supabase 配置）和 en/ leaderboard/ privacy/ 三个路由。
// 照旧版打包传上去，玩家看到的是没有 logo、没有背景、排行榜完全不工作的壳。
//
// 现在改成**按白名单整站打包**，目录结构原样保留 —— 相对路径和 <base href>
// 因此和线上完全一致，不需要为 itch 单独改任何一行页面代码。
//
// 那个可选的地址参数解决另一个坑：itch 把游戏放在 html-classic.itch.zone 的
// iframe 里，游戏内 location.href 拿到的是 CDN 上那个 html 的地址。「分享成绩」
// 照着它生成链接，别人点开是一个没有介绍、没有作者、随时会换地址的裸页面。
// 传进来就注入 window.DOUDOU_SHARE_URL，分享链接落到正式页面上。
import { fileURLToPath } from 'node:url';
import { readFileSync, writeFileSync, mkdirSync, rmSync, existsSync, cpSync, readdirSync, statSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { join, dirname } from 'node:path';

const here = p => fileURLToPath(new URL(p, import.meta.url));
const ROOT = here('../../');
const OUT_DIR = here('../../itch上传包');
const STAGE = `${OUT_DIR}/game`;
const ZIP = `${OUT_DIR}/neon-maze-itch.zip`;

const shareUrl = (process.argv[2] || '').trim();
if (shareUrl && !/^https?:\/\//.test(shareUrl)) {
  console.error('地址要带 http(s)://，收到的是：' + shareUrl);
  process.exit(1);
}

/* 白名单：线上实际提供的东西，一个不多一个不少。
   用白名单而不是「排除 源码/ .git/」那种黑名单 —— 黑名单会随着仓库长出新目录
   而悄悄漏东西进去，白名单漏了只会少文件，构建时就能发现。 */
const FILES = ['index.html', '404.html', 'config.js', 'analytics.js'];
const DIRS  = ['assets', 'en', 'leaderboard', 'privacy'];

for (const f of [...FILES, ...DIRS]){
  if (!existsSync(join(ROOT, f))){
    console.error(`缺 ${f} —— 先跑 node build_web.mjs`);
    process.exit(1);
  }
}

rmSync(STAGE, { recursive: true, force: true });
rmSync(ZIP, { force: true });
mkdirSync(STAGE, { recursive: true });

for (const f of FILES) cpSync(join(ROOT, f), join(STAGE, f));
for (const d of DIRS)  cpSync(join(ROOT, d), join(STAGE, d), { recursive: true });

/* 调试钩子绝不能上线。整包扫一遍，不只扫 index.html —— 生成物有好几份。 */
function walk(dir){
  return readdirSync(dir).flatMap(name => {
    const full = join(dir, name);
    return statSync(full).isDirectory() ? walk(full) : [full];
  });
}
const pages = walk(STAGE).filter(f => f.endsWith('.html'));
for (const f of pages){
  if (readFileSync(f, 'utf8').includes('__dbg')){
    console.error(`${f.replace(STAGE + '/', '')} 里有调试钩子，不能上传。先重跑 build_web.mjs。`);
    process.exit(1);
  }
}

/* 两段都注入 <head>：

   1. NEON_DIR_INDEX —— itch 的 CDN **不把 `dir/` 映射到 `dir/index.html`**。
      语言路由默认跳 `en/`，在 itch 上直接 404，游戏根本加载不出来。
      GitHub Pages 会映射，所以这个问题在 playneonmaze.com 上完全看不见 ——
      只有打包分发到别处才会炸，实测就是这么炸的。
   2. 分享地址 —— 中文页和英文页玩家都可能打到结算，只注入一份会让
      另一半玩家分享出 itch 的 CDN 裸地址。 */
const head = [`<script>window.NEON_DIR_INDEX='index.html';</script>`];
if (shareUrl) head.push(`<script>window.DOUDOU_SHARE_URL=${JSON.stringify(shareUrl)};</script>`);
for (const f of pages){
  let html = readFileSync(f, 'utf8');
  const at = html.indexOf('<head>');
  if (at < 0) continue;
  writeFileSync(f, html.slice(0, at + 6) + '\n' + head.join('\n') + html.slice(at + 6));
}

// -r 递归、-q 安静；进到 STAGE 里打包，zip 内就不会带上 game/ 这一层
execFileSync('zip', ['-r', '-q', ZIP, '.'], { cwd: STAGE });
rmSync(STAGE, { recursive: true, force: true });

const listing = execFileSync('unzip', ['-Z1', ZIP], { encoding: 'utf8' }).trim().split('\n');
const rootIndex = listing.includes('index.html');
const kb = (readFileSync(ZIP).length / 1024).toFixed(0);

console.log(`已生成 ${ZIP}（${kb} KB，${listing.length} 个文件）`);
console.log(rootIndex ? '✓ index.html 在根目录，itch 能识别'
                      : '✗ index.html 不在根目录，itch 会拒绝');
for (const need of ['config.js', 'assets/neon-logo-v2.webp', 'en/index.html', 'privacy/index.html']){
  console.log(listing.includes(need) ? `✓ ${need}` : `✗ 缺 ${need}`);
}
console.log(shareUrl ? `✓ 分享链接落到: ${shareUrl}`
                     : '· 未指定分享地址：游戏内「分享成绩」会用 itch 的 CDN 地址\n'
                     + '  上线拿到正式地址后，重跑一次并把地址作为参数传进来。');
if (!rootIndex) process.exit(1);
