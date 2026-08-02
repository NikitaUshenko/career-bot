import { escapeHtml, fetchJson, formatEuro, sleep, truncate } from "./utils.js";

export async function sendTelegramMessage({ token, chatId, text, buttonUrl, buttonLabel = "Open official job" }) {
  if (!token || !chatId) throw new Error("TELEGRAM_BOT_TOKEN and TELEGRAM_CHAT_ID are required");

  const endpoint = `https://api.telegram.org/bot${token}/sendMessage`;
  const body = {
    chat_id: chatId,
    text: truncate(text, 4096),
    parse_mode: "HTML",
    disable_web_page_preview: true,
  };

  if (buttonUrl) {
    body.reply_markup = {
      inline_keyboard: [[{ text: buttonLabel, url: buttonUrl }]],
    };
  }

  try {
    return await fetchJson(endpoint, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    }, 1);
  } catch (error) {
    const retryMatch = String(error.message).match(/"retry_after"\s*:\s*(\d+)/);
    if (!retryMatch) throw error;
    await sleep(Number(retryMatch[1]) * 1000);
    return fetchJson(endpoint, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    }, 0);
  }
}

function decisionLabel(decision) {
  if (decision === "strong") return "🟢 Strong pay match";
  if (decision === "possible") return "🟡 Possible pay match";
  if (decision === "unconfigured") return "🔵 Pay threshold not configured";
  return "⚪ Below configured threshold";
}

export function buildJobMessage({ job, analysis, publishedSalary, evaluation }) {
  const salarySource = evaluation.salarySource === "published-base"
    ? "base salary published in vacancy"
    : `AI estimate · ${analysis.confidence} confidence`;
  const reasons = analysis.reasons.slice(0, 3).map((reason) => `• ${escapeHtml(reason)}`).join("\n");
  const concerns = analysis.concerns.slice(0, 2).map((reason) => `• ${escapeHtml(reason)}`).join("\n");

  const lines = [
    `<b>${escapeHtml(job.title)}</b>`,
    `${escapeHtml(job.company)} · ${escapeHtml(job.location || "Location not specified")}`,
    "",
    `<b>${decisionLabel(evaluation.payDecision)}</b>`,
    `Role: ${escapeHtml(analysis.roleFamily)} · ${escapeHtml(analysis.seniority)} · match ${analysis.matchScore}/100`,
    `Base: <b>${formatEuro(evaluation.salaryMin)}–${formatEuro(evaluation.salaryMax)}</b> (${escapeHtml(salarySource)})`,
    `Total comp estimate: ${formatEuro(analysis.estimatedTotalCompMin)}–${formatEuro(analysis.estimatedTotalCompMax)}`,
  ];

  if (publishedSalary && evaluation.salarySource !== "published-base") {
    lines.push(`Detected vacancy range: ${formatEuro(publishedSalary.min)}–${formatEuro(publishedSalary.max)} (${escapeHtml(analysis.publishedSalaryType)})`);
  }

  if (evaluation.target > 0) {
    lines.push(`Target base: ${formatEuro(evaluation.target)} (baseline ${formatEuro(evaluation.baseline)})`);
  }

  if (analysis.summary) lines.push("", escapeHtml(analysis.summary));
  if (reasons) lines.push("", "<b>Why it matched</b>", reasons);
  if (concerns) lines.push("", "<b>Check before applying</b>", concerns);
  lines.push("", `<i>Compensation is an estimate unless marked as published base salary.</i>`);

  return lines.join("\n");
}
