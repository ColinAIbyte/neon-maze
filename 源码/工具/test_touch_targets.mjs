// 手机 HUD 热区与双击兜底的源码级回归。
//   用法: node test_touch_targets.mjs
//
// 这里守住两个非常具体、浏览器不会报错的退化：
// 1. 44px 伪元素若同时保留 translate(-50%,-50%) 又在触屏媒体规则里写 inset，
//    热区会整体左上偏移，后一个按钮甚至会盖住前一个按钮中心；
// 2. document 级 touchend.preventDefault 会吞掉 300ms 内第二次按钮 click。
import { readFileSync } from 'node:fs';

const src = readFileSync(new URL('../neon_maze_fragment.html', import.meta.url), 'utf8');
const fail = [];
const expect = (ok, msg) => { if (!ok) fail.push(msg); };

const baseHit = src.match(/\.icon-btn::after\s*\{([\s\S]*?)\}/);
expect(baseHit, '找不到 .icon-btn::after 的 44px 基础热区');
if (baseHit){
  const css = baseHit[1];
  expect(/width\s*:\s*44px/.test(css) && /height\s*:\s*44px/.test(css),
    'HUD 图标基础热区不再是 44×44px');
  expect(/left\s*:\s*50%/.test(css) && /top\s*:\s*50%/.test(css) &&
         /translate\(\s*-50%\s*,\s*-50%\s*\)/.test(css),
    'HUD 图标热区没有以按钮中心对齐');
}

const coarse = src.match(/@media \(hover: none\), \(pointer: coarse\)\s*\{([\s\S]*?)\n\}/);
expect(coarse, '找不到触屏媒体规则');
if (coarse){
  const css = coarse[1];
  const iconOverride = css.match(/\.icon-btn::after\s*\{([\s\S]*?)\}/);
  if (iconOverride){
    expect(!/(?:inset|left|right|top|bottom|transform)\s*:/.test(iconOverride[1]),
      '触屏媒体规则再次改写伪元素定位，会和基础 translate 叠加导致热区偏移');
  }
  const gap = css.match(/\.hud\s+\.hud-controls\s*\{[^}]*gap\s*:\s*([\d.]+)px/);
  expect(gap && Number(gap[1]) >= 14,
    '触屏 HUD 两个 44px 热区的中心距不够，命中区可能重叠');
}

const docTouchEnds = [...src.matchAll(/document\.addEventListener\('touchend'[\s\S]*?\},\s*\{\s*passive:\s*false\s*\}\);/g)];
expect(docTouchEnds.length === 0,
  '仍存在 document 级 touchend.preventDefault，会吞掉快速按钮连点');

const stageGuard = src.match(/let lastStageTouchEnd\s*=\s*0;[\s\S]*?stage\.addEventListener\('touchend',[\s\S]*?\},\s*\{\s*passive:\s*false\s*\}\);/);
expect(stageGuard, '找不到只作用于棋盘的双击缩放兜底');
if (stageGuard){
  expect(/gameState\s*!==\s*'playing'/.test(stageGuard[0]),
    '棋盘双击兜底没有限制在 playing，弹层按钮仍可能被吞 click');
  expect(/e\.preventDefault\(\)/.test(stageGuard[0]),
    '棋盘双击兜底不再阻止默认缩放');
}

if (fail.length){
  console.error('手机触控热区回归失败：\n  ✗ ' + fail.join('\n  ✗ '));
  process.exit(1);
}
console.log('手机 HUD：44×44 热区保持居中，触屏间距不重叠；');
console.log('双击缩放兜底仅限 playing 棋盘，不再吞按钮快速连点。');
