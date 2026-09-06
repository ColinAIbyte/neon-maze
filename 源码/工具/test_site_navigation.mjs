import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
import {boot} from './hall_test_harness.mjs';
import {wrap} from './web_shell.mjs';
import {toEnglish} from './i18n_en.mjs';
const read=p=>readFileSync(new URL('../../'+p,import.meta.url),'utf8');
const adapter=read('assets/site-navigation.js'),source=read('源码/neon_maze_fragment.html');
let passed=0;
function check(name,fn){fn();passed++;console.log('✓ '+name);}
function setup(compact=true,english=false){
  const app=boot({enabled:false,withBridge:false,lang:english?'en':'zh'}),{doc,win,el}=app;
  const header=el('siteHeader'),links=el('siteNavLinks'),toggle=el('siteMenuToggle');
  const play=el('navPlay'),help=el('navHelp'),hall=el('navHall');
  play.setAttribute('data-site-play','');help.setAttribute('data-site-panel','helpBtn');help.dataset={sitePanel:'helpBtn'};
  hall.setAttribute('data-open-hall','');
  const inside=new Set([play,help,hall,toggle,header]);
  header.contains=n=>inside.has(n);links.contains=n=>[play,help,hall].includes(n);
  const dEvents={},wEvents={};
  doc.addEventListener=(name,fn)=>{(dEvents[name]??=[]).push(fn);};
  win.addEventListener=(name,fn)=>{(wEvents[name]??=[]).push(fn);};
  const mq={matches:compact,addEventListener:(name,fn)=>{mq.changed=fn;}};
  win.matchMedia=()=>mq;let observe;
  const leave=el('siteLeaveDialog');leave.open=false;
  leave.contains=n=>[leave,el('siteLeaveCancel'),el('siteLeaveConfirm')].includes(n);
  leave.showModal=()=>{leave.open=true;leave.setAttribute('open','');};leave.close=()=>{leave.open=false;leave.removeAttribute('open');};
  class MutationObserver {constructor(fn){observe=fn;}observe(){}}
  vm.runInNewContext(adapter,{window:win,document:doc,MutationObserver});
  const click=target=>{doc.activeElement=target;for(const fn of dEvents.click)fn({target,preventDefault(){}});};
  const key=key=>{let stopped=false;for(const fn of wEvents.keydown)fn({key,target:doc.activeElement,stopPropagation(){stopped=true;},preventDefault(){}});return stopped;};
  return{...app,header,links,toggle,play,help,hall,mq,click,key,leave,observe:()=>observe()};
}
check('shared web shell has one language switch and real localized links',()=>{
  for(const [lang,html] of [['zh',wrap(source)],['en',toEnglish(wrap(source))]]){
    assert.equal((html.match(/class="language-switch"/g)||[]).length,1);
    assert.equal((html.match(/id="siteHeader"/g)||[]).length,1);
    const header=html.slice(html.indexOf('<header class="site-header"'),html.indexOf('</header>')+9);
    assert(header.includes(`href="${lang==='en'?'en/':''}leaderboard/" data-open-hall`));
    for(const label of lang==='en'?['Play','Leaderboard','How to Play','About','Menu']:['游戏','排行榜','玩法','关于','菜单'])assert(header.includes('>'+label+'<'));
    assert(!/Sign in|Pricing|Upgrade/.test(header));
    assert(html.indexOf('src="assets/site-navigation.js')<html.indexOf('src="assets/leaderboard-bridge.js'));
    for(const block of source.matchAll(/<(script|style)>([\s\S]*?)<\/\1>/g))assert(html.includes(block[0]) || lang==='en');
  }
});
check('compact disclosure pauses but never starts or restarts the game',()=>{
  const a=setup();assert.equal(a.links.hidden,true);a.toggle.click();assert.equal(a.game.state,'ready');
  assert.equal(a.links.hidden,false);assert.equal(a.toggle.getAttribute('aria-expanded'),'true');
  a.el('startBtn').click();a.game.score=54321;const id=a.game.id,player=a.game.player;
  a.toggle.click();a.toggle.click();assert.equal(a.game.state,'paused');
  assert.equal(a.game.id,id);assert.equal(a.game.player,player);assert.equal(a.game.score,54321);
  a.doc.activeElement=a.toggle;for(const k of ['Enter','p','ArrowRight',' '])assert.equal(a.key(k),true);
  a.key('Escape');assert.equal(a.links.hidden,true);assert.equal(a.game.state,'paused');assert.equal(a.doc.activeElement,a.toggle);
});
check('Play keeps an active run; Help closes back to pause with visible opener focus',()=>{
  const a=setup();a.el('startBtn').click();a.game.score=789;const id=a.game.id;
  a.click(a.play);assert.equal(a.game.state,'paused');assert.equal(a.game.id,id);assert.equal(a.game.score,789);
  assert.equal(a.doc.activeElement,a.el('resumeBtn'));
  a.toggle.click();a.click(a.help);a.observe();assert.equal(a.header.inert,true);assert.equal(a.doc.activeElement,a.el('helpOverlay'));
  a.el('helpCloseBtn').click();a.observe();assert.equal(a.header.inert,false);assert.equal(a.doc.activeElement,a.toggle);
  assert.equal(a.game.state,'paused');assert.equal(a.game.id,id);
});
check('desktop links persist; narrowing and hall entry restore an available focus target',()=>{
  const a=setup(false);assert.equal(a.links.hidden,false);
  a.doc.activeElement=a.help;a.mq.matches=true;a.mq.changed();assert.equal(a.links.hidden,true);assert.equal(a.doc.activeElement,a.toggle);
  a.toggle.click();a.click(a.hall);assert.equal(a.links.hidden,true);assert.equal(a.doc.activeElement,a.toggle);
  a.mq.matches=false;a.mq.changed();assert.equal(a.links.hidden,false);
});
check('language departure confirmation leaves a cancelled run paused and unchanged',()=>{
  for(const english of [false,true]){
    const a=setup(true,english);let departed=0;const action=()=>{departed++;};
    a.win.NeonNavigation.requestLeave(action);assert.equal(departed,1);assert.equal(a.leave.open,false);
    a.el('startBtn').click();a.game.score=4321;const id=a.game.id;
    a.win.NeonNavigation.requestLeave(action);assert.equal(a.leave.open,true);assert.equal(departed,1);assert.equal(a.game.state,'paused');
    a.el('siteLeaveCancel').click();assert.equal(a.leave.open,false);assert.equal(departed,1);
    assert.equal(a.game.score,4321);assert.equal(a.game.id,id);
    a.win.NeonNavigation.requestLeave(action);a.key('Escape');assert.equal(a.leave.open,false);assert.equal(departed,1);
    a.win.NeonNavigation.requestLeave(action);a.el('siteLeaveConfirm').click();assert.equal(departed,2);assert.equal(a.leave.open,false);
  }
});
check('all four routes and navigation assets are mirrored; native core is untouched',()=>{
  for(const route of ['index.html','en/index.html','leaderboard/index.html','en/leaderboard/index.html'])assert.equal(read(route),read('发布到网站/'+route));
  for(const asset of ['site-navigation.css','site-navigation.js'])assert.equal(read('assets/'+asset),read('发布到网站/assets/'+asset));
  assert(!source.includes('siteHeader') && !source.includes('NeonNavigation'));
});
check('older dialog implementations fail safely with a modal fallback',()=>{
  const a=setup();delete a.leave.showModal;delete a.leave.close;a.el('startBtn').click();
  let navigations=0;a.win.NeonNavigation.requestLeave(()=>{navigations++;});
  assert(a.leave.hasAttribute('open'));assert.equal(a.doc.querySelector('.cabinet').inert,true);
  assert(a.key('Enter'));a.el('siteLeaveCancel').click();
  assert.equal(a.leave.hasAttribute('open'),false);assert.equal(a.doc.querySelector('.cabinet').inert,false);
  assert.equal(a.game.state,'paused');assert.equal(navigations,0);
});
console.log(`Site navigation: ${passed}/${passed} passed (isolated DOM; browser geometry checked separately).`);
