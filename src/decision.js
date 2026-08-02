export function evaluateJob({ analysis, publishedSalary, config }) {
  const roleFamily = analysis.roleFamily;
  const baseline = roleFamily === "engineering"
    ? config.engineeringBaseline
    : roleFamily === "design"
      ? config.designBaseline
      : 0;
  const target = baseline > 0
    ? Math.round(baseline * (1 + config.desiredImprovementPercent / 100))
    : 0;

  const publishedBaseIsUsable =
    publishedSalary != null && analysis.publishedSalaryType === "base";
  const salaryMin = publishedBaseIsUsable
    ? publishedSalary.min
    : analysis.estimatedBaseMin;
  const salaryMax = publishedBaseIsUsable
    ? publishedSalary.max
    : analysis.estimatedBaseMax;

  let payDecision = "unconfigured";
  if (target > 0 && salaryMin >= target) payDecision = "strong";
  else if (target > 0 && salaryMax >= target) payDecision = "possible";
  else if (target > 0) payDecision = "below";

  const rolePass = analysis.relevant && ["engineering", "design"].includes(roleFamily);
  const scorePass = analysis.matchScore >= config.minMatchScore;
  const payPass =
    payDecision === "strong" ||
    payDecision === "unconfigured" ||
    (payDecision === "possible" && config.includePossibleMatches);

  return {
    baseline,
    target,
    salaryMin,
    salaryMax,
    salarySource: publishedBaseIsUsable ? "published-base" : "ai-estimate",
    payDecision,
    shouldNotify: rolePass && scorePass && payPass,
  };
}
