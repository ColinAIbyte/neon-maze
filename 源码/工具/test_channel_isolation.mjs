/* 广告只许出现在 CrazyGames 那一份包里。
 *
 * 业主的原话是「仅限上 CrazyGames 的版本，别的板块要隔离开」。隔离目前
 * 是靠「别的构建脚本根本不打包 SDK 和适配层」实现的 —— 但这种约定很脆：
 * 以后谁把注入那几行挪进 build_web，或者手滑把 adapter 加进白名单，
 * 自己的域名上就会毫无征兆地冒出广告，而且没人会立刻发现。
 *
 * 所以这条测试反过来盯着产物：CrazyGames 的包里必须有这些东西，其他每一份
 * 产物里必须一个字都没有。顺带盯住开始界面 —— 「落地即游戏」是 CrazyGames
 * 的要求，泄漏到别的渠道就等于把开始菜单弄丢了。
 */
import assert from 'node:assert/strict';
import { readFileSync, existsSync, readdirSync, statSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { join } from 'node:path';
import { execFileSync } from 'node:child_process';

const here = p => fileURLToPath(new URL(p, import.meta.url));
const ROOT = here('../../');

/* 每个带广告的渠道各有一组专属痕迹。任何一条出现在**不属于它的**产物里
   都算越界 —— 既包括漏进免费渠道（网页/微信/itch），也包括两个广告渠道
   互相串味（GameMonetize 的 SDK 跑到 CrazyGames 包里同样是错的）。 */
const GM_MARKERS = [
  'api.gamemonetize.com',
  'gamemonetize-adapter',
  'SDK_OPTIONS',
  'showBanner',
  'NEON_GM_ID',
];
const MARKERS = [
  'sdk.crazygames.com',
  'crazygames-adapter',
  'CrazyGames.SDK',
  /* 注意是**赋值**不是名字：共享源码里 client_version 那句会读
     window.NEON_CHANNEL，所以每个渠道的产物都含这个标识符；真正越界的是
     有人去写它。第一版拿名字当特征，当场把自己的网页版判成了泄漏。 */
  'NEON_CHANNEL=',
  "requestAd('midgame'",
];
/* 免费渠道（网页 / 微信 / itch）两组都不许有。 */
const ALL_MARKERS = [...MARKERS, ...GM_MARKERS];

function walk(dir){
  return readdirSync(dir).flatMap(name => {
    const full = join(dir, name);
    return statSync(full).isDirectory() ? walk(full) : [full];
  });
}
const TEXT = /\.(html|js|json|wxml|wxss|css)$/i;
const read = f => readFileSync(f, 'utf8');

/* ---------- 1. CrazyGames 包里必须有 ---------- */
const CG = join(ROOT, 'crazygames上传包/neon-maze');
assert.ok(existsSync(CG), 'crazygames上传包/neon-maze 不在 —— 先跑 build_crazygames.mjs。'
  + '缺了它这条测试会变成永远通过的空测试。');
const cgIndex = read(join(CG, 'index.html'));
assert.match(cgIndex, /sdk\.crazygames\.com/, 'CrazyGames 包里没有 SDK，Full Launch 拿不到分成');
assert.match(cgIndex, /NEON_CHANNEL='crazygames'/, 'CrazyGames 包里没有渠道标记');
assert.ok(existsSync(join(CG, 'assets/crazygames-adapter.js')), 'CrazyGames 包里没有适配层');

/* 两个广告渠道不许互相串味。 */
for (const f of walk(CG).filter(f => TEXT.test(f))){
  for (const m of GM_MARKERS){
    assert.ok(!read(f).includes(m),
      `CrazyGames 包的 ${f.replace(CG + '/', '')} 里混进了 GameMonetize 的「${m}」`);
  }
}

/* 排行榜页和隐私页不是游戏页，不该挂适配层（挂了会在没有游戏的页面上乱报事件）。 */
for (const sub of ['leaderboard/index.html', 'privacy/index.html']){
  assert.ok(!read(join(CG, sub)).includes('crazygames-adapter'),
    `${sub} 不该挂适配层，那里没有 NeonGame`);
}

/* GameMonetize 的包要有 gameId 才打得出来（gameId 在他们后台拿），所以这段
   是条件性的：包不在就跳过。等包打出来了，它必须带自己那套、且不许混进
   CrazyGames 的东西。 */
const GM = join(ROOT, 'gamemonetize上传包/neon-maze-gamemonetize.zip');
if (existsSync(GM)){
  const gmNames = execFileSync('unzip', ['-Z1', GM], { encoding: 'utf8' }).trim().split('\n');
  const gmIndex = execFileSync('unzip', ['-p', GM, 'index.html'], { encoding: 'utf8' });
  assert.match(gmIndex, /api\.gamemonetize\.com|gamemonetize-adapter/,
    'GameMonetize 包里没有 SDK，他们不验证通过就不给上架');
  assert.match(gmIndex, /NEON_CHANNEL='gamemonetize'/, 'GameMonetize 包里没有渠道标记');
  assert.ok(gmNames.includes('index.html'), 'GameMonetize 要求 index.html 在 zip 根目录');
  for (const n of gmNames.filter(n => TEXT.test(n))){
    const src = execFileSync('unzip', ['-p', GM, n], { encoding: 'utf8' });
    for (const m of MARKERS.filter(m => m !== 'NEON_CHANNEL=')){
      assert.ok(!src.includes(m), `GameMonetize 包的 ${n} 里混进了 CrazyGames 的「${m}」`);
    }
  }
}

/* ---------- 2. 其他每一份产物里必须没有 ---------- */
const targets = [
  /* 仓库根目录就是 GitHub Pages 发布出去的东西，assets/ 整个都是公开可访问的。
     第一版只扫了四个 html，而真实的泄漏恰恰是一个躺在 assets/ 里的 .js —— 
     没被任何页面加载，但已经发布到线上了。所以这里必须整目录扫。 */
  ['网页版（GitHub Pages 直接发布的就是仓库根目录）',
    [...['index.html', 'en/index.html', 'leaderboard/index.html', 'en/leaderboard/index.html', 'analytics.js', 'config.js']
        .map(f => join(ROOT, f)),
     ...walk(join(ROOT, 'assets')).filter(f => TEXT.test(f))]],
  ['发布到网站/', existsSync(join(ROOT, '发布到网站')) ? walk(join(ROOT, '发布到网站')).filter(f => TEXT.test(f)) : null],
  ['微信小游戏版', existsSync(join(ROOT, '源码/微信小游戏版')) ? walk(join(ROOT, '源码/微信小游戏版')).filter(f => TEXT.test(f)) : null],
  ['微信小程序版', existsSync(join(ROOT, '微信小程序版')) ? walk(join(ROOT, '微信小程序版')).filter(f => TEXT.test(f)) : null],
];

let checked = 0;
for (const [name, files] of targets){
  assert.ok(files !== null, `${name} 的产物不在，先把它构建出来 —— 不然这一项等于没测`);
  assert.ok(files.length > 0, `${name} 里一个文本文件都没有，测试是空跑`);
  for (const f of files){
    assert.ok(existsSync(f), `${name} 缺 ${f}`);
    const src = read(f);
    for (const m of ALL_MARKERS){
      assert.ok(!src.includes(m),
        `${name} 的 ${f.replace(ROOT, '')} 里出现了带广告渠道的专属内容「${m}」—— 广告/SDK 泄漏了`);
    }
    checked++;
  }
}

/* itch 包是个 zip，单独解出来扫。 */
const ZIP = join(ROOT, 'itch上传包/neon-maze-itch.zip');
assert.ok(existsSync(ZIP), 'itch 包不在，先跑 build_itch.mjs');
const names = execFileSync('unzip', ['-Z1', ZIP], { encoding: 'utf8' }).trim().split('\n');
for (const n of names.filter(n => TEXT.test(n))){
  const src = execFileSync('unzip', ['-p', ZIP, n], { encoding: 'utf8' });
  for (const m of ALL_MARKERS){
    assert.ok(!src.includes(m), `itch 包的 ${n} 里出现了「${m}」—— 广告/SDK 泄漏到 itch 了`);
  }
  checked++;
}

/* ---------- 3. 开始界面不许在别的渠道消失 ---------- */
for (const f of [join(ROOT, 'index.html'), join(ROOT, 'en/index.html')]){
  const src = read(f);
  assert.match(src, /id="startBtn"/, `${f.replace(ROOT, '')} 的开始按钮没了`);
  assert.match(src, /id="startOverlay"/, `${f.replace(ROOT, '')} 的开始界面没了`);
}

console.log(`✓ 渠道隔离：CrazyGames 包带 SDK/适配层/渠道标记；其余 ${checked} 个产物文件里一个痕迹都没有，开始界面完好`);
