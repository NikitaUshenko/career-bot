import { fetchJson, stripHtml } from "../utils.js";

export async function fetchWorkdayJobs(company) {
  const { host, tenant, site } = company.source;
  const apiBase = `${host.replace(/\/$/, "")}/wday/cxs/${encodeURIComponent(tenant)}/${encodeURIComponent(site)}`;
  const searchUrl = `${apiBase}/jobs`;
  const pageSize = 20;
  const postings = [];

  for (let offset = 0; offset < 10_000; offset += pageSize) {
    const payload = await fetchJson(searchUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        appliedFacets: {},
        limit: pageSize,
        offset,
        searchText: "",
      }),
    });

    if (!Array.isArray(payload?.jobPostings)) {
      throw new Error(`Unexpected Workday response for ${company.name}`);
    }

    postings.push(...payload.jobPostings);
    const total = Number(payload.total);
    if (payload.jobPostings.length < pageSize || (Number.isFinite(total) && postings.length >= total)) break;
  }

  const jobs = [];
  const detailBatchSize = 10;
  for (let index = 0; index < postings.length; index += detailBatchSize) {
    const batch = postings.slice(index, index + detailBatchSize);
    const details = await Promise.all(batch.map(async (posting) => {
      if (!posting.externalPath) throw new Error(`Workday job has no externalPath for ${company.name}`);
      const detailUrl = `${apiBase}${posting.externalPath}`;
      const payload = await fetchJson(detailUrl);
      if (!payload?.jobPostingInfo) {
        throw new Error(`Unexpected Workday job detail for ${company.name}`);
      }
      return { posting, detailUrl, info: payload.jobPostingInfo };
    }));
    jobs.push(...details);
  }

  return jobs.map(({ posting, detailUrl, info }) => {
    const sourceId = info.jobReqId ?? posting.bulletFields?.[0] ?? posting.externalPath;
    const location = info.location ?? posting.locationsText ?? "";
    const remoteData = `${info.remoteType ?? ""} ${location}`;
    return {
      sourceType: "workday",
      sourceId: String(sourceId),
      companyId: company.id,
      company: company.name,
      careersUrl: company.careersUrl,
      officialUrl: info.externalUrl
        ?? `${host.replace(/\/$/, "")}/${encodeURIComponent(site)}${posting.externalPath}`,
      title: info.title ?? posting.title ?? "Untitled role",
      location,
      workplaceType: /\bremote\b/i.test(remoteData) ? "remote" : "unknown",
      department: "",
      description: stripHtml(info.jobDescription ?? ""),
      publishedAt: info.startDate ?? null,
      rawSalary: null,
      fetchedFrom: detailUrl,
    };
  });
}
