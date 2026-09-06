// 语言偏好：默认英文、不泄露 IP、手动选择长期优先、切换不丢挑战参数。
//
// 2026-09-06 行为变更：首次访问不再「留在打开的那一页」，而是一律先进英文版。
// 原因是主要投放面向海外平台，英文是默认门面。下面几条断言当初写的是旧行为
// （首访不跳转），是随这次产品决定一起改的，不是为了让测试变绿。
// 中文没有被削弱：手动选过中文的人永久优先，英文页上的中文浏览器仍有轻提示。
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

function simulate({ current='zh', languages=['en-US'], manual='', dismissed='', href, leaveAllowed=true } = {}){
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
    NeonNavigation:{requestLeave:action=>{if(leaveAllowed)action();}},
    navigator:{languages,language:languages[0] || ''},
  };
  vm.runInNewContext(router, { window, document, URL });
  if (handlers.DOMContentLoaded) handlers.DOMContentLoaded();
  return {location,local,session,body,clickHandler:handlers.click};
}

// 没选过语言的访客，无论浏览器什么语言，一律先进英文版，且挑战参数不丢。
let r = simulate({current:'zh',languages:['en-GB']});
if(r.location.replaced !== 'https://playneonmaze.com/en/?c=123&n=Kid#score')
  fail.push('英文浏览器首次打开中文页没有跳到英文版，或丢了挑战参数');

r = simulate({current:'zh',languages:['zh-CN']});
if(r.location.replaced !== 'https://playneonmaze.com/en/?c=123&n=Kid#score')
  fail.push('中文浏览器首次访问也应先进英文版（默认门面是英文）');

r = simulate({current:'en',languages:['zh-Hans-CN']});
if(r.location.replaced || r.body.children.length !== 1
   || r.body.children[0].children[1].textContent !== '切换中文')
  fail.push('中文浏览器在英文页没有得到中文提示，或被强制跳转');

for (const pair of [
  {current:'en',languages:['en-US']},
  {current:'en',languages:['fr-FR']},
]) {
  r = simulate(pair);
  if(r.body.children.length) fail.push(`${pair.languages[0]} 在匹配页面仍出现了语言提示`);
}

r = simulate({current:'en',languages:['zh-Hans-CN'],dismissed:'1'});
if(r.body.children.length) fail.push('本次会话关闭过提示后仍重复出现');

r = simulate({current:'en',languages:['en-US'],manual:'zh'});
if(r.location.replaced !== 'https://playneonmaze.com/?c=123&n=Kid#score')
  fail.push('手动选择没有在再次访问时优先，或丢失挑战参数');

// 提示现在只出现在英文页上（给中文浏览器），点它应记住中文并回到根目录。
r = simulate({current:'en',languages:['zh-Hans-CN']});
let prevented = false;
const suggestion = r.body.children[0];
r.clickHandler({target:suggestion.children[1],preventDefault(){prevented=true;}});
if(!prevented || r.local.value('neon-maze-language-manual-v1') !== 'zh'
   || r.location.assigned !== 'https://playneonmaze.com/?c=123&n=Kid#score')
  fail.push('提示中的手动切换没有被记住，或丢失挑战参数');

r = simulate({current:'en',languages:['zh-Hans-CN']});
const notice = r.body.children[0];
r.clickHandler({target:notice.children[2],preventDefault(){}});
if(r.session.value('neon-maze-language-suggestion-dismissed-v1') !== '1' || r.body.children.length)
  fail.push('关闭按钮没有移除提示并在本次会话记住');

r = simulate({current:'en',languages:['zh-Hans-CN'],leaveAllowed:false});
r.clickHandler({target:r.body.children[0].children[1],preventDefault(){}});
if(r.location.assigned || r.local.value('neon-maze-language-manual-v1'))
  fail.push('取消离开本局后不应跳转或保存新的语言偏好');

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
console.log('语言偏好通过：未选过语言的访客一律先进英文版，不查询 IP。');
console.log('手动选择长期优先；英文页对中文浏览器仍有轻提示；挑战参数完整保留。');
