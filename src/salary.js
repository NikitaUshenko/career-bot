import { normalizeWhitespace } from "./utils.js";

function toAnnual(amount, period) {
  if (period === "month") return amount * 12;
  if (period === "hour") return amount * 40 * 52;
  return amount;
}

function parseAmount(raw) {
  const value = String(raw).toLowerCase().replace(/\s/g, "").replace(/,/g, "");
  const numeric = Number.parseFloat(value.replace(/[^0-9.]/g, ""));
  if (!Number.isFinite(numeric)) return null;
  return /k\b/.test(value) ? numeric * 1000 : numeric;
}

export function extractPublishedSalary(job) {
  if (job.rawSalary && typeof job.rawSalary === "object") {
    const min = Number(job.rawSalary.min ?? job.rawSalary.minimum);
    const max = Number(job.rawSalary.max ?? job.rawSalary.maximum);
    const currency = String(job.rawSalary.currency ?? "").toUpperCase();
    const interval = String(job.rawSalary.interval ?? job.rawSalary.period ?? "year").toLowerCase();

    if (currency === "EUR" && Number.isFinite(min) && Number.isFinite(max)) {
      return {
        currency: "EUR",
        min: Math.round(toAnnual(min, interval)),
        max: Math.round(toAnnual(max, interval)),
        source: "published-structured",
      };
    }
  }

  const text = normalizeWhitespace(
    `${typeof job.rawSalary === "string" ? job.rawSalary : ""} ${job.description}`,
  );

  const patterns = [
    /(?:€|eur\s*)(\d{2,3}(?:[.,]\d{3})?|\d{2,3}k)\s*(?:-|–|—|to)\s*(?:€|eur\s*)?(\d{2,3}(?:[.,]\d{3})?|\d{2,3}k)(?:\s*(?:per|\/)?\s*(year|annual|annum|month|hour))?/i,
    /(\d{2,3}(?:[.,]\d{3})?|\d{2,3}k)\s*(?:-|–|—|to)\s*(\d{2,3}(?:[.,]\d{3})?|\d{2,3}k)\s*(?:eur|€)(?:\s*(?:per|\/)?\s*(year|annual|annum|month|hour))?/i,
  ];

  for (const pattern of patterns) {
    const match = text.match(pattern);
    if (!match) continue;

    let min = parseAmount(match[1]);
    let max = parseAmount(match[2]);
    const periodText = String(match[3] ?? "year").toLowerCase();
    const period = periodText.includes("month")
      ? "month"
      : periodText.includes("hour")
        ? "hour"
        : "year";

    if (!min || !max) continue;
    if (min < 1000 && period === "year") min *= 1000;
    if (max < 1000 && period === "year") max *= 1000;

    min = toAnnual(min, period);
    max = toAnnual(max, period);

    if (min >= 25_000 && max <= 500_000 && min <= max) {
      return {
        currency: "EUR",
        min: Math.round(min),
        max: Math.round(max),
        source: "published-text",
      };
    }
  }

  return null;
}
