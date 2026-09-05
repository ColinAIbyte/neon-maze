// Execute the real game adapter, cloud transport and web bridge in an isolated
// Node DOM/network harness. No live requests, uploaded scores, or production hooks.
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';

const source = readFileSync(new URL('../neon_maze_fragment.html',import.meta.url),'utf8');
const bridge = readFileSync(new URL('../../assets/leaderboard-bridge.js',import.meta.url),'utf8');
const body = source.slice(source.indexOf('<script>')+8,source.lastIndexOf('</script>'))
  .trim().replace(/^\(function\(\)\s*\{\s*(?:"use strict";|'use strict';)?/,'').replace(/\}\)\(\);?$/,'');
const noop=()=>{};
const ctx=new Proxy({}, {get:(_,k)=>k==='measureText' ? s=>({width:String(s).length*7})
  : /^create.*Gradient$/.test(String(k)) ? ()=>({addColorStop:noop}) : noop});
const canvas=()=>({width:494,height:546,getContext:()=>ctx});
const {installShim}=await import('../微信小游戏版/js/shim.js');
const create=new Function('env',`
  const {document,window,localStorage,getComputedStyle,requestAnimationFrame,
    cancelAnimationFrame,performance,fetch}=env;
  const setTimeout=()=>0,clearTimeout=()=>{};
  ${body}
  return {fullNewGame,endGame,startPractice,startDaily,noteLevelReached,
    submitCloudScore,commitName,stepFrame,
    get id(){return currentRunId},get player(){return player},
    get score(){return score},set score(v){score=v},
    get daily(){return dailyRun},get state(){return gameState},
    get entry(){return lastCloudEntry},get local(){return loadScores()}};
`);
const tick=async()=>{for(let i=0;i<40;i++)await Promise.resolve();};
const copy=v=>JSON.parse(JSON.stringify(v));
const response=(data,status=200)=>({ok:status>=200&&status<300,status,json:async()=>copy(data)});
const deferred=()=>{let resolve;const promise=new Promise(r=>{resolve=r});return {promise,resolve};};
const boardRow=(overrides={})=>({rank:1,position:1,name:'玩家 Player',score:12663021,level:6,
  combo:159,won:true,played_at:'2026-09-05T01:02:03Z',is_me:true,...overrides});
const boardData=(overrides={})=>({scope:'current',rule_version:'web-2026.09.04',total:1,
  revision:'0123456789abcdef0123456789abcdef',
  updated_at:'2026-09-05T02:00:00Z',rows:[boardRow()],podium:[boardRow()],mine:boardRow(),
  next:null,next_gap:null,offset:0,has_more:false,...overrides});

function emitter(target){
  const events=new Map();
  target.addEventListener=(type,fn)=>{const list=events.get(type)||[];list.push(fn);events.set(type,list);};
  target.removeEventListener=(type,fn)=>events.set(type,(events.get(type)||[]).filter(f=>f!==fn));
  target.emit=(type,event={})=>{for(const fn of events.get(type)||[])fn(event);};
  return target;
}
function boot({path='/',lang='zh',storage=new Map(),submit,read,enabled=true,withBridge=true}={}){
  const win=emitter({requestAnimationFrame:()=>0,cancelAnimationFrame:noop});
  globalThis.GameGlobal=win;
  globalThis.wx={createCanvas:canvas,getSystemInfoSync:()=>({windowWidth:390,windowHeight:844,pixelRatio:2}),
    getStorageSync:k=>storage.get(k)||'',setStorageSync:(k,v)=>storage.set(k,v),removeStorageSync:k=>storage.delete(k),
    createWebAudioContext:()=>({currentTime:0,state:'running',resume:noop,destination:{},
      createOscillator:()=>({frequency:{setValueAtTime:noop,exponentialRampToValueAtTime:noop},connect:d=>d,start:noop,stop:noop}),
      createGain:()=>({gain:{setValueAtTime:noop,exponentialRampToValueAtTime:noop},connect:d=>d})})};
  const shim=installShim({maze:canvas(),fx:canvas()});
  const doc=emitter(shim.doc);
  const origEl=shim.el;
  function enhance(el){
    if(el.enhanced)return el;
    el.enhanced=true;el.children=[];el.isConnected=true;
    Object.defineProperty(el,'textContent',{get(){return this._text+this.children.map(c=>c.textContent||'').join(' ');},set(v){this._text=String(v);this.children=[];}});
    el.append=(...kids)=>{el.children.push(...kids);};
    el.appendChild=k=>{el.append(k);return k;};
    el.replaceChildren=(...kids)=>{el._text='';el.children=[...kids];};
    el.after=(...kids)=>{el.afterNodes=kids;};
    el.focus=()=>{doc.activeElement=el;};
    el.closest=selector=>selector.split(',').some(s=>s.trim().startsWith('[')
      ? el.hasAttribute(s.trim().slice(1,-1)) : el.classList.contains(s.trim().slice(1))) ? el : null;
    return el;
  }
  doc.getElementById=id=>enhance(origEl(id));
  for(const el of shim.els.values())enhance(el);
  let detached=0;
  doc.createElement=tag=>{const el=enhance(origEl('detached-'+(++detached)));el.tagName=tag.toUpperCase();return el;};
  const previousQuery=doc.querySelector;
  doc.querySelector=selector=>enhance(previousQuery(selector));
  doc.body=enhance(doc.body);doc.activeElement=doc.getElementById('startBtn');
  doc.documentElement.lang=lang;
  doc.currentScript={src:'https://local.invalid/assets/leaderboard-bridge.js'};
  const location=new URL(path,'https://local.invalid');
  const historyEntries=[location.href];let historyIndex=0;
  const navigate=url=>{location.href=new URL(url,location).href;};
  const history={
    pushState:(state,title,url)=>{navigate(url);historyEntries.splice(++historyIndex);historyEntries.push(location.href);},
    replaceState:(state,title,url)=>{navigate(url);historyEntries[historyIndex]=location.href;},
    back:()=>{if(historyIndex>0){navigate(historyEntries[--historyIndex]);win.emit('popstate');}},
    forward:()=>{if(historyIndex<historyEntries.length-1){navigate(historyEntries[++historyIndex]);win.emit('popstate');}},
  };
  const network=[];
  const fetch=async(url,options={})=>{
    assert(url.startsWith('https://localtest.supabase.co/'),'test never allows a production URL');
    const call={url,options,payload:options.body?JSON.parse(options.body):null};network.push(call);
    if(url.endsWith('/submit_score'))return submit ? submit(call) : response({accepted:true});
    if(url.endsWith('/leaderboard_hall'))return read ? read(call) : response(boardData());
    if(url.includes('/leaderboard_public'))return response([]);
    throw Error('Unexpected mocked route '+url);
  };
  if(enabled)win.NEON_MAZE_CONFIG={supabase:{url:'https://localtest.supabase.co',publishableKey:'sb_publishable_'+ 'localtest'.repeat(5)}};
  const game=create({...shim.env,fetch});
  const hall={mounted:null,opens:[],closed:0,language:lang,mount(options){this.mounted=options;},
    setLanguage(v){this.language=v;},open(v){this.opens.push(v);},close(){this.closed++;}};
  win.NeonHall=hall;
  if(withBridge)vm.runInNewContext(bridge,{window:win,document:doc,URL,location,history,localStorage:shim.env.localStorage});
  const el=id=>doc.getElementById(id);
  const clickHall=({mine=false}={})=>{
    const target=doc.createElement('button');target.setAttribute('data-open-hall','');
    if(mine)target.setAttribute('data-hall-mine','');
    doc.emit('click',{target,preventDefault:noop,stopPropagation:noop});
  };
  const all=(root,tag)=>[...root.children.flatMap(c=>[...(c.tagName===tag?[c]:[]),...all(c,tag)])];
  const confirm=(name='Public Name')=>{
    const result=el('resultCloud'),form=all(result,'FORM')[0];
    assert(form,'must offer explicit public-name confirmation');
    all(form,'INPUT')[0].value=name;
    form.dispatch('submit',{preventDefault:noop});
  };
  const saveLocally=name=>{
    const form=all(el('resultCloud'),'FORM')[0];
    assert(form,'local nickname action belongs to the consent form');
    all(form,'INPUT')[0].value=name;
    const action=all(form,'BUTTON').find(b=>b.className==='cloud-local-name');
    assert(action,'local-only nickname action must exist');
    assert.equal(action.type,'button','local-only action must not submit its parent form');
    action.click();
  };
  return {game,win,doc,el,location,history,hall,storage,network,clickHall,confirm,saveLocally,
    submits:()=>network.filter(c=>c.url.endsWith('/submit_score')),
    reads:()=>network.filter(c=>c.url.endsWith('/leaderboard_hall')),
    result:()=>el('resultCloud').textContent};
}

const results=[];
async function check(name,fn){try{await fn();results.push({name,ok:true});console.log('✓ '+name);}
  catch(error){results.push({name,ok:false,error:error.message});console.error('✗ '+name+'\n  '+error.stack);}}

await check('normal completion saves locally without publishing before nickname confirmation',async()=>{
  const app=boot();app.game.score=123456;app.game.endGame(false);await tick();
  assert.equal(app.submits().length,0);assert.equal(app.game.local.length,1);
  assert.match(app.result(),/尚未公开/);assert.match(app.result(),/确认后公开昵称/);
  assert.equal(app.el('resultCloud').classList.contains('hidden'),false);
  app.confirm('猫<>&"\'长长长长长长长');await tick();
  assert.equal(app.submits().length,1);
  assert.equal(app.submits()[0].payload.p_player_name,'猫长长长长长长长');
  assert.equal(app.submits()[0].payload.p_run_id,app.game.id);
  assert.equal(app.submits()[0].payload.p_player_id,app.win.NeonGame.playerId());
  assert.match(app.result(),/云端已确认保存/);
});

await check('bridge load failure fails closed: completion and local rename never auto-publish',async()=>{
  const app=boot({withBridge:false});app.game.score=123456;app.game.endGame(false);
  app.el('nameInput').value='Local';app.game.commitName();await tick();
  assert.equal(app.submits().length,0);assert.equal(app.game.local.length,1);
  assert.equal(app.game.local[0].name,'Local');
});

await check('local-only nickname confirmation updates the same local row without any cloud submission',async()=>{
  for(const lang of ['zh','en']){
    const app=boot({lang,path:lang==='en'?'/en/':'/'});app.game.score=7654;app.game.endGame(false);await tick();
    const before=app.game.local[0];app.saveLocally('私有<名字>');await tick();
    assert.equal(app.submits().length,0);
    assert.equal(app.game.local.length,1);assert.equal(app.game.local[0].id,before.id);
    assert.equal(app.game.local[0].score,before.score);assert.equal(app.game.local[0].name,'私有名字');
    assert.equal(app.win.NeonGame.name(),'私有名字');
    assert.match(app.result(),lang==='en'?/saved locally.*not public/:/本机昵称已保存，本局尚未公开/);
    assert.equal(app.el('nameRow').classList.contains('hidden'),true,'hide the duplicate legacy nickname input');
    app.confirm('公开昵称');await tick();assert.equal(app.submits().length,1);
    assert.equal(app.submits()[0].payload.p_player_name,'公开昵称');
    assert.equal(app.game.local[0].id,before.id);assert.equal(app.game.local[0].name,'公开昵称');
  }
});

await check('disabled cloud hides both result-cloud controls and preserves the legacy local nickname path',async()=>{
  const app=boot({enabled:false});app.game.score=1357;app.game.endGame(false);await tick();
  assert.equal(app.el('resultCloud').classList.contains('hidden'),true);
  assert.equal(app.el('resultHallBtn').classList.contains('hidden'),true);
  assert.equal(app.el('nameRow').classList.contains('hidden'),false);
  app.el('nameInput').value='本机玩家';app.game.commitName();await tick();
  assert.equal(app.game.local[0].name,'本机玩家');assert.equal(app.network.length,0);
});

await check('HTTP success without accepted:true never claims saved or ranked',async()=>{
  for(const payload of [null,{},[],{accepted:false},{accepted:'true'}]){
    const app=boot({submit:()=>response(payload)});app.game.score=100;app.game.endGame(false);
    app.confirm();await tick();assert.match(app.result(),/未能确认/);assert.doesNotMatch(app.result(),/已确认保存|当前第/);
  }
});

await check('failed submit retries the exact run ID and accepted success alone permits ranking lookup',async()=>{
  let calls=0;const app=boot({submit:()=>++calls===1?Promise.reject(Error('offline')):response({accepted:true})});
  app.game.score=900;app.game.endGame(false);await tick();const readsBefore=app.reads().length;
  app.confirm('重试');await tick();assert.match(app.result(),/未能确认/);assert.equal(app.reads().length,readsBefore);
  app.confirm('重试');await tick();assert.equal(app.submits().length,2);
  assert.deepEqual(app.submits()[0].payload,app.submits()[1].payload);
  assert.match(app.result(),/云端已确认保存/);assert(app.reads().length>readsBefore);
});

await check('pending submit double-click does not enqueue duplicate HTTP writes',async()=>{
  const wait=deferred(),app=boot({submit:()=>wait.promise});app.game.score=900;app.game.endGame(false);
  const form=app.el('resultCloud').children.find(c=>c.tagName==='FORM');
  app.confirm();form.dispatch('submit',{preventDefault:noop});await tick();assert.equal(app.submits().length,1);
  assert.match(app.result(),/正在提交/);wait.resolve(response({accepted:true}));await tick();
});

await check('rename invalidates earlier response and requires explicit confirmation again',async()=>{
  const wait=deferred();let n=0;const app=boot({submit:()=>++n===1?wait.promise:response({accepted:true})});
  app.game.score=123;app.game.endGame(false);app.confirm('原昵称');await tick();
  app.el('nameInput').value='新昵称';app.game.commitName();
  wait.resolve(response({accepted:true}));await tick();
  assert.equal(app.submits().length,1);assert.match(app.result(),/请确认/);assert.doesNotMatch(app.result(),/云端已确认保存/);
  app.confirm('新昵称');await tick();assert.equal(app.submits().length,2);
  assert.equal(app.submits()[1].payload.p_run_id,app.submits()[0].payload.p_run_id);
  assert.equal(app.submits()[1].payload.p_player_name,'新昵称');assert.match(app.result(),/云端已确认保存/);
});

await check('rename confirmed during initial write queues behind that run instead of racing it',async()=>{
  const first=deferred(),second=deferred();let n=0;
  const app=boot({submit:()=>++n===1?first.promise:second.promise});
  app.game.score=321;app.game.endGame(false);app.confirm('原昵称');await tick();
  app.el('nameInput').value='新昵称';app.game.commitName();app.confirm('新昵称');await tick();
  assert.equal(app.submits().length,1);first.resolve(response({accepted:true}));await tick();
  assert.equal(app.submits().length,2);assert.equal(app.submits()[1].payload.p_player_name,'新昵称');
  assert.doesNotMatch(app.result(),/云端已确认保存/);
  second.resolve(response({accepted:true}));await tick();assert.match(app.result(),/云端已确认保存/);
});

await check('confirmed upload with ranking-read failure reports only saved, never an invented rank',async()=>{
  const app=boot({read:call=>call.payload.p_near?Promise.reject(Error('offline')):response(boardData())});
  app.game.score=4321;app.game.endGame(false);app.confirm();await tick();
  assert.match(app.result(),/云端已确认保存/);assert.match(app.result(),/无法核实当前排名/);
  assert.doesNotMatch(app.result(),/当前第|世界纪录|超过上一档还需/);
});

await check('next target derives from best-run server snapshot and requires strictly exceeding the score',async()=>{
  const first=boardRow({rank:1,position:1,name:'First',score:200,is_me:false});
  const mine=boardRow({rank:2,position:2,score:123});
  const data=boardData({total:2,rows:[first,mine],podium:[first,mine],mine,next:first,next_gap:78});
  const app=boot({read:()=>response(data)});app.game.score=100;app.game.endGame(false);app.confirm();await tick();
  assert.match(app.result(),/当前第 2 名/);assert.match(app.result(),/78 分/);assert.doesNotMatch(app.result(),/世界纪录/);
});

await check('new run invalidates a previous pending submission and hides its result',async()=>{
  const wait=deferred(),app=boot({submit:()=>wait.promise});app.game.score=123;app.game.endGame(false);
  app.confirm();await tick();const oldId=app.game.id;
  app.game.fullNewGame();assert.notEqual(app.game.id,oldId);
  wait.resolve(response({accepted:true}));await tick();
  assert.doesNotMatch(app.result(),/云端已确认保存|当前第/);
  assert.equal(app.el('resultCloud').classList.contains('hidden'),true);
});

await check('new run invalidates a previous pending rank lookup',async()=>{
  const wait=deferred();const app=boot({read:call=>call.payload.p_near?wait.promise:response(boardData())});
  app.game.score=123;app.game.endGame(false);app.confirm();await tick();
  app.game.fullNewGame();wait.resolve(response(boardData()));await tick();
  assert.doesNotMatch(app.result(),/当前第/);assert.equal(app.el('resultCloud').classList.contains('hidden'),true);
});

await check('practice and Daily keep results local and never offer public submission',async()=>{
  for(const daily of [false,true]){
    const app=boot();app.game.noteLevelReached(3);
    if(daily)app.game.startDaily();else app.game.startPractice(2);
    app.game.score=9000000;app.game.endGame(false);await tick();
    assert.equal(app.submits().length,0);assert.equal(app.game.entry,null);
    assert.equal(app.el('resultCloud').classList.contains('hidden'),true);
    assert.equal(app.el('resultHallBtn').classList.contains('hidden'),true);
    assert.equal(app.game.local.length,0);
  }
});

await check('Chinese and English sessions use the same browser-bound anonymous player ID',async()=>{
  const storage=new Map(),zh=boot({storage});await tick();const id=zh.win.NeonGame.playerId();
  const en=boot({storage,lang:'en',path:'/en/'});await tick();
  assert.equal(en.win.NeonGame.playerId(),id);assert.equal(en.reads()[0].payload.p_player_id,id);
  assert.equal(zh.reads()[0].payload.p_player_id,id);
  assert.notEqual(boot().win.NeonGame.playerId(),id,'separate storage is not a cross-device account');
});

await check('hall request clamps input, retains stable player identity and disables without config',async()=>{
  const app=boot();await tick();
  await app.win.NeonGame.cloud.hall({scope:'evil',offset:-10,limit:999,near:'true'},app.win.NeonGame.playerId());
  let p=app.reads().at(-1).payload;
  assert.equal(p.p_scope,'current');assert.equal(p.p_offset,0);assert.equal(p.p_limit,50);assert.equal(p.p_near,false);
  await app.win.NeonGame.cloud.hall({scope:'history',offset:100,limit:20,near:true},app.win.NeonGame.playerId());
  p=app.reads().at(-1).payload;assert.equal(p.p_scope,'history');assert.equal(p.p_offset,100);assert.equal(p.p_near,true);
  assert.equal(p.p_player_id,app.win.NeonGame.playerId());
  const off=boot({enabled:false});await tick();assert.equal(off.network.length,0);
  assert.equal((await off.win.NeonGame.cloud.hall()).status,'disabled');
});

await check('unavailable RPC and network failure remain distinct from an empty leaderboard',async()=>{
  for(const code of [400,404]){
    const app=boot({read:()=>response({},code)});assert.equal((await app.win.NeonGame.cloud.hall()).status,'unavailable');
  }
  const offline=boot({read:()=>Promise.reject(Error('offline'))});
  assert.equal((await offline.win.NeonGame.cloud.hall()).status,'offline');
  const empty=boot({read:()=>response(boardData({total:0,rows:[],podium:[],mine:null}))});
  assert.equal((await empty.win.NeonGame.cloud.hall()).status,'ok');
});

await check('hall rejects malformed rows and metadata before UI can show false ranks or targets',async()=>{
  const cases=[null,{},boardData({total:-1}),boardData({updated_at:'bad date'}),
    boardData({rows:[boardRow({score:1e13})]}),boardData({mine:boardRow({rank:0})}),
    boardData({next_gap:'500'}),boardData({next_gap:undefined}),boardData({next_gap:-1}),
    boardData({has_more:'yes'}),boardData({offset:-1}),boardData({scope:'weekly'}),
    boardData({mine:boardRow({is_me:false})}),boardData({podium:[boardRow({position:99})]})];
  const missed=[];
  for(let i=0;i<cases.length;i++){
    const app=boot({read:()=>response(cases[i]),withBridge:false});
    if((await app.win.NeonGame.cloud.hall()).status!=='error')missed.push(i);
  }
  assert.deepEqual(missed,[],'accepted malformed fixtures (zero-based indices): '+missed.join(','));
});

await check('opening hall pauses an actual run; back retains its board, score and run ID',async()=>{
  const app=boot();app.el('startBtn').click();app.game.score=54321;
  const id=app.game.id,player=app.game.player;
  assert.equal(app.game.state,'playing');app.clickHall();
  assert.equal(app.game.state,'paused');assert.equal(app.location.pathname,'/leaderboard/');
  assert.equal(app.doc.querySelector('.cabinet').inert,true);
  app.game.stepFrame(.033);assert.equal(app.game.score,54321);
  app.history.back();assert.equal(app.location.pathname,'/');assert.equal(app.game.state,'paused');
  assert.equal(app.game.player,player);assert.equal(app.game.id,id);assert.equal(app.game.score,54321);
  assert.equal(app.doc.querySelector('.cabinet').inert,false);
  app.el('resumeBtn').click();assert.equal(app.game.state,'playing');assert.equal(app.game.id,id);
});

await check('forward reopens hall and its challenge action resumes instead of restarting',async()=>{
  const app=boot();app.el('startBtn').click();const id=app.game.id;app.clickHall();app.history.back();app.history.forward();
  assert.equal(app.location.pathname,'/leaderboard/');assert.equal(app.hall.mounted.canResume(),true);
  app.hall.mounted.onChallenge();assert.equal(app.location.pathname,'/');assert.equal(app.game.state,'playing');
  assert.equal(app.game.id,id);assert.equal(app.win.NeonCompetition.isOpen(),false);
});

await check('hall owns keyboard input so Enter/P/arrows cannot restart, resume or move the covered game',async()=>{
  const app=boot();app.el('startBtn').click();app.clickHall();
  const id=app.game.id,want={...app.game.player.want};
  for(const key of ['Enter','p','P','ArrowRight',' ','w'])app.win.emit('keydown',{key,preventDefault:noop});
  assert.equal(app.game.state,'paused');assert.equal(app.game.id,id);assert.deepEqual(app.game.player.want,want);
  assert.equal(app.win.NeonCompetition.isOpen(),true);
});

await check('direct Chinese/English hall routes survive refresh; return and challenge target correct game route',async()=>{
  for(const lang of ['zh','en']){
    const path=lang==='en'?'/en/leaderboard/':'/leaderboard/';
    const app=boot({path:path+'?v=local',lang});assert.equal(app.hall.opens.length,1);
    assert.equal(app.game.state,'ready');assert.equal(app.win.NeonCompetition.isOpen(),true);
    app.hall.mounted.onClose();assert.equal(app.location.pathname,lang==='en'?'/en/':'/');
    assert.equal(app.location.search,'?v=local');assert.equal(app.game.state,'ready');
    const refreshed=boot({path,lang});refreshed.hall.mounted.onChallenge();assert.equal(refreshed.game.state,'playing');
    assert.equal(refreshed.location.pathname,lang==='en'?'/en/':'/');
  }
});

await check('in-hall language switching changes only route/language, not identity or active game',async()=>{
  const app=boot();app.el('startBtn').click();app.game.score=2468;const id=app.game.id,playerId=app.win.NeonGame.playerId();
  app.clickHall({mine:true});assert.equal(app.hall.opens.at(-1).mine,true);
  app.hall.mounted.onLanguage('en');assert.equal(app.location.pathname,'/en/leaderboard/');
  assert.equal(app.hall.language,'en');assert.equal(app.storage.get('neon-maze-language-manual-v1'),'en');
  assert.equal(app.game.id,id);assert.equal(app.win.NeonGame.playerId(),playerId);assert.equal(app.game.score,2468);
  app.win.emit('keydown',{key:'Escape',preventDefault:noop});assert.equal(app.location.pathname,'/');
  assert.equal(app.game.state,'paused');assert.equal(app.game.id,id);
});

const failed=results.filter(r=>!r.ok);
console.log(`\nHall integration: ${results.length-failed.length}/${results.length} checks passed. Simulated DOM/network only; no real cloud writes or phone verification.`);
if(failed.length)process.exitCode=1;
