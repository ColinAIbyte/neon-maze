// Real source + isolated storage/DOM. Mutations affect in-memory source strings
// only, never the checkout or production. Every assertion below has a mutant.
import assert from 'node:assert/strict';
import {boot, tick} from './hall_test_harness.mjs';
import {setup, payload, makeRow, tick as viewTick} from './hall_view_harness.mjs';

const KEY = 'doudou.recent.v1';
const stamp = new Date(2026,8,5,14,22).getTime();
const row = (n=1, extra={}) => ({runId:'run-'+n,score:n*100,level:3,maxCombo:41,won:false,playedAt:stamp+n,...extra});
const cases=[];
const scenario=(name,run,...mutations)=>cases.push({name,run,mutations});
const game=(from,to)=>({target:'game',from,to});
const view=(from,to)=>({target:'view',from,to});
const bridge=(from,to)=>({target:'bridge',from,to});
const gameEdits=(...edits)=>({target:'game',edits});
const missingLocal=view('add(main, recentPanel(), policy());','add(main, policy());');
const persisted=app=>JSON.parse(app.storage.get(KEY) || '[]');
const local=app=>app.win.NeonGame.recentScores();
const io=storage=>({getItem:k=>storage.has(k)?storage.get(k):null,
  setItem:(k,v)=>storage.set(k,String(v)),removeItem:k=>storage.delete(k)});

scenario('正式结算立即记录，分数含结算奖励，且不自动上传',async({boot})=>{
  const app=boot({enabled:false});app.game.score=100;app.game.endGame(true);await tick();
  const saved=persisted(app)[0];
  assert.deepEqual({score:saved?.score,final:app.game.score,id:saved?.runId,level:saved?.level,
    combo:saved?.maxCombo,won:saved?.won,time:Number.isFinite(saved?.playedAt),uploads:app.submits().length},
    {score:28375,final:28375,id:app.game.id,level:1,combo:1,won:true,time:true,uploads:0});
},game('if (!practice && !dailyRun) recordRecentScore','if (false) recordRecentScore'),
  game('score, level, maxCombo:maxComboSeen, won:!!won, playedAt:Date.now()',
       'score:score-1, level, maxCombo:maxComboSeen, won:!!won, playedAt:Date.now()'));

scenario('第31次写入立即裁剪，并按最近结束顺序保留30条',({boot})=>{
  const app=boot();for(let n=1;n<=31;n++)app.game.recordRecentScore(row(n,{score:10000-n}));
  assert.deepEqual(persisted(app).map(x=>x.runId),Array.from({length:30},(_,i)=>'run-'+(31-i)));
},game('const RECENT_SCORE_LIMIT = 30;','const RECENT_SCORE_LIMIT = 31;'),
  game('[row].concat(saved.rows)','saved.rows.concat([row])'));

scenario('同局重复回调、改名、上榜重试不会增加战绩',async({boot})=>{
  const app=boot();app.game.score=123;app.game.endGame(false);const first=persisted(app)[0];
  app.game.recordRecentScore({...first,score:999});app.win.NeonGame.saveName('新昵称');
  app.confirm();await tick();app.clickHall();
  assert.deepEqual(persisted(app),[first]);
},game('if (lastRecentRunId === row.runId || saved.rows.some(item=>item.runId === row.runId)) return true;',
       'if (false) return true;'));

scenario('两个已打开标签页交替写入不会使用陈旧列表',({boot})=>{
  const storage=new Map(),a=boot({storage}),b=boot({storage});
  a.game.recordRecentScore(row(1));b.game.recordRecentScore(row(2));a.game.recordRecentScore(row(3));
  assert.deepEqual(persisted(a).map(x=>x.runId),['run-3','run-2','run-1']);
},game('const saved = loadRecentScores(); // read the latest journal, including other tabs',
       "const saved = {rows:[],status:'ok'}; // broken stale snapshot"));

for(const [name,p,d,mutant] of [
  ['练习模式',2,false,game('if (practiceLevel || dailyRun) return false;','if (dailyRun) return false;')],
  ['每日挑战独立标志',0,{d:'2026-09-05',lv:1},game('if (practiceLevel || dailyRun) return false;','if (practiceLevel) return false;')],
]) scenario(name+'不会写入最近战绩',({boot})=>{
  const app=boot();app.game.mode(p,d);app.game.recordRecentScore(row());
  assert.equal(app.storage.has(KEY),false);
},mutant);

scenario('结算入口显式排除每日挑战，即使它不再走练习路径',({boot})=>{
  const app=boot();app.game.mode(0,{d:'2026-09-05',lv:1});app.game.score=456;app.game.endGame(false);
  assert.equal(app.storage.has(KEY),false);
},gameEdits(['if (practiceLevel || dailyRun) return false;','if (practiceLevel) return false;'],
  ['if (!practice && !dailyRun) recordRecentScore','if (!practice) recordRecentScore']));

scenario('旧最高分保留，最近战绩不伪造历史记录',({boot})=>{
  const storage=new Map([['doudou.scores.v3',JSON.stringify([{id:'old',score:14419525,level:6,combo:160,won:true,date:'2026-09-01'}])]]);
  const app=boot({storage});
  assert.deepEqual({rows:local(app).rows,best:local(app).highScore,old:JSON.parse(storage.get('doudou.scores.v3'))[0].score},
    {rows:[],best:14419525,old:14419525});
},game("if (diagnostic.raw === null) return {rows:[], status:'ok'};",
       "if (diagnostic.raw === null) return {rows:[{score:14419525}], status:'ok'};"));

scenario('清空存储后最近战绩为空，不复活内存列表',({boot})=>{
  const app=boot();app.game.recordRecentScore(row());app.storage.clear();
  assert.deepEqual(local(app).rows,[]);
},game("if (diagnostic.raw === null) return {rows:[], status:'ok'};",
       "if (diagnostic.raw === null) return {rows:[{score:100}], status:'ok'};"));

scenario('已打开的另一个标签页能读取最新历史最高分',({boot})=>{
  const storage=new Map(),a=boot({storage}),b=boot({storage});
  local(b);a.game.score=14419525;a.game.endGame(false);
  assert.equal(local(b).highScore,14419525);
},game('Math.max(bestScore(), normalizeLocalSave(readStoredJSON(LOCAL_SAVE_KEY)).highScore)','bestScore()'));

for(const [name,raw] of [['截断JSON','[{"score":'],['结构错误','{"rows":[]}'],['空字符串','']]) {
  scenario(name+'安全降级且备份原文',({boot})=>{
    const storage=new Map([[KEY,raw]]),app=boot({storage,storageIO:io(storage)});
    const saved=local(app);local(app);
    const backups=[...storage].filter(([k])=>k.startsWith(KEY+'.corrupt.'));
    assert.deepEqual({status:saved.status,rows:saved.rows,backup:backups.map(x=>x[1])},
      {status:'corrupt',rows:[],backup:[raw]});
  },game('function backupCorruptJSON(key, raw){','function backupCorruptJSON(key, raw){ return;'));
}

for(const [field,bad,from,to] of [
  ['score','100','!Number.isSafeInteger(r.score)','false'],
  ['score',-1,'r.score < 0','false'],
  ['score',1000000000001,'r.score > 1e12','false'],
  ['level',0,'r.level < 1','false'],
  ['level',7,'r.level > MAX_LEVEL','false'],
  ['maxCombo','41','!Number.isSafeInteger(r.maxCombo)','false'],
  ['won','false',"typeof r.won !== 'boolean'",'false'],
  ['playedAt','2026-09-05','!Number.isSafeInteger(r.playedAt)','false'],
  ['playedAt',0,'r.playedAt <= 0','false'],
  ['playedAt',8640000000000001,'!Number.isFinite(new Date(r.playedAt).getTime())','false'],
  ['runId','', '!r.runId', 'false'],
]) scenario(`损坏字段 ${field}=${String(bad)} 不冒充有效记录`,({boot})=>{
  const storage=new Map([[KEY,JSON.stringify([row(2),row(1,{[field]:bad})])]]);
  const app=boot({storage});const first=local(app),again=local(app);
  assert.deepEqual({first:first.rows,again:again.rows,status:first.status},{first:[row(2)],again:[row(2)],status:'corrupt'});
},game(from,to));

scenario('读取异常返回不可用状态，结算仍能结束',({boot})=>{
  const storage=new Map(),storageIO=io(storage);storageIO.getItem=k=>{if(k===KEY)throw Error('denied');return storage.get(k)??null;};
  const app=boot({storage,storageIO});app.game.score=100;app.game.endGame(false);
  const saved=local(app);
  assert.deepEqual({state:app.game.state,rows:saved.rows,status:saved.status,failed:saved.saveFailed},
    {state:'over',rows:[],status:'unavailable',failed:true});
},game("} catch (e) { return {rows:[], status:'unavailable'}; }",
       "} catch (e) { throw e; }"));

scenario('写入失败保留旧战绩，下一次成功后清除失败状态',({boot})=>{
  const storage=new Map([[KEY,JSON.stringify([row(1)])]]),storageIO=io(storage);let broken=true;
  storageIO.setItem=(k,v)=>{if(k===KEY&&broken)throw Error('quota');storage.set(k,String(v));};
  const app=boot({storage,storageIO});app.game.recordRecentScore(row(2));const failed=local(app);
  broken=false;app.game.recordRecentScore(row(2));const recovered=local(app);
  assert.deepEqual({before:failed.rows,failed:failed.saveFailed,after:recovered.rows,recovered:recovered.saveFailed},
    {before:[row(1)],failed:true,after:[row(2),row(1)],recovered:false});
},game('} catch (e) { recentWriteFailed = true; return false; }','} catch (e) { recentWriteFailed = false; return false; }'),
  game('recentWriteFailed = false;\n    recentBadRaw = null;', 'recentWriteFailed = true;\n    recentBadRaw = null;'));

scenario('战绩通过本地适配器提供，不依赖云端响应',({boot})=>{
  const app=boot({read:()=>new Promise(()=>{})});app.game.recordRecentScore(row());
  assert.deepEqual(app.hall.mounted.recent().rows,[row()]);
},bridge('recent: () => game.recentScores(),',"recent: () => ({rows:[]}),"));

scenario('其他标签页存储更新只刷新本地区块，不请求云榜',async({boot})=>{
  const app=boot();await tick();app.clickHall();const n=app.reads().length;
  app.win.emit('storage',{key:KEY});
  assert.deepEqual({local:app.hall.localRefreshes,requests:app.reads().length-n},{local:1,requests:0});
},bridge('if (opened) hall.refreshLocal();','if (false) hall.refreshLocal();'));

for(const status of ['loading','offline','error','disabled']) scenario('云榜 '+status+' 时本地战绩仍可见',async({view})=>{
  const h=view({response:status==='loading'?()=>new Promise(()=>{}):{status},recent:()=>({rows:[row()],status:'ok',highScore:100})});
  h.api.open();await viewTick();
  assert.equal(h.root.querySelectorAll('.nh-recent-row').length,1);
},missingLocal);

scenario('删除历史标签但保留当前榜、刷新与冠军内容',async({view})=>{
  const h=view({response:request=>payload([makeRow(1)],request)});h.api.open();await viewTick();
  assert.deepEqual({label:h.root.querySelector('.nh-current-label')?.textContent,
    old:!!h.byText('历史规则存档'),scope:h.calls[0].scope,champion:h.root.textContent.includes('世界纪录'),
    refresh:!!h.byText('↻ 刷新榜单')},
    {label:'总排行榜',old:false,scope:'current',champion:true,refresh:true});
},view("current: '总排行榜'","current: '历史规则存档'"),view("const scope = 'current';","const scope = 'history';"));

for(const language of ['zh','en']) scenario(language+' 汇总、同分星标、历史峰值、本地时间均独立准确',async({view})=>{
  const h=view({language,response:payload([]),recent:()=>({rows:[row(3,{score:14419525}),row(2,{score:14419525}),row(1)],status:'ok',highScore:20000000})});
  h.api.open();await viewTick();
  const p=h.root.querySelector('.nh-recent');
  assert.deepEqual({summary:p.querySelector('.nh-recent-summary')?.textContent,
    badges:p.querySelectorAll('.nh-recent-badge').map(x=>x.textContent),
    time:p.querySelector('.nh-recent-time')?.textContent,
    high:p.querySelector('.nh-local-best')?.textContent,
    foreign:language==='en'?/[\u3400-\u9fff]/.test(p.textContent):false},
    {summary:language==='zh'?'已记录 3 局，最好 14,419,525':'3 runs recorded, best 14,419,525',
      badges:Array(2).fill(language==='zh'?'★ 近 30 局最佳':'★ Best of last 30 runs'),time:'09-05 14:22',
      high:language==='zh'?'本机历史最高分20,000,000':'All-time best in this browser20,000,000',foreign:false});
},view('const winner = row.score === best;','const winner = false;'),
  view('fmt(saved.highScore || 0)','fmt(best)'),
  view('stamp.getHours()','stamp.getUTCHours()'),
  view('t().recentSummary(fmt(entries.length), fmt(best))','t().recentSummary(fmt(entries.length + 1), fmt(best))'));

scenario('损坏、不可保存、空记录都有明确本地提示',async({view})=>{
  const results=[];
  for(const state of [{rows:[],status:'corrupt'},{rows:[],status:'unavailable'},{rows:[row()],status:'ok',saveFailed:true},{rows:[],status:'ok'}]){
    const h=view({response:{status:'offline'},recent:()=>state});h.api.open();await viewTick();
    const p=h.root.querySelector('.nh-recent');
    results.push({warning:p?.querySelector('.nh-recent-warning')?.textContent || '',empty:!!p?.querySelector('.nh-recent-empty'),count:p?.querySelectorAll('.nh-recent-row').length});
  }
  assert.deepEqual(results,[
    {warning:'部分战绩数据损坏，已尝试保留备份；有效记录仍可查看。',empty:true,count:0},
    {warning:'当前浏览器无法保存战绩',empty:true,count:0},
    {warning:'当前浏览器无法保存战绩',empty:false,count:1},
    {warning:'',empty:true,count:0},
  ]);
},view("saved.status === 'unavailable' || saved.saveFailed","false"),
  view("saved.status === 'corrupt'","false"),view("if (!entries.length) add(panel,", "if (false) add(panel,"));

scenario('本地刷新读取新记录，不重拉云榜',async({view})=>{
  let rows=[];const h=view({response:payload([]),recent:()=>({rows,status:'ok'})});h.api.open();await viewTick();
  rows=[row()];h.api.refreshLocal();
  assert.deepEqual({rows:h.root.querySelectorAll('.nh-recent-row').length,requests:h.calls.length},{rows:1,requests:1});
},view('refreshLocal: () => { if (isOpen) render(); }','refreshLocal: () => {}'));

scenario('云榜刷新与切换语言不重置战绩列表滚动位置',async({view})=>{
  const h=view({response:payload([]),recent:()=>({rows:Array.from({length:30},(_,i)=>row(i+1)),status:'ok'})});
  h.api.open();await viewTick();h.root.querySelector('.nh-recent-list').scrollTop=230;
  h.api.refresh();await viewTick();h.api.setLanguage('en');
  assert.equal(h.root.querySelector('.nh-recent-list').scrollTop,230);
},view('if (recentList) recentList.scrollTop = recentScroll;','if (recentList) recentList.scrollTop = 0;'));

let checks=0,killed=0;const mutate=process.argv.includes('--mutations');
for(const test of cases){
  const run=async mutation=>{
    let used=false;
    const transform=target=>text=>{
      if(mutation?.target!==target)return text;
      for(const [from,to] of mutation.edits || [[mutation.from,mutation.to]]){
        if(!text.includes(from))throw Error('mutation target missing: '+from);
        used=true;text=text.replaceAll(from,to);
      }
      return text;
    };
    await test.run({boot:options=>boot({...options,mutate:transform('game'),mutateBridge:transform('bridge')}),
      view:options=>setup({...options,mutate:transform('view')})});
    return used;
  };
  await run();checks++;
  if(mutate)for(const mutation of test.mutations){
    let failure;
    try {await run(mutation);}catch(e){failure=e;}
    // A missing edit location is not a killed mutant.
    if(!failure || /mutation target missing/.test(failure.message))throw Error('Mutation survived: '+test.name+' / '+mutation.from+' / '+(failure?.message||''));
    killed++;
  }
  console.log('✓ '+test.name);
}
console.log(`Recent scores: ${checks}/${cases.length} assertions passed; ${killed} in-memory mutants rejected. No production requests or checkout mutations.`);
