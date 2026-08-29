// 确保 GitHub Pages 实际读取的根目录页面就是当前源片段的构建结果。
// 用法: node test_build_consistency.mjs
import { existsSync, readFileSync, statSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { wrap } from './web_shell.mjs';

const fragmentUrl = new URL('../pacman_fragment.html', import.meta.url);
const rootIndexUrl = new URL('../../index.html', import.meta.url);
const weappCoreUrl = new URL('../微信小游戏版/js/core.js', import.meta.url);
const assets = [
  'doudou-hero.png',
  'neon-logo-v2.jpg',
  'neon-space-bg-v2.jpg',
  'neon-demons-v1.png',
];

const fragment = readFileSync(fragmentUrl, 'utf8');
const actual = readFileSync(rootIndexUrl, 'utf8');
const expected = wrap(fragment);
const fail = [];

if (fragment.includes('__dbg')) fail.push('源片段仍包含调试钩子 __dbg');
if (/<(?:meta|title)\b/i.test(fragment.slice(0, fragment.indexOf('<style>'))))
  fail.push('源片段开头混入了只能放在页面 head 的标签');
if (actual !== expected) fail.push('根目录 index.html 已和 pacman_fragment.html 漂移，请运行 build_web.mjs');
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
  if (!actual.includes('assets/' + name)) fail.push('发布页面没有引用美术资源 ' + name);
}

if (fail.length){
  fail.forEach(item => console.error('✗ ' + item));
  process.exit(1);
}

console.log(`构建一致：网页、微信小游戏核心与源片段同步，${assets.length} 个网页美术资源可用。`);
