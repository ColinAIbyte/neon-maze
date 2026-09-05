// 生成可直接上传到网站的完整网页。
//   用法: node build_web.mjs
//   产物: 仓库根目录 index.html / 404.html，并镜像到 发布到网站/
//
// 为什么需要这一步：neon_maze_fragment.html 是**片段**，不是完整网页。它没有
// <!DOCTYPE>、没有 <html>、没有 <head>。artifact 平台发布时会自动包一层壳，
// 所以在那个链接上一切正常；可一旦把这个文件直接传到静态托管上，就没人替你
// 包了。
//
// 最要命的是缺 <meta name="viewport">。浏览器对缺 doctype 很宽容，照样渲染，
// 但没有 viewport 的页面在手机上会按 980px 的桌面宽度排版再整体缩小 ——
// 迷宫小得看不清，按钮点不中。而分享出去的链接绝大多数正是在手机上打开的，
// 也就是说：不包这层壳，等于把最主要的使用场景做坏了，桌面上却看不出问题。
//
// 外壳本身在 web_shell.mjs，跟测试版共用同一份。
import { fileURLToPath } from 'node:url';
import { readFileSync, writeFileSync, mkdirSync, copyFileSync } from 'node:fs';
import { wrap, TITLE, SITE_URL } from './web_shell.mjs';
import { toEnglish } from './i18n_en.mjs';

const here = p => fileURLToPath(new URL(p, import.meta.url));
const ROOT_DIR = here('../../');
const OUT_DIR = here('../../发布到网站');
const fragment = readFileSync(here('../neon_maze_fragment.html'), 'utf8');

if (fragment.includes('__dbg')) {
  console.error('片段里有调试钩子，先清干净再打包。');
  process.exit(1);
}
if (/<!DOCTYPE|<html[\s>]/i.test(fragment)) {
  console.error('片段里已经有 <html>/<!DOCTYPE> 了，说明结构变了，本脚本会包重复。');
  process.exit(1);
}
const fragmentLead = fragment.slice(0, fragment.indexOf('<style>'));
if (/<(?:meta|title)\b/i.test(fragmentLead)) {
  console.error('片段开头混入了 <meta>/<title>，这些标签必须只由 web_shell.mjs 生成。');
  process.exit(1);
}

const html = wrap(fragment);
// /en/ is the same current game, generated from the same fragment.  Never copy
// a separately maintained English page here: that is how the old game came
// back when players switched languages.
const englishHtml = toEnglish(html);

const notFound = `<!DOCTYPE html>
<html lang="zh-CN"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>页面不存在 · ${TITLE}</title>
<style>body{margin:0;height:100vh;display:flex;flex-direction:column;align-items:center;
justify-content:center;background:#0a0612;color:#ece7fb;font-family:system-ui,sans-serif;gap:16px}
a{color:#ffcf5c}</style></head>
<body><h1 style="font-size:20px">页面不存在</h1><a href="${SITE_URL}">回到${TITLE}</a></body></html>
`;

// GitHub Pages 直接读取仓库根目录。构建同时覆盖这里，避免源片段和线上页面漂移。
writeFileSync(`${ROOT_DIR}index.html`, html);
writeFileSync(`${ROOT_DIR}404.html`, notFound);

mkdirSync(OUT_DIR, { recursive: true });
writeFileSync(`${OUT_DIR}/index.html`, html);
mkdirSync(`${OUT_DIR}/assets`, { recursive: true });
const assets = [
  'language-router.js',
  'leaderboard-hall.js',
  'leaderboard-hall.css',
  'leaderboard-bridge.js',
  'leaderboard-entry.css',
  'favicon.svg',
  'favicon-32.png',
  'apple-touch-icon.png',
  'neon-maze-share.jpg',
  'doudou-hero.webp',
  'neon-logo-v2.webp',
  'neon-space-bg-v2.webp',
  'neon-stalkers-tracking-eyes-v9.webp',
];
for (const name of assets){
  copyFileSync(here('../../assets/' + name), `${OUT_DIR}/assets/${name}`);
}
// 英文页由同一份最新游戏生成；只有文案不同，玩法、UI 和存档完全一致。
mkdirSync(`${OUT_DIR}/en`, { recursive: true });
mkdirSync(`${ROOT_DIR}en`, { recursive: true });
writeFileSync(`${ROOT_DIR}en/index.html`, englishHtml);
writeFileSync(`${OUT_DIR}/en/index.html`, englishHtml);
// Real directories make deep links/refresh work on GitHub Pages without a SPA rewrite.
for (const [route,source,base] of [['leaderboard',html,'../'],['en/leaderboard',englishHtml,'../../']]){
  let page=source.replace(/<base href="[^\"]*">\n/,'');
  page=page.replace('<meta charset="utf-8">','<meta charset="utf-8">\n<base href="'+base+'">');
  page=page.replace(/(<link rel="canonical" href=")[^"]+/, '$1'+SITE_URL+route+'/');
  page=page.replace(/(<meta property="og:url" content=")[^"]+/, '$1'+SITE_URL+route+'/');
  page=page.replace(/(<link rel="alternate" hreflang="(?:zh-Hans|x-default)" href=")[^"]+/g,'$1'+SITE_URL+'leaderboard/');
  page=page.replace(/(<link rel="alternate" hreflang="en" href=")[^"]+/,'$1'+SITE_URL+'en/leaderboard/');
  page=page.replace(/<title>[^<]+<\/title>/,'<title>'+ (route.startsWith('en/')?'Global Leaderboard':'全球排行榜') +' · Neon Maze</title>');
  for (const dir of [ROOT_DIR,OUT_DIR+'/']){
    mkdirSync(dir+route,{recursive:true});writeFileSync(dir+route+'/index.html',page);
  }
}
copyFileSync(here('../../config.js'), `${OUT_DIR}/config.js`);
copyFileSync(here('../../analytics.js'), `${OUT_DIR}/analytics.js`);

// 静态托管上没有这个文件时，访问不存在的路径会是平台自带的英文报错页。
writeFileSync(`${OUT_DIR}/404.html`, notFound);

const kb = (html.length/1024).toFixed(0);
console.log(`已生成根目录 index.html（${kb} KB，游戏本体零外部网络依赖）`);
console.log('     根目录 404.html');
console.log('已镜像 发布到网站/index.html');
console.log('     发布到网站/404.html');
console.log(`     发布到网站/assets/（${assets.length} 个本地资源）`);
console.log('     en/index.html（与中文版共用同一游戏源）');
console.log('     发布到网站/en/index.html');
console.log('整个目录拖到任意静态托管即可。');
