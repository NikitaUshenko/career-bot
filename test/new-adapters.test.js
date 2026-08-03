import test from "node:test";
import assert from "node:assert/strict";
import { fetchAmazonJobs } from "../src/adapters/amazon.js";
import { fetchMicrosoftJobs } from "../src/adapters/microsoft.js";
import { fetchTomTomJobs } from "../src/adapters/tomtom.js";
import { fetchWebpageJobs } from "../src/adapters/webpage.js";

function response(value) {
  return new Response(typeof value === "string" ? value : JSON.stringify(value), { status: 200 });
}

test("normalizes Amazon jobs from the official search endpoint", async () => {
  const originalFetch = global.fetch;
  global.fetch = async () => response({ jobs: [{
    id_icims: "A1",
    title: "Frontend Engineer",
    normalized_location: "NLD, Amsterdam",
    job_path: "/en/jobs/A1/frontend-engineer",
    job_category: "Software Development",
    description: "<p>Build customer experiences.</p>",
    basic_qualifications: "React",
    posted_date: "August 1, 2026",
  }] });

  try {
    const jobs = await fetchAmazonJobs({
      id: "amazon", name: "Amazon", careersUrl: "https://amazon.jobs", source: { searchUrl: "https://amazon.jobs/search.json" },
    });
    assert.equal(jobs[0].sourceId, "A1");
    assert.equal(jobs[0].officialUrl, "https://www.amazon.jobs/en/jobs/A1/frontend-engineer");
    assert.match(jobs[0].description, /Build customer experiences.*React/);
  } finally {
    global.fetch = originalFetch;
  }
});

test("paginates Microsoft jobs and retrieves candidate descriptions", async () => {
  const originalFetch = global.fetch;
  const requested = [];
  global.fetch = async (url) => {
    requested.push(String(url));
    if (String(url).includes("position_details")) {
      return response({ data: { jobDescription: "<p>Build with TypeScript.</p>", salary: "competitive" } });
    }
    return response({ data: { count: 1, positions: [{
      id: "M1", name: "Software Engineer", locations: ["Amsterdam, Netherlands"],
      department: "Engineering", positionUrl: "/v2/global/en/job/M1", postedTs: 1785600000,
    }] } });
  };

  try {
    const jobs = await fetchMicrosoftJobs({
      id: "microsoft", name: "Microsoft", careersUrl: "https://careers.microsoft.com",
      source: { apiBase: "https://apply.careers.microsoft.com", domain: "microsoft.com", location: "Netherlands" },
    });
    assert.equal(jobs.length, 1);
    assert.equal(jobs[0].description, "Build with TypeScript.");
    assert.equal(requested.length, 2);
  } finally {
    global.fetch = originalFetch;
  }
});

test("normalizes TomTom's official careers JSON", async () => {
  const originalFetch = global.fetch;
  global.fetch = async () => response({ jobs: [{
    jobId: "T1", slug: "web-engineer", title: "Web Engineer", location: "Amsterdam",
    workplaceType: "Hybrid", categoryLabel: "Engineering",
    description: { body: ["Build maps."], sections: [{ title: "You have", items: [{ text: "TypeScript" }] }] },
  }] });

  try {
    const jobs = await fetchTomTomJobs({
      id: "tomtom", name: "TomTom", careersUrl: "https://tomtom.com/careers",
      source: { apiUrl: "https://tomtom.com/api/careers/jobs", jobBaseUrl: "https://tomtom.com/careers/jobdetails" },
    });
    assert.equal(jobs[0].officialUrl, "https://tomtom.com/careers/jobdetails/T1/web-engineer/");
    assert.equal(jobs[0].description, "Build maps. You have TypeScript");
  } finally {
    global.fetch = originalFetch;
  }
});

test("extracts distinct Picnic IDs and structured job details", async () => {
  const originalFetch = global.fetch;
  global.fetch = async (url) => {
    if (String(url).endsWith("/en/vacancies")) {
      const job = {
        injectables: null,
        data: {
          location: { city: "Amsterdam", state: "North Holland", country: "Netherlands" },
          search_string: "Frontend Engineer Engineering Amsterdam Netherlands",
          custom_search_string: "",
          teams: "Engineering",
        },
        _id: "OB123XYZ",
        name: "Frontend Engineer",
        visibility: "external",
        template: "auto",
        locales: ["en"],
        url: "/en/vacancies/JOB123XYZ/engineering/frontend-engineer/amsterdam/north-holland/netherlands",
      };
      return response(`<script>self.__next_f.push(${JSON.stringify([1, JSON.stringify(job)])})</script>`);
    }
    return response('<script type="application/ld+json">{"@type":"JobPosting","title":"Frontend Engineer","description":"<p>Build with React.</p>","datePosted":"2026-08-01","jobLocation":{"address":{"addressLocality":"Amsterdam","addressCountry":"Netherlands"}}}</script>');
  };

  try {
    const jobs = await fetchWebpageJobs({
      id: "picnic", name: "Picnic", careersUrl: "https://jobs.picnic.app/en/vacancies",
      source: { type: "webpage", variant: "picnic", listingUrl: "https://jobs.picnic.app/en/vacancies", linkPattern: "/(?:en/vacancies|nl/vacatures|de/jobangebot|fr/poste-vacant)/[A-Z0-9]+/" },
    });
    assert.equal(jobs[0].sourceId, "JOB123XYZ");
    assert.equal(jobs[0].location, "Amsterdam, Netherlands");
    assert.equal(jobs[0].description, "Build with React.");
  } finally {
    global.fetch = originalFetch;
  }
});
