import type { CapacitorConfig } from "@capacitor/cli";

const config: CapacitorConfig = {
  appId: "app.wardle.medcase",
  appName: "Wardle",
  webDir: "dist",

  // ── Server ──────────────────────────────────────────────────────
  // Remove `url` for production builds. Uncomment only for live-reload dev.
  // server: {
  //   url: "http://YOUR_LOCAL_IP:5173",
  //   cleartext: true,
  // },

  // ── iOS ─────────────────────────────────────────────────────────
  ios: {
    contentInset: "always",           // web content fills under notch
    backgroundColor: "#1E1E2C",       // charcoal — prevents white flash
    scrollEnabled: false,             // we handle scrolling in-app
    limitsNavigationsToAppBoundDomains: true,
    preferredContentMode: "mobile",
  },

  // ── Android ─────────────────────────────────────────────────────
  android: {
    backgroundColor: "#1E1E2C",
    allowMixedContent: false,
    captureInput: true,
    webContentsDebuggingEnabled: false, // set true for debug builds
  },

  // ── Plugins ─────────────────────────────────────────────────────
  plugins: {
    SplashScreen: {
      launchShowDuration: 1800,
      launchAutoHide: true,
      backgroundColor: "#1E1E2C",
      androidSplashResourceName: "splash",
      androidScaleType: "CENTER_CROP",
      showSpinner: false,
      iosSpinnerStyle: "small",
      spinnerColor: "#00B4A6",
      splashFullScreen: true,
      splashImmersive: true,
    },

    StatusBar: {
      style: "LIGHT",                  // light icons on dark/navy bg
      backgroundColor: "#1E1E2C",
      overlaysWebView: false,
    },

    Keyboard: {
      resize: "body",
      resizeOnFullScreen: true,
      style: "DARK",
    },
  },
};

export default config;
