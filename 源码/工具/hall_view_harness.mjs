import {readFileSync} from 'node:fs';
import vm from 'node:vm';
const source=readFileSync(new URL('../../assets/leaderboard-hall.js',import.meta.url),'utf8');
function setup({response, language = 'zh', resume = false, recent = () => ({rows:[],status:'ok'}), mutate = x => x} = {}) {
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
  vm.runInNewContext(mutate(source), env);
  const api = env.window.NeonHall;
  const callbacks = {close:0, challenge:0, languages:[]};
  api.mount({language, recent, request: async options => {calls.push({...options}); return typeof response === 'function' ? response(options) : response;},
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

export {setup,tick,makeRow,payload};
