import { formatTelegramOrder, normalizeOrderRequest } from "../../../core/order-request.js";

export const runtime = "nodejs";

const requestWindows = new Map();
const RATE_LIMIT_WINDOW_MS = 60_000;
const RATE_LIMIT_MAX_REQUESTS = 4;

export async function POST(request) {
  if (!isSameOriginRequest(request)) {
    return Response.json({ error: "forbidden" }, { status: 403 });
  }

  const clientId = getClientId(request);
  if (isRateLimited(clientId)) {
    return Response.json({ error: "rateLimited" }, { status: 429 });
  }

  let payload;
  try {
    payload = await request.json();
  } catch {
    return Response.json({ error: "invalidRequest" }, { status: 400 });
  }

  const normalized = normalizeOrderRequest(payload);
  if (!normalized.valid) {
    return Response.json({ error: normalized.error }, { status: 400 });
  }

  const order = normalized.value;
  if (order.website) return Response.json({ ok: true });

  const token = process.env.TELEGRAM_BOT_TOKEN;
  const chatId = process.env.TELEGRAM_CHAT_ID;
  if (!token || !chatId) {
    console.error("Telegram order notifications are not configured");
    return Response.json({ error: "notConfigured" }, { status: 503 });
  }

  const telegramPayload = {
    chat_id: chatId,
    text: formatTelegramOrder(order),
    disable_web_page_preview: true,
  };
  const threadId = Number.parseInt(process.env.TELEGRAM_MESSAGE_THREAD_ID || "", 10);
  if (Number.isInteger(threadId) && threadId > 0) {
    telegramPayload.message_thread_id = threadId;
  }

  try {
    const response = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(telegramPayload),
      signal: AbortSignal.timeout(8_000),
      cache: "no-store",
    });
    if (!response.ok) {
      const details = await readTelegramError(response);
      console.error("Telegram order notification failed", response.status, details.description);
      return Response.json(
        { error: classifyTelegramError(response.status, details.description) },
        { status: 502 },
      );
    }
  } catch (error) {
    console.error("Telegram order notification failed", error?.message || error);
    return Response.json({ error: "deliveryFailed" }, { status: 502 });
  }

  return Response.json({ ok: true });
}

async function readTelegramError(response) {
  try {
    const payload = await response.json();
    return { description: String(payload?.description || "Unknown Telegram error").slice(0, 300) };
  } catch {
    return { description: "Unreadable Telegram error" };
  }
}

function classifyTelegramError(status, description) {
  const message = description.toLowerCase();
  if (status === 401 || message.includes("unauthorized")) return "telegramUnauthorized";
  if (message.includes("chat not found")) return "telegramChatNotFound";
  if (message.includes("message thread not found")) return "telegramThreadNotFound";
  if (message.includes("bot was blocked") || message.includes("bot is blocked")) return "telegramBlocked";
  return "deliveryFailed";
}

function isSameOriginRequest(request) {
  const origin = request.headers.get("origin");
  const host = request.headers.get("x-forwarded-host") || request.headers.get("host");
  if (!origin || !host) return true;
  try {
    return new URL(origin).host === host;
  } catch {
    return false;
  }
}

function getClientId(request) {
  return request.headers.get("x-forwarded-for")?.split(",")[0]?.trim()
    || request.headers.get("x-real-ip")
    || "unknown";
}

function isRateLimited(clientId) {
  const now = Date.now();
  const existing = requestWindows.get(clientId);
  if (!existing || now - existing.startedAt >= RATE_LIMIT_WINDOW_MS) {
    requestWindows.set(clientId, { startedAt: now, count: 1 });
    return false;
  }
  existing.count += 1;
  return existing.count > RATE_LIMIT_MAX_REQUESTS;
}
