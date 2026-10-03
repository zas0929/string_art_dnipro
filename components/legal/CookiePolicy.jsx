"use client";

import { useLanguage } from "../i18n/LanguageProvider.jsx";

const copy = {
  uk: {
    title: "Політика використання cookies",
    updated: "Оновлено: 3 жовтня 2026 року",
    intro: "String Art Dnipro використовує cookies та локальне сховище браузера для входу в акаунт, збереження налаштувань і роботи з проєктами.",
    sections: [
      ["Cookies для входу", "Supabase Auth зберігає сесію входу в cookies, щоб ви могли користуватися акаунтом і хмарними проєктами. Cookies можуть оновлюватися під час користування сайтом. Термін зберігання визначається параметрами сесії та cookies; вихід з акаунта завершує поточну сесію."],
      ["Мова та локальні проєкти", "У localStorage зберігаються вибрана мова та технічна позначка перенесення локальних проєктів у хмару. У IndexedDB зберігаються локальні проєкти, зображення та прогрес складання. Ці дані залишаються у браузері до видалення вами або браузером. Це окремі технології зберігання, а не cookies."],
      ["Кеш для роботи сайту", "Service Worker використовує Cache Storage для файлів інтерфейсу та підтримки роботи встановленого застосунку. Кеш оновлюється разом із версіями сайту; його також можна очистити в налаштуваннях браузера."],
      ["Аналітика та реклама", "У поточній версії сайту не підключені рекламні пікселі та сторонні системи аналітики. Посилання на Instagram відкривають інший сайт, де діє його власна політика cookies."],
      ["Як керувати даними", "Ви можете видалити або заблокувати cookies та дані сайту в налаштуваннях браузера. Блокування cookies може перешкоджати входу в акаунт. Очищення локальних даних видаляє локальні проєкти, фото, прогрес і налаштування мови на цьому пристрої. Хмарні проєкти не видаляються під час очищення браузера."],
    ],
    contact: "Якщо маєте запитання, напишіть нам в Instagram:",
    back: "На головну",
  },
  en: {
    title: "Cookie Policy",
    updated: "Updated: October 3, 2026",
    intro: "String Art Dnipro uses cookies and browser storage for account sign-in, preferences, and project features.",
    sections: [
      ["Sign-in cookies", "Supabase Auth stores your sign-in session in cookies so you can use your account and cloud projects. These cookies may be refreshed while you use the site. Retention depends on session and cookie settings; signing out ends the current session."],
      ["Language and local projects", "localStorage stores your language preference and a technical flag for migrating local projects to the cloud. IndexedDB stores local projects, images, and build progress. This data remains until you or your browser remove it. These storage technologies are separate from cookies."],
      ["Site cache", "The Service Worker uses Cache Storage for interface files and installed-app functionality. The cache is updated with site versions and can also be cleared in your browser settings."],
      ["Analytics and advertising", "The current site version does not include advertising pixels or third-party analytics systems. Instagram links open a separate site with its own cookie policy."],
      ["Managing your data", "You can remove or block cookies and site data in your browser settings. Blocking cookies may prevent account sign-in. Clearing local data removes local projects, photos, progress, and language preferences on that device. Clearing browser data does not delete cloud projects."],
    ],
    contact: "For questions, contact us on Instagram:",
    back: "Back to home",
  },
};

export function CookiePolicyLink() {
  const { language } = useLanguage();
  return <a href="/cookie-policy">{language === "uk" ? "Політика cookies" : "Cookie Policy"}</a>;
}

export default function CookiePolicy() {
  const { language } = useLanguage();
  const text = copy[language] || copy.uk;
  return (
    <main className="cookie-policy-page">
      <a href="/">{text.back}</a>
      <h1>{text.title}</h1>
      <p className="cookie-policy-updated">{text.updated}</p>
      <p>{text.intro}</p>
      {text.sections.map(([heading, body]) => (
        <section key={heading}><h2>{heading}</h2><p>{body}</p></section>
      ))}
      <p>{text.contact} <a href="https://www.instagram.com/string_art_dnipro/" target="_blank" rel="noopener noreferrer">@string_art_dnipro</a></p>
    </main>
  );
}
