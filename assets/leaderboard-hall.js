(function (global) {
  'use strict';

  // A presentation-only shell. Its host owns routing, pausing and the cloud API.
  // Never derive a player identity or a rank from a nickname or a partial page.
  const copy = {
    zh: {
      title: '全球排行榜', back: '返回游戏', resume: '继续游戏', challenge: '开始挑战', again: '再次挑战',
      eyebrow: 'NEON MAZE · GLOBAL ARENA', intro: '每一局，都有新的目标。',
      description: '一局完整挑战的最终总分 · 每位玩家保留最佳一局', current: '总排行榜',
      currentNote: '当前计分规则 · 不设结束时间',
      players: n => `${n} 位挑战者`, updated: t => `更新于 ${t}`, pending: '正在读取真实榜单…',
      champion: '世界纪录', runner: '全球第 2 名', third: '全球第 3 名', rank: n => `第 ${n} 名`,
      score: '最佳单局总分', me: '你', myTitle: '我的全球成绩', unranked: '完成第一局，建立你的全球排名',
      unrankedNote: '只有服务器确认的正式挑战成绩才会进入全球榜。',
      recentTitle: '我的最近战绩', recentRange: '最近 30 局 · 正式挑战', recentBest: '近 30 局最佳',
      localBest: '本机历史最高分', recentSummary: (n, score) => `已记录 ${n} 局，最好 ${score}`,
      recentPrivacy: '仅保存在当前浏览器，清除网站数据后会丢失',
      recentEmpty: '还没有记录。打完一局正式挑战，成绩会出现在这里。',
      recentUnavailable: '当前浏览器无法保存战绩', recentFailed: '本局战绩未能保存，已保存的记录仍可查看。',
      recentCorrupt: '部分战绩数据损坏，已尝试保留备份；有效记录仍可查看。',
      next: '下一个目标', beat: (name, gap) => `超过 ${name}，还需 ${gap} 分`, leader: '刷新自己的世界纪录',
      tiedLead: '再多得 1 分，向独占榜首发起挑战。', leaderNote: '下一次，挑战更好的自己。', locate: '查看我的位置',
      top: '榜首', nearby: '我附近', ranking: '全球名次', loadMore: '加载更多', loadingMore: '正在加载…', refresh: '刷新榜单',
      complete: '已显示全部记录', shown: (n, total) => `已显示 ${n} / ${total} 位`, empty: '世界纪录，等你来创造',
      emptyNote: '还没有符合这份榜单规则的成绩。完成正式挑战，就有机会成为第一位。',
      vacant: '下一位挑战者，可能就是你。', error: '暂时无法读取全球榜', errorNote: '请检查网络后重试。本机存档不会受到影响。',
      unavailable: '竞技大厅正在准备中', unavailableNote: '云端排名接口尚未启用。不能据此判断你是否上榜，也不会猜测排名。',
      disabled: '全球榜暂未开启', disabledNote: '这个版本未配置云服务，仍可正常游戏并保存本机成绩。', retry: '重新加载',
      moreError: '这一页没有加载成功，已显示的记录保留；请重试。', won: '六关通关', progress: level => `到达第 ${level}/6 关`,
      combo: n => `最高连击 ×${n}`, date: '纪录时间', details: '这次上榜成绩', detailsHint: '点击成绩行查看详情',
      detailBoundary: '以上只属于这次上榜对局；用时、生命、收集与得分构成暂未公开，不拼接生涯最佳数据。',
      privacy: '游客身份只绑定当前浏览器；清理存储或换设备不会自动找回。昵称和成绩公开，星星与解锁仅存本机。',
      fairness: '同分并列，后续名次跳号（1、1、3）；目标分差按严格超过计算。每日挑战和练习不入榜。',
      assist: '当前规则允许原有的失败辅助，入榜标准相同；旧记录未记录辅助状态，不推断为无辅助。',
      rules: '入榜规则与数据说明', time: '全部时间 · UTC', closeDetails: '收起详情', noNearby: '尚无已确认的本人排名，请先完成正式挑战。',
      below: '完整排名', refreshed: '榜单已更新', changed: '榜单已变化，已刷新排名', unknown: '暂无记录', positions: (start, end) => `当前显示位置 ${start}–${end}`
    },
    en: {
      title: 'Global leaderboard', back: 'Back to game', resume: 'Resume game', challenge: 'Start a challenge', again: 'Challenge again',
      eyebrow: 'NEON MAZE · GLOBAL ARENA', intro: 'One more run. A new personal best.',
      description: 'Final score from one full run · One best run per player', current: 'All-time leaderboard',
      currentNote: 'Current scoring rules · All-time',
      players: n => `${n} challengers`, updated: t => `Updated ${t}`, pending: 'Loading live standings…',
      champion: 'World record', runner: 'World #2', third: 'World #3', rank: n => `Rank #${n}`,
      score: 'Best single-run score', me: 'YOU', myTitle: 'My global best', unranked: 'Finish your first run to earn a global rank',
      unrankedNote: 'Only server-confirmed standard runs enter the global leaderboard.',
      recentTitle: 'My recent runs', recentRange: 'Last 30 runs · Standard challenges', recentBest: 'Best of last 30 runs',
      localBest: 'All-time best in this browser', recentSummary: (n, score) => `${n} runs recorded, best ${score}`,
      recentPrivacy: 'Saved only in this browser. Clearing site data deletes these records.',
      recentEmpty: 'No records yet. Finish a standard challenge to see your score here.',
      recentUnavailable: 'This browser cannot save run history', recentFailed: 'This run could not be saved. Previously saved records are still available.',
      recentCorrupt: 'Some run data is damaged. A backup was attempted; valid records are still available.',
      next: 'Your next target', beat: (name, gap) => `${gap} more points to beat ${name}`, leader: 'Set a new world record',
      tiedLead: 'One more point puts you ahead of the tied leaders.', leaderNote: 'Your next rival is your own best run.', locate: 'Find my position',
      top: 'Top scores', nearby: 'Around me', ranking: 'Global standings', loadMore: 'Load more', loadingMore: 'Loading…', refresh: 'Refresh standings',
      complete: 'All records shown', shown: (n, total) => `${n} of ${total} players shown`, empty: 'The first world record could be yours',
      emptyNote: 'No scores have been recorded under these rules yet. Finish a standard run to join the leaderboard.',
      vacant: 'The next challenger could be you.', error: 'Could not load the leaderboard', errorNote: 'Check your connection and try again. Your local saves are safe.',
      unavailable: 'The arena is getting ready', unavailableNote: 'The cloud ranking endpoint is not enabled yet. We cannot confirm or guess your rank.',
      disabled: 'Global scores are not enabled', disabledNote: 'This build has no cloud connection. You can still play and save scores locally.', retry: 'Try again',
      moreError: 'This page could not be loaded. Existing rows are unchanged; please retry.', won: 'All 6 levels cleared', progress: level => `Reached level ${level}/6`,
      combo: n => `Best combo ×${n}`, date: 'Record set', details: 'This ranked run', detailsHint: 'Select a score to view its details',
      detailBoundary: 'These values belong to this run only. Time, lives, collections and score breakdowns are not public yet; career bests are not combined here.',
      privacy: 'Guest identity belongs to this browser only. Clearing storage or switching devices does not restore it. Names and scores are public; stars and unlocks stay local.',
      fairness: 'Equal scores share a rank; the next rank skips places (1, 1, 3). Targets require strictly beating a score. Daily challenges and practice are excluded.',
      assist: 'The existing failure assist is allowed under the same entry rules. Older records do not identify assist usage; they are not assumed to be unassisted.',
      rules: 'Ranking rules and data', time: 'All-time · UTC', closeDetails: 'Close details', noNearby: 'No confirmed rank yet. Finish a standard run to get started.',
      below: 'Full standings', refreshed: 'Standings updated', changed: 'Standings changed; rankings refreshed', unknown: 'Not recorded', positions: (start, end) => `Showing positions ${start}–${end}`
    }
  };
  let options = {}, root = null, content = null, live = null, lastFocus = null;
  let language = 'zh', isOpen = false, generation = 0, loading = false;
  const scope = 'current';
  let near = false, data = null, rows = [], resultStatus = 'loading', moreError = false, changeNotice = false;
  let cachedBodyOverflow = '';
  const t = () => copy[language];
  const number = value => Number.isSafeInteger(value) && value >= 0 ? value : null;
  const fmt = value => number(value) === null ? '—' : value.toLocaleString(language === 'en' ? 'en-US' : 'zh-CN');
  const text = (tag, className, value) => {
    const node = document.createElement(tag);
    if (className) node.className = className;
    if (value !== undefined && value !== null) node.textContent = String(value);
    return node;
  };
  const add = (parent, ...children) => { for (const child of children) if (child) parent.appendChild(child); return parent; };
  const button = (label, className, handler, pressed) => {
    const node = text('button', `nh-button ${className || ''}`, label);
    node.type = 'button';
    if (pressed !== undefined) node.setAttribute('aria-pressed', String(pressed));
    node.addEventListener('click', handler);
    return node;
  };
  const choice = (value, className, handler, pressed) => button(value, `nh-choice ${className || ''}`, handler, pressed);
  const name = row => typeof row?.name === 'string' && row.name.trim() ? row.name : t().unknown;
  const progress = row => row?.won === true ? t().won : number(row?.level) !== null ? t().progress(fmt(row.level)) : t().unknown;
  const date = (value, full = false) => {
    const valueDate = new Date(value);
    if (!value || !Number.isFinite(valueDate.getTime())) return t().unknown;
    return new Intl.DateTimeFormat(language === 'en' ? 'en-GB' : 'zh-CN', {
      timeZone: 'UTC', year: 'numeric', month: '2-digit', day: '2-digit',
      ...(full ? { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false } : {})
    }).format(valueDate) + ' UTC';
  };
  function avatar(row, large = false) {
    const node = text('span', `nh-avatar${large ? ' nh-avatar-large' : ''}`);
    node.setAttribute('aria-hidden', 'true');
    // An original code-native neon orb, not a user photo or an unlocked skin.
    add(node, text('i', 'nh-eye nh-eye-left'), text('i', 'nh-eye nh-eye-right'));
    if (row?.is_me) node.classList.add('nh-avatar-me');
    return node;
  }
  function challengeButton() {
    const resume = Boolean(options.canResume?.());
    return button(resume ? t().resume : data?.mine ? t().again : t().challenge, 'nh-primary', () => {
      close();
      options.onChallenge?.();
    });
  }
  function requestClose() { close(); options.onClose?.(); }
  function header() {
    const nav = text('header', 'nh-nav');
    add(nav, button(`← ${t().back}`, 'nh-back', requestClose));
    const brand = text('div', 'nh-brand');
    add(brand, text('span', 'nh-brand-mark', '✦'), text('span', '', 'NEON MAZE'));
    const langs = text('div', 'nh-languages');
    langs.setAttribute('aria-label', language === 'en' ? 'Language' : '语言');
    for (const [lang, label] of [['zh', '中文'], ['en', 'EN']]) {
      add(langs, choice(label, '', () => {
        setLanguage(lang);
        options.onLanguage?.(lang);
      }, language === lang));
    }
    return add(nav, brand, langs);
  }
  function intro() {
    const introNode = text('section', 'nh-intro');
    add(introNode, text('p', 'nh-eyebrow', t().eyebrow));
    const title = text('h1', 'nh-title', t().title);
    title.id = 'neon-hall-title';
    title.tabIndex = -1;
    add(introNode, title, text('p', 'nh-tagline', t().intro), text('p', 'nh-description', t().description));
    const meta = text('div', 'nh-meta');
    add(meta, text('span', 'nh-period', t().currentNote));
    if (resultStatus === 'ok' && data) {
      add(meta, text('span', 'nh-count', t().players(fmt(data.total))), text('span', 'nh-updated', t().updated(date(data.updated_at, true))));
    }
    return add(introNode, meta);
  }
  function honorCard(row, index, count) {
    const card = text('article', `nh-honor nh-medal-${Math.min(3, Number(row.rank) || 3)} nh-slot-${index} nh-count-${count}${fmt(row.score).length > 13 ? ' nh-score-wide' : ''}`);
    card.setAttribute('aria-label', `${t().rank(fmt(row.rank))} ${name(row)}`);
    const rank = Number(row.rank);
    add(card, text('div', 'nh-honor-label', rank === 1 ? `♛ ${t().champion}` : t().rank(fmt(row.rank))), avatar(row, true));
    const player = text('div', 'nh-honor-name', name(row));
    player.title = name(row);
    if (row.is_me) add(player, text('span', 'nh-you', t().me));
    add(card, player, text('p', 'nh-score-label', t().score));
    add(card, text('div', 'nh-honor-score nh-digits', fmt(row.score)));
    add(card, text('div', 'nh-honor-meta', `${progress(row)} · ${t().combo(fmt(row.combo))}`), text('time', 'nh-date', date(row.played_at)));
    return card;
  }
  function podium() {
    const section = text('section', 'nh-podium-section');
    const entries = Array.isArray(data?.podium) ? data.podium.slice(0, 3) : [];
    if (!entries.length) {
      const empty = text('div', 'nh-empty');
      add(empty, text('div', 'nh-empty-mark', '♛'), text('h2', '', t().empty), text('p', '', t().emptyNote), challengeButton());
      return add(section, empty);
    }
    const grid = text('div', `nh-podium nh-podium-${entries.length}`);
    entries.forEach((row, index) => add(grid, honorCard(row, index, entries.length)));
    add(section, grid);
    if (entries.length < 3) add(section, text('p', 'nh-vacant', `✦ ${t().vacant}`));
    return section;
  }
  function locate() {
    if (!data?.mine) return;
    const current = root.querySelector('.nh-entry-me');
    if (current) {
      current.scrollIntoView({ block: 'center', behavior: 'auto' });
      current.querySelector('summary')?.focus({ preventScroll: true });
      return;
    }
    near = true;
    load(false, true);
  }
  function myCard() {
    const card = text('section', 'nh-personal');
    const information = text('div', 'nh-personal-info');
    add(information, text('p', 'nh-eyebrow', t().myTitle));
    if (data?.mine) {
      const mine = data.mine;
      const best = text('div', 'nh-personal-best');
      add(best, text('strong', 'nh-personal-rank', t().rank(fmt(mine.rank))), text('strong', 'nh-personal-score nh-digits', fmt(mine.score)));
      add(information, best);
      const next = data.next;
      if (next && number(data.next_gap) !== null && data.next_gap > 0) {
        add(information, text('p', 'nh-next-label', t().next), text('p', 'nh-target', t().beat(name(next), fmt(data.next_gap))));
      } else if (mine.rank === 1) {
        const tied = data.podium.filter(row => row.rank === 1).length > 1;
        add(information, text('p', 'nh-target', t().leader), text('p', 'nh-fine', tied ? t().tiedLead : t().leaderNote));
      }
    } else {
      add(information, text('h2', 'nh-unranked', t().unranked), text('p', 'nh-fine', t().unrankedNote));
    }
    const actions = text('div', 'nh-personal-actions');
    add(actions, challengeButton());
    if (data?.mine) add(actions, button(t().locate, 'nh-secondary', locate));
    return add(card, information, actions);
  }
  function dataDetails(row) {
    const box = text('div', 'nh-run-details');
    add(box, text('h3', '', t().details));
    const list = text('dl', 'nh-detail-grid');
    for (const [label, value] of [[language === 'en' ? 'Nickname' : '玩家昵称', name(row)], [t().score, fmt(row.score)], [t().ranking, t().rank(fmt(row.rank))],
      [language === 'en' ? 'Progress' : '关卡进度', progress(row)], [language === 'en' ? 'Best combo' : '最高连击', `×${fmt(row.combo)}`], [t().date, date(row.played_at, true)]]) {
      const group = text('div');
      add(list, add(group, text('dt', '', label), text('dd', '', value)));
    }
    return add(box, list, text('p', 'nh-fine', t().detailBoundary));
  }
  function scoreRow(row) {
    const details = text('details', `nh-entry${row.is_me ? ' nh-entry-me' : ''}${fmt(row.score).length > 13 ? ' nh-score-wide' : ''}`);
    if (number(row.position) !== null) details.dataset.position = String(row.position);
    const summary = text('summary', 'nh-row');
    const rank = text('span', `nh-row-rank${row.rank <= 3 ? ' nh-rank-top' : ''}`, `#${fmt(row.rank)}`);
    const player = text('span', 'nh-row-player');
    const playerName = text('span', 'nh-player-name', name(row));
    playerName.title = name(row);
    add(player, avatar(row), playerName);
    if (row.is_me) add(player, text('span', 'nh-you', t().me));
    add(summary, rank, player, text('strong', 'nh-row-score nh-digits', fmt(row.score)),
      text('span', 'nh-row-info', `${progress(row)} · ${t().combo(fmt(row.combo))}`), text('time', 'nh-row-date', date(row.played_at)), text('span', 'nh-row-expand', '⌄'));
    return add(details, summary, dataDetails(row));
  }
  function switches() {
    const controls = text('div', 'nh-controls');
    add(controls, text('span', 'nh-current-label', t().current), button(`↻ ${t().refresh}`, 'nh-refresh', () => load()));
    return controls;
  }
  function recentPanel() {
    const panel = text('section', 'nh-recent');
    const heading = text('h2', '', t().recentTitle);
    heading.id = 'neon-recent-title';
    panel.setAttribute('aria-labelledby', heading.id);
    add(panel, heading, text('p', 'nh-fine', t().recentRange));
    let saved;
    try { saved = options.recent?.() || {rows:[], status:'ok'}; }
    catch { saved = {rows:[], status:'unavailable'}; }
    const entries = Array.isArray(saved.rows) ? saved.rows : [];
    const best = entries.reduce((value, row) => Math.max(value, row.score), 0);
    const history = text('div', 'nh-local-best');
    add(history, text('span', '', t().localBest), text('strong', 'nh-digits', fmt(saved.highScore || 0)));
    add(panel, history, text('p', 'nh-recent-summary', t().recentSummary(fmt(entries.length), fmt(best))));
    if (saved.status === 'unavailable' || saved.saveFailed) {
      const warning = text('p', 'nh-recent-warning', t().recentUnavailable);
      warning.setAttribute('role', 'status');
      add(panel, warning);
      if (saved.saveFailed) add(panel, text('p', 'nh-fine', t().recentFailed));
    } else if (saved.status === 'corrupt') {
      add(panel, text('p', 'nh-recent-warning', t().recentCorrupt));
    }
    if (!entries.length) add(panel, text('p', 'nh-recent-empty', t().recentEmpty));
    else {
      const list = text('ol', 'nh-recent-list');
      list.tabIndex = 0;
      list.setAttribute('aria-label', t().recentTitle);
      for (const row of entries) {
        const winner = row.score === best;
        const item = text('li', `nh-recent-row${winner ? ' nh-recent-best' : ''}${fmt(row.score).length > 13 ? ' nh-recent-wide' : ''}`);
        const score = text('div', 'nh-recent-score');
        add(score, text('strong', 'nh-digits', fmt(row.score)));
        if (winner) add(score, text('span', 'nh-recent-badge', `★ ${t().recentBest}`));
        const stamp = new Date(row.playedAt);
        const two = n => String(n).padStart(2, '0');
        const localTime = `${two(stamp.getMonth()+1)}-${two(stamp.getDate())} ${two(stamp.getHours())}:${two(stamp.getMinutes())}`;
        const time = text('time', 'nh-recent-time', localTime);
        time.setAttribute('datetime', stamp.toISOString());
        time.title = stamp.toLocaleString(language === 'en' ? 'en-US' : 'zh-CN');
        add(item, score, text('span', 'nh-recent-info', `${progress(row)} · ${t().combo(fmt(row.maxCombo))}`), time);
        add(list, item);
      }
      add(panel, list);
    }
    return add(panel, text('p', 'nh-fine nh-recent-privacy', t().recentPrivacy));
  }
  function rankings() {
    const section = text('section', 'nh-ranking');
    const heading = text('div', 'nh-ranking-heading');
    add(heading, text('h2', '', t().below));
    const views = text('div', 'nh-switch-group nh-view-switch');
    const nearby = choice(t().nearby, '', () => { near = true; load(false, true); }, near);
    nearby.disabled = !data?.mine;
    if (nearby.disabled) nearby.title = t().noNearby;
    add(views, choice(t().top, '', () => { near = false; load(); }, !near), nearby);
    add(heading, views);
    add(section, heading, text('p', 'nh-fine nh-list-hint', t().detailsHint));
    const list = text('div', 'nh-rows');
    list.id = 'neon-hall-rows';
    for (const row of rows) add(list, scoreRow(row));
    add(section, list);
    const bottom = text('div', 'nh-list-bottom');
    if (moreError) {
      const warning = text('p', 'nh-inline-error', t().moreError);
      warning.setAttribute('role', 'alert');
      add(bottom, warning);
    }
    if (data?.has_more) {
      const more = button(loading ? t().loadingMore : moreError ? t().retry : t().loadMore, 'nh-secondary', () => load(true));
      more.disabled = loading;
      add(bottom, more);
    }
    const first = rows[0]?.position, last = rows.at(-1)?.position;
    add(bottom, text('p', 'nh-fine', near && number(first) !== null && number(last) !== null ? t().positions(fmt(first), fmt(last)) : t().shown(fmt(rows.length), fmt(data?.total))));
    return add(section, bottom);
  }
  function policy() {
    const panel = text('details', 'nh-policy');
    add(panel, text('summary', '', t().rules));
    for (const value of [t().fairness, t().assist, t().privacy]) add(panel, text('p', '', value));
    return panel;
  }
  function skeleton() {
    const panel = text('div', 'nh-loading');
    panel.setAttribute('role', 'status');
    add(panel, text('p', 'nh-loading-label', t().pending));
    const blocks = text('div', 'nh-skeleton-grid');
    blocks.setAttribute('aria-hidden', 'true');
    for (let i = 0; i < 3; i++) add(blocks, text('div', 'nh-skeleton nh-skeleton-card'));
    add(panel, blocks);
    for (let i = 0; i < 4; i++) {
      const row = text('div', 'nh-skeleton nh-skeleton-row');
      row.setAttribute('aria-hidden', 'true');
      add(panel, row);
    }
    return panel;
  }
  function errorPanel() {
    const disabled = resultStatus === 'disabled', unavailable = resultStatus === 'unavailable';
    const panel = text('div', 'nh-error');
    panel.setAttribute('role', 'status');
    add(panel, text('div', 'nh-error-mark', '◇'), text('h2', '', disabled ? t().disabled : unavailable ? t().unavailable : t().error),
      text('p', '', disabled ? t().disabledNote : unavailable ? t().unavailableNote : t().errorNote));
    if (!disabled) add(panel, button(t().retry, 'nh-secondary', () => load()));
    return add(panel, challengeButton());
  }
  function render() {
    if (!root) return;
    const scroll = root.scrollTop;
    const recentScroll = root.querySelector('.nh-recent-list')?.scrollTop || 0;
    const focused = document.activeElement;
    const focusedButton = root.contains(focused) && focused.tagName === 'BUTTON' ? focused.textContent : null;
    content.replaceChildren();
    root.lang = language === 'en' ? 'en' : 'zh-CN';
    add(content, header());
    const main = text('main', 'nh-main');
    add(main, intro(), switches());
    if (resultStatus === 'loading') add(main, skeleton());
    else if (resultStatus === 'ok') {
      if (changeNotice) {
        const notice = text('p', 'nh-change-notice', t().changed);
        notice.setAttribute('role', 'status');
        add(main, notice);
      }
      add(main, podium(), myCard(), rankings());
    }
    else add(main, errorPanel());
    add(main, recentPanel(), policy());
    const footer = text('footer', 'nh-footer');
    add(footer, text('p', '', t().vacant), challengeButton());
    add(main, footer);
    add(content, main);
    root.scrollTop = scroll;
    const recentList = root.querySelector('.nh-recent-list');
    if (recentList) recentList.scrollTop = recentScroll;
    if (focusedButton) {
      const replacement = Array.from(root.querySelectorAll('button:not([disabled])')).find(el => el.textContent === focusedButton);
      (replacement || root.querySelector('h1'))?.focus({ preventScroll: true });
    }
  }
  function validData(value) {
    // The endpoint owns ranking semantics. Incomplete legacy endpoints must not
    // masquerade as a zero-player board or a player who has never submitted.
    return value && value.scope === scope && number(value.total) !== null &&
      Array.isArray(value.rows) && Array.isArray(value.podium) &&
      Object.prototype.hasOwnProperty.call(value, 'mine') && Object.prototype.hasOwnProperty.call(value, 'next_gap') &&
      number(value.offset) !== null && typeof value.has_more === 'boolean' &&
      typeof value.revision === 'string' && value.revision.length > 0 &&
      typeof value.updated_at === 'string' && Number.isFinite(new Date(value.updated_at).getTime());
  }
  async function load(append = false, focusMine = false, changed = false) {
    if (!root || !isOpen || (append && loading)) return;
    const token = ++generation;
    loading = true;
    moreError = false;
    if (!append) { data = null; rows = []; resultStatus = 'loading'; changeNotice = changed; }
    render();
    let result;
    const offset = append ? Number(data?.offset || 0) + rows.length : 0;
    try { result = await options.request({ scope, offset, limit: 25, near }); }
    catch { result = { status: 'offline' }; }
    if (token !== generation || !isOpen) return;
    loading = false;
    const okay = result?.status === 'ok' && validData(result.data);
    if (!okay) {
      if (append) { moreError = true; render(); return; }
      resultStatus = result?.status === 'ok' ? 'unavailable' : result?.status || 'offline';
      render();
      return;
    }
    const next = result.data;
    if (near && !next.mine) {
      // A first-time player may arrive via a result-page "find me" link before
      // submitting. Keep the honest unranked card and load the real top page.
      near = false;
      return load(false, false, changed);
    }
    if (append && next.revision !== data.revision) {
      // Never combine pages taken before and after a competing score changes
      // the order. The server revision describes the full ordered snapshot.
      near = false;
      return load(false, false, true);
    }
    if (append) {
      // Offset identifies the first position of this page, never a guessed rank.
      // Skip exact repeated positions if a server repeats a page during a retry.
      const positions = new Set(rows.map(row => row.position));
      rows.push(...next.rows.filter(row => !positions.has(row.position)));
      data = { ...next, offset: data.offset };
    } else { data = next; rows = next.rows.slice(); }
    resultStatus = 'ok';
    render();
    live.textContent = changeNotice ? t().changed : t().refreshed;
    if (focusMine && data.mine) {
      // A malformed "near me" response must not recursively retry forever.
      const mine = root.querySelector('.nh-entry-me');
      mine?.scrollIntoView({ block: 'center', behavior: 'auto' });
      mine?.querySelector('summary')?.focus({ preventScroll: true });
    }
  }
  function onKey(event) {
    if (!isOpen) return;
    // Prevent game shortcuts while the full-screen view owns keyboard focus.
    event.stopPropagation();
    if (event.key === 'Escape') { event.preventDefault(); requestClose(); return; }
    if (event.key !== 'Tab') return;
    const focusable = Array.from(root.querySelectorAll('button:not([disabled]),summary,[tabindex="0"]')).filter(el => el.getClientRects().length);
    const first = focusable[0], last = focusable.at(-1);
    if (!first) { event.preventDefault(); return; }
    if (event.shiftKey && (document.activeElement === first || !focusable.includes(document.activeElement))) {
      event.preventDefault(); last.focus();
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault(); first.focus();
    }
  }
  function mount(config) {
    options = config || {};
    language = options.language === 'en' ? 'en' : 'zh';
    if (root) return;
    root = text('section', 'neon-hall');
    root.id = 'neon-hall';
    root.hidden = true;
    root.setAttribute('role', 'dialog');
    root.setAttribute('aria-modal', 'true');
    root.setAttribute('aria-labelledby', 'neon-hall-title');
    root.addEventListener('keydown', onKey);
    root.addEventListener('keyup', event => event.stopPropagation());
    content = text('div', 'nh-content');
    live = text('p', 'nh-sr');
    live.setAttribute('aria-live', 'polite');
    live.setAttribute('aria-atomic', 'true');
    add(root, content, live);
    document.body.appendChild(root);
  }
  function open(config = {}) {
    if (!root) mount({});
    if (!isOpen) {
      lastFocus = document.activeElement;
      cachedBodyOverflow = document.body.style.overflow;
      document.body.style.overflow = 'hidden';
    }
    isOpen = true;
    root.hidden = false;
    root.scrollTop = 0;
    near = Boolean(config.mine);
    load(false, near);
    root.querySelector('h1')?.focus({ preventScroll: true });
  }
  function close() {
    if (!root || !isOpen) return;
    isOpen = false;
    generation++;
    loading = false;
    root.hidden = true;
    document.body.style.overflow = cachedBodyOverflow;
    if (lastFocus?.isConnected && !lastFocus.inert) lastFocus.focus?.({ preventScroll: true });
  }
  function setLanguage(value) {
    language = value === 'en' ? 'en' : 'zh';
    if (isOpen) render();
  }
  global.NeonHall = Object.freeze({ mount, open, close, setLanguage, refresh: () => load(),
    refreshLocal: () => { if (isOpen) render(); } });
})(window);
