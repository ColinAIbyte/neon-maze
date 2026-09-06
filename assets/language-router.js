/* Neon Maze language preference.
 *
 * The root page is Chinese and /en/ is English, but English is the default
 * face: a visitor who has never chosen is sent to /en/ regardless of browser
 * language. We never send a visitor's IP to a third party. A previous manual
 * choice always wins over that default; on the English page a Chinese browser
 * still gets a small, dismissible suggestion. Both language buttons always
 * remain visible.
 */
(function () {
  'use strict';

  var script = document.currentScript;
  var current = script && script.getAttribute('data-current-language') === 'en' ? 'en' : 'zh';
  var MANUAL_KEY = 'neon-maze-language-manual-v1';
  var DISMISS_KEY = 'neon-maze-language-suggestion-dismissed-v1';

  function read(storage, key) {
    try { return storage.getItem(key) || ''; } catch (e) { return ''; }
  }

  function write(storage, key, value) {
    try { storage.setItem(key, value); } catch (e) { /* Private mode: this visit only. */ }
  }

  function validLanguage(value) {
    return value === 'zh' || value === 'en';
  }

  /* 有些静态主机不把 `dir/` 映射到 `dir/index.html`（itch.io 的 CDN 就是），
     跳过去直接 404，游戏永远加载不出来。GitHub Pages 会映射，所以这个问题
     在 playneonmaze.com 上完全看不见 —— 只有打包分发到别处时才会炸。
     那种主机在页面里设 window.NEON_DIR_INDEX='index.html'，这里就补上文件名。 */
  var DIR_INDEX = typeof window.NEON_DIR_INDEX === 'string' ? window.NEON_DIR_INDEX : '';

  function targetUrl(language) {
    // Hall deep links have their own static entry; keep the same view on a
    // manual preference redirect instead of appending en/ to leaderboard/.
    if (/\/leaderboard\/?$/.test(window.location.pathname)) {
      var root = new URL('../', script.src);
      var hall = new URL((language === 'en' ? 'en/leaderboard/' : 'leaderboard/') + DIR_INDEX, root);
      hall.search = window.location.search;
      hall.hash = window.location.hash;
      return hall.href;
    }
    var relative = (language === 'en'
      ? (current === 'en' ? './' : 'en/')
      : (current === 'en' ? '../' : './')) + DIR_INDEX;
    var target = new URL(relative, window.location.href);
    // Challenge links use query parameters. Switching language must not throw
    // away the score and player name that made the link meaningful.
    target.search = window.location.search;
    target.hash = window.location.hash;
    return target.href;
  }

  function go(language, replace) {
    if (!validLanguage(language) || language === current) return;
    var url = targetUrl(language);
    if (replace) window.location.replace(url);
    else window.location.assign(url);
  }

  // Event delegation works even though this script runs in <head> before the
  // permanent language buttons and optional suggestion have been parsed.
  document.addEventListener('click', function (event) {
    var node = event.target && event.target.closest
      ? event.target.closest('[data-language-choice]') : null;
    if (node) {
      var choice = node.getAttribute('data-language-choice');
      if (!validLanguage(choice)) return;
      event.preventDefault();
      // Ask before leaving an unfinished run; a cancelled choice is not saved.
      var applyChoice = function () { write(window.localStorage, MANUAL_KEY, choice); go(choice, false); };
      if (choice !== current && window.NeonNavigation) window.NeonNavigation.requestLeave(applyChoice);
      else applyChoice();
      return;
    }

    var close = event.target && event.target.closest
      ? event.target.closest('[data-language-dismiss]') : null;
    if (!close) return;
    event.preventDefault();
    write(window.sessionStorage, DISMISS_KEY, '1');
    var notice = close.closest ? close.closest('.language-suggestion') : null;
    if (notice && notice.parentNode) notice.parentNode.removeChild(notice);
  });

  // A language deliberately chosen by the player may redirect on later visits.
  // This is preference, not geolocation, and therefore remains the strongest signal.
  var manual = read(window.localStorage, MANUAL_KEY);
  if (validLanguage(manual)) {
    go(manual, true);
    return;
  }

  /* 没有手动选择过的访客，一律先进英文版。

     这是产品决定，不是语言检测：主要投放面向海外的 H5 平台和社区，英文是
     默认门面。中文没有被藏起来 —— 顶部的语言开关始终可见，而且中文浏览器
     还会额外收到一条「想用中文浏览？」的轻提示（见下面 showSuggestion）。
     玩家点过一次之后，上面那段 manual 分支永久优先，不会被这里覆盖。 */
  if (current !== 'en') {
    go('en', true);
    return;
  }

  function preferredLanguage() {
    var list = window.navigator && window.navigator.languages;
    var first = list && list.length ? list[0]
      : (window.navigator && window.navigator.language);
    if (typeof first !== 'string' || !first) return '';
    return /^zh(?:-|$)/i.test(first) ? 'zh' : 'en';
  }

  function showSuggestion(language) {
    if (!validLanguage(language) || language === current) return;
    if (read(window.sessionStorage, DISMISS_KEY) === '1') return;
    if (!document.body || typeof document.createElement !== 'function') return;

    var notice = document.createElement('aside');
    notice.className = 'language-suggestion';
    notice.setAttribute('aria-label', language === 'zh' ? '语言建议' : 'Language suggestion');

    var text = document.createElement('span');
    text.textContent = language === 'zh' ? '想用中文浏览？' : 'Prefer English?';

    var switchLink = document.createElement('a');
    switchLink.href = targetUrl(language);
    switchLink.setAttribute('data-language-choice', language);
    switchLink.textContent = language === 'zh' ? '切换中文' : 'Switch to English';

    var dismiss = document.createElement('button');
    dismiss.type = 'button';
    dismiss.setAttribute('data-language-dismiss', '');
    dismiss.setAttribute('aria-label', language === 'zh' ? '关闭语言提示' : 'Dismiss language suggestion');
    dismiss.textContent = '×';

    notice.appendChild(text);
    notice.appendChild(switchLink);
    notice.appendChild(dismiss);
    document.body.appendChild(notice);
  }

  function offerPreferredLanguage() {
    showSuggestion(preferredLanguage());
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', offerPreferredLanguage, { once:true });
  } else {
    offerPreferredLanguage();
  }
})();
