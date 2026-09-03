// 连击加成 / 六关统一速度与能量时长的机制回归。
// 用法：node 源码/工具/test_combo_balance.mjs
// 执行真实源片段，仅在内存里注入测试接口；不生成生产调试钩子。
// 假 canvas 和受控坐标用于机制单测，不代表浏览器或真机操作验证。
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const noop = ()=>{};
const fakeCtx = ()=>new Proxy({}, { get:(_, key)=>{
  if (key === 'measureText') return text=>({width:String(text).length * 7});
  if (key === 'createLinearGradient' || key === 'createRadialGradient')
    return ()=>({addColorStop:noop});
  return noop;
}});
const fakeCanvas = (width=494, height=546)=>({width,height,getContext:()=>fakeCtx()});
const store = new Map();
globalThis.GameGlobal = globalThis;
globalThis.location = {href:'https://example.com/'};
globalThis.requestAnimationFrame = ()=>0;
globalThis.wx = {
  createCanvas:()=>fakeCanvas(),
  getSystemInfoSync:()=>({windowWidth:390,windowHeight:844,pixelRatio:2}),
  getStorageSync:key=>store.has(key) ? store.get(key) : '',
  setStorageSync:(key,value)=>store.set(key,value),
  removeStorageSync:key=>store.delete(key),
  createWebAudioContext:()=>({currentTime:0,state:'running',resume:noop,destination:{},
    createOscillator:()=>({frequency:{setValueAtTime:noop,exponentialRampToValueAtTime:noop},
      connect:value=>value,start:noop,stop:noop}),
    createGain:()=>({gain:{setValueAtTime:noop,exponentialRampToValueAtTime:noop},
      connect:value=>value}),
  }),
  onTouchStart:noop,onTouchEnd:noop,onTouchMove:noop,showKeyboard:noop,hideKeyboard:noop,
  onKeyboardInput:noop,onKeyboardConfirm:noop,onShow:noop,onHide:noop,
  showShareMenu:noop,onShareAppMessage:noop,onShareTimeline:noop,
};

const {installShim} = await import('../微信小游戏版/js/shim.js');
const source = readFileSync(new URL('../neon_maze_fragment.html', import.meta.url), 'utf8');
const start = source.indexOf('<script>');
const end = source.lastIndexOf('</script>');
assert(start >= 0 && end > start, '找不到真实游戏脚本');
const body = source.slice(start + 8, end).trim()
  .replace(/^\(function\(\)\s*\{\s*(?:"use strict";|'use strict';)?/, '')
  .replace(/\}\)\(\);?$/, '');
const createGame = new Function('env', `
  const {document,window,localStorage,getComputedStyle,requestAnimationFrame,
    cancelAnimationFrame,performance}=env;
  const setTimeout=()=>0, clearTimeout=()=>{};
  ${body}
  return {fullNewGame,resetLevel,eatPelletAt,handleGhostCollisions,updateFruit,
    addScore,addComboScore,comboWindow,startPowerMode,endPowerMode,frightSeconds,
    applySpeedModifiers,isEdible,loseLife,togglePause,stepFrame,
    COMBO_SCORE_BOOST,SCORE_MULT,SCORE_BOOST,GHOST_BOUNTY_STEP,BONUS,
    COMBO_WINDOW,COMBO_GRACE_PER,COMBO_GRACE_MAX,COMBO_IDLE_DECAY,
    GHOST_BASE_SPEED,FRIGHT_SECONDS,FRIGHT_GHOST_SPEED_MULT,
    get grid(){return grid;}, get ghosts(){return ghosts;},
    get player(){return player;}, get fruit(){return fruit;},
    get score(){return score;}, get level(){return level;}, set level(v){level=v;},
    get combo(){return combo;}, set combo(v){combo=v;},
    get comboTimer(){return comboTimer;}, set comboTimer(v){comboTimer=v;},
    get frightTimer(){return frightTimer;}, get chain(){return ghostEatChain;},
    get sweeps(){return sweepsThisRun;}, get maxCombo(){return maxComboSeen;},
    get elapsed(){return elapsed;}, get mercy(){return mercySpeedMult;},
    get lives(){return lives;}, set lives(v){lives=v;},
    get pelletsLeft(){return pelletsLeft;}, set pelletsLeft(v){pelletsLeft=v;},
    get state(){return gameState;}, set state(v){gameState=v;},
    set invuln(v){invuln=v;}
  };
`);

function boot(level=1){
  store.clear();
  const shim = installShim({maze:fakeCanvas(),fx:fakeCanvas(1,1)});
  const game = createGame(shim.env);
  game.fullNewGame();
  game.level = level;
  game.resetLevel(false);
  game.state = 'playing';
  shim.el('startOverlay').classList.add('hidden');
  return game;
}
function close(actual, expected, label){
  assert(Math.abs(actual - expected) < 1e-9, `${label}：实际 ${actual}，期望 ${expected}`);
}
function foodCell(game, kind){
  for (let y=0;y<game.grid.length;y++) for (let x=0;x<game.grid[y].length;x++)
    if (game.grid[y][x] === kind) return {x,y};
  assert.fail(`第 ${game.level} 关找不到 ${kind} 测试食物`);
}
function eatFood(game, kind){
  const cell = foodCell(game,kind);
  game.eatPelletAt(cell.x,cell.y);
  return cell;
}
function bite(game, action, points, label){
  const score = game.score, combo = game.combo;
  game.comboTimer = 0.125;
  action();
  assert.equal(game.score - score, points, `${label}入账（只在最后取整）`);
  assert(Number.isInteger(game.score), `${label}总分必须为整数`);
  assert.equal(game.combo, combo + 1, `${label}只续一次连击`);
  close(game.comboTimer,game.comboWindow(),`${label}续满新连击窗口`);
  assert(game.maxCombo >= game.combo, `${label}更新最高连击`);
}
function noBite(game, action, label){
  const before = [game.score,game.combo,game.comboTimer,game.chain];
  action();
  assert.deepEqual([game.score,game.combo,game.comboTimer,game.chain],before,
    `${label}不得刷分、续连击或累加悬赏`);
}
function parkGhosts(game){
  for (const ghost of game.ghosts){
    ghost.state = 'house';
    ghost.releaseAt = 1e9;
  }
}
function collide(game, ghost){
  ghost.state = 'frightened';
  ghost.x = game.player.x;
  ghost.y = game.player.y;
  game.handleGhostCollisions();
}
function speeds(game, expected, label){
  for (const [i,ghost] of game.ghosts.entries()){
    close(ghost.baseSpeed,2.35,`${label}怪物 ${i+1} 基础速度`);
    close(ghost.speed,expected,`${label}怪物 ${i+1} 实际速度`);
  }
}
function quietScene(game){
  parkGhosts(game);
  // 留住关卡中的其余食物，防止测试时自动过关掩盖计时结果。
  const x = Math.round(game.player.x), y = Math.round(game.player.y);
  if ('.o'.includes(game.grid[y][x])) game.pelletsLeft--;
  game.grid[y][x] = ' ';
  game.player.dir = {x:0,y:0};
  game.player.want = {x:0,y:0};
  game.fruit.active = false;
  game.fruit.nextAt = 1e9;
  assert(game.pelletsLeft > 1, '计时场景必须保留未吃食物');
}
function frames(game, count){
  // 1/32 秒既在真实帧长上限内，也能精确抵达 9 秒的到期边界。
  for (let i=0;i<count;i++) game.stepFrame(1/32);
}

const failures = [];
function test(label, run){
  try { run(); console.log('✓ ' + label); }
  catch (error){ failures.push(label + '：' + error.message); console.error('✗ ' + failures.at(-1)); }
}

test('连击独立加成，不重复提高固定奖励或旧榜换算倍率',()=>{
  const g = boot();
  assert.equal(g.COMBO_SCORE_BOOST,1.3);
  assert.equal(g.SCORE_BOOST,1.3);
  assert.equal(g.SCORE_MULT,1.95);
  assert.equal(g.GHOST_BOUNTY_STEP,13000);
  for (const [label,base,raw,expected] of [
    ['普通计分基础',10,false,20],
    ['第一关无伤',g.BONUS.PERFECT_LEVEL,false,1950],
    ['全灭奖励',g.BONUS.GHOST_SWEEP,true,130000],
    ['剩余一条命',g.BONUS.LIFE_LEFT,false,2925],
    ['全程无伤',g.BONUS.FLAWLESS_RUN,false,19500],
  ]){
    const combo = g.combo;
    assert.equal(g.addScore(base,raw),expected,label);
    assert.equal(g.combo,combo,`${label}不是额外一口食物`);
  }
});

test('小豆→小豆→能量星→敌人→晶石：先按旧连击计分，再各续一次',()=>{
  const g = boot();
  parkGhosts(g);
  let eatenCell;
  bite(g,()=>{ eatenCell=eatFood(g,'.'); },25,'小豆 x1');
  noBite(g,()=>g.eatPelletAt(eatenCell.x,eatenCell.y),'已清空的豆子格');
  bite(g,()=>eatFood(g,'.'),51,'小豆 x2');
  bite(g,()=>eatFood(g,'o'),380,'能量星 x3');
  close(g.frightTimer,9,'真实吃星启动时长');
  const enemy = g.ghosts[0];
  bite(g,()=>collide(g,enemy),16900,'第一只敌人（不乘 x4）');
  assert.equal(g.chain,1);
  noBite(g,()=>g.handleGhostCollisions(),'同一只已吃敌人');
  // 本轮已吃过的敌人即使复活，也不能再次支付悬赏。
  enemy.state = 'chase';
  g.invuln = 10;
  noBite(g,()=>g.handleGhostCollisions(),'本轮已吃过的复活敌人');
  Object.assign(g.fruit,{active:true,timer:10,nextAt:9999,x:g.player.x,y:g.player.y});
  bite(g,()=>g.updateFruit(0),3803,'相位晶石 x5');
  assert.equal(g.fruit.active,false);
  noBite(g,()=>g.updateFruit(0),'已经吃完的同一颗晶石');
});

test('悬赏按 16900/33800/50700 递进；续星刷新时长并重置阶梯与资格',()=>{
  const g = boot();
  quietScene(g);
  eatFood(g,'o');
  for (let i=0;i<3;i++){
    bite(g,()=>collide(g,g.ghosts[i]),[16900,33800,50700][i],`第 ${i+1} 只敌人`);
    assert.equal(g.chain,i+1);
  }
  parkGhosts(g);
  frames(g,8);
  close(g.frightTimer,8.75,'续星前已经消耗的时长');
  const beforeCombo = g.combo;
  bite(g,()=>eatFood(g,'o'),Math.round(50*beforeCombo*1.3*1.95),'第二颗能量星');
  close(g.frightTimer,9,'续星必须刷新到 9 秒而非累计');
  assert.equal(g.chain,0,'第二颗星清空上一颗星的悬赏阶梯');
  assert(g.ghosts.every(ghost=>!ghost.eatenThisFright),'新星重置全场被吃资格');
  bite(g,()=>collide(g,g.ghosts[0]),16900,'新一轮第一只敌人');
});

test('完整连击窗口统一增加 10%，x45 起封顶，停止仍三倍消耗',()=>{
  const g = boot();
  close(g.COMBO_WINDOW,1.76,'基础窗口');
  close(g.COMBO_GRACE_PER,0.022,'每级宽限');
  close(g.COMBO_GRACE_MAX,0.99,'宽限上限');
  assert.equal(g.COMBO_IDLE_DECAY,3);
  for (const combo of [1,2,10,44,45,100]){
    g.combo = combo;
    close(g.comboWindow(),(1.6 + Math.min(0.9,combo*0.02))*1.1,`x${combo} 窗口`);
  }
  close(g.comboWindow(),2.75,'高连击封顶窗口');
  quietScene(g);
  g.combo = 10;
  g.comboTimer = g.comboWindow();
  const full = g.comboTimer;
  frames(g,8);
  close(g.comboTimer,full - 0.75,'静止 0.25 秒按三倍扣除');
  // 起步时的移动标记决定本帧消耗速度；真实 update 仍负责移动与转弯。
  g.player.dir = {x:1,y:0};
  const before = g.comboTimer;
  frames(g,1);
  close(g.comboTimer,before - 1/32,'移动中一帧按一倍扣除');
});

for (let level=1;level<=6;level++){
  test(`第 ${level} 关：统一速度/能量时长，三死降速保留且不复合累乘`,()=>{
    const g = boot(level);
    assert.equal(g.ghosts.length,[4,5,6,6,6,7][level-1],'敌人数量不变');
    close(g.GHOST_BASE_SPEED,2.35,'统一基础速度常量');
    close(g.FRIGHT_SECONDS,9,'统一能量时长常量');
    close(g.frightSeconds(),9,'本关能量时长');
    g.applySpeedModifiers();
    speeds(g,2.35,'普通状态');
    g.combo = 100;
    g.comboTimer = g.comboWindow();
    eatFood(g,'o');
    close(g.frightTimer,9,'高连击也不会延长能量时长');
    for (let i=0;i<5;i++) g.applySpeedModifiers();
    speeds(g,2.35*0.85,'受惊状态');
    const combo = g.combo, timer = g.comboTimer;
    g.lives = 10;
    for (let deaths=1;deaths<=3;deaths++){
      g.loseLife();
      assert.equal(g.combo,combo,'死亡保持现有连击规则');
      close(g.comboTimer,timer,'死亡不额外扣除或续满连击');
      close(g.frightTimer,0,'死亡取消能量');
      assert.equal(g.chain,0,'死亡清空本轮悬赏阶梯');
      close(g.mercy,deaths < 3 ? 1 : 0.9,'仅第三次死亡启用降速');
      speeds(g,2.35*(deaths < 3 ? 1 : 0.9),`死亡 ${deaths} 次`);
    }
    eatFood(g,'o');
    for (let i=0;i<5;i++) g.applySpeedModifiers();
    speeds(g,2.35*0.85*0.9,'受惊与温柔降速相乘一次');
    g.endPowerMode();
    speeds(g,2.35*0.9,'能量结束保留本关温柔降速');
    g.resetLevel(false);
    assert.equal(g.mercy,1,'重置关卡取消温柔降速');
    assert.equal(g.combo,1,'重置关卡重置连击');
    assert.equal(g.comboTimer,0);
    speeds(g,2.35,'重置关卡');
  });

  test(`第 ${level} 关：能量模拟时钟、暂停与精确到期一致`,()=>{
    const g = boot(level);
    quietScene(g);
    g.startPowerMode();
    g.combo = 10;
    g.comboTimer = g.comboWindow();
    frames(g,16);
    close(g.frightTimer,8.5,'推进 0.5 秒');
    const beforePause = [g.frightTimer,g.comboTimer,g.combo,g.elapsed,g.score];
    g.togglePause();
    assert.equal(g.state,'paused');
    frames(g,160);
    assert.deepEqual([g.frightTimer,g.comboTimer,g.combo,g.elapsed,g.score],beforePause,
      '暂停 5 秒不得消耗能量或连击窗口');
    g.togglePause();
    assert.equal(g.state,'playing');
    frames(g,16);
    close(g.frightTimer,8,'恢复后继续推进');
    frames(g,255);
    close(g.frightTimer,1/32,'9 秒到期前一帧');
    assert(g.isEdible(g.ghosts[0]),'到期前未吃敌人仍可吃');
    speeds(g,2.35*0.85,'到期前');
    g.ghosts[0].state = 'frightened';
    frames(g,1);
    close(g.frightTimer,0,'恰好 9 秒到期');
    assert(!g.isEdible(g.ghosts[0]),'到期后敌人不可吃');
    assert(g.ghosts.every(ghost=>ghost.state !== 'frightened'),'到期清理受惊状态');
    speeds(g,2.35,'到期后恢复常速');
    frames(g,1);
    assert.equal(g.frightTimer,0,'到期后不会继续变负');
    assert.equal(g.level,level,'未意外过关');
    assert.equal(g.state,'playing','未意外死亡结算');
    assert.equal(g.score,0,'计时场景没有意外吃到食物或敌人');
    assert(g.pelletsLeft > 1,'计时场景保留关卡食物');
  });
}

test('末豆和末星先入账并记录最高连击，再过关重置连击',()=>{
  for (const kind of ['.','o']){
    const g = boot(1);
    quietScene(g);
    const cell = foodCell(g,kind);
    g.player.x = cell.x;
    g.player.y = cell.y;
    g.pelletsLeft = 1;
    g.combo = 9;
    g.comboTimer = g.comboWindow();
    frames(g,1);
    const meal = kind === '.' ? 228 : 1141;
    assert.equal(g.score,meal + 1950,`${kind} 最后一口与第一关无伤奖励`);
    assert.equal(g.level,2,'真正完成并进入下一关');
    assert.equal(g.combo,1,'过关后连击重置');
    assert.equal(g.comboTimer,0);
    assert.equal(g.maxCombo,10,'最后一口的最高连击没有被过关吞掉');
    assert.equal(g.frightTimer,0,'能量不泄漏到下一关');
  }
});

if (failures.length){
  console.error(`\n${failures.length} 项连击平衡回归失败。`);
  process.exitCode = 1;
} else {
  console.log('\n连击平衡机制回归通过（源码内存测试，非真机验证）。');
}
