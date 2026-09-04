/* Neon Maze language routing.
 *
 * GitHub Pages is static, so it cannot choose a language on the server from
 * the visitor's IP. On the first visit we ask country.is for the two-letter
 * country code only. A manual choice always wins and is remembered locally.
 */
(function () {
  'use strict';

  var script = document.currentScript;
  var current = script && script.getAttribute('data-current-language') === 'en' ? 'en' : 'zh';
  var MANUAL_KEY = 'neon-maze-language-manual-v1';
  var AUTO_KEY = 'neon-maze-language-auto-v1';
  var CHINESE_REGIONS = { CN:true, HK:true, MO:true, TW:true };

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
  // two language buttons have been parsed.
  document.addEventListener('click', function (event) {
    var node = event.target && event.target.closest
      ? event.target.closest('[data-language-choice]') : null;
    if (!node) return;
    var choice = node.getAttribute('data-language-choice');
    if (!validLanguage(choice)) return;
    event.preventDefault();
    write(window.localStorage, MANUAL_KEY, choice);
    write(window.sessionStorage, AUTO_KEY, choice);
    go(choice, false);
  });

  // Once the player has chosen, IP detection must never override that choice.
  var manual = read(window.localStorage, MANUAL_KEY);
  if (validLanguage(manual)) {
    go(manual, true);
    return;
  }

  // Cache automatic detection for this tab. It avoids a second lookup after
  // redirecting and prevents a redirect loop if the provider ever fluctuates.
  var cached = read(window.sessionStorage, AUTO_KEY);
  if (validLanguage(cached)) {
    go(cached, true);
    return;
  }

  if (typeof window.fetch !== 'function') return;
  var controller = typeof AbortController === 'function' ? new AbortController() : null;
  var timer = setTimeout(function () {
    if (controller) controller.abort();
  }, 2500);

  window.fetch('https://api.country.is/', {
    method: 'GET',
    mode: 'cors',
    cache: 'no-store',
    credentials: 'omit',
    referrerPolicy: 'no-referrer',
    signal: controller ? controller.signal : undefined
  }).then(function (response) {
    if (!response.ok) throw new Error('country lookup failed');
    return response.json();
  }).then(function (data) {
    var country = data && typeof data.country === 'string'
      ? data.country.toUpperCase() : '';
    if (!/^[A-Z]{2}$/.test(country)) return;
    var language = CHINESE_REGIONS[country] ? 'zh' : 'en';
    write(window.sessionStorage, AUTO_KEY, language);
    go(language, true);
  }).catch(function () {
    // Detection is an enhancement, not a loading requirement. If the network,
    // privacy software, or provider blocks it, keep the page the visitor opened.
  }).then(function () {
    clearTimeout(timer);
  });
})();
