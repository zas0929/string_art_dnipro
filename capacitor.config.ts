import type { CapacitorConfig } from "@capacitor/cli";

const productionUrl = "https://stringartdnipro.com/create";
const developmentUrl = process.env.CAPACITOR_SERVER_URL?.trim();
const appUrl = developmentUrl || productionUrl;

const config: CapacitorConfig = {
  appId: "com.stringartdnipro.app",
  appName: "String Art Dnipro",
  webDir: "mobile-shell",
  server: {
    url: appUrl,
    cleartext: appUrl.startsWith("http://"),
    allowNavigation: [
      "stringartdnipro.com",
      "www.stringartdnipro.com",
      "*.supabase.co",
    ],
  },
  ios: {
    contentInset: "automatic",
    preferredContentMode: "mobile",
  },
  android: {
    allowMixedContent: false,
  },
  plugins: {
    SplashScreen: {
      launchShowDuration: 1200,
      launchAutoHide: true,
      backgroundColor: "#0f1310",
      showSpinner: false,
    },
    StatusBar: {
      style: "LIGHT",
      backgroundColor: "#0f1310",
    },
  },
};

export default config;
