import type { CapacitorConfig } from "@capacitor/cli";

const developmentUrl = process.env.CAPACITOR_SERVER_URL?.trim();

const config: CapacitorConfig = {
  appId: "com.stringartdnipro.app",
  appName: "String Art Dnipro",
  webDir: "mobile-dist",
  server: developmentUrl
    ? {
        url: developmentUrl,
        cleartext: developmentUrl.startsWith("http://"),
        allowNavigation: [
          "stringartdnipro.com",
          "www.stringartdnipro.com",
          "*.supabase.co",
        ],
      }
    : undefined,
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
