// Local diagnostic only: read built files; never write the checkout or cloud.
// Build first, then run: node 源码/工具/profile_web.mjs
// Open http://127.0.0.1:8880/ in the target browser; do not deploy this server.
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import {stressProbe} from './profile_stress.mjs';
import {fileURLToPath} from 'node:url';
const root=fileURLToPath(new URL('../../发布到网站',import.meta.url));
const types={'.html':'text/html','.js':'text/javascript','.css':'text/css','.webp':'image/webp','.png':'image/png','.jpg':'image/jpeg','.svg':'image/svg+xml','.ico':'image/x-icon'};
const prelude=`<script>
(()=>{
 const memory=new Map([['doudou.reached','6'],['doudou.muted','1'],['neon-maze-language-manual-v1','zh']]);
 Object.defineProperty(window,'localStorage',{configurable:true,value:{getItem:k=>memory.get(k)??null,setItem:(k,v)=>memory.set(k,String(v)),removeItem:k=>memory.delete(k),clear:()=>memory.clear()}});
 const realFetch=window.fetch.bind(window);
 window.fetch=(url,options)=>new URL(url,location.href).origin===location.origin?realFetch(url,options):Promise.resolve(new Response('{}',{status:503}));
 if(navigator.sendBeacon)navigator.sendBeacon=()=>false;
})();
</script>`;
const probe=String.raw`
// Instrumentation is injected into the served response only.
(() => {
 let active=null;
 const results=[];
 const panel=document.createElement('aside');
 panel.style='position:fixed;top:0;left:0;z-index:99999;background:#111;color:white;padding:6px;font:12px monospace;max-width:95vw';
 panel.innerHTML='<div>只读性能采样 · 内存存档 · 禁止外部连接</div><button id="probeOne">测第1关</button><button id="probeSix">测第6关</button><button id="probeFx">测礼花</button><span id="probeStatus">准备就绪</span><details><summary>结果</summary><pre id="probeResults" style="max-height:250px;overflow:auto"></pre></details>';
 document.body.append(panel);
 const out=document.getElementById('probeResults'), status=document.getElementById('probeStatus');
 const wrap=(name,fn)=>function(...args){
   if(!active||performance.now()<active.begin)return fn.apply(this,args);
   const t=performance.now();try{return fn.apply(this,args);}finally{active.cost[name].push(performance.now()-t);}
 };
 render=wrap('render',render);update=wrap('update',update);drawMaze=wrap('maze',drawMaze);drawGhost=wrap('ghost',drawGhost);syncChrome=wrap('chrome',syncChrome);stepFrame=wrap('step',stepFrame);
 const quant=(a,p)=>a.length?a[Math.min(a.length-1,Math.floor((a.length-1)*p))]:null;
 const stats=values=>{const a=values.slice().sort((a,b)=>a-b);return {n:a.length,mean:a.length?values.reduce((s,v)=>s+v,0)/a.length:null,p50:quant(a,.5),p95:quant(a,.95),p99:quant(a,.99),max:a.at(-1)??null};};
 let longtasks=null;
 try{if(PerformanceObserver.supportedEntryTypes.includes('longtask')){longtasks=[];new PerformanceObserver(l=>longtasks.push(...l.getEntries().map(e=>({start:e.startTime,duration:e.duration})))).observe({type:'longtask',buffered:true});}}catch{}
 function finish(){
   const r=active;active=null;
   const costs=Object.fromEntries(Object.entries(r.cost).map(([k,v])=>[k,stats(v)]));
   const total=r.intervals.reduce((s,v)=>s+v,0);
   const nav=performance.getEntriesByType('navigation')[0];
   const result={scene:r.scene,durationMs:performance.now()-r.begin,validVisible:!r.hidden,visibility:document.visibilityState,viewport:[innerWidth,innerHeight],dpr:devicePixelRatio,userAgent:navigator.userAgent,playingSamples:r.playing,rafSamples:r.intervals.length,level,ghostCount:ghosts.length,rafHz:total?1000*r.intervals.length/total:null,intervalMs:stats(r.intervals),over22ms:r.intervals.filter(v=>v>22.23).length,over33ms:r.intervals.filter(v=>v>33.34).length,costMs:costs,peakParticles:r.peakParticles,longtasks:longtasks?.filter(e=>e.start>=r.begin)??null,navigation:nav?{ttfb:nav.responseStart,domContentLoaded:nav.domContentLoadedEventEnd,load:nav.loadEventEnd,decodedBodySize:nav.decodedBodySize}:null,paint:performance.getEntriesByType('paint').map(e=>({name:e.name,start:e.startTime})),resources:performance.getEntriesByType('resource').map(e=>({name:e.name.replace(location.origin,''),bytes:e.decodedBodySize,duration:e.duration}))};
   results.push(result);out.textContent=JSON.stringify(results,null,2);status.textContent='已完成 '+results.length+' 轮';
 }
 function tick(t){
   if(!active)return;
   active.hidden ||= document.hidden;
   if(t>=active.begin){
     if(active.prev!==null)active.intervals.push(t-active.prev);
     active.prev=t;active.playing+=Number(gameState==='playing');active.peakParticles=Math.max(active.peakParticles,fxParticles.length);
   }
   if(t>=active.end){finish();return;}
   requestAnimationFrame(tick);
 }
 function begin(scene){
   if(active)return;
   if(document.hidden){status.textContent='不可测：页面在后台';return;}
   if(scene==='fx'){fullNewGame();startFireworks(15000);}
   else startPractice(scene==='six'?6:1);
   const begin=performance.now()+2000;
   active={scene,begin,end:begin+10000,hidden:false,prev:null,intervals:[],playing:0,peakParticles:0,cost:Object.fromEntries(['render','update','maze','ghost','chrome','step'].map(k=>[k,[]]))};
   status.textContent='预热2秒，采样10秒';
   requestAnimationFrame(tick);
   setTimeout(()=>{if(active){active.hidden ||= document.hidden;finish();}},16000);
 }
 document.getElementById('probeOne').onclick=()=>begin('one');
 document.getElementById('probeSix').onclick=()=>begin('six');
 document.getElementById('probeFx').onclick=()=>begin('fx');
})();
`;
http.createServer((req,res)=>{
 try{
  const u=new URL(req.url,'http://127.0.0.1:8880');
  let name=decodeURIComponent(u.pathname);if(name.endsWith('/'))name+='index.html';
  const file=path.resolve(root,'.'+name),type=types[path.extname(file)];
  if(!file.startsWith(root+path.sep)||!type)throw Error('not found');
  let data=fs.readFileSync(file);
  if(file.endsWith('.html')){
   let html=data.toString().replace('<head>','<head>'+prelude);
   const at=html.lastIndexOf('requestAnimationFrame(loop);');if(at<0)throw Error('missing loop');
   html=html.slice(0,at)+probe+stressProbe+'\n'+html.slice(at);data=Buffer.from(html);
  }
  res.writeHead(200,{'Content-Type':type,'Cache-Control':'no-store','Content-Security-Policy':"connect-src 'self'; img-src 'self' data:; frame-src 'none'"});res.end(data);
 }catch(error){res.writeHead(404);res.end(String(error));}
}).listen(8880,'127.0.0.1',()=>console.log('Isolated Neon Maze profiler: http://127.0.0.1:8880/'));
