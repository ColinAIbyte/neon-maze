// 只注入内存测试接口；生产片段和生成入口不含这些接口。
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';

const noop = ()=>{};
const ctx = new Proxy({}, {get:(_,key)=>{
  if (key === 'measureText') return s=>({width:String(s).length*7});
  if (/^create.*Gradient$/.test(String(key))) return ()=>({addColorStop:noop});
  return noop;
}});
const canvas = ()=>({width:494,height:546,getContext:()=>ctx});
const store = new Map();
globalThis.GameGlobal = globalThis;
globalThis.requestAnimationFrame = ()=>0;
globalThis.wx = {
  createCanvas:canvas,
  getSystemInfoSync:()=>({windowWidth:390,windowHeight:844,pixelRatio:2}),
  getStorageSync:k=>store.get(k) || '', setStorageSync:(k,v)=>store.set(k,v),
  removeStorageSync:k=>store.delete(k),
  createWebAudioContext:()=>({currentTime:0,state:'running',resume:noop,destination:{},
    createOscillator:()=>({frequency:{setValueAtTime:noop,exponentialRampToValueAtTime:noop},
      connect:d=>d,start:noop,stop:noop}),
    createGain:()=>({gain:{setValueAtTime:noop,exponentialRampToValueAtTime:noop},connect:d=>d}),
  }),
};
const {installShim} = await import('../微信小游戏版/js/shim.js');
const source = readFileSync(new URL('../neon_maze_fragment.html',import.meta.url),'utf8');
const body = source.slice(source.indexOf('<script>')+8, source.lastIndexOf('</script>'))
  .trim().replace(/^\(function\(\)\s*\{\s*(?:"use strict";|'use strict';)?/,'')
  .replace(/\}\)\(\);?$/,'');
let now = new Date(2026,8,2,12).getTime();
class TestDate extends Date { constructor(...args){super(...(args.length ? args : [now]));} }
const create = new Function('env', `
  const {document,window,localStorage,getComputedStyle,requestAnimationFrame,
    cancelAnimationFrame,performance}=env;
  const Date=env.Date, setTimeout=()=>0, clearTimeout=()=>{};
  ${body}
  return {loadProgress,noteOwl,noteOwlsSeen,owlCodexView,awardStars,starsOf,totalStars,
    dailyLevel,dailyBest,recordDaily,startDaily,startPractice,fullNewGame,endGame,
    openOwl,closeOwl,handleGhostCollisions,loadScores,todayKey,
    get progress(){return progress}, get dailyRun(){return dailyRun},
    get ghosts(){return ghosts}, get player(){return player},
    get state(){return gameState}, set state(v){gameState=v},
    set score(v){score=v}, set deaths(v){deathsThisLevel=v},
    set eaten(v){ghostsEatenThisLevel=v}, get eaten(){return ghostsEatenThisLevel},
    set fright(v){frightTimer=v}, set invuln(v){invuln=v}
  };
`);
function boot(save){
  store.clear();
  if (save !== undefined) store.set('doudou.progress.v1',JSON.stringify(save));
  const shim = installShim({maze:canvas(),fx:canvas()});
  const game = create({...shim.env,Date:TestDate});
  return {game,shim};
}

for (const bad of [null,1,[],{owls:{chaser:1}},{stars:null,owls:[],daily:1},
  {stars:{1:-1,2:99,3:'7'},owls:{chaser:{met:'Infinity',caught:-4,ate:3.8},
    patrol:{met:Infinity,caught:null,ate:1e20},super:{met:100},unknown:{ate:1}},
    daily:{d:20260902,lv:1,best:'Infinity'}}]){
  const {game:g} = boot(bad);
  g.fullNewGame();
  assert.equal(g.owlCodexView().length,4);
  assert.deepEqual(Object.keys(g.progress.owls).sort(),['ambush','chaser','patrol','shy']);
  for (const e of Object.values(g.progress.owls)) for (const value of Object.values(e)){
    assert(Number.isInteger(value) && value >= 0 && value <= 1e9);
  }
  assert(g.totalStars() >= 0 && g.totalStars() <= 18);
  assert(Number.isFinite(g.dailyBest()));
}
console.log('✓ 损坏存档不会白屏：条目/计数/ID/星星/每日成绩均规范化');

const {game:g,shim} = boot({stars:{1:3},owls:{chaser:{met:1,caught:2,ate:3}}});
const before = JSON.stringify(g.progress);
g.noteOwl('__proto__','met'); g.noteOwl('super','met'); g.noteOwl('chaser','constructor');
assert.equal(JSON.stringify(g.progress),before);
g.noteOwl('chaser','ate');
assert.equal(g.progress.owls.chaser.ate,4);
assert.deepEqual(g.owlCodexView().map(o=>[o.id,o.color]),
  [['chaser','--cyan'],['ambush','--danger'],['shy','--tang'],['patrol','--pink']]);
g.deaths=0; g.eaten=2;
assert.equal(g.awardStars(3),3);
assert.equal(g.awardStars(3),0);
g.deaths=4; g.eaten=0; g.awardStars(3);
assert.equal(g.starsOf(3),3);
console.log('✓ 星星只增不减；图鉴仅含线上四种敌人与正确配色');

g.fullNewGame();
const enemy=g.ghosts[0];
for (const e of g.ghosts) e.state='house';
enemy.state='chase'; enemy.x=g.player.x; enemy.y=g.player.y;
g.fright=3;
const ateBefore=g.progress.owls[enemy.id].ate;
g.handleGhostCollisions();
assert.equal(g.eaten,1);
assert.equal(g.progress.owls[enemy.id].ate,ateBefore+1);
enemy.state='chase'; enemy.eatenThisFright=false; g.fright=0; g.invuln=0;
const caughtBefore=g.progress.owls[enemy.id].caught;
g.handleGhostCollisions();
assert.equal(g.progress.owls[enemy.id].caught,caughtBefore+1);
g.state='playing';g.openOwl();assert.equal(g.state,'paused');g.closeOwl();
assert.equal(g.state,'paused');
console.log('✓ 真实碰撞路径记录反击/死亡；图鉴关闭不擅自恢复游戏');

shim.env.localStorage.setItem('doudou.reached','6');
const boardBefore=JSON.stringify(g.loadScores());
const levels=new Set();
for(let day=1;day<=28;day++){ now=new Date(2026,8,day,12).getTime();levels.add(g.dailyLevel()); }
assert(levels.size>=4,'每日关卡不能因整数溢出固定不变');
now=new Date(2026,8,2,23,59).getTime();
g.startDaily();assert.equal(g.dailyRun.d,20260902);
const challengeLevel=g.dailyRun.lv;
g.score=1000;g.endGame(false);
assert.equal(g.dailyBest(),1000);
assert.equal(JSON.stringify(g.loadScores()),boardBefore);
g.startDaily();
now=new Date(2026,8,3,0,1).getTime();
g.score=2000;g.endGame(false);
assert.equal(g.progress.daily.d,20260902);
assert.equal(g.progress.daily.lv,challengeLevel);
assert.equal(g.dailyBest(),0);
g.fullNewGame();assert.equal(g.dailyRun,false);
g.startPractice(2);assert.equal(g.dailyRun,false);
console.log('✓ 每日挑战稳定选关、不入排行榜、跨午夜不污染次日、开新局正确复位');
