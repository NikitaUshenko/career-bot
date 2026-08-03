import { fetchJson, normalizeWhitespace } from "../utils.js";

function descriptionText(description = {}) {
  const body = Array.isArray(description.body) ? description.body : [];
  const sections = Array.isArray(description.sections)
    ? description.sections.flatMap((section) => [
      section.title,
      ...(Array.isArray(section.items) ? section.items.map((item) => item.text) : []),
    ])
    : [];
  return normalizeWhitespace([...body, ...sections].filter(Boolean).join("\n"));
}

export async function fetchTomTomJobs(company) {
  const { apiUrl, jobBaseUrl } = company.source;
  const payload = await fetchJson(apiUrl);
  if (!Array.isArray(payload?.jobs)) throw new Error(`Unexpected TomTom Careers response for ${company.name}`);

  return payload.jobs.map((job) => ({
    sourceType: "tomtom",
    sourceId: String(job.jobId),
    companyId: company.id,
    company: company.name,
    careersUrl: company.careersUrl,
    officialUrl: `${jobBaseUrl}/${encodeURIComponent(job.jobId)}/${job.slug}/`,
    title: job.title ?? "Untitled role",
    location: job.location ?? "",
    workplaceType: job.workplaceType ?? "unknown",
    department: [job.categoryLabel, job.team, job.department].filter(Boolean).join(" / "),
    description: descriptionText(job.description),
    publishedAt: job.createdAt ? new Date(job.createdAt).toISOString() : null,
    rawSalary: null,
    fetchedFrom: apiUrl,
  }));
}
