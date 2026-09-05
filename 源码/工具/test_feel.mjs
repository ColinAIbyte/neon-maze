// 三项手感反馈：连击里程碑、穿墙倒数、敌人保持独立。
//   用法: node test_feel.mjs
//
// 这三样都是"只有声音和几帧画面"的东西，坏掉不会报错、不影响通关，
// 只会让游戏悄悄变得平淡——正是最容易在后续改动里被碰掉、又最不容易发现的
// 一类。所以每一项都盯住可验证的那部分：档位对不对、次数对不对、
// 断连后能不能重新触发、两只受惊敌人相撞后会不会错误合体。
import { readFileSync, writeFileSync, mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os'; import { join } from 'node:path';
const noop=()=>{}; const calls=[];
const fakeCtx=()=>new Proxy({},{get:(_,k)=>{
  if(k==='measureText')return t=>({width:String(t).length*7});
  if(k==='createLinearGradient'||k==='createRadialGradient')return()=>({addColorStop:noop});
  return noop;}});
const fakeCanvas=(w=494,h=546)=>({width:w,height:h,getContext:()=>fakeCtx()});
const store=new Map(); globalThis.GameGlobal=globalThis;
globalThis.location={href:'https://example.com/'};
globalThis.wx={createCanvas:()=>fakeCanvas(),getSystemInfoSync:()=>({windowWidth:390,windowHeight:844,pixelRatio:3}),
 getStorageSync:k=>store.has(k)?store.get(k):'',setStorageSync:(k,v)=>store.set(k,v),removeStorageSync:k=>store.delete(k),
 createWebAudioContext:()=>({currentTime:0,state:'running',resume:noop,destination:{},
  createOscillator:()=>({type:'',frequency:{setValueAtTime:noop,exponentialRampToValueAtTime:noop},connect:d=>d,start:noop,stop:noop}),
  createGain:()=>({gain:{setValueAtTime:noop,exponentialRampToValueAtTime:noop},connect:d=>d})}),
 onTouchStart:noop,onTouchEnd:noop,onTouchMove:noop,showKeyboard:noop,hideKeyboard:noop,
 onKeyboardInput:noop,onKeyboardConfirm:noop,onShow:noop,onHide:noop,showShareMenu:noop,
 onShareAppMessage:noop,onShareTimeline:noop};
globalThis.requestAnimationFrame=()=>0;
const html=readFileSync(new URL('../neon_maze_fragment.html',import.meta.url),'utf8');
let body=html.slice(html.indexOf('<script>')+8,html.lastIndexOf('</script>')).trim()
  .replace(/^\(function\(\)\s*\{\s*(?:"use strict";|'use strict';)?/,'').replace(/\}\)\(\);?$/,'').trim();
const dir=mkdtempSync(join(tmpdir(),'tf-')); const mp=join(dir,'c.mjs');
writeFileSync(mp,`export function createGame(env){
 const document=env.document,window=env.window,localStorage=env.localStorage,
   getComputedStyle=env.getComputedStyle,requestAnimationFrame=env.requestAnimationFrame,
   cancelAnimationFrame=env.cancelAnimationFrame,performance=env.performance;
${body}
 return { fullNewGame, resetLevel, update, render, addPelletScore, Audio2, startPowerMode,
   get combo(){return combo;}, get player(){return player;}, get ghosts(){return ghosts;},
   set gameState(v){gameState=v;}, set level(v){level=v;} };\n}\n`);
const {installShim}=await import(new URL('../微信小游戏版/js/shim.js',import.meta.url));
const shim=installShim({maze:fakeCanvas(),fx:fakeCanvas(1,1)});
const {createGame}=await import(mp);
const g=createGame(shim.env); const el=shim.el; const fail=[];

// 里程碑音效打点
const hits=[]; const orig=g.Audio2.comboMilestone;
g.Audio2.comboMilestone=(m)=>{ hits.push(m); orig&&orig(m); };
g.fullNewGame();
const initial=g.ghosts.map(x=>({state:x.state,releaseAt:x.releaseAt}));
if(initial[0].state!=='exiting'||initial.slice(1).some((x,i)=>x.state!=='house'||x.releaseAt<=initial[i].releaseAt))
  fail.push('敌人没有从单门依次放行，开局仍会叠成一团');
else console.log('敌人放行: '+initial.map(x=>x.releaseAt.toFixed(2)).join(' → ')+' 秒');
g.gameState='playing';
for(let i=0;i<120;i++) g.addPelletScore(15);
console.log('连到 x'+g.combo+'　里程碑触发:', hits.join(' / '));
if(hits.join()!=='10,20,50,100') fail.push('里程碑档位不对: '+hits.join());
console.log('HUD 连击颜色:', el('comboLabel').style.color);

// 开新一局，里程碑要能再触发（本局断连不重报）
const before=hits.length;
g.fullNewGame(); g.gameState='playing';
for(let i=0;i<12;i++) g.addPelletScore(15);
if(hits.length<=before) fail.push('新一局里程碑没有重新触发');
console.log('新一局重新触发:', hits.slice(before).join(' / '));

// 穿墙倒数
const ticks=[]; g.Audio2.phaseTick=(n)=>ticks.push(n);
let ended=0; g.Audio2.phaseEnd=()=>ended++;
g.fullNewGame(); g.gameState='playing'; g.player.phase=4;
for(let i=0;i<60*5;i++) g.update(1/60);
console.log('穿墙倒数:', ticks.join('→')||'（无）', ' 结束音:', ended);
if(ticks.join()!=='3,2,1') fail.push('穿墙倒数不对: '+ticks.join());
if(ended!==1) fail.push('穿墙结束音应当正好一次，实际 '+ended);

// 用户明确选择“不融合”：受惊敌人即使完全重叠，也必须仍是两只独立角色。
g.fullNewGame(); g.level=1; g.resetLevel(false); g.gameState='playing';
g.ghosts.forEach(x=>{ x.state='chase'; });
g.startPowerMode();
const fr=g.ghosts.filter(x=>x.state==='frightened');
if(fr.length>=2){ fr[1].x=fr[0].x; fr[1].y=fr[0].y; g.update(1/60);
  const merged=g.ghosts.some(x=>x.state==='fused-hidden'||x.isFusionHost||x.fusedWith);
  if(merged||g.ghosts.length!==4) fail.push('受惊敌人相撞后没有保持四只独立角色');
  else console.log('敌人独立: 相撞后仍是四只可见角色');
  try{ g.render(); console.log('相撞后的独立渲染: 正常'); }catch(e){ fail.push('独立渲染抛异常: '+e.message); }
}
console.log('\n'+(fail.length?'失败:\n  '+fail.join('\n  '):'三项手感反馈都正确。'));
process.exit(fail.length?1:0);
