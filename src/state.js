import fs from "node:fs";
import path from "node:path";
import { contentHash, sha256 } from "./utils.js";

export function jobKey(job) {
  const sourceId = job.sourceId || sha256(`${job.title}|${job.location}|${job.officialUrl}`).slice(0, 20);
  return `${job.companyId}:${job.sourceType}:${sourceId}`;
}

export function loadState(statePath) {
  if (!fs.existsSync(statePath)) {
    return { version: 1, initializedAt: null, jobs: {} };
  }

  const state = JSON.parse(fs.readFileSync(statePath, "utf8"));
  if (!state.jobs || typeof state.jobs !== "object") state.jobs = {};
  return state;
}

export function touchJob(state, job, now) {
  const key = jobKey(job);
  const hash = contentHash(job);
  const existing = state.jobs[key];

  if (!existing) {
    state.jobs[key] = {
      company: job.company,
      title: job.title,
      location: job.location,
      officialUrl: job.officialUrl,
      firstSeenAt: now,
      lastSeenAt: now,
      contentHash: hash,
      processedAt: null,
      notifiedAt: null,
      decision: null,
    };
    return { key, isNew: true, changed: false, record: state.jobs[key] };
  }

  const changed = existing.contentHash !== hash;
  existing.lastSeenAt = now;
  existing.company = job.company;
  existing.title = job.title;
  existing.location = job.location;
  existing.officialUrl = job.officialUrl;
  existing.contentHash = hash;

  return { key, isNew: false, changed, record: existing };
}

export function saveState(statePath, state) {
  fs.mkdirSync(path.dirname(statePath), { recursive: true });
  const tempPath = `${statePath}.tmp`;
  fs.writeFileSync(tempPath, `${JSON.stringify(state, null, 2)}\n`);
  fs.renameSync(tempPath, statePath);
}
