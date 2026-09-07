/* CrazyGames Full Launch 适配层。
 *
 * 放在 源码/渠道/ 而不是 assets/ 是有原因的：itch 和网页版的构建脚本都是
 * **整目录拷贝 assets/**，第一版把它放在那里，广告代码当场被卷进了 itch 包
 * （没被加载，但确确实实发出去了）。是 test_channel_isolation 抓到的。
 * 放在这里，别的构建连碰都碰不到 —— 靠结构隔离，不靠谁记得加排除项。
 *
 * 只有 build_crazygames.mjs 会把它复制进包，并注入对应的 <script>。
 * 它不动游戏逻辑：只在外面观察 window.NeonGame 的状态，翻译成 SDK 事件。
 * 广告一律走 try/catch，SDK 加载失败（比如玩家开了拦截插件）游戏必须照常
 * 能玩 —— 这也是 CrazyGames 自己的硬性要求。
 */
(() => {
  'use strict';
  /* 不在解析期就抓 NeonGame —— 它是在 <body> 末尾才定义的，而这个脚本
     注入在 <head>。隔壁那个渠道的构建漏了 defer，于是第一行就 return，
     SDK 从头到尾没加载，玩家玩到一局结束也不出广告 —— 线上实测才发现，
     本地全绿（单元测试里游戏对象是提前塞好的，永远存在）。
     这一份有 defer，但不能只靠它：宿主平台重排脚本就又会炸。这里等它出现。
     （措辞刻意避开隔壁渠道的专属标识符：隔离测试拿那些词扫全部产物。） */
  function whenGameReady(run){
    if (window.NeonGame) return run(window.NeonGame);
    let tries = 0;
    const t = setInterval(() => {
      if (window.NeonGame){ clearInterval(t); run(window.NeonGame); }
      else if (++tries > 200) clearInterval(t);   // 50 秒还没有就放弃
    }, 250);
  }

  let game = null;

  const sdk = () => (window.CrazyGames || {}).SDK;
  const safe = fn => { try { return fn(); } catch (e) { /* SDK 不可用就当没有 */ } };

  let live = false;          // SDK 可用且确实在 CrazyGames 域下
  let wasPlaying = null;     // 上一次观察到的「在玩」状态
  let lastState = null;      // 上一次观察到的完整状态
  let adOpen = false;        // 正在放广告
  let restoreTimer = null;

  /* ---------- 广告 ---------- */

  /** 广告期间闭嘴 + 暂停；结束或失败都要原样恢复。 */
  function holdGame(){
    safe(() => game.silence(true));
    safe(() => game.pause());
  }
  function releaseGame(){
    if (!adOpen) return;
    adOpen = false;
    clearTimeout(restoreTimer); restoreTimer = null;
    safe(() => game.silence(false));
  }

  /** 一局结束时插一条中插广告。玩得正起劲的时候不打断。 */
  function midgameAd(){
    if (adOpen || !live) return;
    adOpen = true;
    const done = () => releaseGame();
    /* 兜底：万一 adStarted 之后两个终止回调都不来（广告位卡住、iframe 被
       关掉），声音不能永远哑着 —— 90 秒后无条件恢复。 */
    const arm = () => { restoreTimer = setTimeout(done, 90000); };
    const ok = safe(() => {
      sdk().ad.requestAd('midgame', {
        adStarted: () => { holdGame(); arm(); },
        adFinished: done,
        adError: done,
      });
      return true;
    });
    if (!ok) done();
  }

  /* ---------- 状态观察 ---------- */

  function tick(){
    const state = safe(() => game.state());
    const playing = state === 'playing';
    if (playing !== wasPlaying){
      wasPlaying = playing;
      safe(() => playing ? sdk().game.gameplayStart() : sdk().game.gameplayStop());
    }
    /* 只在**刚刚**结束的那一下插广告。写成 `state === 'over'` 的话，玩家停在
       结算页不动，每 250ms 就会被请求一次广告 —— 是这条测试抓出来的。 */
    if (state === 'over' && lastState !== 'over') midgameAd();
    lastState = state;
  }

  /* Full Launch 要求「落地即游戏」，不能先停在开始菜单。这里不是把开始
     界面删掉（那是共享代码，删了别的渠道也没了），而是从外面替玩家按一下
     开始。关卡进场动画自带一段停顿，所以不会一进来就被鬼贴脸。 */
  function autoStart(){
    let tries = 0;
    const t = setInterval(() => {
      if (tries++ > 40) return clearInterval(t);
      if (safe(() => game.state()) !== 'ready') return clearInterval(t);
      safe(() => game.start());
    }, 250);
  }

  async function init(){
    const s = sdk();
    if (!s) return;                       // SDK 没加载出来：什么都不做，游戏照玩
    try { await s.init(); } catch (e) { return; }
    /* environment 为 'disabled' 表示不在 CrazyGames 域下（例如有人把这个包
       直接开在别处）。那种情况下任何 SDK 调用都会抛，干脆不接管。 */
    const env = safe(() => s.environment);
    if (env === 'disabled') return;
    live = true;
    safe(() => s.game.loadingStart());
    safe(() => s.game.loadingStop());
    autoStart();
    setInterval(tick, 250);
  }

  whenGameReady(g => {
    game = g;
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
    else init();
  });
})();
