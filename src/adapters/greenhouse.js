import { fetchJson, stripHtml } from "../utils.js";

export async function fetchGreenhouseJobs(company) {
  const { boardToken } = company.source;
  const feedUrl = `https://boards-api.greenhouse.io/v1/boards/${encodeURIComponent(boardToken)}/jobs?content=true`;
  const payload = await fetchJson(feedUrl);

  if (!Array.isArray(payload?.jobs)) {
    throw new Error(`Unexpected Greenhouse response for ${company.name}`);
  }

  return payload.jobs.map((job) => ({
    sourceType: "greenhouse",
    sourceId: String(job.id),
    companyId: company.id,
    company: company.name,
    careersUrl: company.careersUrl,
    officialUrl: job.absolute_url,
    title: job.title ?? "Untitled role",
    location: job.location?.name ?? "",
    workplaceType: "unknown",
    department: Array.isArray(job.departments)
      ? job.departments.map((department) => department.name).filter(Boolean).join(" / ")
      : "",
    description: stripHtml(job.content ?? ""),
    publishedAt: job.updated_at ?? null,
    rawSalary: null,
    fetchedFrom: feedUrl,
  }));
}
