import test from "node:test";
import assert from "node:assert/strict";
import { evaluateJob } from "../src/decision.js";

const config = {
  engineeringBaseline: 100000,
  designBaseline: 75000,
  desiredImprovementPercent: 10,
  minMatchScore: 70,
  includePossibleMatches: true,
};

function analysis(overrides = {}) {
  return {
    relevant: true,
    roleFamily: "engineering",
    matchScore: 90,
    publishedSalaryType: "none",
    estimatedBaseMin: 112000,
    estimatedBaseMax: 125000,
    ...overrides,
  };
}

test("marks conservative salary above target as strong", () => {
  const result = evaluateJob({ analysis: analysis(), publishedSalary: null, config });
  assert.equal(result.payDecision, "strong");
  assert.equal(result.shouldNotify, true);
});

test("marks overlapping range as possible", () => {
  const result = evaluateJob({
    analysis: analysis({ estimatedBaseMin: 100000, estimatedBaseMax: 115000 }),
    publishedSalary: null,
    config,
  });
  assert.equal(result.payDecision, "possible");
});

test("uses a published range only when AI identifies it as base salary", () => {
  const publishedSalary = { min: 120000, max: 140000, currency: "EUR" };

  const baseResult = evaluateJob({
    analysis: analysis({ publishedSalaryType: "base", estimatedBaseMin: 90000, estimatedBaseMax: 100000 }),
    publishedSalary,
    config,
  });
  assert.equal(baseResult.salarySource, "published-base");
  assert.equal(baseResult.payDecision, "strong");

  const totalCompResult = evaluateJob({
    analysis: analysis({ publishedSalaryType: "total-comp", estimatedBaseMin: 90000, estimatedBaseMax: 100000 }),
    publishedSalary,
    config,
  });
  assert.equal(totalCompResult.salarySource, "ai-estimate");
  assert.equal(totalCompResult.payDecision, "below");
});
