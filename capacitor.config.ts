import type { CapacitorConfig } from '@capacitor/cli';

// BUILD_MOBILE=true -> bundle the static export (out/) into the APK (offline).
// otherwise         -> WebView points at a deployed instance (keeps API routes).
const isMobile = process.env.BUILD_MOBILE === 'true';

const config: CapacitorConfig = {
  appId: 'com.synaa.studio',
  appName: 'SYNAA Studio',
  webDir: isMobile ? 'out' : 'public',
  ...(isMobile
    ? {}
    : {
        server: {
          url: 'https://synaa-studio.vercel.app',
          cleartext: false,
        },
      }),
  android: {
    allowMixedContent: false,
    captureInput: true,
    webContentsDebuggingEnabled: false,
  },
  plugins: {
    SplashScreen: {
      launchShowDuration: 1500,
      backgroundColor: '#0A0D12',
      androidScaleType: 'CENTER_CROP',
      showSpinner: false,
    },
    StatusBar: {
      style: 'DARK',
      backgroundColor: '#0A0D12',
    },
  },
};

export default config;
