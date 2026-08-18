import { describe, expect, it } from "vitest";
import {
  PROJECT_FEEDBACK_URL,
  PROJECT_PRIVACY_URL,
  PROJECT_REPOSITORY_URL,
  PROJECT_SITE_URL,
  PROJECT_TERMS_URL,
} from "./project";

describe("project public URLs", () => {
  it("points homepage and feedback at GitHub, and legal pages at GitHub Pages", () => {
    expect(PROJECT_REPOSITORY_URL).toBe("https://github.com/interjc/chrome-x-not-brother");
    expect(PROJECT_SITE_URL).toBe("https://interjc.github.io/chrome-x-not-brother");
    expect(PROJECT_FEEDBACK_URL).toBe(`${PROJECT_REPOSITORY_URL}/issues`);
    expect(PROJECT_PRIVACY_URL).toBe(`${PROJECT_SITE_URL}/privacy.html`);
    expect(PROJECT_TERMS_URL).toBe(`${PROJECT_SITE_URL}/terms.html`);
  });
});
