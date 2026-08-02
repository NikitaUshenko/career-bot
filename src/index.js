import path from "node:path";
import { analyzeJobWithGemini } from "./ai/gemini.js";
import { fetchCompanyJobs } from "./adapters/index.js";
import { loadConfig } from "./config.js";
import { evaluateJob } from "./decision.js";
import { loadDotEnv } from "./env.js";
import { prefilterJob } from "./filter.js";
import { extractPublishedSalary } from "./salary.js";
import { jobKey, loadState, saveState, touchJob } from "./state.js";
import { buildJobMessage, sendTelegramMessage } from "./telegram.js";
import { sleep } from "./utils.js";

loadDotEnv(path.resolve(".env"));

const flags = new Set(process.argv.slice(2));
const notifyExisting = flags.has("--notify-existing");
const dryRun = flags.has("--dry-run");

async function main() {
  const config = loadConfig();
  const state = loadState(config.statePath);
  const now = new Date().toISOString();

  console.log(`Scanning ${config.companies.length} official career feeds...`);

  const results = await Promise.allSettled(
    config.companies.map(async (company) => ({ company, jobs: await fetchCompanyJobs(company) })),
  );

  const jobs = [];
  const sourceErrors = [];
  let successfulSources = 0;

  for (const [index, result] of results.entries()) {
    const company = config.companies[index];
    if (result.status === "fulfilled") {
      successfulSources += 1;
      console.log(`${result.value.company.name}: ${result.value.jobs.length} jobs`);
      jobs.push(...result.value.jobs);
    } else {
      const detail = String(result.reason?.message ?? result.reason);
      const message = `${company.name}: ${detail}`;
      sourceErrors.push(message);
      console.error(message);
    }
  }

  if (successfulSources === 0) {
    throw new Error("All career sources failed. State was not changed; rerun when network access is available.");
  }

  if (!state.initializedAt && !notifyExisting && sourceErrors.length > 0) {
    throw new Error(
      `Initial baseline aborted because ${sourceErrors.length} of ${config.companies.length} sources failed. ` +
      "Fix or disable the failing sources, then rerun so existing jobs are not misclassified as new later.",
    );
  }

  const uniqueJobs = [...new Map(jobs.map((job) => [jobKey(job), job])).values()];
  const pending = [];

  for (const job of uniqueJobs) {
    const touched = touchJob(state, job, now);
    const needsProcessing =
      touched.isNew ||
      !touched.record.processedAt ||
      (notifyExisting && touched.record.decision === "initial-baseline") ||
      (config.notifyUpdates && touched.changed);

    if (needsProcessing) pending.push({ job, record: touched.record });
  }

  if (!state.initializedAt && !notifyExisting) {
    for (const { job } of pending) {
      const record = state.jobs[jobKey(job)];
      record.processedAt = now;
      record.decision = "initial-baseline";
    }
    state.initializedAt = now;
    if (!dryRun) saveState(config.statePath, state);
    console.log(`Initial baseline created with ${uniqueJobs.length} jobs. No notifications sent.`);
    console.log("Run `npm run scan:existing` to evaluate and notify about currently open roles instead.");
    return;
  }

  if (!state.initializedAt) state.initializedAt = now;

  const eligible = [];
  for (const item of pending) {
    const prefilter = prefilterJob(item.job);
    if (!prefilter.eligible) {
      item.record.processedAt = now;
      item.record.decision = `filtered: ${prefilter.reason}`;
      continue;
    }
    eligible.push({ ...item, prefilter });
  }

  const queued = eligible.slice(0, config.maxAiJobsPerRun);
  let sent = 0;
  let analyzed = 0;
  let failures = 0;

  for (const item of queued) {
    try {
      const publishedSalary = extractPublishedSalary(item.job);
      const analysis = await analyzeJobWithGemini({
        job: item.job,
        prefilter: item.prefilter,
        publishedSalary,
        apiKey: config.geminiApiKey,
        model: config.geminiModel,
        useGoogleSearch: config.geminiUseGoogleSearch,
      });
      analyzed += 1;

      const evaluation = evaluateJob({ analysis, publishedSalary, config });
      item.record.processedAt = now;
      item.record.decision = evaluation.payDecision;
      item.record.analysis = {
        roleFamily: analysis.roleFamily,
        matchScore: analysis.matchScore,
        baseMin: evaluation.salaryMin,
        baseMax: evaluation.salaryMax,
        confidence: analysis.confidence,
      };

      if (!evaluation.shouldNotify) continue;

      const message = buildJobMessage({
        job: item.job,
        analysis,
        publishedSalary,
        evaluation,
      });

      if (dryRun) {
        console.log("\n--- TELEGRAM MESSAGE ---\n");
        console.log(message.replace(/<[^>]+>/g, ""));
        console.log(item.job.officialUrl);
      } else {
        await sendTelegramMessage({
          token: config.telegramBotToken,
          chatId: config.telegramChatId,
          text: message,
          buttonUrl: item.job.officialUrl,
        });
        await sleep(150);
      }

      item.record.notifiedAt = now;
      sent += 1;
    } catch (error) {
      failures += 1;
      item.record.lastProcessingError = String(error.message ?? error);
      console.error(`Failed to process ${item.job.company} — ${item.job.title}:`, error);
    }
  }

  if (!dryRun) saveState(config.statePath, state);

  const summary = [
    `Career scan complete`,
    `Sources: ${config.companies.length - sourceErrors.length}/${config.companies.length}`,
    `Open jobs fetched: ${uniqueJobs.length}`,
    `New/updated jobs pending: ${pending.length}`,
    `AI-analyzed: ${analyzed}`,
    `Telegram notifications: ${sent}`,
    `Processing failures: ${failures}`,
  ].join("\n");

  console.log(summary);

  if (!dryRun && config.sendScanSummary) {
    await sendTelegramMessage({
      token: config.telegramBotToken,
      chatId: config.telegramChatId,
      text: `<b>Career scan complete</b>\nSources: ${config.companies.length - sourceErrors.length}/${config.companies.length}\nOpen jobs: ${uniqueJobs.length}\nAnalyzed: ${analyzed}\nNotifications: ${sent}\nFailures: ${failures}`,
    });
  }

  if (!dryRun && config.sendSourceErrors && sourceErrors.length > 0) {
    await sendTelegramMessage({
      token: config.telegramBotToken,
      chatId: config.telegramChatId,
      text: `<b>Career source errors</b>\n${sourceErrors.slice(0, 8).map((error) => `• ${error}`).join("\n")}`,
    });
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
