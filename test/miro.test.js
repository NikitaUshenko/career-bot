import test from "node:test";
import assert from "node:assert/strict";
import { fetchMiroJobs } from "../src/adapters/miro.js";

const company = {
  id: "miro",
  name: "Miro",
  careersUrl: "https://miro.com/careers/open-positions/",
  source: {
    type: "miro",
    jobsUrl: "https://miro.com/careers/open-positions/",
    vacancyBaseUrl: "https://miro.com/careers/vacancy",
  },
};

function nextData(pageProps) {
  return `<html><script id="__NEXT_DATA__" type="application/json">${JSON.stringify({ props: { pageProps } })}</script></html>`;
}

test("normalizes Miro jobs and fetches descriptions only for possible candidates", async () => {
  const originalFetch = global.fetch;
  const requestedUrls = [];
  global.fetch = async (url) => {
    requestedUrls.push(String(url));
    if (String(url).endsWith("/open-positions/")) {
      return new Response(nextData({
        jobs: [
          {
            id: 123,
            title: "Staff Design Engineer",
            location: "Amsterdam, NL; Remote Europe",
            departmentName: "Design",
          },
          {
            id: 456,
            title: "Account Executive",
            location: "Amsterdam, NL",
            departmentName: "Sales",
          },
        ],
        departmentsWithJobs: [{
          jobs: [{ id: 123, first_published: "2026-08-03T08:00:00Z" }],
        }],
      }), { status: 200 });
    }
    return new Response(nextData({ content: "<p>Build canvas experiences with React &amp; TypeScript.</p>" }), {
      status: 200,
    });
  };

  try {
    const jobs = await fetchMiroJobs(company);
    assert.equal(jobs.length, 2);
    assert.equal(jobs[0].description, "Build canvas experiences with React & TypeScript.");
    assert.equal(jobs[0].publishedAt, "2026-08-03T08:00:00Z");
    assert.equal(jobs[0].workplaceType, "remote");
    assert.equal(jobs[1].description, "");
    assert.deepEqual(requestedUrls, [
      "https://miro.com/careers/open-positions/",
      "https://miro.com/careers/vacancy/123",
    ]);
  } finally {
    global.fetch = originalFetch;
  }
});
