import type { CapacitorConfig } from "@capacitor/cli";

const config: CapacitorConfig = {
  appId: "app.lovable.d7e345911914455da5aa800df1140813",
  appName: "ARSHNAZ",
  webDir: "dist",
  android: {
    backgroundColor: "#0F172A",
  },
  plugins: {
    StatusBar: {
      style: "DARK",
      backgroundColor: "#00000000",
      overlaysWebView: true,
    },
    SplashScreen: {
      backgroundColor: "#0F172A",
      androidScaleType: "CENTER_CROP",
      showSpinner: false,
    },
  },
};

export default config;
