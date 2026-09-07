/* CrazyGames 适配层。这层代码只有在他们的 iframe 里才跑得起来，没法在本地
 * 用浏览器验，所以拿假的 SDK 在 Node 里把每条分支都走一遍 —— 否则每验证
 * 一次就要重新上传一版、等业主拖一次文件夹。
 *
 * 最要紧的一条是最后那个用例：SDK 加载不出来（玩家开了广告拦截）时，游戏
 * 必须照常能玩。这既是 CrazyGames 的硬性要求，也是常识。
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';

const SRC = readFileSync(new URL('../渠道/crazygames-adapter.js', import.meta.url), 'utf8');

function harness({ sdk = 'ok', state = 'ready' } = {}){
  const log = [];
  const timers = [];
  let cur = state;

  const game = {
    state: () => cur,
    start: () => { log.push('game.start'); if (cur === 'ready') cur = 'playing'; },
    pause: () => log.push('game.pause'),
    resume: () => log.push('game.resume'),
    silence: v => log.push('silence:' + v),
  };

  let adCallbacks = null;
  const SDK = {
    environment: sdk === 'disabled' ? 'disabled' : 'crazygames',
    init: async () => { log.push('init'); },
    game: {
      loadingStart: () => log.push('loadingStart'),
      loadingStop: () => log.push('loadingStop'),
      gameplayStart: () => log.push('gameplayStart'),
      gameplayStop: () => log.push('gameplayStop'),
    },
    ad: {
      requestAd: (kind, cbs) => { log.push('requestAd:' + kind); adCallbacks = cbs; },
    },
  };

  const ctx = {
    window: { NeonGame: game },
    document: { readyState: 'complete', addEventListener(){} },
    setInterval: fn => { timers.push(fn); return timers.length; },
    clearInterval: () => {},
    setTimeout: () => 0,
    clearTimeout: () => {},
    console,
  };
  if (sdk !== 'missing') ctx.window.CrazyGames = { SDK };
  ctx.window.window = ctx.window;

  vm.runInNewContext(SRC, ctx);
  return {
    log, timers,
    setState: s => { cur = s; },
    getState: () => cur,
    tickAll: () => timers.forEach(fn => fn()),
    ad: () => adCallbacks,
  };
}

const settle = () => new Promise(r => setImmediate(() => setImmediate(r)));

/* ---------- 正常路径 ---------- */
{
  const h = harness({ state: 'ready' });
  await settle();
  assert.ok(h.log.includes('init'), 'SDK 没初始化');
  assert.ok(h.log.includes('loadingStop'), '没上报加载完成');

  /* Full Launch 要求落地即游戏：状态是 ready 时要替玩家按下开始。 */
  h.tickAll();
  assert.ok(h.log.includes('game.start'), '没有自动开始，Full Launch 的「落地即游戏」不满足');
  assert.equal(h.getState(), 'playing');

  h.tickAll();
  assert.ok(h.log.includes('gameplayStart'), '开始玩了却没报 gameplayStart');

  const before = h.log.filter(x => x === 'gameplayStart').length;
  h.tickAll();
  assert.equal(h.log.filter(x => x === 'gameplayStart').length, before,
    '状态没变还在重复上报 gameplayStart');

  h.setState('paused'); h.tickAll();
  assert.ok(h.log.includes('gameplayStop'), '暂停了没报 gameplayStop');

  /* 一局结束插一条中插广告，并且期间必须闭嘴。 */
  h.setState('over'); h.tickAll();
  assert.ok(h.log.includes('requestAd:midgame'), '一局结束没请求中插广告，等于没有收入');
  h.ad().adStarted();
  assert.ok(h.log.includes('silence:true'), '广告开始了没静音');
  assert.ok(h.log.includes('game.pause'), '广告开始了没暂停游戏');
  h.ad().adFinished();
  assert.ok(h.log.includes('silence:false'), '广告结束了没恢复声音 —— 玩家会一直听不到声音');

  /* 广告不能重复请求：状态还停在 over，再 tick 也只该有一次。 */
  const ads = h.log.filter(x => x.startsWith('requestAd')).length;
  assert.equal(ads, 1);
  h.tickAll(); h.tickAll();
  assert.equal(h.log.filter(x => x.startsWith('requestAd')).length, 1,
    '玩家停在结算页不动，广告被反复请求 —— 只该在刚结束那一下插一次');
}

/* ---------- 广告失败也要恢复 ---------- */
{
  const h = harness({ state: 'over' });
  await settle();
  h.tickAll();
  h.ad().adStarted();
  h.ad().adError({ code: 'unfilled' });
  assert.ok(h.log.includes('silence:false'), '广告加载失败后没恢复声音');
}

/* ---------- SDK 缺席：游戏必须照常 ---------- */
{
  const h = harness({ sdk: 'missing', state: 'ready' });
  await settle();
  h.tickAll();
  assert.deepEqual(h.log, [], 'SDK 没加载出来时不该有任何动作（游戏要照常能玩）');
}

/* ---------- 不在 CrazyGames 域下：不接管 ---------- */
{
  const h = harness({ sdk: 'disabled', state: 'ready' });
  await settle();
  h.tickAll();
  assert.ok(!h.log.includes('gameplayStart'), 'environment=disabled 时不该接管');
  assert.ok(!h.log.includes('game.start'), 'environment=disabled 时不该自动开始');
}

/* ---------- 适配层依赖的钩子，真页面上必须真的存在 ---------- */
/* 上面全程用的是假的 NeonGame。假的和真的对不上，测试就是自欺 ——
   所以这里回头对一遍真正构建出来的页面。 */
{
  const page = readFileSync(new URL('../../index.html', import.meta.url), 'utf8');
  for (const [hook, why] of [
    ['state:',   '适配层靠它判断在不在玩'],
    ['pause:',   '广告开始要暂停'],
    ['silence:', '广告期间要临时静音（且不能改玩家的静音设置）'],
    ['start:',   '「落地即游戏」靠它替玩家按开始'],
  ]){
    assert.ok(new RegExp('\\n\\s*' + hook.replace(':', ':')).test(page)
      || page.includes(hook), `网页版的 NeonGame 少了 ${hook} —— ${why}`);
  }
  /* 临时静音绝不能落盘：玩家的静音偏好是他自己的选择。 */
  assert.match(page, /setSilenced\(v\)\{ silenced = !!v; \}/,
    'setSilenced 变了 —— 它必须只改内存，不写 localStorage');
}

console.log('✓ CrazyGames 适配层：自动开始、gameplayStart/Stop 只在状态变化时上报、结束插中插广告、'
          + '广告期间静音且失败也恢复、SDK 缺席或非 CrazyGames 域下完全不接管');
