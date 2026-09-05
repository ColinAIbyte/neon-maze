/**
 * Executes the real migration SQL in a disposable, IN-MEMORY PostgreSQL WASM
 * runtime, never against Supabase. No HTTP client, URL or production credentials.
 * Install @electric-sql/pglite outside this repo, then set NEON_PGLITE_MODULE to
 * its absolute dist/index.js path. Missing runtime is an error, never a fake pass.
 */
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {isAbsolute} from 'node:path';
import {pathToFileURL} from 'node:url';

const modulePath = process.env.NEON_PGLITE_MODULE;
if (!modulePath || !isAbsolute(modulePath)) {
  throw new Error('Set NEON_PGLITE_MODULE to the absolute path of a locally installed @electric-sql/pglite dist/index.js. See docs/HALL-DATA.md.');
}
const {PGlite} = await import(pathToFileURL(modulePath).href);
const db = await PGlite.create('memory://');
const passed = [];
const check = (name, fn) => { fn(); passed.push(name); console.log(`✓ ${name}`); };
const uuid = n => `baba0000-0000-4000-8000-${String(n).padStart(12, '0')}`;
let run = 1;
const migrations = ['001_leaderboard.sql', '002_basic_anti_cheat.sql', '003_public_view_readonly.sql', '004_leaderboard_hall.sql'];
const sql = name => readFileSync(new URL(`../../supabase/migrations/${name}`, import.meta.url), 'utf8');
const rpcSignature = 'public.leaderboard_hall(uuid,text,integer,integer,boolean)';
async function asRole(role, fn) {
  // The only role names are constants in this file, never supplied externally.
  await db.exec(`SET ROLE ${role}`);
  try { return await fn(); } finally { await db.exec('RESET ROLE'); }
}
async function hall({player=null, scope='current', offset=0, limit=25, near=false}={}) {
  return asRole('anon', async () => (await db.query(
    'SELECT public.leaderboard_hall($1::uuid,$2::text,$3::integer,$4::integer,$5::boolean) AS value',
    [player, scope, offset, limit, near]
  )).rows[0].value);
}
async function seed({player, score, name='豆豆 Neon', combo=10, level=1, won=false,
  version='web-2026.09.04', played='2026-09-05T01:00:00Z'}={}) {
  // Synthetic fixture inserts bypass write plausibility checks deliberately to
  // test display/query extremes. They only exist in the in-memory database above.
  await db.query(`INSERT INTO public.leaderboard_scores
    (run_id,player_id,player_name,score,level,max_combo,won,duration_ms,deaths,ghosts_eaten,sweeps,client_version,played_at)
    VALUES ($1,$2,$3,$4,$5,$6,$7,100000,0,0,0,$8,$9)`,
  [uuid(100000 + run++), player, name, score, level, combo, won, version, played]);
}
async function clearFixture() { await db.exec('TRUNCATE public.leaderboard_scores RESTART IDENTITY'); }
async function rejects(args, code='22023') {
  await assert.rejects(() => hall(args), e => e.code === code);
}
const rowKeys = ['rank','position','name','score','level','combo','won','played_at','is_me'].sort();
function assertPrivateBoundary(result) {
  for (const row of [...result.rows, ...result.podium, result.mine, result.next].filter(Boolean)) {
    assert.deepEqual(Object.keys(row).sort(), rowKeys);
    assert.equal(typeof row.is_me, 'boolean');
    assert.ok(Number.isSafeInteger(row.score));
  }
  assert.doesNotMatch(JSON.stringify(result), /player_id|run_id|duration_ms|ghosts_eaten|validation_version|deaths|sweeps/);
}

try {
  await db.exec(`CREATE ROLE anon NOLOGIN; CREATE ROLE authenticated NOLOGIN; CREATE ROLE hall_outsider NOLOGIN;
    REVOKE CREATE ON SCHEMA public FROM PUBLIC;
    GRANT USAGE ON SCHEMA public TO anon, authenticated, hall_outsider;
    ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON TABLES TO anon, authenticated;
    ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON FUNCTIONS TO anon, authenticated;`);
  for (let replay=0; replay<2; replay++) for (const file of migrations) await db.exec(sql(file));
  passed.push('migrations 001–004 replay twice with permissive Supabase-style defaults');
  const version = (await db.query('SELECT version() AS version')).rows[0].version;
  const metadata = (await db.query(`SELECT prosecdef, provolatile, proconfig,
      EXISTS (SELECT 1 FROM aclexplode(proacl) WHERE grantee=0 AND privilege_type='EXECUTE') AS public_exec
      FROM pg_proc WHERE oid=$1::regprocedure`, [rpcSignature])).rows[0];
  check('security-definer read function uses safe explicit path and no PUBLIC execute', () => {
    assert.equal(metadata.prosecdef,true);
    assert.equal(metadata.provolatile,'s');
    assert.deepEqual(metadata.proconfig,['search_path=pg_catalog, pg_temp']);
    assert.equal(metadata.public_exec,false);
  });
  for (const role of ['anon','authenticated']) {
    const grants = (await db.query(`SELECT
      has_table_privilege($1,'public.leaderboard_scores','SELECT,INSERT,UPDATE,DELETE,TRUNCATE,REFERENCES,TRIGGER') AS base,
      has_any_column_privilege($1,'public.leaderboard_scores','SELECT,INSERT,UPDATE,REFERENCES') AS columns,
      has_table_privilege($1,'public.leaderboard_public','INSERT,UPDATE,DELETE,TRUNCATE,REFERENCES,TRIGGER') AS view_write,
      has_function_privilege($1,$2,'EXECUTE') AS execute`,[role,rpcSignature])).rows[0];
    check(`${role} can execute read RPC but cannot read/write base table or write public view`, () => {
      assert.deepEqual(grants,{base:false,columns:false,view_write:false,execute:true});
    });
  }
  await asRole('hall_outsider', () => assert.rejects(
    () => db.query('SELECT public.leaderboard_hall()'), e => e.code==='42501'));
  passed.push('unprivileged non-browser role cannot execute hall');
  await asRole('anon', () => assert.rejects(
    () => db.query('SELECT * FROM public.leaderboard_scores LIMIT 1'), e => e.code==='42501'));
  passed.push('actual anonymous direct table SELECT is denied');

  let result=await hall();
  check('0 players: honest empty state, null personal rank/target, no phantom podium',()=>{
    assert.equal(result.total,0); assert.deepEqual(result.rows,[]); assert.deepEqual(result.podium,[]);
    assert.equal(result.mine,null); assert.equal(result.next,null); assert.equal(result.next_gap,null);
    assert.equal(result.has_more,false); assert.equal(result.rule_version,'web-2026.09.04');
    assert.ok(Number.isFinite(Date.parse(result.updated_at))); assertPrivateBoundary(result);
  });
  check('revision exists for empty snapshots without fake IDs',()=>assert.match(result.revision,/^[a-f0-9]{32}$/));
  for (let n=1;n<=3;n++) {
    const previousRevision=result.revision;
    await seed({player:uuid(n),score:(4-n)*1000,name:`挑战者 ${n}`});
    result=await hall({player:uuid(1)});
    check(`${n} players: podium has exactly ${n} real records and champion has no false target`,()=>{
      assert.equal(result.total,n); assert.equal(result.podium.length,n);
      assert.equal(result.mine.rank,1); assert.equal(result.next,null); assert.equal(result.next_gap,null);
      assert.notEqual(result.revision,previousRevision);
      assertPrivateBoundary(result);
    });
  }
  passed.push('new player changes public snapshot revision');
  const repeated=await hall({player:uuid(1)});
  check('unchanged snapshot revision is stable across reads and pagination options',()=>{
    assert.equal(repeated.revision,result.revision);
  });
  await clearFixture();
  for(let n=1;n<=100;n++) await seed({
    player:uuid(n),score:n<=2 ? 1000000000000 : (101-n)*1000,combo:n,
    name:n===1?'超级长昵称 Neon <script>&👻'.repeat(5):n===97?'玩家 99':`玩家 ${n}`,
    played:n===2?'2026-09-05T01:01:00Z':'2026-09-05T01:00:00Z',
    level:n===1?6:4,won:n===1
  });
  const beforeLower=await hall({player:uuid(99)});
  await seed({player:uuid(99),score:1999,combo:888,name:'较低的一局'});
  await seed({player:uuid(99),score:2000,combo:777,name:'较晚同分',played:'2026-09-05T02:00:00Z'});
  result=await hall({player:uuid(99)});
  check('unlisted lower/equal-later runs do not invalidate public snapshot revision',()=>{
    assert.equal(result.revision,beforeLower.revision);
  });
  check('100 players: pagination, ties 1/1/3, trillion-point scores and long names preserved',()=>{
    assert.equal(result.total,100); assert.equal(result.rows.length,25); assert.equal(result.has_more,true);
    assert.deepEqual(result.podium.map(x=>x.rank),[1,1,3]);
    assert.deepEqual(result.podium.map(x=>x.position),[1,2,3]);
    assert.equal(result.podium[0].score,1000000000000);
    assert.ok(result.podium[0].name.includes('<script>')); // JSON data; frontend must use textContent.
    assertPrivateBoundary(result);
  });
  check('player outside loaded page still receives true rank and strictly-higher nearest target',()=>{
    assert.equal(result.rows.some(x=>x.is_me),false);
    assert.equal(result.mine.rank,99); assert.equal(result.mine.position,99);
    assert.equal(result.mine.score,2000); assert.equal(result.mine.combo,99);
    assert.equal(result.mine.name,'玩家 99'); assert.equal(result.mine.is_me,true);
    assert.equal(result.next.rank,98); assert.equal(result.next.score,3000); assert.equal(result.next_gap,1001);
  });
  check('duplicate names are not identities; lower/equal-later runs do not overwrite best-run stats',()=>{
    assert.equal(result.total,100); assert.equal(result.mine.combo,99);
  });
  const second=await hall({offset:25}), last=await hall({offset:75}), beyond=await hall({offset:100});
  check('page boundaries are deterministic, complete and non-overlapping',()=>{
    assert.equal(second.rows[0].position,26); assert.equal(second.rows.at(-1).position,50);
    assert.equal(last.rows[0].position,76); assert.equal(last.rows.at(-1).position,100);
    assert.equal(last.has_more,false); assert.deepEqual(beyond.rows,[]); assert.equal(beyond.total,100);
    assert.equal(second.revision,last.revision); assert.equal(last.revision,beyond.revision);
  });
  const near=await hall({player:uuid(50),near:true,offset:500,limit:1});
  check('nearby view returns actual ±3 neighbors independently of requested page',()=>{
    assert.deepEqual(near.rows.map(x=>x.position),[47,48,49,50,51,52,53]);
    assert.equal(near.offset,46); assert.equal(near.has_more,false); assert.equal(near.rows[3].is_me,true);
  });
  const nearLast=await hall({player:uuid(100),near:true}), absent=await hall({player:uuid(999),near:true});
  check('last-place and unranked nearby states do not invent rank zero or neighbors',()=>{
    assert.deepEqual(nearLast.rows.map(x=>x.position),[97,98,99,100]);
    assert.equal(absent.mine,null); assert.equal(absent.next_gap,null); assert.deepEqual(absent.rows,[]);
  });
  const tied=await hall({player:uuid(2)});
  check('tied world-record holder also has rank 1 and no imaginary higher opponent',()=>{
    assert.equal(tied.mine.rank,1); assert.equal(tied.mine.position,2);
    assert.equal(tied.next,null); assert.equal(tied.next_gap,null);
  });
  await seed({player:uuid(1),score:900000000000,name:'历史冠军',version:'legacy-unknown'});
  await seed({player:uuid(101),score:42,name:'旧版本',version:'web-2026.01.01'});
  const current=await hall({player:uuid(1)}), history=await hall({player:uuid(1),scope:'history'});
  check('known current version and unknown history are separate without multiplying old scores',()=>{
    assert.equal(current.total,100); assert.equal(history.total,2);
    assert.equal(history.rule_version,'unverified-history'); assert.equal(history.mine.score,900000000000);
    assert.equal(history.mine.name,'历史冠军'); assert.equal(current.mine.score,1000000000000);
  });
  for(const args of [{scope:'weekly'},{scope:null},{offset:-1},{offset:1000001},{offset:null},
    {limit:0},{limit:101},{limit:null},{near:null},{player:'00000000-0000-0000-0000-000000000000'}]) await rejects(args);
  passed.push('invalid scope, oversized/negative pagination, null options and zero identity are rejected');
  const auth=await asRole('authenticated',async()=> (await db.query('SELECT public.leaderboard_hall() AS value')).rows[0].value);
  check('authenticated read uses same public data and does not grant extra identity fields',()=>{
    assert.deepEqual(auth.rows,current.rows.map(x=>({...x,is_me:false}))); assertPrivateBoundary(auth);
  });
  const count=(await db.query('SELECT count(*) AS n FROM public.leaderboard_scores')).rows[0].n;
  check('read API does not mutate or deduplicate stored raw runs',()=>assert.equal(Number(count),104));
  const beforeImprovement=await hall({player:uuid(99)});
  await seed({player:uuid(99),score:4000,combo:123,name:'新最佳'});
  const improved=await hall({player:uuid(99)});
  check('better run changes snapshot revision and personal best together',()=>{
    assert.notEqual(improved.revision,beforeImprovement.revision); assert.equal(improved.mine.score,4000);
  });

  // Existing write RPC compatibility: an accepted run is immutable except nickname.
  await clearFixture();
  const submit=async(runId,score,name)=>asRole('anon',async()=> (await db.query(`SELECT public.submit_score(
    $1::uuid,$2::uuid,$3::text,$4::bigint,1::smallint,10,false,10000,0,0,0,'web-2026.09.04') AS value`,
  [uuid(900),uuid(runId),name,score])).rows[0].value);
  const accepted=await submit(9000,1000,'第一次');
  const beforeRename=await hall({player:uuid(900)});
  const retried=await submit(9000,9999,'更新昵称');
  const renamed=await hall({player:uuid(900)});
  await submit(9001,500,'较低分');
  result=await hall({player:uuid(900)});
  check('real submit RPC: unique run retry is idempotent; lower score cannot replace personal best',()=>{
    assert.equal(accepted.accepted,true); assert.equal(accepted.duplicate,false);
    assert.equal(retried.accepted,true); assert.equal(retried.duplicate,true);
    assert.equal(result.total,1); assert.equal(result.mine.score,1000); assert.equal(result.mine.name,'更新昵称');
  });
  check('same-run nickname update invalidates revision; lower new run preserves it',()=>{
    assert.notEqual(renamed.revision,beforeRename.revision);
    assert.equal(result.revision,renamed.revision);
  });
  console.log(JSON.stringify({ok:true,checks:passed.length,runtime:version,environment:'isolated in-memory PostgreSQL WASM; NOT Supabase/HTTP/production',passed},null,2));
} finally { await db.close(); }
