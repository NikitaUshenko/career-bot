import test from "node:test";
import assert from "node:assert/strict";
import { analyzeJobWithGemini } from "../src/ai/gemini.js";

const job = {
  company: "Example",
  title: "Senior Frontend Engineer",
  location: "Amsterdam, Netherlands",
  workplaceType: "hybrid",
  department: "Engineering",
  officialUrl: "https://example.com/jobs/123",
  description: "Build React and TypeScript web applications.",
};

const prefilter = {
  roleFamily: "engineering",
  seniority: "senior",
};

test("sends the current Gemini structured-output request shape and normalizes the result", async () => {
  const originalFetch = global.fetch;
  let requestBody;

  global.fetch = async (_url, options) => {
    requestBody = JSON.parse(options.body);
    return new Response(JSON.stringify({
      candidates: [{
        content: {
          parts: [{
            text: JSON.stringify({
              relevant: true,
              roleFamily: "engineering",
              seniority: "senior",
              matchScore: 91,
              publishedSalaryType: "none",
              estimatedBaseMin: 105000,
              estimatedBaseMax: 120000,
              estimatedTotalCompMin: 115000,
              estimatedTotalCompMax: 140000,
              confidence: "medium",
              salaryBasis: "Comparable Dutch roles",
              summary: "Strong frontend fit.",
              reasons: ["React and TypeScript"],
              concerns: [],
            }),
          }],
        },
      }],
    }), { status: 200, headers: { "content-type": "application/json" } });
  };

  try {
    const result = await analyzeJobWithGemini({
      job,
      prefilter,
      publishedSalary: null,
      apiKey: "test-key",
      model: "gemini-3.5-flash-lite",
    });

    assert.equal(requestBody.generationConfig.responseMimeType, "application/json");
    assert.equal(requestBody.generationConfig.responseSchema.type, "object");
    assert.equal(requestBody.generationConfig.responseFormat, undefined);
    assert.equal(requestBody.tools, undefined);
    assert.equal(result.matchScore, 91);
    assert.equal(result.estimatedBaseMin, 105000);
  } finally {
    global.fetch = originalFetch;
  }
});

test("rejects Google Search grounding on an unsupported model before making a request", async () => {
  await assert.rejects(
    analyzeJobWithGemini({
      job,
      prefilter,
      publishedSalary: null,
      apiKey: "test-key",
      model: "gemini-3.5-flash-lite",
      useGoogleSearch: true,
    }),
    /gemini-3\.6-flash/,
  );
});
