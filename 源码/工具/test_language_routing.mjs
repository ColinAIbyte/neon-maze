// Language preference: no IP disclosure, no forced first-visit redirect,
// browser-language suggestion, remembered manual choice and URL preservation.
import { readFileSync } from 'node:fs';
import vm from 'node:vm';

const router = readFileSync(new URL('../../assets/language-router.js', import.meta.url), 'utf8');
const zh = readFileSync(new URL('../neon_maze_fragment.html', import.meta.url), 'utf8');
const en = readFileSync(new URL('../../en/index.html', import.meta.url), 'utf8');
const shell = readFileSync(new URL('./web_shell.mjs', import.meta.url), 'utf8');
const fail = [];

function storage(seed = {}){
  const data = new Map(Object.entries(seed));
  return {
    getItem:k => data.has(k) ? data.get(k) : null,
    setItem:(k,v) => data.set(k,String(v)),
    value:k => data.get(k),
  };
}

function element(tag){
  const attrs = new Map();
  return {
    tagName:String(tag).toUpperCase(), className:'', textContent:'', href:'', type:'',
    children:[], parentNode:null,
    setAttribute(k,v){ attrs.set(k,String(v)); },
    getAttribute(k){ return attrs.has(k) ? attrs.get(k) : null; },
    appendChild(node){ node.parentNode=this; this.children.push(node); return node; },
    removeChild(node){ this.children=this.children.filter(child=>child!==node); node.parentNode=null; },
    closest(selector){
      if (selector === '[data-language-choice]' && attrs.has('data-language-choice')) return this;
      if (selector === '[data-language-dismiss]' && attrs.has('data-language-dismiss')) return this;
      if (selector === '.language-suggestion' && this.className === 'language-suggestion') return this;
      return this.parentNode && this.parentNode.closest ? this.parentNode.closest(selector) : null;
    },
  };
}

function simulate({ current='zh', languages=['en-US'], manual='', dismissed='', href } = {}){
  href ||= current === 'en'
    ? 'https://playneonmaze.com/en/?c=123&n=Kid#score'
    : 'https://playneonmaze.com/?c=123&n=Kid#score';
  const url = new URL(href);
  const local = storage(manual ? {'neon-maze-language-manual-v1':manual} : {});
  const session = storage(dismissed ? {'neon-maze-language-suggestion-dismissed-v1':'1'} : {});
  const location = {
    href:url.href, search:url.search, hash:url.hash, replaced:'', assigned:'',
    replace(v){ this.replaced=String(v); },
    assign(v){ this.assigned=String(v); },
  };
  const handlers = {};
  const body = element('body');
  const document = {
    currentScript:{ getAttribute:key => key === 'data-current-language' ? current : null },
    readyState:'loading', body,
    createElement:element,
    addEventListener(type, fn){ handlers[type]=fn; },
  };
  const window = {
    location, localStorage:local, sessionStorage:session,
    navigator:{languages,language:languages[0] || ''},
  };
  vm.runInNewContext(router, { window, document, URL });
  if (handlers.DOMContentLoaded) handlers.DOMContentLoaded();
  return {location,local,session,body,clickHandler:handlers.click};
}

let r = simulate({current:'zh',languages:['en-GB']});
if(r.location.replaced || r.location.assigned)
  fail.push('英文浏览器首次打开中文页被强制跳转了');
if(r.body.children.length !== 1 || r.body.children[0].className !== 'language-suggestion')
  fail.push('英文浏览器在中文页没有得到轻量切换提示');
else {
  const link = r.body.children[0].children[1];
  if(link.textContent !== 'Switch to English' || !link.href.includes('/en/?c=123&n=Kid#score'))
    fail.push('英文切换提示文案或挑战链接不正确');
}

r = simulate({current:'en',languages:['zh-Hans-CN']});
if(r.location.replaced || r.body.children.length !== 1
   || r.body.children[0].children[1].textContent !== '切换中文')
  fail.push('中文浏览器在英文页没有得到中文提示，或被强制跳转');

for (const pair of [
  {current:'zh',languages:['zh-CN']},
  {current:'en',languages:['en-US']},
  {current:'en',languages:['fr-FR']},
]) {
  r = simulate(pair);
  if(r.body.children.length) fail.push(`${pair.languages[0]} 在匹配页面仍出现了语言提示`);
}

r = simulate({current:'zh',languages:['en-US'],dismissed:'1'});
if(r.body.children.length) fail.push('本次会话关闭过提示后仍重复出现');

r = simulate({current:'en',languages:['en-US'],manual:'zh'});
if(r.location.replaced !== 'https://playneonmaze.com/?c=123&n=Kid#score')
  fail.push('手动选择没有在再次访问时优先，或丢失挑战参数');

r = simulate({current:'zh',languages:['en-US']});
let prevented = false;
const suggestion = r.body.children[0];
r.clickHandler({target:suggestion.children[1],preventDefault(){prevented=true;}});
if(!prevented || r.local.value('neon-maze-language-manual-v1') !== 'en'
   || r.location.assigned !== 'https://playneonmaze.com/en/?c=123&n=Kid#score')
  fail.push('提示中的手动切换没有被记住，或丢失挑战参数');

r = simulate({current:'zh',languages:['en-US']});
const notice = r.body.children[0];
r.clickHandler({target:notice.children[2],preventDefault(){}});
if(r.session.value('neon-maze-language-suggestion-dismissed-v1') !== '1' || r.body.children.length)
  fail.push('关闭按钮没有移除提示并在本次会话记住');

if(/api\.country\.is|window\.fetch|country lookup/i.test(router))
  fail.push('语言路由仍会查询外部 IP 服务');
for (const [name,html,current] of [['中文',zh,'zh'],['英文',en,'en']]){
  if(!html.includes('class="language-switch"')) fail.push(name + '页缺少顶部语言开关');
  if(!html.includes(`data-language-choice="${current}"`)) fail.push(name + '页缺少当前语言选项');
}
if(!shell.includes('assets/language-router.js')) fail.push('中文页外壳没有加载语言偏好脚本');
if(!en.includes('data-current-language="en"')) fail.push('英文页没有正确声明当前语言');
if(!en.includes('<base href="../">')) fail.push('英文页没有复用根目录资源');
if(!en.includes('class="brand-lockup"') || !en.includes('class="power-card"')
   || !en.includes('class="enemy-card"') || !en.includes('id="dailyBox"'))
  fail.push('英文页不是当前完整三栏游戏');

if(fail.length){
  fail.forEach(item=>console.error('✗ ' + item));
  process.exit(1);
}
console.log('语言偏好通过：首次访问不强制跳转、不查询 IP；浏览器语言只给轻提示。');
console.log('手动选择长期优先，中英文页都有顶部切换，挑战参数完整保留。');
