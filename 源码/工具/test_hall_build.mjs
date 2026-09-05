import assert from 'node:assert/strict';
import {readFileSync,statSync} from 'node:fs';
import vm from 'node:vm';
const read=p=>readFileSync(new URL('../../'+p,import.meta.url),'utf8');
const source=read('源码/neon_maze_fragment.html');
for(const route of ['leaderboard','en/leaderboard']){
  const html=read(route+'/index.html');
  assert.equal(html,read('发布到网站/'+route+'/index.html'));
  assert(html.includes(`<base href="${route.startsWith('en/')?'../../':'../'}">`));
  assert(html.includes(`<link rel="canonical" href="https://playneonmaze.com/${route}/">`));
  assert(html.includes('hreflang="zh-Hans" href="https://playneonmaze.com/leaderboard/"'));
  assert(html.includes('hreflang="en" href="https://playneonmaze.com/en/leaderboard/"'));
  assert(!html.includes('__dbg') && !html.includes('_hall_rpc') && !html.includes('全部为测试数据'));
  for (const script of html.matchAll(/<script(?![^>]*src=)[^>]*>([\s\S]*?)<\/script>/g)) new vm.Script(script[1]);
  assert(html.includes('class="brand-lockup"') && html.includes('const MAZE_LEVEL_6'));
}
let size=0;
for(const file of ['leaderboard-hall.js','leaderboard-hall.css','leaderboard-bridge.js','leaderboard-entry.css']){
  assert.equal(read('assets/'+file),read('发布到网站/assets/'+file));
  size+=statSync(new URL('../../assets/'+file,import.meta.url)).size;
  if(file.endsWith('.js')) new vm.Script(read('assets/'+file));
}
assert(size<80000,'new hall assets stay below 80KB uncompressed');
const over=source.slice(source.indexOf('id="overOverlay"'),source.indexOf('class="pad-area"'));
const action=over.slice(over.indexOf('<div class="over-actions">'));
assert(action.includes('id="restartBtn"') && action.includes('id="resultHallBtn"'),'global link must share sticky result action bar');
assert(!action.includes('id="shareBtn"'),'share is secondary, not covering the global action');
assert.match(read('assets/leaderboard-entry.css'),/\.btn\.hall-entry\{/,'blue button rule must outrank the source gold .btn rule');

const router=read('assets/language-router.js');
for(const [current,choice,route,target] of [
  ['zh','en','leaderboard/','en/leaderboard/'],['en','zh','en/leaderboard/','leaderboard/'],
]){
  const redirects=[];
  const location={href:'https://playneonmaze.com/'+route+'?v=42#mine',pathname:'/'+route,search:'?v=42',hash:'#mine',replace:u=>redirects.push(u),assign:u=>redirects.push(u)};
  vm.runInNewContext(router,{URL,window:{location,navigator:{language:'zh'},localStorage:{getItem:()=>choice},sessionStorage:{getItem:()=>''}},
    document:{currentScript:{src:'https://playneonmaze.com/assets/language-router.js',getAttribute:()=>current},addEventListener:()=>{}}});
  assert.deepEqual(redirects,['https://playneonmaze.com/'+target+'?v=42#mine']);
}
console.log(`✓ Hall deep-link/English/base/canonical/assets mirror/JS/confirmation-action/route guards passed (${size} bytes new assets); no deployment tested.`);
