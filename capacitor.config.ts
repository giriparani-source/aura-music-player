import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.aura.musicplayer',
  appName: 'Aura Music',
  webDir: 'dist',
  server: {
    androidScheme: 'https',
    iosScheme: 'ionic'
  },
  android: {
    // webContentsDebuggingEnabled is now gated by BuildConfig.DEBUG in MainActivity.java
    // cleartext is now restricted to 127.0.0.1 only via network_security_config.xml
    // allowMixedContent removed — tightened to COMPATIBILITY_MODE in native code
  },
  ios: {
    contentInset: 'always',
    allowsLinkPreview: false,
    scrollEnabled: false,
    preferredContentMode: 'mobile'
  },
  plugins: {
    CapacitorHttp: {
      enabled: true
    },
    StatusBar: {
      style: 'DARK',
      backgroundColor: '#0b0d13',
      overlaysWebView: false
    }
  }
};

export default config;
