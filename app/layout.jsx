import "./globals.css";

export const metadata = {
  title: "String Art Generator",
  description: "Генератор схем для картин из нитей",
};

export const viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
};

export default function RootLayout({ children }) {
  return (
    <html lang="ru">
      <body>{children}</body>
    </html>
  );
}
