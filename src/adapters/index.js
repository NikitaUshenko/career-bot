import { fetchAshbyJobs } from "./ashby.js";
import { fetchGreenhouseJobs } from "./greenhouse.js";
import { fetchJibeJobs } from "./jibe.js";
import { fetchLeverJobs } from "./lever.js";

export async function fetchCompanyJobs(company) {
  switch (company.source.type) {
    case "greenhouse":
      return fetchGreenhouseJobs(company);
    case "lever":
      return fetchLeverJobs(company);
    case "ashby":
      return fetchAshbyJobs(company);
    case "jibe":
      return fetchJibeJobs(company);
    default:
      throw new Error(`Unsupported source type: ${company.source.type}`);
  }
}
