import StringArtGenerator from "../../components/StringArtGenerator.jsx";
import { SITE_NAME, SITE_URL, SOCIAL_IMAGE } from "../../lib/site.js";

export const metadata = {
  title: "Безкоштовний генератор String Art — схема за фото",
  description:
    "Безкоштовний генератор String Art: створіть схему картини ниткою зі свого фото, перегляньте макет і отримайте послідовність з'єднання точок.",
  alternates: {
    canonical: "/create",
  },
  twitter: {
    card: "summary_large_image",
    title: "Безкоштовний генератор String Art — схема за фото",
    description: "Завантажте фото, створіть макет картини ниткою та складайте її за покроковою інструкцією.",
    images: [SOCIAL_IMAGE],
  },
  openGraph: {
    type: "website",
    url: "/create",
    title: "Безкоштовний генератор String Art — схема за фото",
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
        dangerouslySetInnerHTML={{ __html: JSON.stringify([
          structuredData,
          {
            "@context": "https://schema.org",
            "@type": "BreadcrumbList",
            itemListElement: [
              { "@type": "ListItem", position: 1, name: "String Art Dnipro", item: SITE_URL },
              { "@type": "ListItem", position: 2, name: "Генератор String Art", item: `${SITE_URL}/create` },
            ],
          },
        ]).replace(/</g, "\\u003c") }}
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

          <section className="generator-seo-questions" aria-labelledby="generator-questions-title">
            <h2 id="generator-questions-title">Як створити картину ниткою за фото</h2>
            <h3>Яке фото обрати для String Art?</h3>
            <p>Оберіть чіткий портрет з добре видимими очима, носом і контуром обличчя. Уникайте розмитих знімків, глибоких тіней та великої кількості дрібних деталей на фоні. Після завантаження наблизьте обличчя й перевірте кадр у попередньому перегляді.</p>
            <h3>Скільки точок і ліній потрібно?</h3>
            <p>Типовий макет використовує 240 точок на круглій основі. Генератор підтримує до 4500 ліній нитки. Порівняйте варіанти на 3500, 4000 і 4500 ліній: більша кількість ліній робить зображення щільнішим, але найкращий результат залежить від фотографії.</p>
            <h3>Як складати картину за готовою схемою?</h3>
            <p>Збережіть проєкт і відкрийте режим складання. Він показує, між якими точками натягувати нитку, озвучує наступну точку та дозволяє регулювати паузу, перемотувати кроки й зберігати прогрес. Також можна надрукувати інструкцію.</p>
            <h3>Чи потрібен акаунт для генерації?</h3>
            <p>Створити макет можна без реєстрації. Локальні проєкти зберігаються у вашому браузері, а після входу в акаунт доступне хмарне збереження.</p>
            <p><a href="/#kit">Переглянути набори String Art з основою та ниткою</a> або <a href="/#faq">дізнатися більше про вибір фото</a>.</p>
          </section>
        </div>
      </section>
    </>
  );
}
