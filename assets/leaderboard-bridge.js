/* Web integration only. No production test hooks, no secret keys, no new game engine. */
(() => {
  'use strict';
  const game = window.NeonGame, hall = window.NeonHall;
  if (!game || !hall) return;
  const root = new URL('../', document.currentScript.src);
  const originalLanguage = document.documentElement.lang.startsWith('en') ? 'en' : 'zh';
  let language = originalLanguage, opened = false, returnFocus = null, enteredHere = false;
  let pending = null, submission = 0, confirmed = false, resultState = 'idle';
  const text = (zh,en) => language === 'en' ? en : zh;
  const node = (tag, label, cls) => {
    const el=document.createElement(tag); if (label) el.textContent=label; if (cls) el.className=cls; return el;
  };
  const button = (label, action, cls='hall-entry') => {
    const el=node('button',label,cls); el.type='button'; el.addEventListener('click',action); return el;
  };
  const gamePath = () => new URL(originalLanguage === 'en' ? 'en/' : './',root).pathname;
  const hallPath = () => new URL(language === 'en' ? 'en/leaderboard/' : 'leaderboard/',root).pathname;
  const onHallPath = () => /\/leaderboard\/?$/.test(location.pathname);
  function closeView(){
    opened=false; hall.close();
    const cabinet=document.querySelector('.cabinet'); if (cabinet) {cabinet.inert=false;cabinet.removeAttribute('inert');cabinet.removeAttribute('aria-hidden');}
    document.body.classList.remove('hall-active');
    language=originalLanguage;
    if (returnFocus && returnFocus.isConnected) returnFocus.focus({preventScroll:true});
  }
  function leave(challenge=false){
    // Replacing the route avoids Back re-opening a screen the player just dismissed.
    // The original game document and closure never reload, so the run survives.
    history.replaceState(null,'',gamePath()+location.search);
    enteredHere=false; closeView();
    if (challenge) game.challenge();
  }
  function open({mine=false,push=true}={}){
    if (!opened){ returnFocus=document.activeElement; game.pause(); }
    opened=true;
    if (push && !onHallPath()) {history.pushState({neonHall:true},'',hallPath()+location.search);enteredHere=true;}
    const cabinet=document.querySelector('.cabinet'); if (cabinet) {cabinet.inert=true;cabinet.setAttribute('inert','');}
    document.body.classList.add('hall-active');
    hall.setLanguage(language); hall.open({mine});
    if (cabinet) cabinet.setAttribute('aria-hidden','true');
  }
  hall.mount({
    request: options => game.cloud.hall(options,game.playerId()),
    recent: () => game.recentScores(),
    language, canResume:()=>game.state()==='paused',
    onClose:()=>leave(), onChallenge:()=>leave(true),
    onLanguage:lang=>{
      language=lang==='en'?'en':'zh';
      try {localStorage.setItem('neon-maze-language-manual-v1',language);} catch(e){}
      history.replaceState({neonHall:true},'',hallPath()+location.search);
      hall.setLanguage(language);
    },
  });
  // Local records can change in another tab without any cloud request.
  window.addEventListener('storage',()=>{ if (opened) hall.refreshLocal(); });
  window.addEventListener('popstate',()=>{
    if (onHallPath()) open({push:false});
    else if (opened) closeView();
  });
  document.addEventListener('click',e=>{
    const el=e.target.closest && e.target.closest('[data-open-hall],.board-cloud');
    if (!el) return;
    e.preventDefault(); e.stopPropagation(); open({mine:el.hasAttribute('data-hall-mine')});
  },true);
  // Focused controls retain Enter/Space; the game's window handler checks isOpen().
  window.addEventListener('keydown',e=>{if (opened && e.key==='Escape'){e.preventDefault();leave();}});

  function renderResult(message){
    const el=document.getElementById('resultCloud'); if (!el) return;
    el.replaceChildren(); el.classList.remove('hidden');
    el.append(node('strong',text('全球排名 · 本机成绩已保存','Global ranking · Saved in this browser')));
    if (message) el.append(node('p',message));
    if (resultState==='pending' || resultState==='failed' || resultState==='idle'){
      el.append(node('p',text('确认后公开昵称、成绩、关卡与连击。不要填写真实姓名或联系方式。','Confirm to publish your nickname, score, level and combo. Avoid real names or contact details.')));
      const form=node('form',null,'cloud-confirm');
      const label=node('label',text('公开昵称','Public nickname'));
      const input=node('input'); input.maxLength=8; input.value=pending ? pending.name : game.name();
      input.autocomplete='off'; input.required=true; label.append(input);
      const submit=node('button',text(resultState==='failed'?'重试提交':'确认昵称并上榜',resultState==='failed'?'Retry submission':'Confirm & submit'),'hall-entry'); submit.type='submit';
      form.append(label,submit);
      const local=button(text('仅保存本机昵称','Save nickname locally'),()=>{
        const name=input.value.replace(/[<>&"']/g,'').trim().slice(0,8);if(!name || !pending)return;
        pending={...pending,name};game.saveName(name);
        renderResult(text('本机昵称已保存，本局尚未公开。','Nickname saved locally. This run is not public yet.'));
      },'cloud-local-name');
      form.append(local);
      form.addEventListener('submit',e=>{
        e.preventDefault(); const name=input.value.replace(/[<>&"']/g,'').trim().slice(0,8);
        if (!name || !pending) return;
        pending={...pending,name}; game.saveName(name); confirmed=true; submitPending();
      });
      el.append(form);
    }
  }
  async function submitPending(){
    if (!pending || !confirmed || resultState==='sending') return;
    const entry={...pending}, token=++submission;
    resultState='sending';renderResult(text('正在提交，尚未确认上榜…','Submitting — not yet confirmed…'));
    const result=await game.cloud.submit(entry);
    // A previous run or rename must never mark the current run as uploaded.
    if (token!==submission || !pending || pending.runId!==entry.runId) return;
    if (result.status!=='ok' || !result.data || result.data.accepted!==true){
      resultState='failed';renderResult(text('未能确认云端保存。本机记录不受影响，可安全重试。','Cloud save was not confirmed. Your local record is safe; you can retry.'));return;
    }
    resultState='saved';renderResult(text('✓ 云端已确认保存，正在读取当前排名…','✓ Cloud save confirmed. Checking your ranking…'));
    const rank=await game.cloud.hall({scope:'current',near:true},game.playerId());
    if (token!==submission) return;
    if (rank.status==='ok' && rank.data.mine){
      const d=rank.data;
      const aim=d.next_gap===null ? text('挑战刷新自己的世界纪录。','Challenge your own world record.')
        : text(`超过上一档还需 ${d.next_gap.toLocaleString('en-US')} 分。`,`${d.next_gap.toLocaleString('en-US')} more points to beat the next score.`);
      renderResult(text(`✓ 云端已确认保存 · 当前第 ${d.mine.rank} 名。${aim}`,`✓ Saved to the cloud · Currently #${d.mine.rank}. ${aim}`));
    } else renderResult(text('✓ 云端已确认保存；暂时无法核实当前排名，请打开全球榜重试。','✓ Cloud save confirmed; ranking is not available yet. Open the board to retry.'));
    refreshPreview();
  }
  window.NeonCompetition={
    isOpen:()=>opened,
    reset:()=>{pending=null;++submission;confirmed=false;resultState='idle';document.getElementById('resultCloud')?.classList.add('hidden');},
    offer:entry=>{pending={...entry};++submission;confirmed=false;resultState='pending';renderResult(text('本局尚未公开，请确认昵称。','This run is not public yet. Confirm your nickname.'));},
    rename:name=>{if (!pending) return;pending={...pending,name};++submission;confirmed=false;resultState='pending';renderResult(text('昵称已更改，请确认后同步全球榜。','Nickname changed. Confirm to sync it to the board.'));},
    resultMode:practice=>{
      for (const id of ['resultCloud','resultHallBtn']) document.getElementById(id)?.classList.toggle('hidden',practice || !game.cloud.enabled());
      if (!practice && game.cloud.enabled()) document.getElementById('nameRow')?.classList.add('hidden');
      if (practice){pending=null;++submission;}
    },
  };
  function previewRow(row,champion=false){
    const line=node('span',null,'preview-row'+(champion?' preview-champion':''));
    const name=node('span',row.name,'preview-name');name.title=row.name;
    line.append(node('span',row.rank?`#${row.rank}`:'','preview-rank'),name,
      node('span',row.score.toLocaleString('en-US'),'preview-score'));
    return line;
  }
  async function refreshPreview(){
    const preview=document.getElementById('hallPreview'); if (!preview) return;
    preview.classList.remove('hidden');preview.replaceChildren(node('strong',text('🏆 世界纪录','🏆 World record')),node('span',text('正在读取…','Loading…')));
    const result=await game.cloud.hall({limit:3},game.playerId());
    preview.replaceChildren(node('strong',text('🏆 世界纪录 · 查看全球榜','🏆 World record · Open rankings')));
    if (result.status==='ok'){
      const top=result.data.podium;
      if (!top.length) preview.append(node('span',text('第一位挑战者，可能就是你','You could be the first challenger')));
      for (const row of top) preview.append(previewRow(row,row.position===1));
    } else if (result.status==='unavailable'){
      // Old production API still offers verified public scores, but no identity/ranks.
      // A top score can be shown honestly without pretending the new API is deployed.
      const legacy=await game.cloud.top(3);
      if (legacy.status==='ok' && legacy.data.length){
        preview.append(previewRow(legacy.data[0],true));
        preview.append(node('small',text('现有公开纪录 · 详细排名服务待升级','Existing public record · Full ranking service pending')));
      } else preview.append(node('span',text('详细排名服务待启用','Full rankings are not enabled yet')));
    } else preview.append(node('span',text('暂时无法读取 · 点击重试','Unable to load · Open to retry')));
  }
  document.body.classList.add('hall-ready');
  // The start and result controls should not be buried below lengthy local rows.
  const actions=document.querySelector('.start-actions'),welcome=document.getElementById('welcomeLine');
  if (actions && welcome) welcome.after(actions);
  const preview=document.getElementById('hallPreview');if (preview && actions) actions.after(preview);
  const notice=document.getElementById('cloudNotice');
  if (notice){notice.replaceChildren(node('span',text('结束后确认昵称，再将成绩公开到全球榜。','After each run, confirm your nickname to publish your score.')),node('span',text('星星与解锁仅存本机。','Stars and unlocks stay in this browser.')));}
  const about=document.querySelector('#cloudAbout p');
  if (about) about.textContent=text('正式挑战结束后，本机自动保存。确认昵称后才公开提交本局成绩、关卡和连击；练习与每日挑战不上传。星星与解锁仅存本机。','Normal runs save locally first. Only after nickname confirmation is the run submitted publicly with its score, level and combo. Practice and Daily runs are not uploaded. Stars and unlocks stay in this browser.');
  if (onHallPath()) open({push:false});
  else refreshPreview();
})();
