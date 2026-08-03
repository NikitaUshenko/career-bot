import { fetchJson, stripHtml } from "../utils.js";

export async function fetchJibeJobs(company) {
  const { apiUrl, jobBaseUrl, brand } = company.source;
  const pageSize = 100;
  const entries = [];

  for (let page = 1; page <= 100; page += 1) {
    const pageUrl = new URL(apiUrl);
    pageUrl.searchParams.set("limit", String(pageSize));
    pageUrl.searchParams.set("page", String(page));
    const payload = await fetchJson(pageUrl.toString());

    if (!Array.isArray(payload?.jobs)) {
      throw new Error(`Unexpected Jibe response for ${company.name}`);
    }

    entries.push(...payload.jobs);
    const totalCount = Number(payload.totalCount ?? payload.count);
    if (payload.jobs.length < pageSize || (Number.isFinite(totalCount) && entries.length >= totalCount)) break;
  }

  return entries
    .map((entry) => entry?.data)
    .filter((job) => job && (!brand || job.brand === brand))
    .map((job) => {
      const categories = Array.isArray(job.categories)
        ? job.categories.map((category) => category.name).filter(Boolean)
        : [];
      const location = job.full_location
        ?? [job.city, job.state, job.country].filter(Boolean).join(", ");
      const salaryMin = Number(job.salary_min_value) || 0;
      const salaryMax = Number(job.salary_max_value) || 0;

      return {
        sourceType: "jibe",
        sourceId: String(job.req_id ?? job.slug),
        companyId: company.id,
        company: company.name,
        careersUrl: company.careersUrl,
        officialUrl: job.meta_data?.canonical_url
          ?? `${jobBaseUrl.replace(/\/$/, "")}/${encodeURIComponent(job.slug)}`,
        title: job.title ?? "Untitled role",
        location,
        workplaceType: "unknown",
        department: [job.department, ...categories].filter(Boolean).join(" / "),
        description: stripHtml(job.description ?? ""),
        publishedAt: job.posted_date ?? job.update_date ?? null,
        rawSalary: salaryMin || salaryMax ? { min: salaryMin, max: salaryMax } : null,
        fetchedFrom: apiUrl,
      };
    });
}
