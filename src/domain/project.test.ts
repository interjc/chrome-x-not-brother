import { describe, expect, it } from "vitest";
import {
  PROJECT_FEEDBACK_URL,
  PROJECT_PRIVACY_URL,
  PROJECT_REPOSITORY_URL,
  PROJECT_TERMS_URL,
} from "./project";

describe("project public URLs", () => {
  it("points homepage, feedback, privacy, and terms at the public GitHub repository", () => {
    expect(PROJECT_REPOSITORY_URL).toBe("https://github.com/interjc/chrome-x-not-brother");
    expect(PROJECT_FEEDBACK_URL).toBe(`${PROJECT_REPOSITORY_URL}/issues`);
    expect(PROJECT_PRIVACY_URL).toBe(`${PROJECT_REPOSITORY_URL}/blob/main/terms/privacy.md`);
    expect(PROJECT_TERMS_URL).toBe(`${PROJECT_REPOSITORY_URL}/blob/main/terms/terms.md`);
  });
});
