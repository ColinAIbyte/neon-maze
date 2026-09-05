// 手机网页版虚拟摇杆：四向判定、持续转向缓存、松手不停步、暂停复位与显示边界。
import { readFileSync, writeFileSync, mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const noop=()=>{};
const fakeCtx=()=>new Proxy({},{get:(_,k)=>{
  if(k==='measureText')return t=>({width:String(t).length*7});
  if(k==='createLinearGradient'||k==='createRadialGradient')return()=>({addColorStop:noop});
  return noop;
}});
const fakeCanvas=(w=494,h=546)=>({width:w,height:h,getContext:()=>fakeCtx()});
const store=new Map();
globalThis.GameGlobal=globalThis;
globalThis.PointerEvent=function PointerEvent(){};
globalThis.location={href:'https://playneonmaze.com/'};
globalThis.wx={
  createCanvas:()=>fakeCanvas(),getSystemInfoSync:()=>({windowWidth:390,windowHeight:844,pixelRatio:3}),
  getStorageSync:k=>store.has(k)?store.get(k):'',setStorageSync:(k,v)=>store.set(k,v),removeStorageSync:k=>store.delete(k),
  createWebAudioContext:()=>({currentTime:0,state:'running',resume:noop,destination:{},
    createOscillator:()=>({type:'',frequency:{setValueAtTime:noop,exponentialRampToValueAtTime:noop},connect:d=>d,start:noop,stop:noop}),
    createGain:()=>({gain:{setValueAtTime:noop,exponentialRampToValueAtTime:noop},connect:d=>d})}),
  onTouchStart:noop,onTouchEnd:noop,onTouchMove:noop,onTouchCancel:noop,
  showKeyboard:noop,hideKeyboard:noop,onKeyboardInput:noop,onKeyboardConfirm:noop,
  onShow:noop,onHide:noop,showShareMenu:noop,onShareAppMessage:noop,onShareTimeline:noop,
};
globalThis.requestAnimationFrame=()=>0;

const html=readFileSync(new URL('../neon_maze_fragment.html',import.meta.url),'utf8');
const body=html.slice(html.indexOf('<script>')+8,html.lastIndexOf('</script>')).trim()
  .replace(/^\(function\(\)\s*\{\s*(?:"use strict";|'use strict';)?/,'').replace(/\}\)\(\);?$/,'').trim();
const dir=mkdtempSync(join(tmpdir(),'joystick-'));
const modulePath=join(dir,'core.mjs');
writeFileSync(modulePath,`export function createGame(env){
 const document=env.document,window=env.window,localStorage=env.localStorage,
   getComputedStyle=env.getComputedStyle,requestAnimationFrame=env.requestAnimationFrame,
   cancelAnimationFrame=env.cancelAnimationFrame,performance=env.performance;
${body}
 return { fullNewGame,stepFrame,togglePause,resetJoystick,
   get player(){return player;},get gameState(){return gameState;},set gameState(v){gameState=v;} };
}\n`);

const {installShim}=await import(new URL('../微信小游戏版/js/shim.js',import.meta.url));
const shim=installShim({maze:fakeCanvas(),fx:fakeCanvas(1,1)});
const joy=shim.el('touchJoystick');joy.width=104;joy.height=104;
const knob=shim.el('joyKnob');
const {createGame}=await import(modulePath);
const game=createGame(shim.env);
const fail=[];
const expect=(ok,msg)=>{if(!ok)fail.push(msg);};
const event=(x,y,extra={})=>({pointerId:7,pointerType:'touch',isPrimary:true,clientX:x,clientY:y,
  cancelable:true,prevented:false,preventDefault(){this.prevented=true;},...extra});
const wanted=()=>{
  const {x,y}=game.player.want||{};
  return x===1?'right':x===-1?'left':y===1?'down':y===-1?'up':'none';
};

game.fullNewGame();game.gameState='playing';
let e=event(96,52);joy.dispatch('pointerdown',e);
expect(e.prevented,'按下摇杆没有阻止浏览器默认手势');
expect(wanted()==='right','向右推摇杆没有立即请求向右');
expect(joy.classList.contains('active'),'按住摇杆没有进入高亮状态');
expect(knob.style.transform&&knob.style.transform!=='translate(0px,0px)','摇杆帽没有跟随手指');

// 按住不动也要不断刷新转向缓存，否则还没到路口请求就会过期。
game.player.distTravelled=50;game.player.wantAtDist=0;game.stepFrame(0);
expect(game.player.wantAtDist===50,'按住摇杆没有在每帧刷新提前转向缓存');

e=event(96,52);joy.dispatch('pointerup',e);
expect(!joy.classList.contains('active'),'松手后摇杆仍保持高亮');
expect(knob.style.transform==='translate(0px,0px)','松手后摇杆帽没有回中');
expect(wanted()==='right','松开摇杆让豆豆急停或清掉了已选方向');

// 四个方向都必须只落在正交轴；接近 45° 时保持上一方向，避免抖动。
const cases=[['down',52,100],['left',4,52],['up',52,4]];
for(const [name,x,y] of cases){
  joy.dispatch('pointerdown',event(x,y));
  expect(wanted()===name,`向${name}推摇杆得到 ${wanted()}`);
  joy.dispatch('pointerup',event(x,y));
}
joy.dispatch('pointerdown',event(96,52));
joy.dispatch('pointermove',event(85,86));
expect(wanted()==='right','接近 45° 的轻微抖动错误切换了轴');

game.togglePause();
expect(game.gameState==='paused','暂停前提失败');
game.stepFrame(0);
expect(!shim.env.document.body.classList.contains('in-game'),'暂停后没有及时退出游玩布局，摇杆仍然可见');
expect(!joy.classList.contains('active')&&knob.style.transform==='translate(0px,0px)',
  '暂停时摇杆没有复位');

const cssChecks=[
  [/\.touch-joystick\s*\{[\s\S]*?display\s*:\s*none/, '摇杆默认没有隐藏'],
  [/@media \(hover:none\), \(pointer:coarse\)[\s\S]*?body\.in-game \.touch-joystick\s*\{display:block/, '触屏开局后没有自动显示摇杆'],
  [/\.touch-joystick\s*\{[\s\S]*?touch-action\s*:\s*none/, '摇杆没有阻止页面滚动/缩放手势'],
  [/id="touchJoystick"[\s\S]*?id="joyKnob"/, '页面缺少完整摇杆结构'],
  [/手机在迷宫上<b>滑动<\/b>，或使用左下角<b>摇杆<\/b>/, '玩法说明没有介绍两种手机操作'],
];
for(const [re,msg] of cssChecks)expect(re.test(html),msg);

if(fail.length){console.error('手机虚拟摇杆回归失败：\n  ✗ '+fail.join('\n  ✗ '));process.exit(1);}
console.log('手机虚拟摇杆：触屏开局自动显示，四向判定与 45° 防抖正确。');
console.log('按住会刷新转向缓存；松手继续跑；暂停复位；滑动操作仍保留。');
