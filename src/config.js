import fs from "node:fs";
import path from "node:path";
import { parseBoolean, parseNumber } from "./utils.js";

export function loadConfig() {
  const companiesPath = path.resolve(process.env.COMPANIES_FILE ?? "config/companies.json");
  const companies = JSON.parse(fs.readFileSync(companiesPath, "utf8"));

  if (!Array.isArray(companies)) throw new Error("config/companies.json must contain an array");

  for (const company of companies) {
    if (!company.id || !company.name || !company.source?.type) {
      throw new Error(`Invalid company configuration: ${JSON.stringify(company)}`);
    }
  }

  return {
    companies: companies.filter((company) => company.enabled !== false),
    statePath: path.resolve(process.env.STATE_FILE ?? "data/state.json"),
    geminiApiKey: process.env.GEMINI_API_KEY ?? "",
    geminiModel: process.env.GEMINI_MODEL ?? "gemini-3.5-flash-lite",
    geminiUseGoogleSearch: parseBoolean(process.env.GEMINI_USE_GOOGLE_SEARCH, false),
    telegramBotToken: process.env.TELEGRAM_BOT_TOKEN ?? "",
    telegramChatId: process.env.TELEGRAM_CHAT_ID ?? "",
    engineeringBaseline: parseNumber(process.env.ENGINEERING_BASELINE_EUR, 0),
    designBaseline: parseNumber(process.env.DESIGN_BASELINE_EUR, 0),
    desiredImprovementPercent: parseNumber(process.env.DESIRED_IMPROVEMENT_PERCENT, 10),
    minMatchScore: parseNumber(process.env.MIN_MATCH_SCORE, 70),
    includePossibleMatches: parseBoolean(process.env.INCLUDE_POSSIBLE_MATCHES, true),
    maxAiJobsPerRun: parseNumber(process.env.MAX_AI_JOBS_PER_RUN, 30),
    sendScanSummary: parseBoolean(process.env.SEND_SCAN_SUMMARY, false),
    sendSourceErrors: parseBoolean(process.env.SEND_SOURCE_ERRORS, true),
    notifyUpdates: parseBoolean(process.env.NOTIFY_UPDATES, false),
  };
}
