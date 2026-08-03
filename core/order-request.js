const PHONE_MIN_DIGITS = 7;
const PHONE_MAX_DIGITS = 15;

export function normalizeOrderRequest(payload) {
  const phone = String(payload?.phone || "").trim().slice(0, 40);
  const digits = phone.replace(/\D/g, "");
  if (digits.length < PHONE_MIN_DIGITS || digits.length > PHONE_MAX_DIGITS) {
    return { valid: false, error: "invalidPhone" };
  }

  return {
    valid: true,
    value: {
      phone,
      contactViaMessengers: payload?.contactViaMessengers === true,
      selfGeneratePattern: payload?.selfGeneratePattern === true,
      language: payload?.language === "en" ? "en" : "uk",
      source: String(payload?.source || "landing").slice(0, 60),
      website: String(payload?.website || "").slice(0, 120),
    },
  };
}

export function formatTelegramOrder(order) {
  const messengerPreference = order.contactViaMessengers ? "Так" : "Ні";
  const patternPreference = order.selfGeneratePattern
    ? "Клієнт хоче створити макет самостійно"
    : "Потрібна допомога зі створенням макета";

  return [
    "🧵 Нова заявка на String Art набір",
    "",
    `Телефон: ${order.phone}`,
    `Зв'язатися через месенджери: ${messengerPreference}`,
    `Макет: ${patternPreference}`,
    `Мова сайту: ${order.language === "en" ? "English" : "Українська"}`,
    `Джерело: ${order.source}`,
  ].join("\n");
}
