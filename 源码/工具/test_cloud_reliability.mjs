// Exercise the production cloud module with controlled network/timer responses.
// This is a frontend contract test, not a live Supabase/database test.
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
const source = readFileSync(new URL('../neon_maze_fragment.html',import.meta.url),'utf8');
const part = source.slice(source.indexOf('const CloudLeaderboard ='),source.indexOf('\nfunction submitCloudScore'));
const integer = source.slice(source.indexOf('const saveInteger ='),source.indexOf('\nfunction readStoredJSON'));
function boot(fetch, supabase={url:'https://testproject.supabase.co',anonKey:'x'.repeat(64)}){
  const timers = new Map(); let nextId=0;
  const env = {
    window:{NEON_MAZE_CONFIG:{supabase}},
    fetch, AbortController,
    setTimeout:(fn,ms)=>{const id=++nextId;timers.set(id,{fn,ms});return id;},
    clearTimeout:id=>timers.delete(id),
    // Keep the test focused on transport and ordering. Name sanitation is
    // independently exercised against the full game by test_progress.mjs.
    cleanName:s=>String(s || '').replace(/[<>]/g,''),
    saveObject:v=>v!==null && typeof v==='object' && !Array.isArray(v),
    DEFAULT_NAME:'Doudou', MAX_LEVEL:6, CLIENT_VERSION:'web-2026.09.04',
  };
  const cloud=vm.runInNewContext(integer+'\n'+part+'\nCloudLeaderboard;',env);
  return {cloud,timers};
}
const response=data=>({ok:true,status:200,json:async()=>data});
const tick=async()=>{for(let i=0;i<10;i++) await Promise.resolve();};

// A hung fetch or body read must settle even if abort is ignored.
for(const stuck of ['fetch','body']){
  const {cloud,timers}=boot(()=>stuck==='fetch' ? new Promise(()=>{})
    : Promise.resolve({ok:true,status:200,json:()=>new Promise(()=>{})}));
  const result=cloud.top(); await tick();
  assert.equal(timers.size,1);
  const timer=[...timers.values()][0]; assert.equal(timer.ms,8000);
  timer.fn();
  assert.equal((await result).status,'offline');
  assert.equal(timers.size,0);
}
for(const value of [null,{},'bad response']){
  const {cloud,timers}=boot(async()=>response(value));
  assert.equal((await cloud.top()).status,'error');
  assert.equal(timers.size,0);
}

const calls=[];
const {cloud,timers}=boot((url,options)=>new Promise(resolve=>calls.push({url,options,resolve})));
const entry={runId:'same-run',playerId:'player',name:'Before',score:123456,
  level:3,maxCombo:10,won:false,durationMs:50000,deaths:1,ghostsEaten:3,sweeps:0};
const original=cloud.submit(entry);
entry.name='After';
const rename=cloud.submit(entry);
await tick();
assert.equal(calls.length,1,'rename must wait for the initial response');
assert.equal(JSON.parse(calls[0].options.body).p_player_name,'Before');
calls[0].resolve(response({accepted:true}));
assert.equal((await original).status,'ok');
await tick();
assert.equal(calls.length,2);
assert.equal(JSON.parse(calls[1].options.body).p_player_name,'After');
calls[1].resolve(response({accepted:true}));
assert.equal((await rename).status,'ok');
assert.equal(timers.size,0);

const failed=boot(async()=>{throw new Error('offline');});
assert.equal((await failed.cloud.submit(entry)).status,'offline');
assert.equal((await failed.cloud.submit({...entry,name:'Retry'})).status,'offline');
assert.equal(failed.timers.size,0);
const publicKey='sb_publishable_'+ 'test'.repeat(8);
for(const field of ['publishableKey','anonKey']){
  let headers;
  const app=boot(async(url,options)=>{headers=options.headers;return response([]);},
    {url:'https://testproject.supabase.co',[field]:publicKey});
  assert.equal((await app.cloud.top()).status,'ok');
  assert.equal(headers.apikey,publicKey);
  assert.equal('Authorization' in headers,false,'publishable key must not be sent as a JWT');
}
let legacyHeaders;
await boot(async(url,options)=>{legacyHeaders=options.headers;return response([]);}).cloud.top();
assert.equal(legacyHeaders.Authorization,'Bearer '+ 'x'.repeat(64));
for(const field of ['publishableKey','anonKey']){
  const app=boot(()=>{throw Error('must not send a backend key');},
    {url:'https://testproject.supabase.co',[field]:'sb_secret_'+'test'.repeat(10)});
  assert.equal(app.cloud.enabled(),false);
}
console.log('✓ 新版 publishable key 只发送 apikey，旧 anon key 保持兼容，拒绝 sb_secret 配置');
console.log('✓ 云榜连接/响应体8秒超时、无效响应回退、同局改名按顺序提交；使用模拟网络，未验证真实数据库');
