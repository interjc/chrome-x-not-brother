import { access, readFile } from "node:fs/promises";
import path from "node:path";
import process from "node:process";

const skill = path.join(process.cwd(), "skills", "x-relationship-observer");
const source = await readFile(path.join(skill, "SKILL.md"), "utf8");
const frontmatter = source.match(/^---\n([\s\S]*?)\n---\n/);
if (!frontmatter?.[1]) throw new Error("SKILL.md is missing YAML frontmatter");

const fields = Object.fromEntries(
  frontmatter[1]
    .split("\n")
    .map((line) => line.match(/^([a-z_]+):\s*(.+)$/))
    .filter((match) => match !== null)
    .map((match) => [match[1], match[2]]),
);

if (fields.name !== "x-relationship-observer") {
  throw new Error("Skill name must match its folder name");
}
if (!fields.description || fields.description.length < 80) {
  throw new Error("Skill description must explain what it does and when it triggers");
}
if (/\bTODO\b/.test(source)) throw new Error("Skill still contains TODO placeholders");

const references = ["development.md", "maintenance.md", "usage.md", "release.md"];
await Promise.all(
  references.map((name) => access(path.join(skill, "references", name))),
);

const interfaceYaml = await readFile(path.join(skill, "agents", "openai.yaml"), "utf8");
if (!interfaceYaml.includes("$x-relationship-observer")) {
  throw new Error("agents/openai.yaml default_prompt must invoke the skill by name");
}

console.log("Validated project skill structure and references.");

