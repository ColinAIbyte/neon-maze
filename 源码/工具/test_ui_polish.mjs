// A-summary DOM and codex state regressions. Browser layout is checked separately.
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {boot,tick,response,boardRow,boardData,noop} from './hall_test_harness.mjs';

let passed=0;
async function check(name,fn){await fn();passed++;console.log('✓ '+name);}
const rows=app=>app.el('hallPreview').children.filter(el=>(el.className||'').split(' ').includes('preview-row'));

await check('both languages render zero to three rows without inventing ranks or clipping stored names',async()=>{
  for(const lang of ['zh','en'])for(const count of [0,1,2,3]){
    const podium=Array.from({length:count},(_,i)=>boardRow({rank:i<2?1:3,position:i+1,
      name:i===0?'豆豆迷宫探险队长':'WWWWWWWW',score:i<2?88888888:77777777,is_me:false}));
    const app=boot({lang,read:()=>response(boardData({total:count,rows:podium,podium,mine:null}))});
    await tick();const actual=rows(app);assert.equal(actual.length,count);
    for(let i=0;i<count;i++){
      assert.equal(actual[i].children.length,3);
      assert.equal(actual[i].children[0].textContent,'#'+podium[i].rank);
      assert.equal(actual[i].children[1].textContent,podium[i].name);
      assert.equal(actual[i].children[1].title,podium[i].name);
      assert.equal(actual[i].children[2].textContent,podium[i].score.toLocaleString('en-US'));
      assert.equal(actual[i].className.includes('preview-champion'),i===0);
    }
    assert.match(app.el('hallPreview').textContent,lang==='en'?/World record/:/世界纪录/);
    assert.equal(app.submits().length,0);
  }
});

await check('legacy public record uses the same columns but never fabricates a rank',async()=>{
  const app=boot({read:()=>response({},404),mutateBridge:s=>s.replace(
    'const legacy=await game.cloud.top(3);',
    'const legacy={status:"ok",data:[{name:"旧纪录",score:14419525}]};')});
  await tick();const [row]=rows(app);assert(row);
  assert.equal(row.children[0].textContent,'');
  assert.equal(row.children[1].textContent,'旧纪录');
  assert.equal(row.children[2].textContent,'14,419,525');
  assert.match(app.el('hallPreview').textContent,/待升级/);
});

await check('empty and offline summaries keep their existing honest messages',async()=>{
  const empty=boot({read:()=>response(boardData({total:0,rows:[],podium:[],mine:null}))});
  await tick();assert.match(empty.el('hallPreview').textContent,/第一位挑战者/);
  const offline=boot({read:()=>Promise.reject(Error('offline'))});
  await tick();assert.match(offline.el('hallPreview').textContent,/暂时无法读取/);
  assert.equal(rows(offline).length,0);
});

const codex=()=>boot({withBridge:false,mutate:s=>s+'\nwindow.polishTest={openOwl,openHelp,openAbout,renderLevelSelect};'});
await check('codex close returns to the visible start screen without changing run state',()=>{
  const app=codex(),before=app.game.state;
  app.win.polishTest.openOwl();assert.equal(app.el('owlOverlay').classList.contains('hidden'),false);
  assert.equal(app.el('startOverlay').classList.contains('hidden'),false);
  app.el('owlCloseBtn').click();assert.equal(app.el('owlOverlay').classList.contains('hidden'),true);
  assert.equal(app.game.state,before);
});
await check('codex opened during a run pauses and Escape preserves that same paused run',()=>{
  const app=codex();app.el('startBtn').click();const id=app.game.id;
  app.win.polishTest.openOwl();assert.equal(app.game.state,'paused');
  assert.equal(app.el('pauseOverlay').classList.contains('hidden'),false);
  app.win.emit('keydown',{key:'Escape',preventDefault:noop});
  assert.equal(app.el('owlOverlay').classList.contains('hidden'),true);
  assert.equal(app.game.id,id);assert.equal(app.game.state,'paused');
});
await check('codex, help and about remain mutually exclusive',()=>{
  const app=codex();
  for(const open of ['openOwl','openHelp','openOwl','openAbout']){
    app.win.polishTest[open]();
    assert.equal(['owlOverlay','helpOverlay','aboutOverlay'].filter(id=>!app.el(id).classList.contains('hidden')).length,1);
  }
});
await check('summary CSS keeps A sizing, tabular right alignment and direct-child short-screen hiding',()=>{
  const css=readFileSync(new URL('../../assets/leaderboard-entry.css',import.meta.url),'utf8');
  assert.match(css,/\.preview-row\{[^}]*grid-template-columns:24px minmax\(0,1fr\) max-content[^}]*font-size:15px[^}]*font-weight:500/);
  assert.match(css,/\.preview-champion\{color:#ffe085;font-weight:700\}/);
  assert.match(css,/\.preview-score\{font-variant-numeric:tabular-nums;white-space:nowrap/);
  assert.match(css,/\.preview-score\{text-align:right\}/);
  assert.match(css,/\.hall-preview > span:not\(\.preview-champion\)/);
  assert.doesNotMatch(css,/\.preview-champion\{[^}]*font-size/);
});
await check('codex shares opaque viewport layout, keeps a scrollable body and clears persistent navigation',()=>{
  const html=readFileSync(new URL('../neon_maze_fragment.html',import.meta.url),'utf8');
  assert.match(html,/#helpOverlay,#owlOverlay\{background:#0a0614;\}/);
  assert.match(html,/#helpOverlay,#owlOverlay\{\s*position:fixed;\s*inset:0;/);
  assert.match(html,/#owlOverlay\{z-index:130;touch-action:pan-y;\}/);
  assert.match(html,/<div class="help-doc" id="owlList" tabindex="0" aria-labelledby="owlTitle">/);
});
await check('codex entry reuses the real cyan enemy sprite and advertises a dialog',()=>{
  const app=codex();app.game.noteLevelReached(2);app.win.polishTest.renderLevelSelect();
  const markup=app.el('levelSel').innerHTML;
  assert.match(markup,/class="lv lv-codex enemy-choice chaser"/);
  assert.match(markup,/aria-haspopup="dialog" aria-controls="owlOverlay" aria-expanded="false"/);
  assert.match(markup,/<span class="enemy-thumb" aria-hidden="true"><\/span>/);
  assert.doesNotMatch(markup,/🦉/);
});
await check('entry Enter and Space remain native button activation, not game shortcuts',()=>{
  const app=codex();app.game.noteLevelReached(2);app.win.polishTest.renderLevelSelect();
  const button=app.el('owlBtn');button.focus();
  for(const key of ['Enter',' ']){
    let stopped=false;button.dispatch('keydown',{key,stopPropagation(){stopped=true;}});
    assert(stopped);assert.equal(app.game.state,'ready');
  }
  button.click();assert.equal(app.el('owlOverlay').classList.contains('hidden'),false);
  assert.equal(app.game.state,'ready');
});
await check('codex blocks game shortcuts from start, active-run and result screens',()=>{
  for(const mode of ['ready','playing','result']){
    const app=codex();
    if(mode!=='ready')app.el('startBtn').click();
    if(mode==='result')app.game.endGame(false);
    app.win.polishTest.openOwl();const state=app.game.state,id=app.game.id;
    for(const key of ['Enter','p','P','ArrowRight',' '])app.win.emit('keydown',{key,preventDefault:noop});
    assert.equal(app.game.state,state,mode);assert.equal(app.game.id,id,mode);
    assert.equal(app.el('owlOverlay').classList.contains('hidden'),false);
  }
});
await check('opening moves focus into the codex, closing returns it and updates expanded state',()=>{
  const app=codex(),opener=app.el('owlBtn');opener.focus();
  app.win.polishTest.openOwl();
  assert.equal(app.doc.activeElement,app.el('owlOverlay'));
  assert.equal(opener.getAttribute('aria-expanded'),'true');
  app.win.emit('keydown',{key:'Escape',preventDefault:noop});
  assert.equal(app.doc.activeElement,opener);
  assert.equal(opener.getAttribute('aria-expanded'),'false');
});
await check('Tab and Shift-Tab stay between readable content and the close button',()=>{
  const app=codex();app.win.polishTest.openOwl();
  const panel=app.el('owlOverlay'),list=app.el('owlList'),close=app.el('owlCloseBtn');
  for(const [from,shift,to] of [[panel,true,close],[list,true,close],[close,false,list]]){
    from.focus();let prevented=false;
    panel.dispatch('keydown',{key:'Tab',shiftKey:shift,preventDefault(){prevented=true;}});
    assert(prevented);assert.equal(app.doc.activeElement,to);
  }
});
console.log(`\nUI polish: ${passed}/${passed} passed. Isolated fixtures; no production writes.`);
