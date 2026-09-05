// Local diagnostic response injection only. Never included in the game/build.
// Synthetic forced ability states are test fixtures, not a gameplay mode.
export const stressProbe = String.raw`
(() => {
 const panel=document.createElement('aside');
 panel.style='position:fixed;top:0;right:0;z-index:100000;background:#111;color:#fff;padding:8px;font:12px monospace;max-width:95vw';
 panel.innerHTML='<button id="stressStart">10分钟合成压力测试</button><div id="stressStatus">隔离内存，不上传；交替完整/减少动态</div><details><summary>压力结果</summary><pre id="stressResults" style="max-height:200px;overflow:auto"></pre></details>';
 document.body.append(panel);
 const status=document.getElementById('stressStatus'),out=document.getElementById('stressResults');
 let run=null;
 const errors=[];window.addEventListener('error',e=>errors.push(String(e.message)));
 window.addEventListener('unhandledrejection',e=>errors.push(String(e.reason)));
 const costs={render:[],step:[]};
 const wrap=(name,fn)=>function(...args){if(!run)return fn.apply(this,args);const t=performance.now();try{return fn.apply(this,args);}finally{costs[name].push(performance.now()-t);}};
 render=wrap('render',render);stepFrame=wrap('step',stepFrame);
 let longTasks=0;
 try{new PerformanceObserver(l=>{if(run)longTasks+=l.getEntries().length;}).observe({type:'longtask'});}catch{}
 const stats=values=>{const a=values.slice().sort((a,b)=>a-b);const q=p=>a[Math.floor((a.length-1)*p)]??null;return {n:a.length,p95:q(.95),p99:q(.99),max:a.at(-1)??null,mean:a.length?values.reduce((s,v)=>s+v,0)/a.length:null};};
 function minute(){
  return {intervals:[],prev:null,playing:0,fxPeak:0,feedbackPeak:0};
 }
 function output(){out.textContent=JSON.stringify({complete:!run,minutes:results,errors},null,2);}
 const results=[];
 function sample(t){
  if(!run)return;
  run.hidden ||= document.hidden;
  const m=run.minute;
  if(m.prev!==null)m.intervals.push(t-m.prev);m.prev=t;
  m.playing+=Number(gameState==='playing');m.fxPeak=Math.max(m.fxPeak,fxParticles.length);m.feedbackPeak=Math.max(m.feedbackPeak,feedbackParticles.length);
  if(t-run.effectAt>=250){
   run.effectAt=t;
   if(gameState!=='playing')startPractice(6);
   frightTimer=9;player.phase=10;
   requestDir([{x:1,y:0},{x:0,y:1},{x:-1,y:0},{x:0,y:-1}][Math.floor((t-run.begin)/3000)%4]);
   const kind=['counter','warp','phase','power','level'][run.events%5];emitFeedback(kind,player.x,player.y);run.events++;
   if(run.events%4===0){combo=100+run.events*50;checkComboMilestone();}
  }
  if(t-run.minuteAt>=60000){
   const intervals=stats(m.intervals),sum=m.intervals.reduce((a,b)=>a+b,0);
   results.push({minute:results.length+1,mode:presentation.reduceMotion,visible:!run.hidden,rafHz:1000*m.intervals.length/sum,intervalMs:intervals,over22:m.intervals.filter(x=>x>22.23).length,over33:m.intervals.filter(x=>x>33.34).length,renderMs:stats(costs.render),stepMs:stats(costs.step),playingSamples:m.playing,fxPeak:m.fxPeak,feedbackPeak:m.feedbackPeak,longTasks,heapBytes:performance.memory?.usedJSHeapSize??null,viewport:[innerWidth,innerHeight],dpr:devicePixelRatio});
   longTasks=0;costs.render=[];costs.step=[];
   if(results.length===10){run=null;status.textContent='完成10分钟；'+errors.length+'个脚本错误';output();return;}
   run.minute=minute();run.minuteAt=t;
   setPresentation('reduceMotion',results.length%2?'reduce':'system');
   status.textContent='已完成 '+results.length+'/10 分钟；'+presentation.reduceMotion;
   output();
  }
  requestAnimationFrame(sample);
 }
 document.getElementById('stressStart').onclick=()=>{
  if(run)return;
  if(document.hidden){status.textContent='页面隐藏，拒绝采样';return;}
  results.length=0;errors.length=0;costs.render=[];costs.step=[];longTasks=0;
  startPractice(6);setPresentation('colorAssist',true);setPresentation('effectVolume',.05);setPresentation('alertVolume',.05);setPresentation('reduceMotion','system');
  const now=performance.now();run={begin:now,minuteAt:now,minute:minute(),effectAt:0,events:0,hidden:false};
  status.textContent='运行中 0/10 分钟；完整动态；音量5%';output();requestAnimationFrame(sample);
 };
})();
`;
