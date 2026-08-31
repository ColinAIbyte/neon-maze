// Logo 裁切回归：NEON 顶部不能再被容器截掉。
//   用法: node test_logo_crop.mjs
//
// Logo WebP 本身已经留了透明/黑色边距，.brand-lockup 却是 overflow:hidden。
// 如果再给图片负 margin-top，结果不是“更紧凑”，而是把 NEON 的字顶裁掉。
import { readFileSync } from 'node:fs';

const src = readFileSync(new URL('../pacman_fragment.html', import.meta.url), 'utf8');
const fail = [];

const lockup = src.match(/\.brand-lockup\s*\{([^}]*)\}/)?.[1] || '';
if (!/overflow\s*:\s*hidden/.test(lockup))
  fail.push('Logo 容器的裁切条件变了，这条测试需要重新核对');

const rules = [...src.matchAll(/\.brand-logo\s*\{([^}]*)\}/g)];
if (rules.length < 2) fail.push('找不到 Logo 的基础和桌面宽屏样式');
for (const [i, rule] of rules.entries()){
  const margin = rule[1].match(/margin-top\s*:\s*(-?[\d.]+)(?:px)?/);
  if (!margin) fail.push(`第 ${i+1} 个 Logo 样式没有明确 margin-top`);
  else if (Number(margin[1]) < 0)
    fail.push(`第 ${i+1} 个 Logo 样式又向上偏移 ${margin[1]}px，NEON 会被裁掉`);
  if (/transform\s*:[^;}]*translateY\(\s*-/.test(rule[1]))
    fail.push(`第 ${i+1} 个 Logo 样式用 translateY 再次向上偏移`);
}

if (fail.length){
  console.log('Logo 裁切回归失败:\n  ✗ ' + fail.join('\n  ✗ '));
  process.exit(1);
}
console.log('Logo 在普通与桌面宽屏布局中均无向上负偏移，NEON 字顶不会被裁切。');
