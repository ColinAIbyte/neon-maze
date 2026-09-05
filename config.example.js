// Copy to config.js for a separate deployment. All optional services start off.
// Only a publishable key belongs here; never paste a database password or backend key.
window.NEON_MAZE_CONFIG = {
  supabase: {url: '', publishableKey: '', anonKey: ''},
  analytics: {ga4MeasurementId: '', ga4ConsentGranted: false, cloudflareBeaconToken: ''},
  ads: {showPlaceholders: false},
};
