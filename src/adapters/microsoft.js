import { fetchJson, stripHtml } from "../utils.js";

export async function fetchMicrosoftJobs(company) {
  const { apiBase, domain, location } = company.source;
  const positions = [];
  let start = 0;
  let total = Infinity;

  while (start < total) {
    const searchUrl = `${apiBase}/api/pcsx/search?domain=${encodeURIComponent(domain)}&query=&location=${encodeURIComponent(location)}&start=${start}`;
    const payload = await fetchJson(searchUrl);
    const page = payload?.data?.positions;
    if (!Array.isArray(page)) throw new Error(`Unexpected Microsoft Careers response for ${company.name}`);

    total = Number(payload.data.count) || page.length;
    positions.push(...page);
    if (page.length === 0) break;
    start += page.length;
  }

  const jobs = positions.map((position) => ({
    sourceType: "microsoft",
    sourceId: String(position.id),
    companyId: company.id,
    company: company.name,
    careersUrl: company.careersUrl,
    officialUrl: new URL(position.positionUrl, apiBase).href,
    title: position.name ?? "Untitled role",
    location: Array.isArray(position.locations) ? position.locations.join(" / ") : "",
    workplaceType: position.workLocationOption ?? "unknown",
    department: position.department ?? "",
    description: "",
    publishedAt: position.postedTs ? new Date(position.postedTs * 1000).toISOString() : null,
    rawSalary: null,
    fetchedFrom: searchUrlFor(company),
  }));

  for (const job of jobs) {
    const titleCouldMatch = /engineer|developer|designer|product design/i.test(job.title);
    if (!titleCouldMatch) continue;
    const detailUrl = `${apiBase}/api/pcsx/position_details?position_id=${encodeURIComponent(job.sourceId)}&domain=${encodeURIComponent(domain)}&hl=en`;
    const payload = await fetchJson(detailUrl);
    const detail = payload?.data;
    if (!detail) throw new Error(`Unexpected Microsoft job detail for ${company.name}`);
    job.description = stripHtml(detail.jobDescription ?? "");
    job.rawSalary = detail.salary ?? null;
  }

  return jobs;
}

function searchUrlFor(company) {
  const { apiBase, domain, location } = company.source;
  return `${apiBase}/api/pcsx/search?domain=${encodeURIComponent(domain)}&query=&location=${encodeURIComponent(location)}&start=0`;
}
