import "./globals.css";
import { AuthSessionProvider } from "../components/auth/AuthSessionProvider.jsx";
import { LanguageProvider } from "../components/i18n/LanguageProvider.jsx";
import MobileNavigation from "../components/navigation/MobileNavigation.jsx";
import ServiceWorkerRegistration from "../components/pwa/ServiceWorkerRegistration.jsx";
import { isSupabaseConfigured } from "../lib/supabase/config.js";
import { createClient } from "../lib/supabase/server.js";

export const metadata = {
  title: "String Art Generator",
  description: "Generate String Art patterns from your photos",
  applicationName: "String Art Dnipro",
  manifest: "/manifest.webmanifest",
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "String Art",
    startupImage: [],
  },
  icons: {
    icon: {
      url: "/favicon.ico?v=2",
      type: "image/x-icon",
    },
    apple: [
      {
        url: "/pwa/apple-touch-icon.png",
        sizes: "180x180",
        type: "image/png",
      },
    ],
  },
};

export const viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  themeColor: "#0f1310",
};

export default async function RootLayout({ children }) {
  let user = null;
  if (isSupabaseConfigured()) {
    try {
      const supabase = await createClient();
      const { data } = await supabase.auth.getClaims();
      if (data?.claims?.sub) {
        user = {
          id: data.claims.sub,
          email: data.claims.email || "",
        };
      }
    } catch {
      user = null;
    }
  }

  return (
    <html lang="en">
      <body>
        <LanguageProvider>
          <AuthSessionProvider user={user}>
            <MobileNavigation />
            {children}
          </AuthSessionProvider>
        </LanguageProvider>
        <ServiceWorkerRegistration />
      </body>
    </html>
  );
}
