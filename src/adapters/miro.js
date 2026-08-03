import { fetchText, stripHtml } from "../utils.js";

const CANDIDATE_TITLE = /\b(front[- ]?end|full[- ]?stack|web engineer|ui engineer|design engineer|product engineer|software engineer|software developer|product designer|ux designer|ui[- /]?ux designer|interaction designer|experience designer|design systems? designer)\b/i;
const CANDIDATE_LOCATION = /\b(netherlands|nederland|amsterdam|haarlem|utrecht|rotterdam|the hague|den haag|eindhoven|remote[^.;,]*(europe|emea|eu)|(?:europe|emea|eu)[^.;,]*remote)\b/i;

function parseNextData(html, companyName) {
  const match = String(html).match(/<script id="__NEXT_DATA__" type="application\/json">([\s\S]*?)<\/script>/);
  if (!match) throw new Error(`Missing Next.js job data for ${companyName}`);
  return JSON.parse(match[1]);
}

export async function fetchMiroJobs(company) {
  const { jobsUrl, vacancyBaseUrl } = company.source;
  const listingHtml = await fetchText(jobsUrl);
  const pageProps = parseNextData(listingHtml, company.name)?.props?.pageProps;

  if (!Array.isArray(pageProps?.jobs)) {
    throw new Error(`Unexpected Miro careers response for ${company.name}`);
  }

  const metadataById = new Map(
    (pageProps.departmentsWithJobs ?? [])
      .flatMap((department) => department.jobs ?? [])
      .map((job) => [String(job.id), job]),
  );
  const detailJobs = pageProps.jobs.filter((job) =>
    CANDIDATE_TITLE.test(job.title ?? "") && CANDIDATE_LOCATION.test(job.location ?? ""));
  const descriptions = new Map(await Promise.all(detailJobs.map(async (job) => {
    const detailUrl = `${vacancyBaseUrl.replace(/\/$/, "")}/${encodeURIComponent(job.id)}`;
    const detailHtml = await fetchText(detailUrl);
    const content = parseNextData(detailHtml, company.name)?.props?.pageProps?.content ?? "";
    return [String(job.id), stripHtml(content)];
  })));

  return pageProps.jobs.map((job) => {
    const id = String(job.id);
    const metadata = metadataById.get(id);
    return {
      sourceType: "miro",
      sourceId: id,
      companyId: company.id,
      company: company.name,
      careersUrl: company.careersUrl,
      officialUrl: `${vacancyBaseUrl.replace(/\/$/, "")}/${encodeURIComponent(id)}?gh_jid=${encodeURIComponent(id)}`,
      title: job.title ?? "Untitled role",
      location: job.location ?? "",
      workplaceType: /\bremote\b/i.test(job.location ?? "") ? "remote" : "unknown",
      department: job.departmentName ?? metadata?.departmentName ?? "",
      description: descriptions.get(id) ?? "",
      publishedAt: metadata?.first_published ?? metadata?.updated_at ?? null,
      rawSalary: null,
      fetchedFrom: jobsUrl,
    };
  });
}
