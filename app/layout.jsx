import "./globals.css";
import { LanguageProvider } from "../components/i18n/LanguageProvider.jsx";
import ServiceWorkerRegistration from "../components/pwa/ServiceWorkerRegistration.jsx";

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
    icon: [
      {
        url: "/pwa/icon-192.png",
        sizes: "192x192",
        type: "image/png",
      },
      {
        url: "/pwa/icon-512.png",
        sizes: "512x512",
        type: "image/png",
      },
    ],
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
  themeColor: "#0f1115",
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body>
        <LanguageProvider>{children}</LanguageProvider>
        <ServiceWorkerRegistration />
      </body>
    </html>
  );
}
