/* GameMonetize 适配层。
 *
 * 和隔壁那个渠道的适配层一样放在 源码/渠道/，绝不放进 assets/ ——
 * （这里刻意不写出隔壁那个文件名：隔离测试拿文件名当泄漏特征扫全部产物，
 *   注释里提一嘴也会被判成串味。宁可注释绕一下，也不放松那条检查。）
 * itch 和网页版的构建是整目录拷贝 assets/，放那里等于把广告代码发给所有渠道。
 * 只有 build_gamemonetize.mjs 会把它复制进包。
 *
 * 和 CrazyGames 那套的区别：
 *  - 它们要求 window.SDK_OPTIONS 必须在 sdk.js 之前就位，所以加载器写在这里，
 *    构建脚本只注入这一个 <script>，不像 CrazyGames 那样分两段。
 *  - 暂停/恢复是**他们回调我们**（SDK_GAME_PAUSE / SDK_GAME_START），
 *    不是我们去问状态。他们文档把「播广告时必须静音」列为强制项。
 *  - 广告靠 sdk.showBanner()，没有回调，所以恢复只能等他们的 SDK_GAME_START。
 *
 * gameId 由构建脚本注入 window.NEON_GM_ID —— 它是每个游戏一个的哈希，
 * 写死在代码里就没法给第二个游戏复用，也容易在别的渠道里被看见。
 */
(() => {
  'use strict';
  const gameId = window.NEON_GM_ID;
  if (typeof gameId !== 'string' || !gameId) return;

  /* 不在解析期就抓 NeonGame —— 它是在 <body> 末尾才定义的，而这个脚本
     注入在 <head>。GameMonetize 那一版漏了 defer，于是第一行就 return，
     SDK 从头到尾没加载，玩家玩到结束也不会出广告（线上实测：
     SDK_OPTIONS undefined、sdk undefined、连 script 标签都没有）。
     defer 补上了，但不能只靠它：宿主平台重排脚本就又会炸。这里等它出现。 */
  function whenGameReady(run){
    if (window.NeonGame) return run(window.NeonGame);
    let tries = 0;
    const t = setInterval(() => {
      if (window.NeonGame){ clearInterval(t); run(window.NeonGame); }
      else if (++tries > 200) clearInterval(t);   // 50 秒还没有就放弃
    }, 250);
  }

  let game = null;

  const safe = fn => { try { return fn(); } catch (e) { /* SDK 不可用就当没有 */ } };

  let adOpen = false, lastState = null, restoreTimer = null;

  /* 广告开始：闭嘴 + 暂停。他们把静音列为强制要求（广告播放时后台还有
     声音是被禁止的），而且必须用临时静音，不能去动玩家自己的静音设置。 */
  function hold(){
    if (adOpen) return;
    adOpen = true;
    safe(() => game.silence(true));
    safe(() => game.pause());
    /* 兜底：万一 SDK_GAME_START 永远不来（广告位卡住、SDK 挂了），
       声音不能一直哑着。 */
    clearTimeout(restoreTimer);
    restoreTimer = setTimeout(release, 90000);
  }
  function release(){
    if (!adOpen) return;
    adOpen = false;
    clearTimeout(restoreTimer); restoreTimer = null;
    safe(() => game.silence(false));
    safe(() => game.resume());
  }

  whenGameReady(g => { game = g; boot(); });

  function boot(){
    window.SDK_OPTIONS = {
      gameId,
      onEvent(a){
        switch (a && a.name){
          case 'SDK_GAME_PAUSE': hold(); break;   // 广告要播了
          case 'SDK_GAME_START': release(); break; // 广告播完了
          default: break;
        }
      },
    };

    /* 官方给的加载片段，原样照搬（含那个 id 去重）。 */
    (function (d, tag, id){
      const first = d.getElementsByTagName(tag)[0];
      if (d.getElementById(id)) return;
      const s = d.createElement(tag);
      s.id = id;
      s.src = 'https://api.gamemonetize.com/sdk.js';
      first.parentNode.insertBefore(s, first);
    })(document, 'script', 'gamemonetize-sdk');

    /* 一局结束插一条广告。只在**刚刚**结束那一下调用 —— 写成「状态是 over
       就调」的话，玩家停在结算页不动会被反复弹广告（CrazyGames 那边就是这么
       踩到的，见 test_crazygames_adapter）。 */
    function tick(){
      const state = safe(() => game.state());
      if (state === 'over' && lastState !== 'over'){
        safe(() => { if (typeof sdk !== 'undefined' && sdk && typeof sdk.showBanner === 'function') sdk.showBanner(); });
      }
      lastState = state;
    }
    setInterval(tick, 250);
  }
})();
