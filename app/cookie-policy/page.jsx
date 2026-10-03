import CookiePolicy from "../../components/legal/CookiePolicy.jsx";

export const metadata = {
  title: "Політика cookies",
  description: "Як String Art Dnipro використовує cookies, локальне сховище та кеш браузера.",
  alternates: { canonical: "/cookie-policy" },
};

export default function CookiePolicyPage() {
  return <CookiePolicy />;
}
