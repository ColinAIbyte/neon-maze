// IP language routing: region mapping, manual override, URL preservation and UI.
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

async function simulate({ current='zh', country='US', manual='', href } = {}){
  href ||= current === 'en'
    ? 'https://playneonmaze.com/en/?c=123&n=Kid#score'
    : 'https://playneonmaze.com/?c=123&n=Kid#score';
  const url = new URL(href);
  const local = storage(manual ? {'neon-maze-language-manual-v1':manual} : {});
  const session = storage();
  const location = {
    href:url.href, search:url.search, hash:url.hash, replaced:'', assigned:'',
    replace(v){ this.replaced=String(v); },
    assign(v){ this.assigned=String(v); },
  };
  let clickHandler = null, fetches = 0;
  const document = {
    currentScript:{ getAttribute:key => key === 'data-current-language' ? current : null },
    addEventListener(type, fn){ if(type === 'click') clickHandler=fn; },
  };
  const window = {
    location, localStorage:local, sessionStorage:session,
    fetch(){
      fetches++;
      return Promise.resolve({ok:true,json:()=>Promise.resolve({country})});
    },
  };
  vm.runInNewContext(router, {
    window, document, URL, AbortController,
    setTimeout:()=>1, clearTimeout:()=>{},
  });
  await new Promise(resolve=>setImmediate(resolve));
  return {location,local,session,fetches,clickHandler};
}

let r = await simulate({current:'zh',country:'US'});
if(r.location.replaced !== 'https://playneonmaze.com/en/?c=123&n=Kid#score')
  fail.push('外网 IP 没有跳英文或丢了挑战参数');

for (const country of ['CN','HK','MO','TW']){
  r = await simulate({current:'zh',country});
  if(r.location.replaced) fail.push(country + ' 应保持中文，却发生跳转');
}

r = await simulate({current:'en',country:'TW'});
if(r.location.replaced !== 'https://playneonmaze.com/?c=123&n=Kid#score')
  fail.push('港澳台 IP 从英文页返回中文失败');

r = await simulate({current:'en',country:'US',manual:'zh'});
if(r.fetches !== 0 || r.location.replaced !== 'https://playneonmaze.com/?c=123&n=Kid#score')
  fail.push('手动选择没有优先于 IP 自动检测');

r = await simulate({current:'zh',country:'CN',manual:'zh'});
let prevented = false;
r.clickHandler({
  target:{closest:()=>({getAttribute:()=> 'en'})},
  preventDefault(){prevented=true;},
});
if(!prevented || r.local.value('neon-maze-language-manual-v1') !== 'en'
   || r.location.assigned !== 'https://playneonmaze.com/en/?c=123&n=Kid#score')
  fail.push('顶部手动切换没有记住选择或丢了链接参数');

for (const [name,html,current] of [['中文',zh,'zh'],['英文',en,'en']]){
  if(!html.includes('class="language-switch"')) fail.push(name + '页缺少顶部语言开关');
  if(!html.includes(`data-language-choice="${current}"`)) fail.push(name + '页缺少当前语言选项');
}
if(!shell.includes('assets/language-router.js')) fail.push('中文页外壳没有加载语言路由脚本');
if(!en.includes('data-current-language="en"')) fail.push('英文页没有正确声明当前语言');
if(!en.includes('<base href="../">')) fail.push('英文页没有复用根目录资源');
if(!en.includes('class="brand-lockup"') || !en.includes('class="power-card"') || !en.includes('class="enemy-card"') || !en.includes('id="dailyBox"'))
  fail.push('英文页不是当前完整三栏游戏');

if(fail.length){
  fail.forEach(item=>console.error('✗ ' + item));
  process.exit(1);
}
console.log('语言路由通过：CN / HK / MO / TW → 中文，其他国家 → English。');
console.log('手动选择优先，中英文页都有顶部切换，挑战参数保留。');
