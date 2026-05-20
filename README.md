# @gonrocca/skillautoforge-pi

> The skill auto-learning loop pi is missing. pi already stores, surfaces, and loads skills — this adds the behavioral loop: distill a reusable skill after a hard task, refine one that proved wrong.

---

skillautoforge-pi is a pi ([pi.dev](https://pi.dev)) package. It does **not**
reimplement pi's skill system — pi already does the hard parts:

- **Storage**: scans `~/.pi/agent/skills/`, `~/.agents/skills/`, and project skill dirs.
- **Surfacing (progressive disclosure)**: only skill *descriptions* sit in the system prompt; the full `SKILL.md` loads on demand.
- **Invocation**: `/skill:name` loads and runs a skill.

What pi lacks is the *behavioral loop* — the nudge to **create** a skill after a
hard task and to **refine** one when it was wrong. This package adds exactly
that, and nothing else. Inspired by [Hermes Agent](https://github.com/)'s
"after difficult/iterative tasks, offer to save as a skill" pattern.

## 📦 Install

```
pi install npm:@gonrocca/skillautoforge-pi
```

Needs Node ≥ 20.6.0. Restart pi after install.

## 🛠 What it adds

### `skill_save` tool (LLM-callable)

A deterministic writer. The model supplies a kebab-case `name`, a specific
`description` (what it does + when to use it), and a Markdown `body` (pattern,
ordered steps, exact commands, gotchas). The extension validates the name,
builds valid frontmatter, and writes `~/.pi/agent/skills/<name>/SKILL.md` —
the library pi already scans. The model never hand-serializes frontmatter or
guesses the path.

- Invalid names are normalized (slugified) rather than rejected outright.
- Missing description/body are rejected (pi won't load a description-less skill).
- Saving over an existing name without `overwrite:true` is refused with guidance
  to read-then-merge — so refinement never blind-clobbers a skill.

### Prompt guidelines (the loop)

While `skill_save` is active, pi surfaces these guidelines:

- *After a difficult, multi-step, or iterative task with a reusable pattern, call `skill_save`.* Routine one-off work is skipped.
- *If a skill you loaded was missing steps or had a wrong command, read it and call `skill_save` with `overwrite:true` and the merged content* — refine, don't duplicate.

These ride pi's `promptGuidelines` mechanism, so they appear only when the tool
is active — no manual system-prompt surgery, no always-on token tax beyond the
guideline bullets.

### `/skill-save` command (manual)

Force distillation of the current session:

```
/skill-save                       # distill whatever is reusable here
/skill-save focus on the deploy   # optional hint
```

## 🔄 How the loop closes

1. **Distill** — after a hard task, the model calls `skill_save`.
2. **Store** — the extension writes `SKILL.md` into pi's user skill library.
3. **Surface** — pi indexes the new skill's description into the system prompt (next session, or now after `/reload`).
4. **Refine** — when the model re-applies a skill and finds it lacking, it reads and re-saves the merged version with `overwrite:true`.

## 🔗 Composition with zero-pi / devteam-pi

No code coupling. Because `skill_save` writes into pi's shared skill library,
any agent pi runs — a plain session, a `/forge` run, a `/devteam` role — that
has skills enabled will see distilled skills surface automatically. To let the
loop run *inside* zero's SDD phases, enable skills on the relevant phase agents
(they ship with `inheritSkills: false`).

## 🧪 Development

```
npm test   # node --test --experimental-strip-types
```

The deterministic core (`extensions/skill-write.ts`) is pure and unit-tested.
Dependency-free, no build step — pi loads the TypeScript directly via jiti.

## License

MIT © Gonzalo Rocca
