// 网页滑动手势：触点归属、多指取消、45° 模糊方向、连续滑动与系统中断。
//   用法: node test_web_gesture.mjs
//
// 微信小游戏入口早已用 identifier 跟踪第一指；网页版若一直读取
// changedTouches[0]，第二指加入、非归属触点抬起或系统暂停后都可能写入一次
// 玩家没有做出的方向。这里直接执行源片段注册在 .stage 上的真实处理器，不复制
// 手势算法，确保两端以后不会再次悄悄漂移。
import { readFileSync, writeFileSync, mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const noop = () => {};
const fakeCtx = () => new Proxy({}, { get: (_, k) => {
  if (k === 'measureText') return t => ({ width: String(t).length * 7 });
  if (k === 'createLinearGradient' || k === 'createRadialGradient')
    return () => ({ addColorStop: noop });
  return noop;
}});
const fakeCanvas = (w=494, h=546) => ({ width:w, height:h, getContext:()=>fakeCtx() });
const store = new Map();
globalThis.GameGlobal = globalThis;
globalThis.location = { href:'https://example.com/' };
globalThis.wx = {
  createCanvas:()=>fakeCanvas(),
  getSystemInfoSync:()=>({ windowWidth:390, windowHeight:844, pixelRatio:3 }),
  getStorageSync:k=>store.has(k)?store.get(k):'',
  setStorageSync:(k,v)=>store.set(k,v),
  removeStorageSync:k=>store.delete(k),
  createWebAudioContext:()=>({
    currentTime:0, state:'running', resume:noop, destination:{},
    createOscillator:()=>({
      type:'', frequency:{ setValueAtTime:noop, exponentialRampToValueAtTime:noop },
      connect:d=>d, start:noop, stop:noop,
    }),
    createGain:()=>({
      gain:{ setValueAtTime:noop, exponentialRampToValueAtTime:noop }, connect:d=>d,
    }),
  }),
  onTouchStart:noop, onTouchEnd:noop, onTouchMove:noop, onTouchCancel:noop,
  showKeyboard:noop, hideKeyboard:noop, onKeyboardInput:noop, onKeyboardConfirm:noop,
  onShow:noop, onHide:noop, showShareMenu:noop, onShareAppMessage:noop,
  onShareTimeline:noop,
};
globalThis.requestAnimationFrame = () => 0;

const html = readFileSync(new URL('../neon_maze_fragment.html', import.meta.url), 'utf8');
let body = html.slice(html.indexOf('<script>') + 8, html.lastIndexOf('</script>')).trim()
  .replace(/^\(function\(\)\s*\{\s*(?:"use strict";|'use strict';)?/, '')
  .replace(/\}\)\(\);?$/, '').trim();
const dir = mkdtempSync(join(tmpdir(), 'web-gesture-'));
const modulePath = join(dir, 'core.mjs');
writeFileSync(modulePath, `export function createGame(env){
 const document=env.document,window=env.window,localStorage=env.localStorage,
   getComputedStyle=env.getComputedStyle,requestAnimationFrame=env.requestAnimationFrame,
   cancelAnimationFrame=env.cancelAnimationFrame,performance=env.performance;
${body}
 return { fullNewGame, autoPause, togglePause,
   get player(){return player;},
   get gameState(){return gameState;}, set gameState(v){gameState=v;} };
}\n`);

const { installShim } = await import(new URL('../微信小游戏版/js/shim.js', import.meta.url));
const shim = installShim({ maze:fakeCanvas(), fx:fakeCanvas(1,1) });
/* 生产 shim 不需要派发网页 document 事件；本测试补一个最小 EventTarget，专门
   验证“第二指落在 stage 外”仍会在捕获阶段取消第一指。 */
const docListeners = {};
shim.doc.addEventListener = (type, fn) => { (docListeners[type] ||= []).push(fn); };
shim.doc.dispatch = (type, e) => { for (const fn of docListeners[type] || []) fn(e); };
const { createGame } = await import(modulePath);
const game = createGame(shim.env);
const stage = shim.el('mazeCanvas').parentElement;
const fail = [];

const touch = (identifier, clientX, clientY) => ({ identifier, clientX, clientY });
const event = (touches=[], changedTouches=touches) => ({
  touches, changedTouches, prevented:false,
  preventDefault(){ this.prevented = true; },
});
const dispatch = (type, touches=[], changedTouches=touches) => {
  const e = event(touches, changedTouches);
  stage.dispatch(type, e);
  return e;
};
const neutral = () => { game.player.want = { x:0, y:0 }; };
const wanted = () => {
  const {x,y} = game.player.want || {};
  return x===1?'right':x===-1?'left':y===1?'down':y===-1?'up':'none';
};
const expect = (ok, msg) => { if (!ok) fail.push(msg); };
const cancel = () => dispatch('touchcancel', [], []);

function fresh(){
  cancel();
  game.fullNewGame();
  game.gameState = 'playing';
  neutral();
}

// 1) 明确方向在 touchmove 阶段立即响应，同一根手指可连续拐弯。
fresh();
const a0 = touch(11, 50, 50);
dispatch('touchstart', [a0], [a0]);
const a1 = dispatch('touchmove', [touch(11, 70, 50)], [touch(11, 70, 50)]);
expect(wanted() === 'right', '明确的右滑没有在 touchmove 阶段立即转向');
expect(a1.prevented, '已归属棋盘的滑动没有 preventDefault，页面可能跟着滚');
neutral();
dispatch('touchmove', [touch(11, 70, 70)], [touch(11, 70, 70)]);
expect(wanted() === 'down', '判定后没有重置起点，同一指无法连续滑动转向');

// 2) 接近 45° 时先等待；主轴明确后仍从原起点判定，不丢手势。
fresh();
const b0 = touch(21, 80, 80);
dispatch('touchstart', [b0], [b0]);
const ambiguous = dispatch('touchmove', [touch(21, 98, 97)], [touch(21, 98, 97)]);
expect(wanted() === 'none', '18×17px 的近 45° 拖动被过早猜成了某个方向');
expect(ambiguous.prevented, '模糊但已归属棋盘的拖动没有阻止页面默认手势');
dispatch('touchmove', [touch(21, 112, 97)], [touch(21, 112, 97)]);
expect(wanted() === 'right', '近 45° 手势变得明确后仍未响应');

// 3) 非归属触点抬起不能终止第一指；第一指随后移动仍应生效。
fresh();
const c0 = touch(31, 40, 40);
dispatch('touchstart', [c0], [c0]);
dispatch('touchend', [c0], [touch(99, 100, 100)]);
expect(wanted() === 'none', '非归属触点 touchend 产生了幽灵转向');
dispatch('touchmove', [touch(31, 60, 40)], [touch(31, 60, 40)]);
expect(wanted() === 'right', '非归属触点抬起错误终止了第一指手势');

// 4) 第二指一加入就取消整次手势；必须重新 touchstart 才能恢复控制。
fresh();
const d0 = touch(41, 60, 60), d1 = touch(42, 90, 90);
dispatch('touchstart', [d0], [d0]);
/* 第二指模拟落在 HUD：只经过 document 捕获，不经过 stage。 */
shim.doc.dispatch('touchstart', event([d0, d1], [d1]));
neutral();
dispatch('touchmove', [touch(41, 85, 60)], [touch(41, 85, 60)]);
expect(wanted() === 'none', '多指取消后旧触点仍能继续控制，存在坐标跳变风险');
const d2 = touch(41, 85, 60);
dispatch('touchstart', [d2], [d2]);
dispatch('touchmove', [touch(41, 105, 60)], [touch(41, 105, 60)]);
expect(wanted() === 'right', '多指取消后一次新的单指手势无法恢复控制');

// 5) touchcancel 与失焦自动暂停都必须清掉旧起点。
fresh();
const e0 = touch(51, 30, 30);
dispatch('touchstart', [e0], [e0]);
cancel();
dispatch('touchmove', [touch(51, 60, 30)], [touch(51, 60, 30)]);
expect(wanted() === 'none', 'touchcancel 后旧手势仍产生方向');

fresh();
const f0 = touch(61, 30, 30);
dispatch('touchstart', [f0], [f0]);
game.autoPause();
expect(game.gameState === 'paused', 'autoPause 没有进入暂停态，测试前提不成立');
game.togglePause();
neutral();
dispatch('touchmove', [touch(61, 60, 30)], [touch(61, 60, 30)]);
expect(wanted() === 'none', '失焦暂停再恢复后，旧触点产生了幽灵转向');

// 6) 弹层/按钮按下时不归属棋盘；随后状态切到 playing 也不能补出一次转向。
fresh();
game.gameState = 'ready';
const g0 = touch(71, 20, 20);
dispatch('touchstart', [g0], [g0]);
game.gameState = 'playing';
dispatch('touchmove', [touch(71, 50, 20)], [touch(71, 50, 20)]);
expect(wanted() === 'none', '非 playing 屏幕上的按下泄漏成了开局后的方向');

// 7) 没经过 touchmove 的短甩仍由 touchend 兜底，且只认归属触点。
fresh();
const h0 = touch(81, 100, 100);
dispatch('touchstart', [h0], [h0]);
dispatch('touchend', [], [touch(81, 100, 120)]);
expect(wanted() === 'down', '短甩没有在 touchend 兜底转向');

if (fail.length){
  console.error('网页版滑动手势回归失败：\n  ✗ ' + fail.join('\n  ✗ '));
  process.exit(1);
}
console.log('网页版滑动手势：identifier 归属、多指取消、45° 延迟判定、连续滑动、');
console.log('touchcancel/自动暂停恢复、弹层隔离和短甩兜底均正常。');
