import StringArtGenerator from "../../components/StringArtGenerator.jsx";
import { SITE_NAME, SITE_URL, SOCIAL_IMAGE } from "../../lib/site.js";

export const metadata = {
  title: "Генератор String Art за фото онлайн",
  description:
    "Безкоштовний генератор String Art: створіть схему картини ниткою зі свого фото, перегляньте макет і отримайте послідовність з'єднання точок.",
  alternates: {
    canonical: "/create",
  },
  openGraph: {
    type: "website",
    url: "/create",
    title: "Генератор String Art за фото онлайн",
    description: "Створіть безкоштовний макет картини ниткою зі свого фото онлайн.",
    images: [
      {
        url: SOCIAL_IMAGE,
        width: 1672,
        height: 941,
        alt: "Приклад персональної картини String Art за фото",
      },
    ],
  },
};

const structuredData = {
  "@context": "https://schema.org",
  "@type": "SoftwareApplication",
  "@id": `${SITE_URL}/create#application`,
  name: "String Art Generator",
  alternateName: "Генератор String Art за фото",
  url: `${SITE_URL}/create`,
  image: `${SITE_URL}${SOCIAL_IMAGE}`,
  applicationCategory: "DesignApplication",
  applicationSubCategory: "String Art pattern generator",
  operatingSystem: "Web",
  browserRequirements: "Requires JavaScript and a modern web browser",
  inLanguage: ["uk", "en"],
  description:
    "Безкоштовний онлайн-генератор схем String Art: перетворює фотографію на макет картини ниткою та послідовність з'єднання пронумерованих точок.",
  creator: {
    "@type": "Organization",
    name: SITE_NAME,
    url: SITE_URL,
  },
  offers: {
    "@type": "Offer",
    price: "0",
    priceCurrency: "UAH",
  },
  featureList: [
    "Генерація схеми String Art за фото",
    "Налаштування кадру та кількості точок",
    "Завантаження схеми та макета",
    "Інтерактивний режим складання",
  ],
};

export default function CreatePage() {
  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(structuredData).replace(/</g, "\\u003c") }}
      />
      <StringArtGenerator />
      <section className="generator-seo" aria-labelledby="generator-seo-title">
        <div className="generator-seo-inner">
          <p className="generator-seo-eyebrow">ВІД ФОТО ДО СХЕМИ</p>
          <h2 id="generator-seo-title">Онлайн-генератор String Art за фото</h2>
          <p className="generator-seo-intro">
            Завантажте портрет і створіть персональний макет картини ниткою. Генератор
            розрахує маршрут нитки між пронумерованими точками та покаже результат ще до
            початку складання.
          </p>

          <div className="generator-seo-grid">
            <article>
              <span aria-hidden="true">1</span>
              <h3>Завантажте фото</h3>
              <p>Найкраще підходить чіткий портрет крупним планом з одним або двома обличчями.</p>
            </article>
            <article>
              <span aria-hidden="true">2</span>
              <h3>Налаштуйте макет</h3>
              <p>Відкоригуйте кадр, масштаб, кількість точок і товщину нитки під свою основу.</p>
            </article>
            <article>
              <span aria-hidden="true">3</span>
              <h3>Отримайте схему</h3>
              <p>Збережіть макет і послідовність точок або відкрийте інтерактивний режим складання.</p>
            </article>
          </div>
        </div>
      </section>
    </>
  );
}
