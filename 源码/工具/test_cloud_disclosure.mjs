// Exercise player-facing cloud disclosure and success feedback in both languages.
// Uses simulated cloud responses; no remote service or generated files are changed.
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
import {toEnglish} from './i18n_en.mjs';

const source = readFileSync(new URL('../neon_maze_fragment.html',import.meta.url),'utf8');
assert.match(source,/#startBoard \.board-cloud-note\{display:none;\}/,'short screens avoid duplicate cloud footnote overlap');
assert.match(source,/@media \(max-width:420px\) and \(max-height:700px\)/,'compact portrait buttons retain their own layout rule');
for (const [language,html] of [['zh',source],['en',toEnglish(source)]]){
  const script = html.slice(html.indexOf('<script>')+8,html.lastIndexOf('</script>'));
  new vm.Script(script);
  const notice = html.match(/<p class="cloud-notice hidden" id="cloudNotice">([\s\S]*?)<\/p>/)[1];
  const details = html.match(/<section class="hidden" id="cloudAbout">([\s\S]*?)<\/section>/)[1];
  assert.equal((notice.match(/<span>/g) || []).length,2,'start notice stays in two short statements');
  assert(html.indexOf('id="cloudNotice"') < html.indexOf('id="startBtn"'));
  if (language === 'en'){
    assert(!/[\u3400-\u9fff]/.test(notice+details),'English disclosure must be fully translated');
    for (const phrase of ['automatically submit','randomly generated anonymous player ID',
      'score ownership and basic validation','not an account','does not sync progress across devices']){
      assert(details.includes(phrase),phrase);
    }
  }

  const elements = new Map();
  function element(id){
    if (!elements.has(id)){
      const classes = new Set(['hidden']);
      elements.set(id,{innerHTML:'',classList:{
        add:c=>classes.add(c),remove:c=>classes.delete(c),contains:c=>classes.has(c),
        toggle:(c,on)=>on ? classes.add(c) : classes.delete(c),
      }});
    }
    return elements.get(id);
  }
  let enabled = false, records = [], result = {status:'offline'};
  const toasts = [];
  const env = {
    document:{getElementById:element},
    CloudLeaderboard:{enabled:()=>enabled,top:async()=>result,submit:async()=>result},
    Analytics:{track:()=>{}},loadScores:()=>records,fmtNum:String,
    boardMode:{},boardExpanded:false,justAddedId:null,DEFAULT_NAME:'Doudou',
    wireBoard:()=>{},gameState:'over',toast:text=>toasts.push(text),
  };
  const board = html.slice(html.indexOf('async function renderCloudScoreboard'),html.indexOf('\nfunction endGame'));
  const submit = html.slice(html.indexOf('function submitCloudScore'),html.indexOf('\n/**',html.indexOf('function submitCloudScore')));
  const api = vm.runInNewContext(board+'\n'+submit+'\n({renderScoreboard,renderCloudScoreboard,submitCloudScore});',env);
  api.renderScoreboard('startBoard');
  assert(element('startBoard').classList.contains('hidden'));
  assert(element('cloudNotice').classList.contains('hidden'));
  assert(element('cloudAbout').classList.contains('hidden'));

  records = [{name:'Doudou',score:100,level:1,combo:2}];
  api.renderScoreboard('startBoard');
  const localNote = language === 'zh' ? '纪录只保存在当前浏览器' : 'Records are stored only in this browser';
  assert(element('startBoard').innerHTML.includes(localNote),'disabled cloud keeps the legacy local note');

  enabled = true;
  api.renderScoreboard('startBoard');
  assert(!element('startBoard').innerHTML.includes(localNote),'cloud-enabled UI must not imply all scores are local-only');
  records = [];
  api.renderScoreboard('startBoard');
  assert(!element('cloudNotice').classList.contains('hidden'),'first-time players see disclosure');
  assert(!element('cloudAbout').classList.contains('hidden'));
  await api.renderCloudScoreboard('startBoard');
  assert(!element('cloudNotice').classList.contains('hidden'),'connection failures must not hide disclosure');

  for (const status of ['offline','error','disabled']){
    result = {status};
    api.submitCloudScore({});
    await Promise.resolve();
    assert.equal(toasts.length,0,'failed upload must not display success');
  }
  result = {status:'ok',data:[]};
  await api.renderCloudScoreboard('startBoard');
  assert(element('startBoard').innerHTML.includes(language === 'zh' ? '昵称与成绩公开' : 'Public names &amp; scores'));
  api.submitCloudScore({});
  await Promise.resolve();
  assert.equal(toasts.length,1,'confirmed upload can display success');

  enabled = false;
  api.renderScoreboard('startBoard');
  assert(element('cloudNotice').classList.contains('hidden'));
  assert(element('cloudAbout').classList.contains('hidden'));
}
console.log('✓ 中英文云榜公开说明：开启/关闭、首次无纪录、网络失败、成功提示边界均通过（模拟网络）');
