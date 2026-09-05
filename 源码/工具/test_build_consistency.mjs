// 确保 GitHub Pages 实际读取的根目录页面就是当前源片段的构建结果。
// 用法: node test_build_consistency.mjs
import { existsSync, readFileSync, statSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { wrap } from './web_shell.mjs';
import { toEnglish } from './i18n_en.mjs';

const fragmentUrl = new URL('../neon_maze_fragment.html', import.meta.url);
const rootIndexUrl = new URL('../../index.html', import.meta.url);
const weappCoreUrl = new URL('../微信小游戏版/js/core.js', import.meta.url);
const weappAtlasUrl = new URL('../微信小游戏版/images/neon-stalkers-tracking-eyes-v9.webp', import.meta.url);
const routerUrl = new URL('../../assets/language-router.js', import.meta.url);
const publishedRouterUrl = new URL('../../发布到网站/assets/language-router.js', import.meta.url);
const englishUrl = new URL('../../en/index.html', import.meta.url);
const publishedEnglishUrl = new URL('../../发布到网站/en/index.html', import.meta.url);
const assets = [
  'favicon.svg',
  'favicon-32.png',
  'apple-touch-icon.png',
  'neon-maze-share.jpg',
  'doudou-hero.webp',
  'neon-logo-v2.webp',
  'neon-space-bg-v2.webp',
  'neon-stalkers-tracking-eyes-v9.webp',
];
const assetSizeCaps = {
  'favicon.svg': 2_000,
  'favicon-32.png': 5_000,
  'apple-touch-icon.png': 50_000,
  'neon-maze-share.jpg': 150_000,
  'doudou-hero.webp': 30_000,
  'neon-logo-v2.webp': 30_000,
  'neon-space-bg-v2.webp': 40_000,
  'neon-stalkers-tracking-eyes-v9.webp': 20_000,
};
const expectedDimensions = {
  'favicon-32.png': [32, 32],
  'apple-touch-icon.png': [180, 180],
  'neon-maze-share.jpg': [1200, 630],
  'doudou-hero.webp': [512, 512],
  'neon-logo-v2.webp': [380, 380],
  'neon-space-bg-v2.webp': [1672, 941],
  'neon-stalkers-tracking-eyes-v9.webp': [256, 256],
};

function webpDimensions(url){
  const b = readFileSync(url);
  if (b.toString('ascii', 0, 4) !== 'RIFF' || b.toString('ascii', 8, 12) !== 'WEBP') return null;
  const kind = b.toString('ascii', 12, 16);
  if (kind === 'VP8 ' && b[23] === 0x9d && b[24] === 0x01 && b[25] === 0x2a)
    return [b.readUInt16LE(26) & 0x3fff, b.readUInt16LE(28) & 0x3fff];
  if (kind === 'VP8L' && b[20] === 0x2f)
    return [1 + b[21] + ((b[22] & 0x3f) << 8),
            1 + ((b[22] >> 6) | (b[23] << 2) | ((b[24] & 0x0f) << 10))];
  if (kind === 'VP8X')
    return [1 + b.readUIntLE(24, 3), 1 + b.readUIntLE(27, 3)];
  return null;
}

function rasterDimensions(url){
  const b = readFileSync(url);
  if (b.subarray(0, 8).equals(Buffer.from([137,80,78,71,13,10,26,10])))
    return [b.readUInt32BE(16), b.readUInt32BE(20)];
  if (b[0] === 0xff && b[1] === 0xd8){
    let p = 2;
    while (p + 9 < b.length){
      while (b[p] === 0xff) p++;
      const marker = b[p++];
      if (marker === 0xd9 || marker === 0xda) break;
      const len = b.readUInt16BE(p); p += 2;
      if ([0xc0,0xc1,0xc2,0xc3,0xc5,0xc6,0xc7,0xc9,0xca,0xcb,0xcd,0xce,0xcf].includes(marker))
        return [b.readUInt16BE(p + 3), b.readUInt16BE(p + 1)];
      p += len - 2;
    }
  }
  return webpDimensions(url);
}

const fragment = readFileSync(fragmentUrl, 'utf8');
const actual = readFileSync(rootIndexUrl, 'utf8');
const expected = wrap(fragment);
const expectedEnglish = toEnglish(expected);
const fail = [];

if (fragment.includes('__dbg')) fail.push('源片段仍包含调试钩子 __dbg');
if (/<(?:meta|title)\b/i.test(fragment.slice(0, fragment.indexOf('<style>'))))
  fail.push('源片段开头混入了只能放在页面 head 的标签');
if (actual !== expected) fail.push('根目录 index.html 已和 neon_maze_fragment.html 漂移，请运行 build_web.mjs');
if (!existsSync(routerUrl) || !actual.includes('assets/language-router.js'))
  fail.push('中文发布页缺少语言偏好脚本');
for (const marker of [
  '<link rel="canonical" href="https://playneonmaze.com/">',
  '<meta property="og:image" content="https://playneonmaze.com/assets/neon-maze-share.jpg">',
  '<meta name="twitter:card" content="summary_large_image">',
  '<link rel="icon" href="assets/favicon.svg" type="image/svg+xml">',
  '<link rel="apple-touch-icon" href="assets/apple-touch-icon.png" sizes="180x180">',
]) {
  if (!actual.includes(marker)) fail.push('中文发布页缺少站点元数据：' + marker);
}
if (actual.includes('api.country.is')) fail.push('中文发布页仍引用第三方 IP 查询');
if (!existsSync(englishUrl)) {
  fail.push('缺少英文发布页');
} else {
  const english = readFileSync(englishUrl, 'utf8');
  if (english !== expectedEnglish)
    fail.push('英文页不是由当前完整游戏生成，请运行 build_web.mjs');
  if (!english.includes('data-current-language="en"'))
    fail.push('英文发布页缺少正确的语言标记');
  if (!english.includes('<link rel="canonical" href="https://playneonmaze.com/en/">'))
    fail.push('英文发布页 canonical 没有指向 /en/');
  if (!english.includes('<meta property="og:url" content="https://playneonmaze.com/en/">'))
    fail.push('英文发布页 og:url 没有指向 /en/');
  if (!english.includes('<meta property="og:locale" content="en_US">'))
    fail.push('英文发布页 og:locale 不正确');
  for (const marker of ['class="brand-lockup"', 'class="power-card"', 'class="enemy-card"', 'id="dailyBox"',
                        'id="owlOverlay"', 'class="record-box hidden"']) {
    if (!english.includes(marker)) fail.push('英文页缺少当前完整版结构：' + marker);
  }
}
if (!existsSync(publishedRouterUrl)
    || !readFileSync(publishedRouterUrl).equals(readFileSync(routerUrl)))
  fail.push('发布镜像里的语言路由脚本缺失或漂移');
if (!existsSync(publishedEnglishUrl)
    || !readFileSync(publishedEnglishUrl).equals(readFileSync(englishUrl)))
  fail.push('发布镜像里的英文页缺失或漂移');
const srcHash = createHash('sha1').update(fragment).digest('hex').slice(0, 12);
for (const name of ['config.js','analytics.js']){
  const original = new URL('../../' + name, import.meta.url);
  const published = new URL('../../发布到网站/' + name, import.meta.url);
  if (!existsSync(published) || !readFileSync(original).equals(readFileSync(published)))
    fail.push('发布镜像缺失或版本不一致：' + name);
}
if (!actual.includes('<script src="config.js"></script>')) fail.push('发布页缺少云榜公开配置');
if (!actual.includes('<script src="analytics.js"></script>')) fail.push('发布页缺少可选分析入口');
if (!existsSync(weappCoreUrl)) {
  fail.push('缺少微信小游戏 core.js，请运行 build_weapp.mjs');
} else {
  const weappCore = readFileSync(weappCoreUrl, 'utf8');
  const m = weappCore.match(/源码指纹:\s*([0-9a-f]{12})/);
  if (!m || m[1] !== srcHash)
    fail.push(`微信小游戏 core.js 已和网页源漂移（应为 ${srcHash}，请运行 build_weapp.mjs）`);
}
for (const name of assets){
  const url = new URL('../../assets/' + name, import.meta.url);
  const minBytes = name === 'favicon.svg' ? 300 : 1024;
  if (!existsSync(url) || statSync(url).size < minBytes) fail.push('缺少有效的 assets/' + name);
  else if (statSync(url).size > assetSizeCaps[name])
    fail.push(`assets/${name} 超过压图上限 ${assetSizeCaps[name]} bytes`);
  else if (expectedDimensions[name]
           && String(rasterDimensions(url)) !== String(expectedDimensions[name]))
    fail.push(`assets/${name} 尺寸应为 ${expectedDimensions[name].join('×')}`);
  if (!actual.includes('assets/' + name)) fail.push('发布页面没有引用美术资源 ' + name);
}
const webAtlasUrl = new URL('../../assets/neon-stalkers-tracking-eyes-v9.webp', import.meta.url);
if (!existsSync(weappAtlasUrl)) {
  fail.push('微信小游戏缺少 images/neon-stalkers-tracking-eyes-v9.webp，请运行 build_weapp.mjs');
} else if (existsSync(webAtlasUrl)
           && !readFileSync(weappAtlasUrl).equals(readFileSync(webAtlasUrl))) {
  fail.push('微信小游戏与网页版的恶魔图集不是同一个文件');
}

if (fail.length){
  fail.forEach(item => console.error('✗ ' + item));
  process.exit(1);
}

console.log(`构建一致：网页、微信小游戏核心与源片段同步，${assets.length} 个网页美术资源可用。`);
