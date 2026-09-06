/* Website navigation adapter. No scoring, storage or engine changes. */
(() => {
  'use strict';
  const header=document.getElementById('siteHeader'),game=window.NeonGame;
  if(!header || !game)return;
  const links=document.getElementById('siteNavLinks'),toggle=document.getElementById('siteMenuToggle');
  const compact=window.matchMedia('(max-width:1119px), (max-height:719px)');
  const leave=document.getElementById('siteLeaveDialog'),cancel=document.getElementById('siteLeaveCancel');
  const cabinet=document.querySelector('.cabinet');
  let pendingLeave=null,leaveOpener=null,fallbackModal=false;
  let expanded=false,opener=null,activePanel=null;
  const panels=['helpOverlay','aboutOverlay','owlOverlay','prefsOverlay'].map(id=>document.getElementById(id)).filter(Boolean);
  function closeMenu(restore=false){
    expanded=false;toggle.setAttribute('aria-expanded','false');links.hidden=compact.matches;
    if(restore && compact.matches)toggle.focus({preventScroll:true});
  }
  function syncLayout(){
    const restore=compact.matches && links.contains(document.activeElement);
    closeMenu(restore);
  }
  toggle.addEventListener('click',()=>{
    if(expanded){closeMenu(true);return;}
    game.pause();expanded=true;links.hidden=false;toggle.setAttribute('aria-expanded','true');
  });
  if(compact.addEventListener)compact.addEventListener('change',syncLayout);
  else compact.addListener(syncLayout);
  syncLayout();
  header.addEventListener('focusout',e=>{if(expanded && !header.contains(e.relatedTarget))closeMenu();});
  document.addEventListener('click',e=>{
    if(leave.hasAttribute('open') && !leave.contains(e.target)){
      e.preventDefault();e.stopImmediatePropagation();return;
    }
    if(!header.contains(e.target)){if(expanded)closeMenu();return;}
    const hall=e.target.closest('[data-open-hall]');
    if(hall && expanded)closeMenu(true); // bridge captures the restored, visible opener
    const play=e.target.closest('[data-site-play]');
    if(play){
      e.preventDefault();closeMenu();
      game.pause(); // visiting the current section never starts or resets a run
      const target=document.getElementById(game.state()==='paused'?'resumeBtn':game.state()==='over'?'restartBtn':'startBtn');
      target?.focus({preventScroll:true});
    }
    const action=e.target.closest('[data-site-panel]');
    if(action){
      closeMenu();opener=compact.matches?toggle:action;
      game.pause();
      document.getElementById(action.dataset.sitePanel)?.click();
    }
  },true);
  window.addEventListener('keydown',e=>{
    if(leave.hasAttribute('open')){
      if(e.key==='Escape'){e.preventDefault();finishLeave(false);}
      if(e.key==='Tab'){
        const last=document.getElementById('siteLeaveConfirm');
        if(!leave.contains(document.activeElement)){e.preventDefault();cancel.focus();}
        else if(e.shiftKey && document.activeElement===cancel){e.preventDefault();last.focus();}
        else if(!e.shiftKey && document.activeElement===last){e.preventDefault();cancel.focus();}
      }
      e.stopPropagation();return;
    }
    if(!expanded && !header.contains(e.target))return;
    // Native links/buttons retain Enter/Space; game shortcuts must not leak through.
    if(e.key==='Escape' && expanded){e.preventDefault();closeMenu(true);}
    e.stopPropagation();
  },true);
  const focusable=panel=>Array.from(panel.querySelectorAll('a[href],button,input,select,textarea,[tabindex]'))
    .filter(el=>!el.disabled && el.tabIndex>=0 && el.getClientRects().length);
  // Full-screen documents own focus; the site header cannot sit above them.
  function syncPanels(){
    const panel=panels.find(el=>!el.classList.contains('hidden'));
    header.inert=!!panel;
    if(panel && opener && panel!==activePanel){
      panel.setAttribute('tabindex','-1');panel.focus({preventScroll:true});
    }else if(!panel && activePanel && opener){
      const target=compact.matches?toggle:opener;opener=null;target.focus({preventScroll:true});
    }
    activePanel=panel;
  }
  const observer=new MutationObserver(syncPanels);
  panels.forEach(panel=>observer.observe(panel,{attributes:true,attributeFilter:['class']}));
  document.addEventListener('keydown',e=>{
    if(!activePanel || !opener || e.key!=='Tab')return;
    const items=focusable(activePanel),first=items[0],last=items.at(-1),a=document.activeElement;
    if(!first){e.preventDefault();return;}
    if(e.shiftKey && (a===first || a===activePanel)){e.preventDefault();last.focus();}
    else if(!e.shiftKey && (a===last || a===activePanel)){e.preventDefault();first.focus();}
  });
  function finishLeave(confirmed){
    const action=pendingLeave;pendingLeave=null;
    if(typeof leave.close==='function')leave.close();else leave.removeAttribute('open');
    if(fallbackModal){cabinet.inert=false;leave.classList.remove('site-leave-fallback');fallbackModal=false;}
    if(leaveOpener?.isConnected)leaveOpener.focus({preventScroll:true});leaveOpener=null;
    if(confirmed && action)action();
  }
  cancel.addEventListener('click',()=>finishLeave(false));
  document.getElementById('siteLeaveConfirm').addEventListener('click',()=>finishLeave(true));
  leave.addEventListener('cancel',e=>{e.preventDefault();finishLeave(false);});
  window.NeonNavigation={requestLeave:action=>{
    if(!['playing','paused'].includes(game.state())){action();return;}
    game.pause();closeMenu();pendingLeave=action;leaveOpener=document.activeElement;
    if(typeof leave.showModal==='function')leave.showModal();
    else{leave.setAttribute('open','');leave.classList.add('site-leave-fallback');cabinet.inert=true;fallbackModal=true;}
    cancel.focus({preventScroll:true});
  }};
})();
