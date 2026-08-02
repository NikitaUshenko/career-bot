import test from "node:test";
import assert from "node:assert/strict";
import { fetchGreenhouseJobs } from "../src/adapters/greenhouse.js";

const company = {
  id: "example",
  name: "Example",
  careersUrl: "https://example.com/careers",
  source: { type: "greenhouse", boardToken: "example" },
};

test("normalizes a Greenhouse job from the company-specific official feed", async () => {
  const originalFetch = global.fetch;
  global.fetch = async (url) => {
    assert.match(String(url), /boards-api\.greenhouse\.io\/v1\/boards\/example\/jobs/);
    return new Response(JSON.stringify({
      jobs: [{
        id: 123,
        title: "Senior Frontend Engineer",
        location: { name: "Amsterdam, Netherlands" },
        departments: [{ name: "Engineering" }],
        content: "<p>Build with React &amp; TypeScript.</p>",
        updated_at: "2026-08-02T08:00:00Z",
        absolute_url: "https://example.com/jobs/123",
      }],
    }), { status: 200, headers: { "content-type": "application/json" } });
  };

  try {
    const jobs = await fetchGreenhouseJobs(company);
    assert.equal(jobs.length, 1);
    assert.equal(jobs[0].sourceId, "123");
    assert.equal(jobs[0].company, "Example");
    assert.equal(jobs[0].location, "Amsterdam, Netherlands");
    assert.equal(jobs[0].description, "Build with React & TypeScript.");
    assert.equal(jobs[0].officialUrl, "https://example.com/jobs/123");
  } finally {
    global.fetch = originalFetch;
  }
});
