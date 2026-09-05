/* Neon Maze language preference.
 *
 * The root page is Chinese and /en/ is English. We never send a visitor's IP
 * to a third party and never force a first-time redirect. A previous manual
 * choice still wins; otherwise the browser language may offer a small,
 * dismissible suggestion. Both full language buttons always remain visible.
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

  function targetUrl(language) {
    // Hall deep links have their own static entry; keep the same view on a
    // manual preference redirect instead of appending en/ to leaderboard/.
    if (/\/leaderboard\/?$/.test(window.location.pathname)) {
      var root = new URL('../', script.src);
      var hall = new URL(language === 'en' ? 'en/leaderboard/' : 'leaderboard/', root);
      hall.search = window.location.search;
      hall.hash = window.location.hash;
      return hall.href;
    }
    var relative = language === 'en'
      ? (current === 'en' ? './' : 'en/')
      : (current === 'en' ? '../' : './');
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
      write(window.localStorage, MANUAL_KEY, choice);
      go(choice, false);
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
