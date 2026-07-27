import "./globals.css";
import { LanguageProvider } from "../components/i18n/LanguageProvider.jsx";

export const metadata = {
  title: "String Art Generator",
  description: "Generate String Art patterns from your photos",
};

export const viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body>
        <LanguageProvider>{children}</LanguageProvider>
      </body>
    </html>
  );
}
