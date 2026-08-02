import test from "node:test";
import assert from "node:assert/strict";
import { touchJob } from "../src/state.js";

const sample = {
  sourceType: "greenhouse",
  sourceId: "123",
  companyId: "example",
  company: "Example",
  title: "Senior Frontend Engineer",
  location: "Amsterdam, Netherlands",
  description: "React and TypeScript",
  officialUrl: "https://example.com/jobs/123",
};

test("touchJob creates a pending record and preserves it on later scans", () => {
  const state = { version: 1, initializedAt: "2026-08-02T00:00:00.000Z", jobs: {} };
  const first = touchJob(state, sample, "2026-08-02T08:00:00.000Z");
  assert.equal(first.isNew, true);
  assert.equal(first.record.processedAt, null);

  const second = touchJob(state, sample, "2026-08-02T20:00:00.000Z");
  assert.equal(second.isNew, false);
  assert.equal(second.record.processedAt, null);
  assert.equal(second.record.lastSeenAt, "2026-08-02T20:00:00.000Z");
});
