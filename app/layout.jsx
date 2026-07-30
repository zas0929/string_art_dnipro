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
  themeColor: "#f4efe7",
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
