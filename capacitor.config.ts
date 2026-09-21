import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.aura.musicplayer',
  appName: 'Aura Music',
  webDir: 'dist',
  server: {
    androidScheme: 'https',
    iosScheme: 'ionic',
    cleartext: true
  },
  android: {
    allowMixedContent: true,
    webContentsDebuggingEnabled: true
  },
  ios: {
    contentInset: 'always',
    allowsLinkPreview: false,
    scrollEnabled: false,
    preferredContentMode: 'mobile'
  },
  plugins: {
    StatusBar: {
      style: 'DARK',
      backgroundColor: '#0b0d13',
      overlaysWebView: false
    }
  }
};

export default config;
