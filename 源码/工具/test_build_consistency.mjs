// 确保 GitHub Pages 实际读取的根目录页面就是当前源片段的构建结果。
// 用法: node test_build_consistency.mjs
import { existsSync, readFileSync, statSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { wrap } from './web_shell.mjs';

const fragmentUrl = new URL('../neon_maze_fragment.html', import.meta.url);
const rootIndexUrl = new URL('../../index.html', import.meta.url);
const weappCoreUrl = new URL('../微信小游戏版/js/core.js', import.meta.url);
const weappAtlasUrl = new URL('../微信小游戏版/images/neon-stalkers-tracking-eyes-v9.webp', import.meta.url);
const assets = [
  'doudou-hero.webp',
  'neon-logo-v2.webp',
  'neon-space-bg-v2.webp',
  'neon-stalkers-tracking-eyes-v9.webp',
];
const assetSizeCaps = {
  'doudou-hero.webp': 30_000,
  'neon-logo-v2.webp': 30_000,
  'neon-space-bg-v2.webp': 40_000,
  'neon-stalkers-tracking-eyes-v9.webp': 20_000,
};
const expectedDimensions = {
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

const fragment = readFileSync(fragmentUrl, 'utf8');
const actual = readFileSync(rootIndexUrl, 'utf8');
const expected = wrap(fragment);
const fail = [];

if (fragment.includes('__dbg')) fail.push('源片段仍包含调试钩子 __dbg');
if (/<(?:meta|title)\b/i.test(fragment.slice(0, fragment.indexOf('<style>'))))
  fail.push('源片段开头混入了只能放在页面 head 的标签');
if (actual !== expected) fail.push('根目录 index.html 已和 neon_maze_fragment.html 漂移，请运行 build_web.mjs');
const srcHash = createHash('sha1').update(fragment).digest('hex').slice(0, 12);
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
  if (!existsSync(url) || statSync(url).size < 1024) fail.push('缺少有效的 assets/' + name);
  else if (statSync(url).size > assetSizeCaps[name])
    fail.push(`assets/${name} 超过压图上限 ${assetSizeCaps[name]} bytes`);
  else if (String(webpDimensions(url)) !== String(expectedDimensions[name]))
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
