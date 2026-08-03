import test from "node:test";
import assert from "node:assert/strict";
import { fetchWorkdayJobs } from "../src/adapters/workday.js";

const company = {
  id: "example",
  name: "Example",
  careersUrl: "https://example.com/careers",
  source: {
    type: "workday",
    host: "https://example.wd1.myworkdayjobs.com",
    tenant: "example",
    site: "External",
  },
};

test("paginates and normalizes jobs from a Workday careers API", async () => {
  const originalFetch = global.fetch;
  const searchOffsets = [];
  const detailUrls = [];
  global.fetch = async (url, options = {}) => {
    if (String(url).endsWith("/jobs")) {
      const body = JSON.parse(options.body);
      searchOffsets.push(body.offset);
      const count = body.offset === 0 ? 20 : 1;
      const jobPostings = Array.from({ length: count }, (_, index) => {
        const number = body.offset + index + 1;
        return {
          title: `Role ${number}`,
          externalPath: `/job/Amsterdam/Role-${number}_JR${number}`,
          locationsText: "Amsterdam, Netherlands",
          bulletFields: [`JR${number}`],
        };
      });
      return new Response(JSON.stringify({ total: 21, jobPostings }), { status: 200 });
    }

    detailUrls.push(String(url));
    const reqId = String(url).match(/_(JR\d+)$/)?.[1];
    return new Response(JSON.stringify({
      jobPostingInfo: {
        title: `Senior Frontend Engineer ${reqId}`,
        jobReqId: reqId,
        location: "Amsterdam, Netherlands",
        remoteType: "Hybrid",
        startDate: "2026-08-03",
        externalUrl: `https://example.com/jobs/${reqId}`,
        jobDescription: "<p>Build with React &amp; TypeScript.</p>",
      },
    }), { status: 200 });
  };

  try {
    const jobs = await fetchWorkdayJobs(company);
    assert.equal(jobs.length, 21);
    assert.deepEqual(searchOffsets, [0, 20]);
    assert.equal(detailUrls.length, 21);
    assert.equal(jobs[0].sourceId, "JR1");
    assert.equal(jobs[0].description, "Build with React & TypeScript.");
    assert.equal(jobs[0].officialUrl, "https://example.com/jobs/JR1");
    assert.equal(jobs[0].location, "Amsterdam, Netherlands");
    assert.equal(jobs[0].publishedAt, "2026-08-03");
  } finally {
    global.fetch = originalFetch;
  }
});
