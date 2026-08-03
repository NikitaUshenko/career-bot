import { fetchText, normalizeWhitespace, stripHtml, truncate } from "../utils.js";

const HTML_OPTIONS = {
  headers: {
    Accept: "text/html,application/xhtml+xml",
    "User-Agent": "Mozilla/5.0 (compatible; career-watch-telegram/1.0)",
  },
};

function decodeAttribute(value = "") {
  return value.replace(/&amp;/g, "&").replace(/\\u002F/g, "/").replace(/\\"/g, '"');
}

function slugTitle(value = "") {
  return value
    .replace(/^\d+-/, "")
    .split("-")
    .filter(Boolean)
    .map((part) => part.length <= 3 ? part.toUpperCase() : `${part[0].toUpperCase()}${part.slice(1)}`)
    .join(" ");
}

function metaContent(html, key) {
  const escaped = key.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const pattern = new RegExp(`<meta[^>]+(?:name|property)=["']${escaped}["'][^>]+content=["']([^"']*)`, "i");
  return normalizeWhitespace(stripHtml(pattern.exec(html)?.[1] ?? ""));
}

function mainText(html, title) {
  const main = /<main[^>]*>([\s\S]*?)<\/main>/i.exec(html)?.[1];
  if (main) return stripHtml(main);
  const titleIndex = title ? html.lastIndexOf(title) : -1;
  return stripHtml(titleIndex >= 0 ? html.slice(titleIndex, titleIndex + 140_000) : html.slice(0, 140_000));
}

function jobPosting(html) {
  for (const match of html.matchAll(/<script[^>]+type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi)) {
    try {
      const parsed = JSON.parse(match[1]);
      const values = Array.isArray(parsed) ? parsed : parsed?.["@graph"] ?? [parsed];
      const posting = values.find((value) => value?.["@type"] === "JobPosting");
      if (posting) return posting;
    } catch {
      // Ignore unrelated or malformed structured-data blocks.
    }
  }
  return null;
}

function structuredLocation(posting) {
  const locations = Array.isArray(posting?.jobLocation) ? posting.jobLocation : [posting?.jobLocation];
  return locations.filter(Boolean).map((location) => {
    const address = location.address ?? {};
    return location.name || [address.addressLocality, address.addressRegion, address.addressCountry].filter(Boolean).join(", ");
  }).filter(Boolean).join(" / ");
}

function extractLinks(html, source) {
  const pattern = new RegExp(source.linkPattern, "i");
  const links = [];
  for (const match of html.matchAll(/<a[^>]+href=["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>/gi)) {
    const href = decodeAttribute(match[1]);
    if (!pattern.test(href)) continue;
    const text = stripHtml(match[2]);
    links.push({ href, text });
  }

  if (source.variant === "google") {
    for (const match of html.matchAll(/(?:href=["']?)?(jobs\/results\/\d+-[a-z0-9-]+(?:\?[^"' <]+)?)/gi)) {
      links.push({ href: decodeAttribute(match[1]), text: "" });
    }
  }

  const absoluteUrl = (href) => source.variant === "google" && /^\/?jobs\/results\//i.test(href)
    ? new URL(href.replace(/^\//, ""), source.baseUrl).href
    : new URL(href, source.listingUrl).href;

  return [...new Map(links.map((link) => [absoluteUrl(link.href), link])).entries()]
    .map(([url, link]) => ({ ...link, url }));
}

function jsonObjectAt(value, start) {
  let depth = 0;
  let quoted = false;
  let escaped = false;
  for (let index = start; index < value.length; index += 1) {
    const character = value[index];
    if (quoted) {
      if (escaped) escaped = false;
      else if (character === "\\") escaped = true;
      else if (character === '"') quoted = false;
      continue;
    }
    if (character === '"') quoted = true;
    else if (character === "{") depth += 1;
    else if (character === "}" && --depth === 0) return value.slice(start, index + 1);
  }
  return null;
}

function parsePicnicLinks(html, source) {
  const jobs = new Map();
  for (const match of html.matchAll(/<script>self\.__next_f\.push\(([\s\S]*?)\)<\/script>/g)) {
    let payload;
    try {
      payload = JSON.parse(match[1])?.[1];
    } catch {
      continue;
    }
    if (typeof payload !== "string") continue;

    let cursor = 0;
    const marker = '{"injectables":null,"data":';
    while ((cursor = payload.indexOf(marker, cursor)) >= 0) {
      const raw = jsonObjectAt(payload, cursor);
      cursor += marker.length;
      if (!raw) continue;
      try {
        const job = JSON.parse(raw);
        if (job.visibility !== "external" || job.template !== "auto" || !job.url || !job._id) continue;
        const location = job.data?.location ?? {};
        jobs.set(job._id, {
          url: new URL(job.url, source.listingUrl).href,
          text: job.name,
          sourceId: `J${job._id}`,
          location: [location.city, location.state, location.country].filter(Boolean).join(", "),
          department: job.data?.teams ?? "",
        });
      } catch {
        // Ignore non-job objects in the streamed page payload.
      }
    }
  }
  return [...jobs.values()];
}

function preliminary(link, company) {
  const { source } = company;
  const pathname = new URL(link.url).pathname;
  const parts = pathname.split("/").filter(Boolean);
  let title = link.text;
  let location = link.location ?? source.defaultLocation ?? "";
  let department = link.department ?? "";

  if (source.variant === "google") title = slugTitle(parts.at(-1));
  if (source.variant === "picnic") {
    title = link.text.split(/Engineering|Product|Design|Operations/i)[0].trim() || slugTitle(parts.at(-4));
    department ||= parts.at(-5) ?? "";
    location ||= [parts.at(-3), parts.at(-2), parts.at(-1)].map(slugTitle).join(", ");
  }
  if (source.variant === "optiver") {
    title = link.text || slugTitle(parts.at(-1));
    department = parts.at(-3) ?? "";
    location = slugTitle(parts.at(-2));
  }
  if (source.variant === "mollie") {
    title = link.text.split(/Amsterdam|Lisbon|Milan|London|Paris|Munich|Ghent|Maastricht/i)[0].trim();
    location = link.text.match(/Amsterdam|Lisbon|Milan|London|Paris|Munich|Ghent|Maastricht/i)?.[0] ?? "";
  }

  return { title: title || slugTitle(parts.at(-1)), location, department };
}

async function fetchDetail(link, company, preliminaryJob) {
  const html = await fetchText(link.url, HTML_OPTIONS);
  const posting = jobPosting(html);
  const title = normalizeWhitespace(posting?.title ?? metaContent(html, "og:title") ?? preliminaryJob.title)
    .replace(/\s+[|–—]\s+.*$/, "");
  const description = normalizeWhitespace(stripHtml(posting?.description ?? "")) || mainText(html, title);
  return {
    ...preliminaryJob,
    title: title || preliminaryJob.title,
    location: structuredLocation(posting) || preliminaryJob.location,
    description: truncate(description, 30_000),
    publishedAt: posting?.datePosted ?? null,
  };
}

function sourceIdFor(link, variant) {
  if (link.sourceId) return link.sourceId;
  const path = new URL(link.url).pathname;
  if (variant === "picnic") return /\/(?:vacancies|vacatures|jobangebot|poste-vacant)\/([^/]+)/i.exec(path)?.[1];
  if (variant === "mollie") return /\/vacancies\/([^/]+)/i.exec(path)?.[1];
  if (variant === "google") return /\/results\/(\d+)-/i.exec(path)?.[1];
  return path.match(/\d{5,}/)?.[0] ?? path.split("/").filter(Boolean).at(-1);
}

function parseUberLinks(html, source) {
  const links = [];
  const pattern = /\\"Reference\\":\\"([^"\\]+)\\"[\s\S]{0,1500}?\\"Title\\":\\"([^"\\]+)\\"[\s\S]{0,2500}?\\"Address\\":\\"([^"\\]+)\\"/g;
  for (const match of html.matchAll(pattern)) {
    links.push({
      url: new URL(`/en/jobs/${match[1]}/`, source.baseUrl).href,
      text: match[2],
      location: match[3],
      sourceId: match[1],
    });
  }
  return [...new Map(links.map((link) => [link.sourceId, link])).values()];
}

export async function fetchWebpageJobs(company) {
  const { source } = company;
  const html = await fetchText(source.listingUrl, HTML_OPTIONS);
  const links = source.variant === "uber"
    ? parseUberLinks(html, source)
    : source.variant === "picnic" ? parsePicnicLinks(html, source) : extractLinks(html, source);
  if (links.length === 0) throw new Error(`No official job links found for ${company.name}`);

  const jobs = [];
  for (const link of links.slice(0, source.maxJobs ?? 500)) {
    const initial = source.variant === "uber"
      ? { title: link.text, location: link.location, department: "" }
      : preliminary(link, company);
    const titleCouldMatch = /engineer|developer|designer|product design/i.test(initial.title);
    const locationCouldMatch = /netherlands|nederland|amsterdam|haarlem|utrecht|rotterdam|the hague|den haag|hoofddorp|schiphol|eindhoven|delft|leiden|hilversum|almere|amersfoort|remote[^,]*(?:europe|emea|eu)/i.test(initial.location);
    const detail = titleCouldMatch && locationCouldMatch
      ? await fetchDetail(link, company, initial)
      : { ...initial, description: "", publishedAt: null };
    jobs.push({
      sourceType: `webpage-${source.variant}`,
      sourceId: sourceIdFor(link, source.variant),
      companyId: company.id,
      company: company.name,
      careersUrl: company.careersUrl,
      officialUrl: link.url,
      title: detail.title,
      location: detail.location,
      workplaceType: "unknown",
      department: detail.department,
      description: detail.description,
      publishedAt: detail.publishedAt,
      rawSalary: null,
      fetchedFrom: source.listingUrl,
    });
  }

  return jobs;
}
