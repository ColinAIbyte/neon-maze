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
    cancelAnimationFrame,performance,fetch}=env;
  const Date=env.Date, setTimeout=()=>0, clearTimeout=()=>{};
  ${body}
  return {loadProgress,noteOwl,noteOwlsSeen,owlCodexView,awardStars,starsOf,totalStars,
    dailyLevel,dailyBest,recordDaily,startDaily,startPractice,fullNewGame,endGame,
    openOwl,closeOwl,handleGhostCollisions,loadScores,todayKey,maxLevelReached,
    noteLevelReached,bestScore,saveScores,Audio2,getPlayerId,validPlayerId,
    CloudLeaderboard,CLIENT_VERSION,
    get progress(){return progress}, get dailyRun(){return dailyRun},
    get localSave(){return localSave},
    get ghosts(){return ghosts}, get player(){return player},
    get state(){return gameState}, set state(v){gameState=v},
    set score(v){score=v}, set deaths(v){deathsThisLevel=v},
    set eaten(v){ghostsEatenThisLevel=v}, get eaten(){return ghostsEatenThisLevel},
    set fright(v){frightTimer=v}, set invuln(v){invuln=v}
  };
`);
function boot(save, extra={}, runtime={}){
  if (!runtime.reuseStore) store.clear();
  if (save !== undefined) store.set('doudou.progress.v1',JSON.stringify(save));
  for (const [key,value] of Object.entries(extra)) store.set(key,value);
  const shim = installShim({maze:canvas(),fx:canvas()});
  if (runtime.config) shim.env.window.NEON_MAZE_CONFIG = runtime.config;
  const game = create({...shim.env,Date:TestDate,fetch:runtime.fetch,
    localStorage:runtime.localStorage || shim.env.localStorage});
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

const legacyBoard = [{id:'old-best',name:'豆豆',score:123456,level:4,combo:20,won:false,date:'2026-09-02'}];
const {game:savedGame} = boot({stars:{1:3,2:5},owls:{chaser:{met:1,caught:2,ate:3}}},{
  'doudou.reached':'4',
  'doudou.muted.v1':'1',
  'doudou.scores.v3':JSON.stringify(legacyBoard),
});
assert.equal(savedGame.maxLevelReached(),4);
assert.equal(savedGame.totalStars(),4);
assert.equal(savedGame.Audio2.isMuted(),true);
assert.equal(savedGame.bestScore(),123456);
let unified = JSON.parse(store.get('doudou.save.v1'));
assert.equal(unified.version,2);
assert(savedGame.validPlayerId(unified.playerId));
assert.equal(unified.highScore,123456);
assert.equal(unified.maxLevel,4);
assert.deepEqual(unified.stars,{1:3,2:5});
assert.deepEqual(unified.settings,{muted:true});
savedGame.noteLevelReached(6);
savedGame.Audio2.setMuted(false);
unified = JSON.parse(store.get('doudou.save.v1'));
assert.equal(unified.maxLevel,6);
assert.equal(unified.settings.muted,false);
assert.equal(store.get('doudou.reached'),'6');
assert.equal(store.get('doudou.muted.v1'),'0');

const {game:recoveredGame} = boot({stars:{3:7}}, {
  'doudou.save.v1':'{broken json',
  'doudou.reached':'3',
});
assert.equal(recoveredGame.maxLevelReached(),3);
assert.equal(recoveredGame.starsOf(3),3);
assert([...store.keys()].some(key=>key.startsWith('doudou.save.v1.corrupt.')));
console.log('✓ 统一存档迁移最高分/关卡/星级/设置；损坏值留备份并安全恢复');

const firstPlayerId = recoveredGame.getPlayerId();
const recoveredSave = store.get('doudou.save.v1');
const {game:returningGame} = boot(undefined, {'doudou.save.v1':recoveredSave});
assert.equal(returningGame.getPlayerId(),firstPlayerId);
assert(returningGame.validPlayerId(firstPlayerId));
const {game:newPlayer} = boot();
assert(newPlayer.validPlayerId(newPlayer.getPlayerId()));
assert.notEqual(newPlayer.getPlayerId(),firstPlayerId);
const {game:badIdPlayer} = boot(undefined, {
  'doudou.save.v1':JSON.stringify({version:2,playerId:'email@example.com',maxLevel:2}),
});
assert(badIdPlayer.validPlayerId(badIdPlayer.getPlayerId()));
assert.notEqual(badIdPlayer.getPlayerId(),'email@example.com');
console.log('✓ 匿名 player_id 跨会话稳定、不同安装隔离、坏值自动重建且不含设备指纹');

// 中文和英文标签页共享同一份浏览器存储，但各有启动时的陈旧内存状态。
const {game:tabA} = boot(undefined,{'doudou.muted.v1':'1'});
const {game:tabB} = boot(undefined,{}, {reuseStore:true});
assert.equal(tabA.getPlayerId(),tabB.getPlayerId());
tabB.saveScores([{...legacyBoard[0],score:987654}]);
tabB.noteLevelReached(6);
tabB.deaths=0;tabB.eaten=2;tabB.awardStars(3);
tabB.Audio2.setMuted(false);
// A 原本只有第 1 关、0 分、0 星且静音；后来解锁第 2 关和记录碰撞。
tabA.noteLevelReached(2);
tabA.noteOwl('chaser','ate');
let sharedSave = JSON.parse(store.get('doudou.save.v1'));
assert.equal(sharedSave.highScore,987654);
assert.equal(sharedSave.maxLevel,6);
assert.equal(store.get('doudou.reached'),'6');
assert.equal(sharedSave.stars[3],7);
assert.equal(JSON.parse(store.get('doudou.progress.v1')).stars[3],7);
assert.equal(sharedSave.settings.muted,false);
assert.equal(tabA.bestScore(),987654,'本机最高分缓存也应看到保存时合并的峰值');
// 两页随后各拿不同关的星星，交错写入后两份存档都必须保留并集。
tabA.deaths=2;tabA.eaten=0;tabA.awardStars(1);
tabB.noteOwl('patrol','ate');
sharedSave = JSON.parse(store.get('doudou.save.v1'));
assert.deepEqual(sharedSave.stars,{1:1,3:7});
assert.deepEqual(JSON.parse(store.get('doudou.progress.v1')).stars,{1:1,3:7});
// 用户在陈旧页明确改变设置仍然有效，普通进度写入不得覆盖这个选择。
tabA.Audio2.setMuted(true);
tabB.noteOwl('chaser','ate');
assert.equal(JSON.parse(store.get('doudou.save.v1')).settings.muted,true);
tabB.Audio2.setMuted(false);
tabA.noteOwl('chaser','caught');
assert.equal(JSON.parse(store.get('doudou.save.v1')).settings.muted,false);
const {game:tabReloaded} = boot(undefined,{}, {reuseStore:true});
assert.equal(tabReloaded.maxLevelReached(),6);
assert.equal(tabReloaded.bestScore(),987654);
assert.equal(tabReloaded.starsOf(3),3);
assert.equal(tabReloaded.starsOf(1),1);
assert.equal(tabReloaded.Audio2.isMuted(),false);
console.log('✓ 双标签交错保存不丢星、不降最高分和解锁；显式取消静音不会被旧页恢复');

// 模拟首次打开时两个读取都还没看到另一页的存档，但实际写入前已出现有效 ID。
const sharedPlayerId = tabReloaded.getPlayerId();
let missingIdReads = 2;
const racingStorage = {
  getItem(key){
    if (key === 'doudou.save.v1' && missingIdReads-- > 0) return null;
    return store.has(key) ? store.get(key) : null;
  },
  setItem:(key,value)=>store.set(key,value),
  removeItem:key=>store.delete(key),
};
const {game:racingTab} = boot(undefined,{}, {reuseStore:true,localStorage:racingStorage});
assert.equal(racingTab.getPlayerId(),sharedPlayerId);
assert.equal(JSON.parse(store.get('doudou.save.v1')).playerId,sharedPlayerId);
const mutedConflict = JSON.parse(store.get('doudou.save.v1'));
mutedConflict.settings.muted = false;
const {game:explicitUnmute} = boot(undefined,{
  'doudou.save.v1':JSON.stringify(mutedConflict),
  'doudou.muted.v1':'1',
});
assert.equal(explicitUnmute.Audio2.isMuted(),false);
console.log('✓ 首次并发写入沿用已有匿名 ID；新存档的取消静音优先于旧静音键');

const cloudCalls = [];
const cloudFetch = async (url,options={})=>{
  cloudCalls.push({url,options});
  if (url.includes('leaderboard_public')) return {
    ok:true,status:200,json:async()=>[
      {player_name:'<高手>',score:500000,level:6,max_combo:88,won:true,played_at:'2026-09-04T00:00:00Z'},
    ],
  };
  return {ok:true,status:200,json:async()=>({accepted:true})};
};
const cloudRuntime = {
  config:{supabase:{url:'https://abcdefghij.supabase.co',anonKey:'a'.repeat(64)}},
  fetch:cloudFetch,
};
const {game:cloudGame} = boot(undefined,{},cloudRuntime);
assert.equal(cloudGame.CloudLeaderboard.enabled(),true);
const cloudSubmit = await cloudGame.CloudLeaderboard.submit({
  playerId:cloudGame.getPlayerId(),runId:'123e4567-e89b-42d3-a456-426614174000',
  name:'豆豆<script>',score:123456,level:4,maxCombo:22,won:false,durationMs:65432,
  deaths:2,ghostsEaten:5,sweeps:1,
});
assert.equal(cloudSubmit.status,'ok');
const submitted = JSON.parse(cloudCalls[0].options.body);
assert.deepEqual(Object.keys(submitted).sort(),[
  'p_client_version','p_deaths','p_duration_ms','p_ghosts_eaten','p_level','p_max_combo',
  'p_player_id','p_player_name','p_run_id','p_score','p_sweeps','p_won',
]);
assert.equal(submitted.p_player_name,'豆豆script');
assert.equal(submitted.p_client_version,cloudGame.CLIENT_VERSION);
const cloudTop = await cloudGame.CloudLeaderboard.top();
assert.equal(cloudTop.status,'ok');
assert.deepEqual(cloudTop.data[0],{name:'高手',score:500000,level:6,combo:88,won:true});
const {game:offlineGame} = boot();
assert.equal(offlineGame.CloudLeaderboard.enabled(),false);
assert.equal((await offlineGame.CloudLeaderboard.submit({})).status,'disabled');
console.log('✓ Supabase 未配置时离线降级；配置后只上传白名单字段并清洗云端榜单');

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

g.noteLevelReached(6);
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
