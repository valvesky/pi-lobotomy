# Pi Lobotomy usage

[Installation and quick start](../README.md)

The parent receives Angela's coordination instructions. The extension does not change the parent's tools or override repository instructions. Projects prohibiting delegation remain main-agent-only.

## Team

Angela, Yesod, Netzach, Hod, Gebura, Chesed, and Binah are personal names, not role titles. Each member's role is their associated team. A worker spawned by a member belongs to that member's team: for example, a worker spawned by Yesod is part of the Information Team. This describes team membership, not delegation permission; bundled profiles still cannot spawn workers. Use their names directly in commands and tool calls, case-insensitively. Team aliases work too; existing lowercase names remain compatible. Custom profile names take precedence over team aliases.

| Name | Team alias | Team | Responsibility | Tools |
|---|---|---|---|---|
| Angela | Parent session | Coordinator | Scope, ownership, reconciliation, integration, reporting | Parent's existing tools + coordination |
| Yesod | `information` | Information | Research and evidence-backed investigation (low thinking) | Read/search + bash for read-only rg/fzf |
| Netzach | `safety` | Safety | Failure paths, cleanup, cancellation, resource lifetimes | Read/search only |
| Hod | `training` | Training | Regression tests and behavior verification | Read/search, edit/write, bash |
| Gebura | `disciplinary` | Disciplinary | Fast codebase scouting and handoff (low thinking) | Read/search only |
| Chesed | `welfare` | Welfare | Documentation and developer workflows | Read/search, edit/write, bash |
| Binah | `extraction` | Extraction | Code review, correctness, and complexity reduction | Read/search only |

Read/search means `read`, `grep`, `find`, and `ls`. Yesod additionally uses bash for read-only ripgrep (`rg`) and non-interactive `fzf`; these shell restrictions are instructions, not a sandbox. Read-only agents cannot run git or test commands; provide relevant diffs, history, or logs in the brief. Personalities affect tone, never correctness, care, or professionalism.

The old bundled `scout`, `researcher`, and `worker` profiles are replaced by these six roles. Existing global or project profiles are still discoverable and override package profiles by name: **project > global > package**. Bundled roles have no recursive spawning permission and all default to **`openai-codex/gpt-6-luna`**. An explicit assignment model or overriding custom profile can change that. Custom profiles without a model inherit the parent's selected model; resumes replay their original model. The child must be able to resolve that model without the parent's unrelated extensions.

BongBong, when installed as a personal profile, can be requested as `BongBong` (the legacy `employee` name remains compatible). It uses `openai-codex/gpt-6.1-sol` with `xhigh` thinking, writes code within an explicit scope, and asks questions when blocked. It does not perform independent reviews; assign those to Binah.

## Assignment tools

- `subagent`: launch asynchronously and return an acknowledgement.
- `subagent_message`: steer a running agent, answer its question, or resume a finished session by its persistent name.
- `subagents_list`: discover role definitions, not runtime progress.
- `ask_question`: available in child sessions; parks the child until the parent replies.
- `/subagent <name-or-team> <task>`: request a launch from the parent; Angela supplies writer scopes as needed.

```ts
subagent({
  agent: "Chesed",
  name: "cancel-fix",
  task: "Fix cancellation so the current operation releases its resources. Inspect the relevant contracts first.",
  write_scope: ["src/operation.ts"],
  constraints: ["Preserve the public API", "Do not modify tests; Hod owns them"],
  checks: ["Existing cancellation test passes", "Explain the cleanup path and remaining risks"],
});

subagent({
  agent: "Hod",
  task: "Add a regression test for cancellation cleanup. The implementation is assigned separately; do not change it.",
  write_scope: ["test/operation.test.ts"],
  checks: ["Test fails against the old behavior and passes with the fix"],
});

subagent_message({ name: "cancel-fix", message: "Keep the existing public return type." });
```

Only activate roles that materially help. Small tasks are often better done directly. Results arrive automatically as steered messages; never poll or assume success. A final result should identify changed paths, checks actually run, observed outcomes, blockers, risks, and pending human checks. Angela inspects the actual diff and reconciles findings; **the user accepts the work**.

## Ownership and concurrency

- Bundled writers require `write_scope`, an array of literal file/directory paths relative to the child cwd. Globs and empty paths are rejected.
- Existing path ancestors are canonicalized, including symlinks; duplicate paths collapse.
- Directory/descendant overlaps with active sibling assignments are rejected **before pane creation**. Reservations include pending launches and agents waiting for replies.
- A finished session's scope is stored in its loadout snapshot and reserved again before resume. To change ownership, create a new assignment rather than expanding scope through a message.
- Failed or aborted launches release reservations and close their pane. Completion, watcher failure, and shutdown cancellation release reservations. Duplicate names cannot launch/resume concurrently.
- Default capacity is **three** active or starting assignments, including read-only agents. Set `PI_LOBOTOMY_MAX_AGENTS` to a positive integer before starting Pi to change it (`PI_ANGELA_MAX_AGENTS` remains a compatibility fallback). There is no queue or automatic dispatch.

**This is coordination, not a filesystem sandbox.** Scope checks cover only this parent's child assignments, not edits by the main agent, other Pi sessions, other processes, hard-link aliases, or shared build outputs. Do not modify a worker's files concurrently. Serialize builds with common outputs or use isolated output directories. `bash` has ordinary user permissions and can write outside assigned paths; instructions are not confinement. Path aliases created or retargeted after reservation can evade overlap checks.

The tool allowlist controls model-visible tools, not operating-system privileges. Child processes use `--no-extensions` and an explicit tool/extension loadout. Custom profiles and extensions are trusted code, not a security boundary.

## Profiles and configuration

Profiles live in `agents/*.md`; customize with `.pi/agents/*.md` or `~/.pi/agent/agents/*.md` (`PI_CODING_AGENT_DIR` overrides the global directory).

```md
---
name: my-writer
description: A narrowly scoped implementer
tools: read, grep, find, ls, edit, write, bash
model: openai-codex/gpt-6-luna
thinking: high
system-prompt: append
session-mode: lineage-only
auto-exit: true
write-scope-required: true
---

Read the relevant contracts, modify only assigned paths, and report actual validation.
```

`write-scope-required: true` opts custom profiles into required ownership declarations. Supplying a scope reserves it even for profiles without this flag. Omitting the flag on a custom writer permits scopeless work; Angela should still assign explicit scopes. Frontmatter also retains upstream `model`, `cwd`, `skills`, `interactive`, `disable-model-invocation`, `session-mode` (`standalone`, `lineage-only`, `fork`), and `subagent_agents` fields. Nested delegation is not granted to bundled roles; custom profiles can deliberately enable it, outside the default coordination policy. Ownership gates are per parent, not global across a tree.

No network-research extension is assumed. Custom extension-backed tools can be registered through the retained `__pi_interactive_subagents.registerToolExtension(name, path)` hook. Child tool restrictions and identity are snapshotted beside session files and replayed on resume. Resume still refuses sessions without an upstream-compatible loadout snapshot.

The status widget remains compact and follows runtime activity. Copy `config.json.example` to `config.json` to customize status configuration. `PI_SUBAGENT_SHELL_READY_DELAY_MS` controls shell startup delay (default 500 ms). Subagents exit on Pi's final `agent_settled` event, not the earlier `agent_end` boundary, so automatic retries and queued work are not cut off.

## Validation

```sh
npm run check       # Strict TypeScript check of extension code
npm test           # Session/status/loadout/coordination/profile/lifecycle regression tests
npm run test:tmux   # Real tmux surfaces + deterministic CLI-double lifecycle; no model calls
npm run test:integration  # Also runs live-model lifecycle tests; requires credentials and incurs model usage
```

The tmux tests require a live tmux session; the CLI-double test also requires Python 3. The deterministic lifecycle test covers writer scope requirements, aborted launch and UI-failure cleanup, overlapping writers, questions, completion, loadout replay, conflicting resume, and shutdown cancellation; its CLI double does not prove real model behavior. Full lifecycle tests use `PI_TEST_MODEL` (default `anthropic/claude-haiku-4-5`) and `PI_TEST_TIMEOUT`. Automated checks do not replace interactive acceptance: exercise launch, overlapping writer rejection, questions, completion, resume, cancellation/reload, and pane focus in a fresh Pi session before switching the installed package.

## Provenance and license

Cloned from [amosblomqvist/pi-interactive-subagents](https://github.com/amosblomqvist/pi-interactive-subagents), itself derived from [HazAT/pi-interactive-subagents](https://github.com/HazAT/pi-interactive-subagents). Original MIT license and git history are retained. This is a separate local repository; no remote has been published.
