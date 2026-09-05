/** Local-only QA server: real built UI + isolated in-memory SQL. NEVER publish.
 * NEON_PGLITE_MODULE=/absolute/dist/index.js node 源码/工具/preview_hall_local.mjs
 * Synthetic data is clearly labeled. No remote database/network calls exist here.
 */
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath,pathToFileURL} from 'node:url';
const root=fileURLToPath(new URL('../../发布到网站/',import.meta.url));
const {PGlite}=await import(pathToFileURL(process.env.NEON_PGLITE_MODULE).href);
const uuid=n=>`abcd0000-0000-4000-8000-${String(n).padStart(12,'0')}`;
const databases=new Map();
const port=Number(process.env.NEON_PREVIEW_PORT || 8870);
async function database(count){
  if (databases.has(count)) return databases.get(count);
  const promise=(async()=>{
    const db=await PGlite.create('memory://');
    await db.exec('CREATE ROLE anon NOLOGIN; CREATE ROLE authenticated NOLOGIN; GRANT USAGE ON SCHEMA public TO anon,authenticated;');
    for (const file of ['001_leaderboard.sql','002_basic_anti_cheat.sql','003_public_view_readonly.sql','004_leaderboard_hall.sql'])
      await db.exec(fs.readFileSync(new URL('../../supabase/migrations/'+file,import.meta.url),'utf8'));
    for(let i=1;i<=count;i++){
      const points=count===100 && i<=2?1e12:12663021-(i-1)*82037;
      await db.query(`insert into public.leaderboard_scores
        (run_id,player_id,player_name,score,level,max_combo,won,duration_ms,deaths,ghosts_eaten,sweeps,client_version,played_at)
        values($1,$2,$3,$4,$5,$6,$7,900000,0,157,22,'web-2026.09.04','2026-09-05T03:00:00Z')`,
        [uuid(i+10000),uuid(i),i===1?'试玩冠军（样例）':i===2?'LongName中文混排'.repeat(5):`测试玩家${i}`,points,i<=3?6:4,i===1?159:100+i,i<=3]);
    }
    return db;
  })();
  databases.set(count,promise);return promise;
}
const mime={'.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8','.css':'text/css; charset=utf-8','.webp':'image/webp','.png':'image/png','.svg':'image/svg+xml','.jpg':'image/jpeg'};
http.createServer(async(req,res)=>{
  try{
    const url=new URL(req.url,'http://127.0.0.1:'+port);
    if(url.pathname==='/_hall_rpc'){
      let body=''; for await (const c of req) {body+=c;if(body.length>10000)throw Error('body too large');}
      const q=JSON.parse(body),count=[0,1,2,3,100].includes(q.count)?q.count:3;
      if(q.mode==='offline'){res.writeHead(503,{'content-type':'application/json'});res.end('{}');return;}
      if(q.mode==='slow')await new Promise(resolve=>setTimeout(resolve,3000));
      const db=await database(count);
      if(q.path.endsWith('/submit_score')){
        // No synthetic or human score is written, even into the preview table.
        res.writeHead(503,{'content-type':'application/json'});res.end('{}');return;
      }
      const p=q.params || {};
      const result=await db.query('SELECT public.leaderboard_hall($1,$2,$3,$4,$5) as data',
        [q.me?uuid(q.me):p.p_player_id,p.p_scope||'current',p.p_offset||0,p.p_limit||25,p.p_near||false]);
      res.writeHead(200,{'content-type':'application/json','cache-control':'no-store'});res.end(JSON.stringify(result.rows[0].data));return;
    }
    let rel=decodeURIComponent(url.pathname).replace(/^\//,'');
    if(!path.extname(rel))rel=rel.replace(/\/$/,'')+'/index.html';
    if(rel==='/index.html')rel='index.html';
    const file=path.resolve(root,rel);if(!file.startsWith(root) || !mime[path.extname(file)]){res.writeHead(404);res.end();return;}
    let data=fs.readFileSync(file);
    if(file.endsWith('.html')){
      const prelude=`<script>
        const realFetch=window.fetch.bind(window),qa=new URLSearchParams(location.search);
        // Disposable browser storage, even when previewing result submission.
        // Fixtures never overwrite the user's browser saves or reach Supabase.
        const localFixtures=new Map(),recentKey='doudou.recent.v1';
        const recentCount=Math.max(0,Math.min(30,Number(qa.get('recent')||0)));
        if(recentCount){
          const records=Array.from({length:recentCount},(_,i)=>({runId:'preview-'+i,
            score:i===2?14419525:620415-i*10000,level:i===2?6:4,maxCombo:i===2?160:41,
            won:i===2,playedAt:Date.UTC(2026,8,5,6,22)-i*3600000}));
          localFixtures.set(recentKey,JSON.stringify(records));
          localFixtures.set('doudou.scores.v3',JSON.stringify([{id:'preview-best',name:'测试记录',score:20000000,level:6,combo:200,won:true,date:'2026-09-01'}]));
        }
        if(qa.get('storage')==='corrupt')localFixtures.set(recentKey,'[{"score":');
        Object.defineProperty(window,'localStorage',{configurable:true,value:{
          getItem:key=>{if(qa.get('storage')==='blocked')throw Error('Preview blocked storage');return localFixtures.get(key)??null;},
          setItem:(key,value)=>{if(qa.get('storage')==='blocked'||(qa.get('storage')==='quota'&&key===recentKey))throw Error('Preview full storage');localFixtures.set(key,String(value));},
          removeItem:key=>localFixtures.delete(key),clear:()=>localFixtures.clear(),
        }});
        window.fetch=(url,options={})=>String(url).includes('.supabase.co/')
          ? realFetch('/_hall_rpc',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({
            path:new URL(url).pathname,params:options.body?JSON.parse(options.body):{},
            count:Number(qa.get('count')??3),me:Number(qa.get('me')||0),mode:qa.get('mode')||''})}) : realFetch(url,options);
        document.addEventListener('DOMContentLoaded',()=>{
          const badge=document.createElement('div');badge.textContent='本地验收 · 全部为测试数据 · 不连接正式榜';
          badge.style='position:fixed;bottom:0;left:0;right:0;z-index:9999;text-align:center;background:#ffd557;color:#251600;font:11px/22px system-ui;pointer-events:none';document.body.append(badge);
        });
      </script>`;
      let html=data.toString().replace('<head>','<head>'+prelude);
      if (url.searchParams.get('result')==='1'){
        const marker='requestAnimationFrame(loop);',at=html.lastIndexOf(marker)+marker.length;
        html=html.slice(0,at)+`\nwindow.addEventListener('load',()=>{
          score=12663021;level=6;lives=3;deathsThisRun=2;ghostsEatenThisRun=157;
          maxComboSeen=159;sweepsThisRun=22;runActiveSeconds=900;
          document.getElementById('startOverlay').classList.add('hidden');endGame(true);
        });\n`+html.slice(at);
      }
      data=Buffer.from(html);
    }
    res.writeHead(200,{'content-type':mime[path.extname(file)],'cache-control':'no-store'});res.end(data);
  }catch(e){res.writeHead(500,{'content-type':'text/plain'});res.end(String(e.message));}
}).listen(port,'127.0.0.1',()=>console.log('Local fixture preview http://127.0.0.1:'+port+'/?count=3 — isolated SQL/storage, no production writes.'));
