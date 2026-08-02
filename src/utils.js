import crypto from "node:crypto";

export function normalizeWhitespace(value = "") {
  return String(value).replace(/\s+/g, " ").trim();
}

export function decodeHtmlEntities(value = "") {
  return String(value)
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/&quot;/gi, '"')
    .replace(/&#39;|&apos;/gi, "'")
    .replace(/&#(\d+);/g, (_, code) => String.fromCodePoint(Number(code)))
    .replace(/&#x([0-9a-f]+);/gi, (_, code) => String.fromCodePoint(parseInt(code, 16)));
}

export function stripHtml(value = "") {
  const withBreaks = String(value)
    .replace(/<\s*br\s*\/?\s*>/gi, "\n")
    .replace(/<\/(p|li|div|h[1-6]|section)>/gi, "\n")
    .replace(/<li[^>]*>/gi, "• ");
  return normalizeWhitespace(decodeHtmlEntities(withBreaks.replace(/<[^>]+>/g, " ")));
}

export function sha256(value) {
  return crypto.createHash("sha256").update(String(value)).digest("hex");
}

export function contentHash(job) {
  return sha256([job.title, job.location, job.description, job.officialUrl].join("\n"));
}

export function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export function parseBoolean(value, fallback = false) {
  if (value == null || value === "") return fallback;
  return ["1", "true", "yes", "on"].includes(String(value).toLowerCase());
}

export function parseNumber(value, fallback = 0) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

export function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

export function truncate(value, maxLength) {
  const text = String(value ?? "");
  return text.length <= maxLength ? text : `${text.slice(0, maxLength - 1)}…`;
}

export function escapeHtml(value = "") {
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

export function formatEuro(value) {
  if (!Number.isFinite(value) || value <= 0) return "unknown";
  return new Intl.NumberFormat("en-NL", {
    style: "currency",
    currency: "EUR",
    maximumFractionDigits: 0,
  }).format(value);
}

export async function fetchJson(url, options = {}, retryCount = 2) {
  let lastError;

  for (let attempt = 0; attempt <= retryCount; attempt += 1) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), options.timeoutMs ?? 30_000);

    try {
      const response = await fetch(url, {
        ...options,
        signal: controller.signal,
        headers: {
          Accept: "application/json",
          "User-Agent": "career-watch-telegram/1.0",
          ...(options.headers ?? {}),
        },
      });

      const text = await response.text();
      if (!response.ok) {
        throw new Error(`HTTP ${response.status} from ${url}: ${truncate(text, 300)}`);
      }

      return text ? JSON.parse(text) : null;
    } catch (error) {
      lastError = error;
      if (attempt < retryCount) await sleep(500 * 2 ** attempt);
    } finally {
      clearTimeout(timeout);
    }
  }

  throw lastError;
}
