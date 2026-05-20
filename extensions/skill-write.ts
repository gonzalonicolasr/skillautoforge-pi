// skillautoforge-pi — pure helpers for distilling a session into a pi skill.
//
// pi already owns skill storage, surfacing (progressive disclosure: only
// descriptions sit in the system prompt, full SKILL.md loads on demand), and
// invocation (`/skill:name`). This package adds only the missing behavioral
// loop — distill after hard tasks, refine on reuse — backed by a deterministic
// writer so the LLM never has to hand-serialize frontmatter or guess the path.
//
// Everything in this module is pure and dependency-free so it is unit-testable
// without a running pi session.

import { homedir } from "node:os";
import { join } from "node:path";

/** A skill name must satisfy the Agent Skills standard pi enforces. */
const NAME_RE = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
export const MAX_NAME = 64;
export const MAX_DESCRIPTION = 1024;

export interface NameCheck {
  ok: boolean;
  error?: string;
}

/** Validate a skill name against pi's rules: 1-64 chars, lowercase a-z/0-9,
 *  hyphen-separated, no leading/trailing/consecutive hyphens. */
export function validateSkillName(name: string): NameCheck {
  if (typeof name !== "string" || name.length === 0) {
    return { ok: false, error: "name is empty" };
  }
  if (name.length > MAX_NAME) {
    return { ok: false, error: `name exceeds ${MAX_NAME} characters` };
  }
  if (!NAME_RE.test(name)) {
    return {
      ok: false,
      error:
        "name must be lowercase a-z/0-9 separated by single hyphens, with no leading, trailing, or consecutive hyphens",
    };
  }
  return { ok: true };
}

/** Turn arbitrary text into a valid skill name: lowercase, non-alphanumerics to
 *  hyphens, collapse runs, trim edge hyphens, clamp to MAX_NAME without leaving
 *  a trailing hyphen. Returns "" when nothing usable remains. */
export function slugifySkillName(raw: string): string {
  if (typeof raw !== "string") return "";
  let s = raw
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
  if (s.length > MAX_NAME) {
    s = s.slice(0, MAX_NAME).replace(/-+$/g, "");
  }
  return s;
}

/** Escape a value for safe single-line YAML inside the frontmatter. The only
 *  fields we emit are name (already validated) and description (free text), so
 *  we double-quote and escape quotes/backslashes and collapse newlines. */
export function yamlInline(value: string): string {
  const oneLine = value.replace(/\r?\n/g, " ").trim();
  const escaped = oneLine.replace(/\\/g, "\\\\").replace(/"/g, '\\"');
  return `"${escaped}"`;
}

export interface SkillInput {
  name: string;
  description: string;
  body: string;
  /** ISO timestamp; injected for testability. Defaults to now at call time. */
  now?: string;
}

/** Build the full SKILL.md text: required frontmatter (name, description) plus
 *  a provenance metadata block, followed by the distilled body. The body is
 *  used verbatim — the caller (the LLM) owns its quality. */
export function buildSkillMarkdown(input: SkillInput): string {
  const desc =
    input.description.length > MAX_DESCRIPTION
      ? input.description.slice(0, MAX_DESCRIPTION)
      : input.description;
  const ts = input.now ?? new Date().toISOString();
  const body = input.body.trim();
  const frontmatter = [
    "---",
    `name: ${input.name}`,
    `description: ${yamlInline(desc)}`,
    "metadata:",
    "  source: skillautoforge",
    `  updated: ${ts}`,
    "---",
  ].join("\n");
  return `${frontmatter}\n\n${body}\n`;
}

/** The user-scoped skill library pi auto-scans. Override the home dir for tests. */
export function skillsRoot(home: string = homedir()): string {
  return join(home, ".pi", "agent", "skills");
}

/** Absolute path of a skill's directory and its SKILL.md. */
export function skillPaths(name: string, home: string = homedir()): {
  dir: string;
  file: string;
} {
  const dir = join(skillsRoot(home), name);
  return { dir, file: join(dir, "SKILL.md") };
}
