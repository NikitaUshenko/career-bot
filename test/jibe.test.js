import test from "node:test";
import assert from "node:assert/strict";
import { fetchJibeJobs } from "../src/adapters/jibe.js";

const company = {
  id: "booking",
  name: "Booking.com",
  careersUrl: "https://jobs.booking.com/booking/jobs",
  source: {
    type: "jibe",
    apiUrl: "https://jobs.booking.com/api/jobs",
    jobBaseUrl: "https://jobs.booking.com/booking/jobs",
    brand: "Booking.com",
  },
};

test("normalizes and brand-filters jobs from a Jibe careers API", async () => {
  const originalFetch = global.fetch;
  global.fetch = async () => new Response(JSON.stringify({
    jobs: [
      {
        data: {
          slug: "12345",
          req_id: "12345",
          title: "Senior Frontend Software Engineer",
          description: "<p>Build with React &amp; TypeScript.</p>",
          full_location: "Amsterdam, Netherlands",
          categories: [{ name: "Engineering" }],
          brand: "Booking.com",
          posted_date: "2026-08-03T08:00:00+0000",
          meta_data: {
            canonical_url: "https://jobs.booking.com/booking/jobs/12345?lang=en-us",
          },
        },
      },
      {
        data: {
          slug: "99999",
          title: "Unrelated holding-company role",
          brand: "Booking Holdings",
        },
      },
    ],
  }), { status: 200, headers: { "content-type": "application/json" } });

  try {
    const jobs = await fetchJibeJobs(company);
    assert.equal(jobs.length, 1);
    assert.equal(jobs[0].sourceId, "12345");
    assert.equal(jobs[0].location, "Amsterdam, Netherlands");
    assert.equal(jobs[0].department, "Engineering");
    assert.equal(jobs[0].description, "Build with React & TypeScript.");
    assert.equal(jobs[0].officialUrl, "https://jobs.booking.com/booking/jobs/12345?lang=en-us");
  } finally {
    global.fetch = originalFetch;
  }
});

test("retrieves every page from a Jibe careers API", async () => {
  const originalFetch = global.fetch;
  const requestedPages = [];
  global.fetch = async (url) => {
    const page = Number(new URL(url).searchParams.get("page"));
    requestedPages.push(page);
    const jobs = page === 1
      ? Array.from({ length: 100 }, (_, index) => ({
        data: { slug: String(index), title: `Role ${index}`, brand: "Booking.com" },
      }))
      : [{ data: { slug: "100", title: "Role 100", brand: "Booking.com" } }];
    return new Response(JSON.stringify({ jobs, totalCount: 101 }), {
      status: 200,
      headers: { "content-type": "application/json" },
    });
  };

  try {
    const jobs = await fetchJibeJobs(company);
    assert.equal(jobs.length, 101);
    assert.deepEqual(requestedPages, [1, 2]);
  } finally {
    global.fetch = originalFetch;
  }
});
