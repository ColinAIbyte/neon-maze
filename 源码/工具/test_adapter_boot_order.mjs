/* 适配层的启动时机。这条测试是一个线上事故换来的。
 *
 * 两个渠道的适配层都注入在 <head>，而 window.NeonGame 是在 <body> 末尾
 * 才定义的。第一版 GameMonetize 的注入漏了 defer，脚本在 head 里同步跑，
 * 第一行 `const game = window.NeonGame; if (!game) return;` 直接退出 ——
 * SDK 从头到尾没加载，玩家玩到一局结束也不会出广告。
 *
 * 而这件事在本地一点征兆都没有：适配层的单元测试里 NeonGame 是我自己
 * 提前塞好的假对象，永远存在；隔离测试只看文件在不在包里。两边都绿。
 * 是业主在 GameMonetize 的验证弹窗里玩到 game over、广告没出来才暴露的。
 *
 * 所以这里锁两道：
 *   1. 适配层在 NeonGame 尚未定义时加载，等它出现后仍然要正常接管；
 *   2. 构建注入的 <script> 必须带 defer。
 * 任一道单独都不够 —— defer 挡不住宿主平台重排脚本，等待逻辑也不该成为
 * 省掉 defer 的借口。
 */
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { execFileSync } from 'node:child_process';
import vm from 'node:vm';

const here = p => fileURLToPath(new URL(p, import.meta.url));

/* ---------- 1. 晚到的 NeonGame 也要认 ---------- */
function bootLate(src, extraGlobals = {}){
  const log = [];
  const timers = [];
  const win = { ...extraGlobals };
  win.window = win;
  const ctx = {
    window: win,
    document: {
      readyState: 'loading',
      addEventListener(_, fn){ ctx.__domReady = fn; },
      getElementsByTagName: () => [{ parentNode: { insertBefore(){ log.push('sdk-script-inserted'); } } }],
      getElementById: () => null,
      createElement: () => ({ setAttribute(){}, set src(v){ log.push('src:' + v); } }),
    },
    setInterval: fn => { timers.push(fn); return timers.length; },
    clearInterval: () => {}, setTimeout: () => 0, clearTimeout: () => {},
    console,
  };
  vm.runInNewContext(src, ctx);
  return {
    log, timers, win, ctx,
    /* 脚本已经跑完了，游戏这时候才出现 —— 正是 <head> 里同步执行的情形。 */
    gameArrives(game){ win.NeonGame = game; timers.forEach(fn => fn()); },
  };
}

const fakeGame = () => ({
  state: () => 'ready', start(){}, pause(){}, resume(){}, silence(){},
});

/* GameMonetize：游戏晚到之后，SDK_OPTIONS 必须被设上、SDK 必须被插入。 */
{
  const src = readFileSync(here('../渠道/gamemonetize-adapter.js'), 'utf8');
  const h = bootLate(src, { NEON_GM_ID: 'testhash123456' });
  assert.equal(h.win.SDK_OPTIONS, undefined, '游戏还没出现时不该急着初始化');
  h.gameArrives(fakeGame());
  assert.ok(h.win.SDK_OPTIONS, 'NeonGame 出现后 SDK_OPTIONS 仍然没设 —— 广告永远不会来');
  assert.equal(h.win.SDK_OPTIONS.gameId, 'testhash123456', 'gameId 没传给 SDK');
  assert.ok(h.log.some(l => l.includes('api.gamemonetize.com/sdk.js')), 'SDK 脚本没有被插入');
}

/* CrazyGames：同样不能因为脚本比游戏先跑就永久瘫掉。 */
{
  const src = readFileSync(here('../渠道/crazygames-adapter.js'), 'utf8');
  const h = bootLate(src, {});
  h.gameArrives(fakeGame());
  assert.ok(h.timers.length > 0,
    'NeonGame 晚到之后适配层没有起任何轮询 —— 它已经永久退出了');
}

/* ---------- 2. 构建注入必须带 defer ---------- */
const cases = [
  ['CrazyGames', here('../../crazygames上传包/neon-maze/index.html'), null],
  ['GameMonetize', null, here('../../gamemonetize上传包/neon-maze-gamemonetize.zip')],
];
let checked = 0;
for (const [name, file, zip] of cases){
  let html = null;
  if (file && existsSync(file)) html = readFileSync(file, 'utf8');
  else if (zip && existsSync(zip)) html = execFileSync('unzip', ['-p', zip, 'index.html'], { encoding: 'utf8' });
  if (html === null) continue;               // 那个渠道的包还没打，跳过
  const tag = html.match(/<script[^>]*adapter\.js[^>]*>/);
  assert.ok(tag, `${name} 包里找不到适配层的 script 标签`);
  assert.match(tag[0], /\bdefer\b/,
    `${name} 的适配层没有 defer —— 它会在 <head> 里先于 NeonGame 执行，SDK 永远不会加载：\n${tag[0]}`);
  checked++;
}
assert.ok(checked > 0, '两个渠道的包一个都没打出来，这半条测试等于空跑');

console.log(`✓ 适配层启动时机：NeonGame 晚到也能接管；${checked} 个渠道包的注入都带 defer`);
