// skillautoforge-pi — the auto-learning loop pi is missing.
//
// pi natively stores, surfaces (progressive disclosure), and loads skills from
// ~/.pi/agent/skills/. What it lacks is the *behavioral* loop: a nudge to
// distill a reusable skill after a hard task, and to refine a skill that proved
// wrong. This extension adds exactly that, and nothing pi already does:
//
//   - `skill_save` tool   — deterministic writer; the LLM supplies name +
//                           description + body, we write valid frontmatter to
//                           the skill library pi already scans.
//   - promptGuidelines    — the distill/refine triggers, surfaced only while
//                           the tool is active (idiomatic pi, no system-prompt
//                           surgery).
//   - `/skill-save`       — force distillation of the current session by hand.
//
// The deterministic, unit-tested core lives in ./skill-write.ts.

import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
import { Type } from "typebox";
import { existsSync, mkdirSync, writeFileSync } from "node:fs";
import {
  validateSkillName,
  slugifySkillName,
  buildSkillMarkdown,
  skillPaths,
} from "./skill-write.ts";

export default function register(pi: ExtensionAPI): void {
  pi.registerTool({
    name: "skill_save",
    label: "Save Skill",
    description:
      "Distill a reusable skill into the user's pi skill library so future " +
      "sessions reuse the solution instead of re-deriving it. Provide a kebab-case " +
      "name, a specific description (what it does + when to use it), and the skill " +
      "body in Markdown (the pattern, ordered steps, exact commands, and gotchas). " +
      "To refine an existing skill, read it first, then call with overwrite:true and " +
      "the merged content.",
    promptSnippet:
      "Persist a reusable solution as a pi skill (distill after hard tasks, refine when one was wrong)",
    promptGuidelines: [
      "After a difficult, multi-step, or iterative task that has a reusable pattern, call skill_save to distill it into a skill (capture the steps, exact commands, and the non-obvious gotchas). Skip routine one-off work.",
      "If a skill you loaded was missing steps, had a wrong command, or lacked a pitfall you hit, read it and call skill_save with overwrite:true and the merged, corrected content — refine, do not duplicate.",
      "Keep skill_save names kebab-case and descriptions specific about when the skill applies.",
    ],
    parameters: Type.Object({
      name: Type.String({
        description: "kebab-case skill name (lowercase a-z/0-9, single hyphens).",
      }),
      description: Type.String({
        description: "What the skill does and when to use it. Be specific (drives when it loads).",
      }),
      body: Type.String({
        description: "Skill body in Markdown: pattern, ordered steps, exact commands, gotchas.",
      }),
      overwrite: Type.Optional(
        Type.Boolean({
          description: "Set true to refine/replace an existing skill of the same name.",
        }),
      ),
    }),
    async execute(_toolCallId, params, _signal, _onUpdate, _ctx) {
      const { name, description, body } = params as {
        name: string;
        description: string;
        body: string;
        overwrite?: boolean;
      };
      const overwrite = (params as { overwrite?: boolean }).overwrite === true;

      let finalName = name;
      const check = validateSkillName(finalName);
      if (!check.ok) {
        const slug = slugifySkillName(name);
        if (slug && validateSkillName(slug).ok) {
          finalName = slug; // forgiving: normalize rather than fail outright
        } else {
          return {
            content: [{ type: "text", text: `skill_save: invalid name — ${check.error}` }],
            details: { ok: false, error: check.error },
            isError: true,
          };
        }
      }

      if (!description || !description.trim()) {
        return {
          content: [{ type: "text", text: "skill_save: description is required (pi will not load a skill without one)." }],
          details: { ok: false, error: "missing description" },
          isError: true,
        };
      }
      if (!body || !body.trim()) {
        return {
          content: [{ type: "text", text: "skill_save: body is required." }],
          details: { ok: false, error: "missing body" },
          isError: true,
        };
      }

      const { dir, file } = skillPaths(finalName);
      const exists = existsSync(file);
      if (exists && !overwrite) {
        return {
          content: [
            {
              type: "text",
              text:
                `Skill "${finalName}" already exists at ${file}. To refine it, read that file, ` +
                `merge your new steps/gotchas, then call skill_save again with overwrite:true. ` +
                `To keep both, pick a different name.`,
            },
          ],
          details: { ok: false, exists: true, file },
          isError: false,
        };
      }

      try {
        mkdirSync(dir, { recursive: true });
        writeFileSync(file, buildSkillMarkdown({ name: finalName, description, body }), "utf8");
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        return {
          content: [{ type: "text", text: `skill_save: write failed — ${message}` }],
          details: { ok: false, error: message },
          isError: true,
        };
      }

      const verb = exists ? "Refined" : "Saved";
      return {
        content: [
          {
            type: "text",
            text:
              `${verb} skill "${finalName}" → ${file}. ` +
              `pi will surface it (by its description) in new sessions, or now after /reload.`,
          },
        ],
        details: { ok: true, name: finalName, file, refined: exists },
      };
    },
  });

  pi.registerCommand("skill-save", {
    description: "Distill the current session into a reusable pi skill (skillautoforge)",
    handler: async (args, ctx) => {
      const hint = args && args.trim() ? ` Focus: ${args.trim()}.` : "";
      ctx.ui.notify("skillautoforge: distilling a skill from this session…", "info");
      pi.sendUserMessage(
        "Distill the substantial, reusable work from this session into a single pi skill using the " +
          "skill_save tool: a kebab-case name, a specific description (what it does + when to use it), " +
          "and a Markdown body with the pattern, ordered steps, exact commands, and the non-obvious " +
          "gotchas. If nothing here is reusable beyond this one-off, say so and do not create a skill." +
          hint,
      );
    },
  });
}
