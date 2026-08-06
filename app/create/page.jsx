import StringArtGenerator from "../../components/StringArtGenerator.jsx";

export const metadata = {
  title: "Безкоштовний генератор String Art за фото",
  description: "Створіть персональний макет String Art онлайн: завантажте фото, налаштуйте кадр і отримайте послідовність з'єднання пронумерованих точок.",
  alternates: {
    canonical: "/create",
  },
  openGraph: {
    url: "/create",
    title: "Безкоштовний генератор String Art за фото",
    description: "Створіть персональний макет картини ниткою зі свого фото онлайн.",
  },
};

export default function CreatePage() {
  return <StringArtGenerator />;
}
