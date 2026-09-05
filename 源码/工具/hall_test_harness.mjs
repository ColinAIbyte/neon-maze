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
const create=(env,mutate=x=>x)=>new Function('env',`
  const {document,window,localStorage,getComputedStyle,requestAnimationFrame,
    cancelAnimationFrame,performance,fetch}=env;
  const setTimeout=()=>0,clearTimeout=()=>{};
  ${mutate(body)}
  return {fullNewGame,endGame,startPractice,startDaily,noteLevelReached,
    submitCloudScore,commitName,stepFrame,recordRecentScore,loadRecentScores,recentScoreState,
    mode(p,d){practiceLevel=p;dailyRun=d;},
    get id(){return currentRunId},get player(){return player},
    get score(){return score},set score(v){score=v},
    get daily(){return dailyRun},get state(){return gameState},
    get entry(){return lastCloudEntry},get local(){return loadScores()}};
`)(env);
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
function boot({path='/',lang='zh',storage=new Map(),submit,read,enabled=true,withBridge=true,storageIO,mutate=x=>x,mutateBridge=x=>x}={}){
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
  const game=create({...shim.env,fetch,localStorage:storageIO || shim.env.localStorage},mutate);
  const hall={mounted:null,opens:[],closed:0,localRefreshes:0,refreshLocal(){this.localRefreshes++;},language:lang,mount(options){this.mounted=options;},
    setLanguage(v){this.language=v;},open(v){this.opens.push(v);},close(){this.closed++;}};
  win.NeonHall=hall;
  if(withBridge)vm.runInNewContext(mutateBridge(bridge),{window:win,document:doc,URL,location,history,localStorage:shim.env.localStorage});
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


export {boot,tick,copy,response,deferred,boardRow,boardData,noop};
