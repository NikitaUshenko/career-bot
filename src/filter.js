import { normalizeWhitespace } from "./utils.js";

const EXCLUDED_SENIORITY = /\b(intern(ship)?|junior|graduate|working student|apprentice)\b/i;
const EXCLUDED_ENGINEERING = /\b(ios|android|mobile|embedded|firmware|data engineer|machine learning engineer|ml engineer|qa engineer|test engineer|site reliability|sre|devops|security engineer)\b/i;
const EXCLUDED_DESIGN = /\b(graphic|brand|marketing|motion|industrial|fashion|interior) designer\b/i;

const DESIGN_TITLE = /\b(product designer|ux designer|ui\s*\/\s*ux designer|ui[- ]ux designer|interaction designer|experience designer|design systems? designer|product design lead|staff product designer|lead product designer)\b/i;
const EXPLICIT_ENGINEERING_TITLE = /\b(front[- ]?end|full[- ]?stack|web engineer|ui engineer|design engineer|frontend platform|product engineer)\b/i;
const GENERIC_ENGINEERING_TITLE = /\bsoftware engineer|software developer|application engineer\b/i;

const WEB_SIGNALS = [
  /\breact(?:\.js)?\b/i,
  /\btypescript\b/i,
  /\bjavascript\b/i,
  /\bnode(?:\.js)?\b/i,
  /\bfront[- ]?end\b/i,
  /\bweb application/i,
  /\bdesign system/i,
  /\bhtml\b/i,
  /\bcss\b/i,
];

const DUTCH_LOCATION = /\b(netherlands|nederland|amsterdam|haarlem|utrecht|rotterdam|the hague|den haag|hoofddorp|schiphol|eindhoven|delft|leiden|hilversum|almere|amersfoort)\b/i;
const EUROPE_REMOTE = /\b(remote[^.;,]*(europe|emea|eu|netherlands)|(?:europe|emea|eu|netherlands)[^.;,]*remote)\b/i;

export function inferSeniority(title) {
  if (/\bprincipal\b/i.test(title)) return "principal";
  if (/\bstaff\b/i.test(title)) return "staff";
  if (/\blead\b/i.test(title)) return "lead";
  if (/\bsenior|\bsr\.?\b/i.test(title)) return "senior";
  if (/\bmanager|\bdirector|\bhead\b/i.test(title)) return "manager";
  return "mid-or-unknown";
}

export function prefilterJob(job) {
  const title = normalizeWhitespace(job.title);
  const searchable = `${title}\n${job.department}\n${job.location}\n${job.description}`;

  if (EXCLUDED_SENIORITY.test(title)) {
    return { eligible: false, reason: "Excluded junior or internship role" };
  }

  const locationEligible = DUTCH_LOCATION.test(job.location) || EUROPE_REMOTE.test(job.location);
  if (!locationEligible) {
    return { eligible: false, reason: "Location is not Netherlands or Europe/EMEA remote" };
  }

  if (DESIGN_TITLE.test(title) && !EXCLUDED_DESIGN.test(title)) {
    return {
      eligible: true,
      roleFamily: "design",
      seniority: inferSeniority(title),
      ruleReason: "Design title and eligible location",
    };
  }

  if (EXPLICIT_ENGINEERING_TITLE.test(title) && !EXCLUDED_ENGINEERING.test(title)) {
    return {
      eligible: true,
      roleFamily: "engineering",
      seniority: inferSeniority(title),
      ruleReason: "Frontend/full-stack/web title and eligible location",
    };
  }

  if (GENERIC_ENGINEERING_TITLE.test(title) && !EXCLUDED_ENGINEERING.test(title)) {
    const signalCount = WEB_SIGNALS.filter((pattern) => pattern.test(searchable)).length;
    if (signalCount >= 2) {
      return {
        eligible: true,
        roleFamily: "engineering",
        seniority: inferSeniority(title),
        ruleReason: `Generic engineering title with ${signalCount} web-stack signals`,
      };
    }
  }

  return { eligible: false, reason: "Role does not match frontend/full-stack or product design" };
}
