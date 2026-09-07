/* 排行榜浮层的地址处理。两个真实事故各锁一条。
 *
 * 1) 改地址栏不能把功能弄死。CrazyGames 把游戏放在 iframe 里，那边点
 *    「Global Leaderboard」毫无反应，而同一份构建在 itch 上正常 —— 差别只
 *    可能出在 history 调用上（它是 open() 里第一件事，抛了后面的浮层就没了）。
 *    地址是锦上添花，浮层才是功能：history 一律包 try/catch。
 *
 * 2) 有些静态主机不把 `dir/` 映射到 `dir/index.html`（itch 和 CrazyGames 的
 *    CDN 都是）。地址栏改成 `.../leaderboard/` 后玩家一刷新就 404。语言路由
 *    早就用 NEON_DIR_INDEX 绕开了，这里当初漏掉了半边。
 *    补上之后地址变成 `.../leaderboard/index.html`，认路径的正则也得跟着放宽，
 *    否则浏览器「后退」再也拉不回排行榜。
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const src = readFileSync(new URL('../../assets/leaderboard-bridge.js', import.meta.url), 'utf8');

/* ---------- 1. history 调用必须全部被包住 ---------- */
assert.match(src, /function tryHistory\(fn\)\{ try \{ fn\(\); return true; \} catch/,
  'tryHistory 不见了：history 调用一旦抛异常，排行榜就整个打不开');

const bare = src.split('\n').filter(l =>
  /history\.(push|replace)State\(/.test(l) && !/tryHistory\(/.test(l));
assert.deepEqual(bare, [],
  '这些行直接调用了 history，没走 tryHistory —— 在 iframe 里会把排行榜弄死：\n' + bare.join('\n'));

/* ---------- 2. 目录索引后缀 ---------- */
assert.match(src, /const DIR_INDEX = typeof window\.NEON_DIR_INDEX === 'string'/,
  'DIR_INDEX 没读出来');
for (const fn of ['gamePath', 'hallPath']){
  const line = src.split('\n').find(l => l.includes(`const ${fn} =`));
  assert.ok(line && line.includes('DIR_INDEX'),
    `${fn} 没拼上 DIR_INDEX，itch / CrazyGames 上刷新会 404`);
}

/* ---------- 3. 认路径的正则要认三种写法 ---------- */
const m = src.match(/const onHallPath = \(\) => (\/.*?\/)\.test\(location\.pathname\)/);
assert.ok(m, '找不到 onHallPath 的正则');
const re = new RegExp(m[1].slice(1, -1));
for (const p of ['/leaderboard', '/leaderboard/', '/leaderboard/index.html',
                 '/en/leaderboard/index.html', '/html/19127805/en/leaderboard/']){
  assert.ok(re.test(p), `onHallPath 认不出 ${p} —— 后退键拉不回排行榜`);
}
for (const p of ['/en/', '/leaderboard/x.html', '/leaderboardindex.html', '/']){
  assert.ok(!re.test(p), `onHallPath 误判了 ${p}`);
}

console.log('✓ 排行榜地址：history 全部包了 try/catch；gamePath/hallPath 带 DIR_INDEX；三种路径写法都认得');
