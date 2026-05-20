import { test } from "node:test";
import assert from "node:assert/strict";
import { join } from "node:path";
import {
  validateSkillName,
  slugifySkillName,
  yamlInline,
  buildSkillMarkdown,
  skillPaths,
  skillsRoot,
  MAX_NAME,
} from "./skill-write.ts";

test("validateSkillName accepts standard names", () => {
  for (const n of ["pdf-tools", "code-review", "a", "x1", "deploy-to-prod-v2"]) {
    assert.equal(validateSkillName(n).ok, true, n);
  }
});

test("validateSkillName rejects invalid names", () => {
  const bad = ["", "PDF", "-pdf", "pdf-", "pdf--tools", "two words", "café", "a".repeat(MAX_NAME + 1)];
  for (const n of bad) {
    assert.equal(validateSkillName(n).ok, false, n);
  }
});

test("validateSkillName: name at the length cap is allowed, one over is not", () => {
  assert.equal(validateSkillName("a".repeat(MAX_NAME)).ok, true);
  assert.equal(validateSkillName("a".repeat(MAX_NAME + 1)).ok, false);
});

test("slugifySkillName normalizes arbitrary text", () => {
  assert.equal(slugifySkillName("Fix Prisma P1013 on Windows"), "fix-prisma-p1013-on-windows");
  assert.equal(slugifySkillName("  --Hello, World!!  "), "hello-world");
  assert.equal(slugifySkillName("café crème"), "caf-cr-me");
  assert.equal(slugifySkillName("!!!"), "");
});

test("slugifySkillName clamps to MAX_NAME without a trailing hyphen", () => {
  const out = slugifySkillName("a-".repeat(80)); // would overflow with a hyphen at the cut
  assert.ok(out.length <= MAX_NAME);
  assert.ok(!out.endsWith("-"));
  assert.equal(validateSkillName(out).ok, true);
});

test("slugify output always validates (or is empty)", () => {
  for (const raw of ["A B C", "@@@weird@@@name@@@", "trailing---", "MiXeD-123"]) {
    const s = slugifySkillName(raw);
    if (s !== "") assert.equal(validateSkillName(s).ok, true, `${raw} -> ${s}`);
  }
});

test("yamlInline escapes quotes/backslashes and collapses newlines", () => {
  assert.equal(yamlInline('say "hi"'), '"say \\"hi\\""');
  assert.equal(yamlInline("a\\b"), '"a\\\\b"');
  assert.equal(yamlInline("line1\nline2"), '"line1 line2"');
});

test("buildSkillMarkdown emits valid, parseable frontmatter", () => {
  const md = buildSkillMarkdown({
    name: "my-skill",
    description: 'Does a "thing"',
    body: "# My Skill\n\nSteps here.",
    now: "2026-05-20T00:00:00.000Z",
  });
  assert.match(md, /^---\nname: my-skill\n/);
  assert.match(md, /description: "Does a \\"thing\\""/);
  assert.match(md, /metadata:\n {2}source: skillautoforge\n {2}updated: 2026-05-20T00:00:00\.000Z/);
  assert.match(md, /\n---\n\n# My Skill/);
  assert.ok(md.endsWith("\n"));
});

test("buildSkillMarkdown truncates an over-long description", () => {
  const long = "x".repeat(2000);
  const md = buildSkillMarkdown({ name: "n", description: long, body: "b", now: "t" });
  const descLine = md.split("\n").find((l) => l.startsWith("description:"))!;
  // 1024 x's + the two surrounding quotes
  assert.ok(descLine.length <= 1024 + "description: ".length + 2);
});

test("skillPaths/skillsRoot resolve under the pi user skill library", () => {
  const home = join("/home", "u");
  const root = join(home, ".pi", "agent", "skills");
  assert.equal(skillsRoot(home), root);
  const p = skillPaths("foo", home);
  assert.equal(p.dir, join(root, "foo"));
  assert.equal(p.file, join(root, "foo", "SKILL.md"));
});
