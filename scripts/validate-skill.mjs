import { access, readdir, readFile } from "node:fs/promises";
import path from "node:path";
import process from "node:process";

const skillsRoot = path.join(process.cwd(), "skills");

function frontmatterFields(source, skillName) {
  const frontmatter = source.match(/^---\n([\s\S]*?)\n---\n/);
  if (!frontmatter?.[1]) throw new Error(`${skillName}: SKILL.md is missing YAML frontmatter`);
  return Object.fromEntries(
    frontmatter[1]
      .split("\n")
      .map((line) => line.match(/^([a-z_]+):\s*(.+)$/))
      .filter((match) => match !== null)
      .map((match) => [match[1], match[2]]),
  );
}

async function validateSkill(skillName) {
  const skill = path.join(skillsRoot, skillName);
  const source = await readFile(path.join(skill, "SKILL.md"), "utf8");
  const fields = frontmatterFields(source, skillName);

  if (fields.name !== skillName) {
    throw new Error(`${skillName}: Skill name must match its folder name`);
  }
  if (!fields.description || fields.description.length < 80) {
    throw new Error(`${skillName}: Skill description must explain what it does and when it triggers`);
  }
  if (/\bTODO\b/.test(source)) throw new Error(`${skillName}: Skill still contains TODO placeholders`);

  if (skillName === "x-relationship-observer") {
    const references = ["development.md", "maintenance.md", "usage.md", "release.md", "contributing.md"];
    await Promise.all(
      references.map((name) => access(path.join(skill, "references", name))),
    );
    const interfaceYaml = await readFile(path.join(skill, "agents", "openai.yaml"), "utf8");
    if (!interfaceYaml.includes("$x-relationship-observer")) {
      throw new Error("agents/openai.yaml default_prompt must invoke the skill by name");
    }
  }

  if (skillName === "x-not-brother-rules") {
    await access(path.join(skill, "references", "schema.md"));
  }
}

const entries = await readdir(skillsRoot, { withFileTypes: true });
const skillNames = entries.filter((entry) => entry.isDirectory()).map((entry) => entry.name).toSorted();
if (skillNames.length === 0) throw new Error("No skills found under skills/");
for (const name of skillNames) await validateSkill(name);

console.log(`Validated ${skillNames.length} project skill(s): ${skillNames.join(", ")}.`);
