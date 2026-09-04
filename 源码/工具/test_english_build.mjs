// Guard against /en/ drifting back to a stale standalone game.
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import { wrap } from './web_shell.mjs';
import { toEnglish } from './i18n_en.mjs';

const fragment = readFileSync(new URL('../neon_maze_fragment.html', import.meta.url), 'utf8');
const english = readFileSync(new URL('../../en/index.html', import.meta.url), 'utf8');
const expected = toEnglish(wrap(fragment));
const fail = [];

if (english !== expected) fail.push('/en/ 没有由当前中文完整版直接生成');

for (const marker of [
  'class="brand-lockup"', 'class="power-card"', 'class="enemy-card"',
  'id="dailyBox"', 'id="owlOverlay"', 'class="record-box hidden"',
  'const MAZE_LEVEL_6', 'const COMBO_SCORE_BOOST = 1.3',
]) {
  if (!english.includes(marker)) fail.push('英文完整版缺少：' + marker);
}

// Every generated inline script must still be valid JavaScript after replacing
// interpolated UI strings.
const scripts = [...english.matchAll(/<script(?![^>]*\bsrc=)[^>]*>([\s\S]*?)<\/script>/gi)];
if (!scripts.length) fail.push('英文页没有游戏脚本');
for (const [i, match] of scripts.entries()) {
  try { new vm.Script(match[1], { filename:`en-inline-${i}.js` }); }
  catch (error) { fail.push('英文页脚本语法错误：' + error.message); }
}

// Ignore comments and the deliberately bilingual language switch. Any other
// Han text here would be visible UI or a runtime message missed by translation.
const visible = english
  .replace(/<!--[\s\S]*?-->/g, '')
  .replace(/\/\*[\s\S]*?\*\//g, '')
  .replace(/\/\/.*$/gm, '')
  .replace(/Language \/ 语言|>中文</g, '');
const residue = visible.match(/[\u3400-\u9fff]+/g) || [];
if (residue.length) fail.push('英文页仍有未翻译文字：' + [...new Set(residue)].slice(0,12).join('、'));

if (fail.length) {
  fail.forEach(item => console.error('✗ ' + item));
  process.exit(1);
}
console.log('英文构建通过：与当前完整版同源，所有模式齐全，脚本有效且无遗漏中文。');
