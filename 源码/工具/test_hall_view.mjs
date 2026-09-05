// Presentation contract tests only: simulated DOM and API, never production writes.
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';

const source = readFileSync(new URL('../../assets/leaderboard-hall.js', import.meta.url), 'utf8');
const css = readFileSync(new URL('../../assets/leaderboard-hall.css', import.meta.url), 'utf8');
assert(!/innerHTML|insertAdjacentHTML|document\.write|\beval\(/.test(source), 'all remote names use text DOM');
assert(!/\bfetch\(|XMLHttpRequest|location\.|history\.|localStorage/.test(source), 'hall does not own network, routes, or identity');
assert.match(css, /prefers-reduced-motion/);
assert.match(css, /\.neon-hall\[hidden\]\{display:none!important\}/);
assert.match(css, /font-variant-numeric:tabular-nums/);
new vm.Script(source);

function setup({response, language = 'zh', resume = false} = {}) {
  const calls = [], elements = [];
  let document;
  class Element {
    constructor(tag) {
      this.tagName = tag.toUpperCase(); this.children = []; this.attrs = {}; this.events = {};
      this.style = {}; this.dataset = {}; this.className = ''; this._text = ''; this.hidden = false;
      this.disabled = false; this.scrollTop = 0; this.isConnected = true;
      this.classList = {add: x => {this.className += ' ' + x;}};
      elements.push(this);
    }
    get textContent() { return this._text + this.children.map(x => x.textContent).join(''); }
    set textContent(value) {this._text = String(value); this.children = [];}
    setAttribute(k, v) {this.attrs[k] = v;}
    appendChild(child) {this.children.push(child); child.parent = this; return child;}
    replaceChildren(...children) {this._text = ''; this.children = []; children.forEach(x => this.appendChild(x));}
    addEventListener(type, fn) {(this.events[type] ||= []).push(fn);}
    click() {for (const fn of this.events.click || []) fn({target: this});}
    focus() {document.activeElement = this;}
    scrollIntoView() {this.scrolled = true;}
    getClientRects() {return this.hidden ? [] : [{}];}
    contains(el) {return this === el || this.children.some(x => x.contains(el));}
    matches(selector) {
      if (selector.startsWith('.')) return this.className.split(/\s+/).includes(selector.slice(1));
      if (selector === '[tabindex="0"]') return this.tabIndex === 0;
      if (selector === 'button:not([disabled])') return this.tagName === 'BUTTON' && !this.disabled;
      return this.tagName.toLowerCase() === selector;
    }
    querySelectorAll(selector) {
      const selectors = selector.split(',');
      return this.children.flatMap(child => [...(selectors.some(s => child.matches(s)) ? [child] : []), ...child.querySelectorAll(selector)]);
    }
    querySelector(selector) {return this.querySelectorAll(selector)[0] || null;}
  }
  document = {createElement: tag => new Element(tag), body: new Element('body')};
  const trigger = new Element('button');document.body.appendChild(trigger); document.activeElement = trigger;
  const env = {window:{}, document, Intl, Number, Date, Set, Array};
  vm.runInNewContext(source, env);
  const api = env.window.NeonHall;
  const callbacks = {close:0, challenge:0, languages:[]};
  api.mount({language, request: async options => {calls.push({...options}); return typeof response === 'function' ? response(options) : response;},
    canResume:()=>resume, onClose:()=>callbacks.close++, onChallenge:()=>callbacks.challenge++, onLanguage:x=>callbacks.languages.push(x)});
  const root = document.body.querySelector('.neon-hall');
  return {api, root, document, trigger, calls, callbacks, byText(value) {
    return root.querySelectorAll('button').find(x => x.textContent === value);
  }};
}
const tick = async () => {for(let i=0;i<8;i++) await Promise.resolve();};
const makeRow = (position, extra = {}) => ({rank:position, position, name:`Player-${position}`, score:1000000 - position * 100,
  level:6,combo:159,won:true,played_at:'2026-09-05T02:10:00Z',is_me:false,...extra});
function payload(all, request = {}, mine = null) {
  const offset = request.near && mine ? Math.max(0,mine.position-3) : request.offset || 0;
  return {status:'ok',data:{scope:request.scope || 'current',rule_version:'current-v1',revision:'fixture-r1',total:all.length,
    updated_at:'2026-09-05T03:00:00Z',rows:all.slice(offset,offset+25),podium:all.slice(0,3),mine,
    next:mine?.rank > 1 ? all[mine.position-2] : null,next_gap:mine?.rank > 1 ? 101 : null,
    offset,has_more:offset+25 < all.length}};
}
let checks = 0;
for (const language of ['zh','en']) {
  for (const count of [0,1,2,3,100]) {
    const all = Array.from({length:count},(_,i)=>makeRow(i+1));
    const h=setup({language,response:request=>payload(all,request)});
    h.api.open();
    assert(!h.root.hidden);assert(h.root.querySelector('.nh-loading'),'loading skeleton before response');
    await tick();
    assert.equal(h.root.querySelectorAll('.nh-honor').length,Math.min(3,count));
    assert.equal(h.root.querySelectorAll('.nh-entry').length,Math.min(25,count));
    assert.equal(h.root.querySelectorAll('.nh-empty').length,count===0?1:0);
    assert.equal(h.root.attrs.role,'dialog'); assert.equal(h.root.attrs['aria-modal'],'true');
    if (count===100) {
      for(let n=25;n<100;n+=25){h.byText(language==='en'?'Load more':'加载更多').click();await tick();}
      assert.equal(h.root.querySelectorAll('.nh-entry').length,100);
      assert.deepEqual(h.calls.map(x=>x.offset),[0,25,50,75]);
    }
    if(language==='en') assert(!/[\u3400-\u9fff]/.test(h.root.textContent.replace('中文','')),'English visible UI translated');
    h.api.close();assert(h.root.hidden);assert.equal(h.callbacks.close,0,'programmatic close does not create route callbacks');
    assert.equal(h.document.activeElement,h.trigger,'close restores focus');
    checks++;
  }
}

{
  const me=makeRow(63,{name:'长昵称 <img src=x onerror=alert(1)> 中English',score:1000000000000,is_me:true});
  const all=Array.from({length:100},(_,i)=>makeRow(i+1));all[62]=me;
  const h=setup({response:request=>payload(all,request,me)});
  h.api.open();await tick();
  assert(h.root.textContent.includes('第 63 名'),'server rank present beyond first page');
  assert(h.root.textContent.includes('1,000,000,000,000'),'full score is never shortened');
  h.byText('查看我的位置').click();await tick();
  assert.equal(h.calls.at(-1).near,true);
  assert(h.root.querySelector('.nh-entry-me').scrolled,'nearby response locates player');
  assert(h.root.textContent.includes(me.name),'nickname is safe literal text, not interpolated HTML');
  assert.equal(h.root.querySelector('.nh-entry-me').querySelector('.nh-player-name').title,me.name,'truncated row retains full nickname as title');
  assert(h.root.querySelector('.nh-entry-me').querySelector('.nh-run-details').textContent.includes(me.name),'expanded detail contains full nickname');
  h.byText('EN').click();
  assert.deepEqual(h.callbacks.languages,['en']);
  assert(h.root.textContent.includes('Rank #63'));assert.equal(h.calls.length,2,'language never refetches different standings');
  h.byText('Historical records').click();await tick();
  assert.equal(h.calls.at(-1).scope,'history');assert(h.root.textContent.includes('not comparable across rule versions'));
  assert(h.root.textContent.includes('My historical record'));
  assert(!h.root.textContent.includes('Your next target'));assert(!h.root.textContent.includes('more points to beat'));
  checks++;
}
{
  const tied=[makeRow(1,{score:1000}),makeRow(2,{rank:1,score:1000}),makeRow(3,{score:900,is_me:true})];
  const h=setup({response:request=>payload(tied,request,tied[2])});h.api.open();await tick();
  const ranks=h.root.querySelectorAll('.nh-row-rank').map(x=>x.textContent);
  assert.deepEqual(ranks,['#1','#1','#3'],'render server competition ranks, not row offsets');
  assert(h.root.textContent.includes('101 分'),'strictly greater target gap from server');checks++;
}
{
  const leader=makeRow(1,{is_me:true});const h=setup({response:request=>payload([leader],request,leader)});
  h.api.open();await tick();assert(h.root.textContent.includes('刷新自己的世界纪录'));assert(!h.root.textContent.includes('还需'));
  h.byText('历史规则存档').click();await tick();
  assert(h.root.textContent.includes('我的历史记录'));assert(!h.root.textContent.includes('刷新自己的世界纪录'));
  checks++;
}
{
  const all=Array.from({length:3},(_,i)=>makeRow(i+1));
  const h=setup({response:request=>{
    const response=payload(all,request);if(request.near)response.data.rows=[];return response;
  }});
  h.api.open({mine:true});await tick();
  assert.equal(h.calls.length,2);assert.equal(h.calls[1].near,false,'unranked find-me falls back to top scores');
  assert.equal(h.root.querySelectorAll('.nh-entry').length,3);assert(h.root.textContent.includes('完成第一局'));checks++;
}
for(const status of ['offline','error','unavailable','disabled']){
  const h=setup({response:{status}});h.api.open();await tick();
  assert(h.root.querySelector('.nh-error'));assert(!h.root.querySelector('.nh-empty'),'failure never becomes zero players');
  assert(!h.root.querySelector('.nh-personal-rank'),'errors do not manufacture rank');checks++;
}
{
  const h=setup({response:{status:'ok',data:{rows:[]}}});h.api.open();await tick();
  assert(h.root.textContent.includes('接口尚未启用'),'legacy incomplete response is not a valid empty board');checks++;
}
{
  const pending=[];const h=setup({response:request=>new Promise(resolve=>pending.push({request,resolve}))});
  h.api.open();await tick();h.byText('历史规则存档').click();await tick();
  pending[1].resolve(payload([makeRow(1,{name:'history winner'})],pending[1].request));await tick();
  pending[0].resolve(payload([makeRow(1,{name:'stale current winner'})],pending[0].request));await tick();
  assert(h.root.textContent.includes('history winner'));assert(!h.root.textContent.includes('stale current winner'));
  h.api.refresh();await tick();h.api.close();pending[2].resolve(payload([makeRow(1,{name:'after closing'})],pending[2].request));await tick();
  assert(h.root.hidden);assert(!h.root.textContent.includes('after closing'));checks++;
}
{
  let attempt=0;const all=Array.from({length:100},(_,i)=>makeRow(i+1));
  const h=setup({response:request=>request.offset>0 && attempt++===0 ? {status:'offline'} : payload(all,request)});
  h.api.open();await tick();h.byText('加载更多').click();await tick();
  assert(h.root.querySelector('.nh-inline-error'));assert.equal(h.root.querySelectorAll('.nh-entry').length,25);
  h.byText('重新加载').click();await tick();assert.equal(h.root.querySelectorAll('.nh-entry').length,50);checks++;
}
{
  const h=setup({response:payload([]),resume:true});h.api.open();await tick();
  assert(h.byText('← 返回游戏'),'header returns without promising resume');assert(!h.byText('← 继续游戏'));
  assert(h.byText('继续游戏'));h.byText('继续游戏').click();assert.equal(h.callbacks.challenge,1);assert(h.root.hidden);checks++;
}
{
  const h=setup({response:payload([])});h.api.open();await tick();
  let prevented=false,stopped=false;
  h.root.events.keydown[0]({key:'Escape',preventDefault(){prevented=true},stopPropagation(){stopped=true}});
  assert(prevented&&stopped);assert.equal(h.callbacks.close,1);assert(h.root.hidden);checks++;
}
{
  const initial=Array.from({length:100},(_,i)=>makeRow(i+1));let changed=false;
  const h=setup({response:request=>{
    const all=changed ? initial.map(row=>({...row,name:`new snapshot ${row.position}`})) : initial;
    const result=payload(all,request);result.data.revision=changed?'fixture-r2':'fixture-r1';return result;
  }});
  h.api.open();await tick();changed=true;h.byText('加载更多').click();await tick();
  assert.deepEqual(h.calls.map(x=>x.offset),[0,25,0],'changed full snapshot restarts at top');
  assert.equal(h.root.querySelectorAll('.nh-entry').length,25,'never appends inconsistent snapshots');
  assert(h.root.textContent.includes('榜单已变化，已刷新排名'));
  assert(h.root.textContent.includes('new snapshot 1'));assert(!h.root.textContent.includes('Player-1'));
  h.byText('EN').click();assert(h.root.textContent.includes('Standings changed; rankings refreshed'));checks++;
}
console.log(`✓ 全球竞技大厅 ${checks} 组模拟 DOM/API 检查通过；未访问生产服务，布局需另做真实浏览器尺寸检查。`);
