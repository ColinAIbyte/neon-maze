// 桌面右栏的四只怪物必须在悬停时显示一句准确、简短的特点。
//   用法: node test_enemy_profiles.mjs
import { readFileSync } from 'node:fs';

const src = readFileSync(new URL('../neon_maze_fragment.html', import.meta.url), 'utf8');
const fail = [];
const ids = ['chaser', 'ambush', 'shy', 'patrol'];
const expectedProfiles = {
  chaser:'闪闪：锁定你的位置直接追踪',
  ambush:'狐狐：预判你的去向，提前拦截',
  shy:'软软：你一靠近它就跑',
  patrol:'慢慢：沿固定路线循环巡逻',
};

for (const id of ids){
  const re = new RegExp(
    `<button[^>]*class="[^"]*enemy-choice[^\"]*${id}[^\"]*"[^>]*data-enemy="${id}"[\\s\\S]{0,260}?data-profile="([^"]+)"[\\s\\S]{0,260}?aria-pressed="false"[\\s\\S]{0,260}?aria-controls="enemyDetail"[^>]*>`,
    'm'
  );
  const m = re.exec(src);
  if (!m){ fail.push(`${id} 不是可点击且带无障碍状态的怪物按钮`); continue; }
  const profile = m[1].trim();
  if (profile.length > 22) fail.push(`${id} 的特点太长（${profile.length} 字）：${profile}`);
  if (profile !== expectedProfiles[id])
    fail.push(`${id} 的特点与玩法说明不一致：${profile}`);
}

const required = [
  ['四只按钮', (src.match(/class="enemy-choice /g) || []).length === 4],
  ['44px 命中区', /\.enemy-choice\{[\s\S]{0,180}?width:44px;height:44px/.test(src)],
  ['实时说明区', /id="enemyDetail"[^>]*aria-live="polite"/.test(src)],
  ['图鉴绑定', /querySelectorAll\('\.enemy-choice\[data-enemy\]'\)/.test(src)],
  ['三态回落顺序', /hoveredBtn\s*\|\|\s*focusedBtn\s*\|\|\s*committedBtn/.test(src)],
  ['鼠标悬停即显', /addEventListener\('mouseenter',[\s\S]{0,100}?hoveredBtn\s*=\s*btn[\s\S]{0,80}?syncEnemyProfile\(\)/.test(src)],
  ['键盘聚焦即显', /addEventListener\('focus',[\s\S]{0,100}?focusedBtn\s*=\s*btn[\s\S]{0,80}?syncEnemyProfile\(\)/.test(src)],
  ['轻触确认', /addEventListener\('click',[\s\S]{0,100}?committedBtn\s*=\s*btn[\s\S]{0,80}?syncEnemyProfile\(\)/.test(src)],
  ['移出图鉴回落', /addEventListener\('mouseleave',[\s\S]{0,220}?hoveredBtn\s*=\s*null[\s\S]{0,80}?syncEnemyProfile\(\)/.test(src)],
  ['安全写入文字', /detail\.textContent\s*=\s*current\.dataset\.profile/.test(src)],
  ['确认状态独立', /setAttribute\('aria-pressed',[\s\S]{0,100}?item\s*===\s*committedBtn/.test(src)],
  ['键盘焦点', /\.enemy-choice:focus-visible/.test(src)],
  ['激活键不被游戏劫持', /btn\.addEventListener\('keydown',[\s\S]{0,220}?e\.stopPropagation\(\)/.test(src)],
  ['当前预览高亮', /\.enemy-choice\.is-current/.test(src)],
];
for (const [label, ok] of required) if (!ok) fail.push(`缺少：${label}`);

// 执行源码里的真实绑定，覆盖 hover / focus / click 三态竞合，避免只验正则而假绿。
class FakeClassList {
  constructor(){ this.names = new Set(); }
  add(name){ this.names.add(name); }
  remove(name){ this.names.delete(name); }
  toggle(name, on){ on ? this.names.add(name) : this.names.delete(name); }
  contains(name){ return this.names.has(name); }
}
class FakeNode {
  constructor(dataset={}){
    this.dataset = {...dataset}; this.attrs = {}; this.listeners = {};
    this.classList = new FakeClassList(); this.textContent = '';
  }
  addEventListener(type, fn){ (this.listeners[type] ||= []).push(fn); }
  emit(type, event={}){ for (const fn of this.listeners[type] || []) fn(event); }
  setAttribute(name, value){ this.attrs[name] = String(value); }
  getAttribute(name){ return this.attrs[name] ?? null; }
  removeAttribute(name){
    delete this.attrs[name];
    if (name === 'data-enemy') delete this.dataset.enemy;
  }
}

try {
  const buttons = ids.map(id=>new FakeNode({enemy:id, profile:expectedProfiles[id]}));
  const roster = new FakeNode();
  const detail = new FakeNode(); detail.textContent = '悬停怪物 · 查看特点';
  const document = {
    getElementById:id=>id === 'enemyDetail' ? detail : null,
    querySelector:sel=>sel === '.enemy-roster' ? roster : null,
    querySelectorAll:sel=>sel === '.enemy-choice[data-enemy]' ? buttons : [],
  };
  const start = src.indexOf('(function bindEnemyProfiles(){');
  const finish = src.indexOf('})();', start);
  if (start < 0 || finish < 0) throw new Error('找不到 bindEnemyProfiles 实现');
  Function('document', src.slice(start, finish + 5))(document);

  const current = ()=>buttons.find(b=>b.classList.contains('is-current'));
  const pressed = ()=>buttons.filter(b=>b.getAttribute('aria-pressed') === 'true');
  const check = (ok, msg)=>{ if (!ok) fail.push(msg); };

  buttons[0].emit('mouseenter');
  check(detail.textContent === expectedProfiles.chaser && current() === buttons[0], '悬停闪闪没有立即显示');
  check(pressed().length === 0, '悬停不应伪装成 aria-pressed');

  buttons[0].emit('focus');
  buttons[1].emit('mouseenter');
  check(detail.textContent === expectedProfiles.ambush && current() === buttons[1], '键盘焦点 A + 悬停 B 时没有优先显示 B');
  roster.emit('mouseleave');
  check(detail.textContent === expectedProfiles.chaser && current() === buttons[0], '移出后没有回落到键盘焦点 A');
  buttons[0].emit('blur');
  check(detail.textContent === '悬停怪物 · 查看特点' && !current(), '焦点离开后没有恢复默认提示');

  buttons[2].emit('click');
  check(detail.textContent === expectedProfiles.shy && pressed()[0] === buttons[2], '轻触/点击没有确认软软');
  buttons[3].emit('mouseenter');
  check(current() === buttons[3] && pressed()[0] === buttons[2], '悬停预览不应覆盖已确认的 aria-pressed');
  roster.emit('mouseleave');
  check(current() === buttons[2] && detail.textContent === expectedProfiles.shy, '移出后没有回落到已确认的软软');

  let stopped = false;
  buttons[0].emit('keydown', {key:'Enter', stopPropagation(){ stopped = true; }});
  check(stopped, 'Enter 没有与游戏全局快捷键隔离');
} catch (e) {
  fail.push(`真实交互绑定无法执行：${e.message}`);
}

console.log(fail.length
  ? '怪物特点交互有问题：\n  ✗ ' + fail.join('\n  ✗ ')
  : '怪物特点 OK：悬停即显 / 轻触备用 / 44px 热区 / 键盘聚焦 / 实时播报。');
process.exit(fail.length ? 1 : 0);
