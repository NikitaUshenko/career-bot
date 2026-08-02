import { fetchJson, stripHtml } from "../utils.js";

export async function fetchAshbyJobs(company) {
  const { boardName } = company.source;
  const feedUrl = `https://api.ashbyhq.com/posting-api/job-board/${encodeURIComponent(boardName)}?includeCompensation=true`;
  const payload = await fetchJson(feedUrl);

  if (!Array.isArray(payload?.jobs)) {
    throw new Error(`Unexpected Ashby response for ${company.name}`);
  }

  return payload.jobs
    .filter((job) => job.isListed !== false)
    .map((job) => {
      const secondaryLocations = Array.isArray(job.secondaryLocations)
        ? job.secondaryLocations.map((entry) => entry.location).filter(Boolean)
        : [];
      const locations = [job.location, ...secondaryLocations].filter(Boolean);

      return {
        sourceType: "ashby",
        sourceId: String(job.id ?? job.jobUrl ?? job.applyUrl),
        companyId: company.id,
        company: company.name,
        careersUrl: company.careersUrl,
        officialUrl: job.jobUrl ?? job.applyUrl,
        title: job.title ?? "Untitled role",
        location: locations.join("; "),
        workplaceType: job.isRemote ? "remote" : "unknown",
        department: [job.department, job.team].filter(Boolean).join(" / "),
        description: job.descriptionPlain ?? stripHtml(job.descriptionHtml ?? job.description ?? ""),
        publishedAt: job.publishedAt ?? null,
        rawSalary: job.compensation ?? null,
        fetchedFrom: feedUrl,
      };
    });
}
