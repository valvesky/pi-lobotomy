import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, mkdirSync, readFileSync, rmSync, symlinkSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { AssignmentGate, canonicalScope, formatTaskBrief, prepareWriteScope, scopesOverlap } from "../pi-extension/subagents/coordination.ts";
import extension, { __test__ } from "../pi-extension/subagents/index.ts";

const root = dirname(dirname(fileURLToPath(import.meta.url)));
const roles = ["yesod", "netzach", "hod", "gebura", "chesed", "binah"];
const writers = new Set(["hod", "chesed"]);

function withDirectory(run: (cwd: string) => void) {
  const cwd = mkdtempSync(join(tmpdir(), "angela-coordination-"));
  try { run(cwd); } finally { rmSync(cwd, { recursive: true, force: true }); }
}

describe("assignment coordination", () => {
  it("reserves before asynchronous launch, rejects overlaps, and releases idempotently", () => {
    const gate = new AssignmentGate();
    const release = gate.acquire("malkuth", ["/project/src"]);
    assert.throws(() => gate.acquire("hod", ["/project/src/tests.ts"]), /conflicts.*malkuth/);
    assert.throws(() => gate.acquire("gebura", ["/project"]), /conflicts/);
    const releaseOther = gate.acquire("chesed", ["/project/src-other"]);
    release(); release();
    const next = gate.acquire("hod", ["/project/src/tests.ts"]);
    next(); releaseOther();
  });

  it("counts read-only and pending assignments toward the cap", () => {
    const gate = new AssignmentGate(2);
    const one = gate.acquire("yesod", []);
    const two = gate.acquire("binah", []);
    assert.throws(() => gate.acquire("netzach", []), /limit.*reached/);
    one();
    const three = gate.acquire("netzach", []);
    two(); three();
  });

  it("prevents simultaneous resumes of the same name", () => {
    const gate = new AssignmentGate();
    const release = gate.acquire("yesod", []);
    assert.throws(() => gate.acquire("yesod", []), /already starting or running/);
    release(); gate.acquire("yesod", [])();
  });

  it("does not consume a slot after a rejected reservation", () => {
    const gate = new AssignmentGate(2);
    const release = gate.acquire("one", ["/project/a"]);
    assert.throws(() => gate.acquire("two", ["/project/a"]), /conflicts/);
    gate.acquire("two", ["/project/b"])();
    release();
  });

  it("validates capacity", () => {
    for (const limit of [0, -1, 1.5, NaN, Infinity]) assert.throws(() => new AssignmentGate(limit), /positive integer/);
  });

  it("handles parent scopes without treating path prefixes as containment", () => {
    assert.equal(scopesOverlap("/a/b", "/a/b"), true);
    assert.equal(scopesOverlap("/a/b", "/a/b/c"), true);
    assert.equal(scopesOverlap("/", "/a"), true);
    assert.equal(scopesOverlap("/a/b", "/a/bc"), false);
  });

  it("canonicalizes new paths and symlinked existing ancestors", () => withDirectory((cwd) => {
    mkdirSync(join(cwd, "src"));
    symlinkSync(join(cwd, "src"), join(cwd, "alias"));
    assert.equal(canonicalScope("alias/new/file.ts", cwd), join(cwd, "src/new/file.ts"));
    assert.equal(canonicalScope("src/../src/new/file.ts", cwd), join(cwd, "src/new/file.ts"));
  }));

  it("requires writer scopes and rejects blanks and globs", () => withDirectory((cwd) => {
    assert.throws(() => prepareWriteScope({ task: "fix" }, cwd, true), /requires write_scope/);
    assert.deepEqual(prepareWriteScope({ task: "inspect" }, cwd, false), []);
    for (const path of ["", "  ", "src/*", "src/[ab].ts"]) assert.throws(() => canonicalScope(path, cwd), /literal/);
    assert.deepEqual(prepareWriteScope({ task: "fix", write_scope: ["src", "./src"] }, cwd, true), [join(cwd, "src")]);
  }));

  it("passes context, scope, constraints, and observed acceptance criteria to the child", () => {
    const task = formatTaskBrief({ task: "Fix cancellation", write_scope: ["/project/src/a.ts"], constraints: ["Preserve API"], checks: ["Cancellation releases ownership"] });
    assert.match(task, /^Fix cancellation/);
    assert.match(task, /Exclusive write scope.*\n- \/project\/src\/a.ts/);
    assert.match(task, /Constraints:\n- Preserve API/);
    assert.match(task, /Acceptance checks.*\n- Cancellation releases ownership/);
    assert.equal(formatTaskBrief({ task: "inspect" }), "inspect");
  });
});

describe("coding team", () => {
  it("bundles six distinct profiles with narrow tools and no recursive delegation", () => {
    for (const name of roles) {
      const definition = __test__.parseAgentDefinition(readFileSync(join(root, "agents", `${name}.md`), "utf8"), name)!;
      assert.equal(definition.name, name);
      assert.equal(definition.subagentAgents, undefined);
      assert.equal(definition.model, "openai-codex/gpt-6-luna", "all bundled roles use the requested model");
      assert.equal(definition.thinking, name === "yesod" || name === "gebura" ? "low" : name === "chesed" ? "medium" : "high");
      assert.equal(definition.autoExit, true);
      assert.equal(definition.sessionMode, "lineage-only");
      assert.equal(definition.writeScopeRequired ?? false, writers.has(name));
      if (!writers.has(name)) for (const tool of (name === "yesod" ? ["edit", "write"] : ["bash", "edit", "write"])) assert.equal(definition.tools?.split(/,\s*/).includes(tool), false);
      const personalName = name[0].toUpperCase() + name.slice(1);
      assert.match(definition.body!, new RegExp(`You are ${personalName}\\b`));
      assert.match(definition.body!, /ask_question/);
    }
  });

  it("adds Angela as a structured prompt section only in a coordinator session", () => {
    const previous = process.env.PI_SUBAGENT_AGENT;
    try {
      const create = () => {
        const handlers = new Map<string, Function>();
        extension({ on(name: string, fn: Function) { handlers.set(name, fn); }, registerTool() {}, registerCommand() {}, registerMessageRenderer() {} } as any);
        return handlers;
      };
      delete process.env.PI_SUBAGENT_AGENT;
      const handlers = create();
      const event = { systemPromptOptions: { sections: { existing: "keep" } } };
      handlers.get("before_agent_start")!(event);
      assert.equal(event.systemPromptOptions.sections.existing, "keep");
      assert.match((event.systemPromptOptions.sections as any).angela, /You are Angela/);
      assert.match((event.systemPromptOptions.sections as any).angela, /prohibitions on delegation/);
      assert.match((event.systemPromptOptions.sections as any).angela, /personal names, like Angela, not role titles/);
      assert.match((event.systemPromptOptions.sections as any).angela, /Yesod's workers belong to the Information Team/);
      assert.match((event.systemPromptOptions.sections as any).angela, /Team membership does not itself grant delegation permission/);
      for (const id of roles) {
        const personalName = id[0].toUpperCase() + id.slice(1);
        assert.ok((event.systemPromptOptions.sections as any).angela.includes(`- ${personalName} (\`${id}\`):`));
      }
      process.env.PI_SUBAGENT_AGENT = "gebura";
      assert.equal(create().has("before_agent_start"), false);
    } finally {
      if (previous === undefined) delete process.env.PI_SUBAGENT_AGENT;
      else process.env.PI_SUBAGENT_AGENT = previous;
    }
  });
});
