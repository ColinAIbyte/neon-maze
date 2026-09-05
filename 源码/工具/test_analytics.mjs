import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';

const source = readFileSync(new URL('../../analytics.js',import.meta.url),'utf8');

function boot(config={}){
  const scripts = [];
  const window = {NEON_MAZE_CONFIG:config};
  const document = {
    title:'Neon Maze · 豆豆',
    head:{appendChild:node=>scripts.push(node)},
    createElement:()=>({setAttribute(key,value){this[key]=value;}}),
  };
  const context = {window,document,location:{origin:'https://playneonmaze.com',pathname:'/',search:'?n=名字&c=123'}};
  vm.runInNewContext(source,context);
  return {window,scripts};
}

const off = boot();
assert.equal(off.scripts.length,0);
assert.equal(off.window.NeonAnalytics.track('game_start',{mode:'normal'}),false);

const on = boot({analytics:{
  ga4MeasurementId:'G-ABCD1234',ga4ConsentGranted:false,
  cloudflareBeaconToken:'0123456789abcdef0123456789abcdef',
}});
assert.equal(on.scripts.length,2);
assert.match(on.scripts[0].src,/googletagmanager\.com\/gtag\/js\?id=G-ABCD1234/);
assert.equal(on.scripts[1].src,'https://static.cloudflareinsights.com/beacon.min.js');
assert.deepEqual(JSON.parse(on.scripts[1]['data-cf-beacon']),{
  token:'0123456789abcdef0123456789abcdef',spa:false,
});
const pageView = Array.from(on.window.dataLayer[3]);
assert.equal(pageView[0],'event');
assert.equal(pageView[1],'page_view');
assert.equal(pageView[2].page_location,'https://playneonmaze.com/');
assert(!JSON.stringify(pageView).includes('名字'));
assert(!JSON.stringify(pageView).includes('123'));

const before = on.window.dataLayer.length;
assert.equal(on.window.NeonAnalytics.track('game_end',{
  mode:'normal',level:4,won:false,score_band:'100k_500k',duration_band:'3m_10m',
  player_id:'must-not-leak',score:123456,name:'must-not-leak',
}),true);
assert.equal(on.window.dataLayer.length,before+1);
const tracked = Array.from(on.window.dataLayer.at(-1));
assert.deepEqual({...tracked[2]}, {
  mode:'normal',level:4,won:false,score_band:'100k_500k',duration_band:'3m_10m',
});
assert(!JSON.stringify(tracked).includes('must-not-leak'));
assert.equal(on.window.NeonAnalytics.track('arbitrary_event',{mode:'normal'}),false);
assert.equal(on.window.dataLayer.length,before+1);

console.log('✓ 分析默认关闭；启用后只加载有效配置并仅发送事件/参数白名单');
