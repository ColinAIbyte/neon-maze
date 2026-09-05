// Neon Maze 公开运行配置。浏览器仅使用 publishable key（或旧 anon key）。
// sb_secret_* / service_role 绕过数据权限，绝不能写入此文件或提交到 Git。
window.NEON_MAZE_CONFIG = {
  supabase: {
    url: 'https://nphdwmcyriinggjwwnfw.supabase.co',
    publishableKey: 'sb_publishable_XCbyWVZ3kt6zSqI1htherQ_mwFY9iVS',
    // 仅为已有项目保留的兼容项，新项目填写上面的 publishableKey 即可。
    anonKey: '',
  },
  analytics: {
    ga4MeasurementId: '',
    ga4ConsentGranted: false,
    cloudflareBeaconToken: '',
  },
  ads: {
    // 仅用于本地检查布局；不会加载、请求或渲染任何真实广告。
    showPlaceholders: false,
  },
};
