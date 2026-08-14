import "./globals.css";
import { AuthSessionProvider } from "../components/auth/AuthSessionProvider.jsx";
import { LanguageProvider } from "../components/i18n/LanguageProvider.jsx";
import MobileNavigation from "../components/navigation/MobileNavigation.jsx";
import ServiceWorkerRegistration from "../components/pwa/ServiceWorkerRegistration.jsx";
import { isSupabaseConfigured } from "../lib/supabase/config.js";
import { createClient } from "../lib/supabase/server.js";
import { SITE_DESCRIPTION, SITE_NAME, SITE_URL, SOCIAL_IMAGE } from "../lib/site.js";

export const metadata = {
  metadataBase: new URL(SITE_URL),
  title: {
    default: "Картини ниткою за фото та String Art набори",
    template: `%s | ${SITE_NAME}`,
  },
  description: SITE_DESCRIPTION,
  applicationName: SITE_NAME,
  creator: SITE_NAME,
  publisher: SITE_NAME,
  category: "arts and crafts",
  manifest: "/manifest.webmanifest",
  openGraph: {
    type: "website",
    locale: "uk_UA",
    alternateLocale: "en_US",
    siteName: SITE_NAME,
    title: "Картини ниткою за фото та String Art набори",
    description: SITE_DESCRIPTION,
    images: [
      {
        url: SOCIAL_IMAGE,
        width: 1672,
        height: 941,
        alt: "Персональна картина String Art в інтер'єрі",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "Картини ниткою за фото та String Art набори",
    description: SITE_DESCRIPTION,
    images: [SOCIAL_IMAGE],
  },
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      "max-image-preview": "large",
      "max-snippet": -1,
      "max-video-preview": -1,
    },
  },
  ...(process.env.GOOGLE_SITE_VERIFICATION
    ? { verification: { google: process.env.GOOGLE_SITE_VERIFICATION } }
    : {}),
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
        const { data: profile } = await supabase
          .from("profiles")
          .select("role")
          .eq("id", data.claims.sub)
          .maybeSingle();
        user = {
          id: data.claims.sub,
          email: data.claims.email || "",
          role: profile?.role === "admin" ? "admin" : "user",
        };
      }
    } catch {
      user = null;
    }
  }

  return (
    <html lang="uk">
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
