import "./globals.css";

export const metadata = {
  title: "String Art Generator",
  description: "Генератор схем для картин из нитей",
};

export default function RootLayout({ children }) {
  return (
    <html lang="ru">
      <body>{children}</body>
    </html>
  );
}
