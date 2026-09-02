// Logo 裁切回归：NEON 顶部不能再被容器截掉。
//   用法: node test_logo_crop.mjs
//
// Logo WebP 本身已经留了透明/黑色边距，.brand-lockup 却是 overflow:hidden。
// 如果再给图片负 margin-top，结果不是“更紧凑”，而是把 NEON 的字顶裁掉。
import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';

const src = readFileSync(new URL('../neon_maze_fragment.html', import.meta.url), 'utf8');
const fail = [];
const logo = readFileSync(new URL('../../assets/neon-logo-v2.webp',import.meta.url));
// 此 WebP 的可见字形位于中间约 60% 高度。资产变更后必须重新核对安全边界，
// 不能沿用旧 JPG（1280px）裁切坐标来宣称新图安全。
if (createHash('sha256').update(logo).digest('hex') !== '105001947af269a857e8849a0d6f0708d4bf51bf024cd9b6f3225d6895ea6cd0')
  fail.push('Logo WebP 发生变化，需要重新核对可见字形的安全边界');
if (!/src="assets\/neon-logo-v2\.webp"[^>]*width="380" height="380"/.test(src))
  fail.push('Logo 未使用当前 380×380 WebP 或其固有尺寸不正确');

if (/brand-sub|DOUDOU\s*·\s*豆豆/.test(src))
  fail.push('Logo 下方重复的「DOUDOU · 豆豆」副标题又出现了');

const lockup = src.match(/\.brand-lockup\s*\{([^}]*)\}/)?.[1] || '';
if (!/overflow\s*:\s*hidden/.test(lockup))
  fail.push('Logo 容器的裁切条件变了，这条测试需要重新核对');

const rules = [...src.matchAll(/\.brand-logo\s*\{([^}]*)\}/g)];
if (rules.length < 2) fail.push('找不到 Logo 的基础和桌面宽屏样式');
for (const [i, rule] of rules.entries()){
  const margin = rule[1].match(/margin(?:-top)?\s*:\s*(-?[\d.]+)(?:px)?/);
  if (!margin) fail.push(`第 ${i+1} 个 Logo 样式没有明确 margin-top`);
  else if (Number(margin[1]) < 0)
    fail.push(`第 ${i+1} 个 Logo 样式又向上偏移 ${margin[1]}px，NEON 会被裁掉`);
  if (/transform\s*:[^;}]*translateY\(\s*-/.test(rule[1]))
    fail.push(`第 ${i+1} 个 Logo 样式用 translateY 再次向上偏移`);
}
if (!/object-fit\s*:\s*contain/.test(rules[0]?.[1] || ''))
  fail.push('Logo 必须 contain，不能依赖 cover 裁切');
const lockups = [...src.matchAll(/\.brand-lockup\s*\{([^}]*)\}/g)];
for (let i=0;i<Math.min(lockups.length,rules.length);i++){
  const height=Number(lockups[i][1].match(/(?:^|;)\s*height:(\d+)px/)?.[1]);
  const imageHeight=Number(rules[i][1].match(/(?:^|;)\s*height:(\d+)px/)?.[1]);
  if (!height || !imageHeight || height < imageHeight*.6)
    fail.push(`第 ${i+1} 个品牌区无法完整容纳当前 WebP 的字形安全边界`);
}

if (fail.length){
  console.log('Logo 裁切回归失败:\n  ✗ ' + fail.join('\n  ✗ '));
  process.exit(1);
}
console.log('Logo 使用当前 380×380 WebP；普通、高竖屏和桌面布局均居中并容纳字形安全边界。');
