import { PROJECT_PRIVACY_URL, PROJECT_TERMS_URL } from "./project-urls.mjs";

const pages = [
  { url: PROJECT_PRIVACY_URL, mustInclude: "Privacy Policy" },
  { url: PROJECT_TERMS_URL, mustInclude: "Terms of Use" },
];

for (const page of pages) {
  const response = await fetch(page.url, { redirect: "follow" });
  if (!response.ok) {
    throw new Error(`${page.url} returned HTTP ${response.status}`);
  }
  const body = await response.text();
  if (!body.includes(page.mustInclude)) {
    throw new Error(`${page.url} does not look like the published legal page`);
  }
  console.log(`OK ${page.url}`);
}
