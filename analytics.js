(function(){
  'use strict';

  const root = window.NEON_MAZE_CONFIG || {};
  const config = root.analytics && typeof root.analytics === 'object' ? root.analytics : {};
  const allowedEvents = new Set([
    'game_start','level_complete','game_end','leaderboard_view','cloud_score_result',
  ]);
  const allowedParams = new Set([
    'mode','level','won','score_band','duration_band','cloud_status',
  ]);
  const allowedModes = new Set(['normal','practice','daily','cloud']);
  const allowedCloudStatus = new Set(['ok','error','offline','disabled']);

  function cleanParams(input){
    const output = {};
    if (!input || typeof input !== 'object') return output;
    for (const [key,value] of Object.entries(input)){
      if (!allowedParams.has(key)) continue;
      if (key === 'mode' && allowedModes.has(value)) output[key] = value;
      else if (key === 'level' && Number.isInteger(value) && value >= 1 && value <= 6) output[key] = value;
      else if (key === 'won' && typeof value === 'boolean') output[key] = value;
      else if (key === 'cloud_status' && allowedCloudStatus.has(value)) output[key] = value;
      else if ((key === 'score_band' || key === 'duration_band')
               && typeof value === 'string' && /^[a-z0-9_]{1,24}$/.test(value)) output[key] = value;
    }
    return output;
  }

  const gaId = typeof config.ga4MeasurementId === 'string'
    && /^G-[A-Z0-9]{4,20}$/.test(config.ga4MeasurementId.trim())
    ? config.ga4MeasurementId.trim() : '';

  if (gaId){
    window.dataLayer = window.dataLayer || [];
    window.gtag = window.gtag || function(){ window.dataLayer.push(arguments); };
    window.gtag('consent','default',{
      analytics_storage:config.ga4ConsentGranted === true ? 'granted' : 'denied',
      ad_storage:'denied',ad_user_data:'denied',ad_personalization:'denied',
      wait_for_update:500,
    });
    window.gtag('js',new Date());
    window.gtag('config',gaId,{
      send_page_view:false,
      allow_google_signals:false,
      allow_ad_personalization_signals:false,
    });
    // 不把挑战链接中的姓名和分数查询参数发送给分析服务。
    const safeLocation = location.origin + location.pathname;
    window.gtag('event','page_view',{page_title:document.title,page_location:safeLocation});
    const script = document.createElement('script');
    script.async = true;
    script.src = 'https://www.googletagmanager.com/gtag/js?id=' + encodeURIComponent(gaId);
    document.head.appendChild(script);
  }

  const cfToken = typeof config.cloudflareBeaconToken === 'string'
    && /^[a-f0-9]{32}$/i.test(config.cloudflareBeaconToken.trim())
    ? config.cloudflareBeaconToken.trim() : '';
  if (cfToken){
    const script = document.createElement('script');
    script.type = 'module';
    script.src = 'https://static.cloudflareinsights.com/beacon.min.js';
    script.setAttribute('data-cf-beacon',JSON.stringify({token:cfToken,spa:false}));
    document.head.appendChild(script);
  }

  window.NeonAnalytics = {
    track(event, params){
      if (!gaId || !allowedEvents.has(event) || typeof window.gtag !== 'function') return false;
      window.gtag('event',event,cleanParams(params));
      return true;
    },
    setConsent(granted){
      if (!gaId || typeof window.gtag !== 'function') return false;
      window.gtag('consent','update',{analytics_storage:granted === true ? 'granted' : 'denied'});
      return true;
    },
  };
})();
