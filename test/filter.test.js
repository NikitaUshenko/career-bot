import test from "node:test";
import assert from "node:assert/strict";
import { prefilterJob } from "../src/filter.js";

function job(overrides = {}) {
  return {
    title: "Senior Software Engineer",
    location: "Amsterdam, Netherlands",
    department: "Engineering",
    description: "Build React and TypeScript web applications.",
    ...overrides,
  };
}

test("accepts a generic software role with web signals in Amsterdam", () => {
  const result = prefilterJob(job());
  assert.equal(result.eligible, true);
  assert.equal(result.roleFamily, "engineering");
});

test("accepts senior product design", () => {
  const result = prefilterJob(job({ title: "Senior Product Designer", description: "Complex B2B SaaS." }));
  assert.equal(result.eligible, true);
  assert.equal(result.roleFamily, "design");
});

test("rejects a US-only role", () => {
  const result = prefilterJob(job({ location: "San Francisco, California" }));
  assert.equal(result.eligible, false);
});

test("rejects a backend-only role", () => {
  const result = prefilterJob(job({
    title: "Senior Software Engineer - Backend",
    description: "Java distributed systems and databases.",
  }));
  assert.equal(result.eligible, false);
});

test("rejects a backend title even when its description mentions web technologies", () => {
  const result = prefilterJob(job({
    title: "Backend Software Engineer",
    description: "Backend services that support our website, using Node.js, TypeScript, and JSX.",
  }));
  assert.equal(result.eligible, false);
  assert.equal(result.reason, "Excluded backend-only role");
});
