import { fetchJson, stripHtml } from "../utils.js";

export async function fetchLeverJobs(company) {
  const { site, region = "global" } = company.source;
  const host = region === "eu" ? "https://api.eu.lever.co" : "https://api.lever.co";
  const feedUrl = `${host}/v0/postings/${encodeURIComponent(site)}?mode=json`;
  const payload = await fetchJson(feedUrl);

  if (!Array.isArray(payload)) {
    throw new Error(`Unexpected Lever response for ${company.name}`);
  }

  return payload.map((job) => ({
    sourceType: "lever",
    sourceId: String(job.id),
    companyId: company.id,
    company: company.name,
    careersUrl: company.careersUrl,
    officialUrl: job.hostedUrl ?? job.applyUrl,
    title: job.text ?? "Untitled role",
    location: job.categories?.allLocations?.join("; ") ?? job.categories?.location ?? "",
    workplaceType: job.workplaceType ?? "unknown",
    department: job.categories?.department ?? job.categories?.team ?? "",
    description: job.descriptionPlain ?? stripHtml(job.description ?? ""),
    publishedAt: null,
    rawSalary: job.salaryRange ?? job.salaryDescriptionPlain ?? null,
    fetchedFrom: feedUrl,
  }));
}
