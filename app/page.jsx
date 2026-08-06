import LandingPage from "../components/landing/LandingPage.jsx";
import { SITE_DESCRIPTION, SITE_NAME, SITE_URL, SOCIAL_IMAGE } from "../lib/site.js";

export const metadata = {
  title: "Картини ниткою за фото та String Art набори",
  description: SITE_DESCRIPTION,
  alternates: {
    canonical: "/",
  },
  openGraph: {
    url: "/",
    title: "Картини ниткою за фото та String Art набори",
    description: SITE_DESCRIPTION,
    images: [SOCIAL_IMAGE],
  },
};

const structuredData = {
  "@context": "https://schema.org",
  "@graph": [
    {
      "@type": "OnlineStore",
      "@id": `${SITE_URL}/#organization`,
      name: SITE_NAME,
      url: SITE_URL,
      logo: `${SITE_URL}/logo-white-compact.png`,
      image: `${SITE_URL}${SOCIAL_IMAGE}`,
      description: SITE_DESCRIPTION,
      sameAs: ["https://www.instagram.com/string_art_dnipro/"],
    },
    {
      "@type": "WebSite",
      "@id": `${SITE_URL}/#website`,
      url: SITE_URL,
      name: SITE_NAME,
      inLanguage: ["uk", "en"],
      publisher: { "@id": `${SITE_URL}/#organization` },
    },
    {
      "@type": "ItemList",
      name: "Персональні набори String Art",
      itemListElement: [
        {
          "@type": "ListItem",
          position: 1,
          item: {
            "@type": "Product",
            name: "Персональний String Art набір на круглій основі",
            image: `${SITE_URL}/circle.jpeg`,
            description: "Підготовлена кругла основа з цвяхами, нитка, персональний макет і покрокова інструкція.",
            brand: { "@type": "Brand", name: SITE_NAME },
            offers: {
              "@type": "Offer",
              url: `${SITE_URL}/#kit`,
              priceCurrency: "UAH",
              price: "1800",
              availability: "https://schema.org/InStock",
            },
          },
        },
        {
          "@type": "ListItem",
          position: 2,
          item: {
            "@type": "Product",
            name: "Персональний String Art набір на квадратній основі",
            image: `${SITE_URL}/square.jpeg`,
            description: "Підготовлена квадратна основа з цвяхами, нитка, персональний макет і покрокова інструкція.",
            brand: { "@type": "Brand", name: SITE_NAME },
            offers: {
              "@type": "Offer",
              url: `${SITE_URL}/#kit`,
              priceCurrency: "UAH",
              price: "1600",
              availability: "https://schema.org/InStock",
            },
          },
        },
      ],
    },
    {
      "@type": "SoftwareApplication",
      name: "String Art Generator",
      url: `${SITE_URL}/create`,
      applicationCategory: "DesignApplication",
      operatingSystem: "Web",
      description: "Онлайн-генератор персональних схем String Art за фотографією.",
      offers: {
        "@type": "Offer",
        price: "0",
        priceCurrency: "UAH",
      },
    },
    {
      "@type": "FAQPage",
      mainEntity: [
        {
          "@type": "Question",
          name: "Яке фото найкраще підходить для String Art?",
          acceptedAnswer: {
            "@type": "Answer",
            text: "Оберіть чіткий, рівномірно освітлений портрет крупним планом з одним або двома добре видимими обличчями. Простий або світлий фон зазвичай дає чистіший макет.",
          },
        },
        {
          "@type": "Question",
          name: "Що входить до набору?",
          acceptedAnswer: {
            "@type": "Answer",
            text: "До набору входять підготовлена основа з пронумерованими цвяхами, підібрана нитка, персональний макет, друкована інструкція та захисне пакування.",
          },
        },
        {
          "@type": "Question",
          name: "Чи можна скласти картину без досвіду?",
          acceptedAnswer: {
            "@type": "Answer",
            text: "Так. Дотримуйтеся друкованої послідовності або використовуйте інтерактивний режим складання з озвученням, регулюванням темпу, перемотуванням і збереженням прогресу.",
          },
        },
      ],
    },
  ],
};

export default function Home() {
  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(structuredData).replace(/</g, "\\u003c") }}
      />
      <LandingPage />
    </>
  );
}
