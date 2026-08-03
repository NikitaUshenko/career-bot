import { fetchJson, stripHtml } from "../utils.js";

export async function fetchAmazonJobs(company) {
  const { searchUrl } = company.source;
  const payload = await fetchJson(searchUrl);

  if (!Array.isArray(payload?.jobs)) {
    throw new Error(`Unexpected Amazon Jobs response for ${company.name}`);
  }

  return payload.jobs.map((job) => ({
    sourceType: "amazon",
    sourceId: String(job.id_icims ?? job.id),
    companyId: company.id,
    company: company.name,
    careersUrl: company.careersUrl,
    officialUrl: new URL(job.job_path, "https://www.amazon.jobs").href,
    title: job.title ?? "Untitled role",
    location: job.normalized_location ?? job.location ?? "",
    workplaceType: "unknown",
    department: job.job_category ?? job.business_category ?? "",
    description: stripHtml([
      job.description,
      job.basic_qualifications,
      job.preferred_qualifications,
    ].filter(Boolean).join("\n")),
    publishedAt: job.posted_date ?? null,
    rawSalary: null,
    fetchedFrom: searchUrl,
  }));
}
