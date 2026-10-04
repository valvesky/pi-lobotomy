/** Real tmux + deterministic CLI double. No model calls or credentials. */
import { it } from "node:test";
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import extension from "../../pi-extension/subagents/index.ts";
import { readSubagentLoadout } from "../../pi-extension/subagents/session.ts";
import { isMuxAvailable } from "../../pi-extension/subagents/tmux.ts";

it("coordinates launch, questions, completion, conflicting resume, and cancellation", { skip: !isMuxAvailable(), timeout: 40_000 }, async () => {
  const dir = mkdtempSync(join(tmpdir(), "angela-lifecycle-"));
  const sessionName = `angela-test-${process.pid}`;
  const old = { pane: process.env.TMUX_PANE, agentDir: process.env.PI_CODING_AGENT_DIR };
  const handlers = new Map<string, Function>();
  const tools = new Map<string, any>();
  const queued: any[] = [];
  const waiters: Array<{ type: string; name: string; resolve: (message: any) => void }> = [];
  let shutdown: Function | undefined;
  let ctx: any;

  function receive(message: any) {
    const index = waiters.findIndex((w) => w.type === message.customType && w.name === message.details?.name);
    if (index < 0) queued.push(message);
    else waiters.splice(index, 1)[0].resolve(message);
  }
  function next(type: string, name: string): Promise<any> {
    const index = queued.findIndex((m) => m.customType === type && m.details?.name === name);
    if (index >= 0) return Promise.resolve(queued.splice(index, 1)[0]);
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => reject(new Error(`No ${type} for ${name}: ${JSON.stringify(queued)}`)), 10_000);
      timer.unref();
      waiters.push({ type, name, resolve(message) { clearTimeout(timer); resolve(message); } });
    });
  }
  function call(tool: string, params: any, signal = new AbortController().signal) {
    return tools.get(tool).execute("test", params, signal, undefined, ctx);
  }

  try {
    const bin = join(dir, "bin");
    mkdirSync(bin);
    writeFileSync(join(bin, "pi"), `#!/usr/bin/env python3
import json, os, sys, uuid
args = sys.argv[1:]
session = args[args.index('--session') + 1]
with open(session + '.argv', 'w') as f: json.dump(args, f)
with open(session + '.ask', 'w') as f:
    json.dump({'name': os.environ['PI_SUBAGENT_NAME'], 'agent': os.environ['PI_SUBAGENT_AGENT'], 'question': 'Proceed with synthetic completion?'}, f)
reply = sys.stdin.readline().strip()
with open(session, 'a') as f:
    f.write(json.dumps({'type': 'message', 'id': str(uuid.uuid4()), 'parentId': None, 'message': {'role': 'assistant', 'content': [{'type': 'text', 'text': 'Synthetic result: ' + reply}]}}) + '\\n')
with open(session + '.exit', 'w') as f: json.dump({'type': 'done'}, f)
`, { mode: 0o755 });
    const anchor = execFileSync("tmux", ["new-session", "-d", "-s", sessionName, "-x", "160", "-y", "50", "-P", "-F", "#{pane_id}", "/bin/bash --noprofile --norc"], { encoding: "utf8" }).trim();
    const rcfile = join(dir, "bashrc");
    writeFileSync(rcfile, `export PATH='${bin}':$PATH\n`);
    execFileSync("tmux", ["set-option", "-t", sessionName, "default-shell", "/bin/bash"]);
    execFileSync("tmux", ["set-option", "-t", sessionName, "default-command", `/bin/bash --noprofile --rcfile ${rcfile} -i`]);
    execFileSync("tmux", ["set-environment", "-t", sessionName, "PATH", `${bin}:${process.env.PATH}`]);
    process.env.TMUX_PANE = anchor;
    process.env.PI_CODING_AGENT_DIR = join(dir, "agent");
    const parentDir = join(dir, "parent");
    mkdirSync(parentDir);
    const parentFile = join(parentDir, "parent.jsonl");
    writeFileSync(parentFile, JSON.stringify({ type: "session", id: "parent", version: 3, cwd: dir }) + "\n");
    ctx = {
      cwd: dir,
      model: { provider: "synthetic", id: "coding-model" },
      sessionManager: { getSessionFile: () => parentFile, getSessionId: () => "parent", getSessionDir: () => parentDir },
      ui: { setWidget() {} },
    };
    extension({
      on(event: string, fn: Function) { handlers.set(event, fn); },
      registerTool(tool: any) { tools.set(tool.name, tool); },
      registerCommand() {}, registerMessageRenderer() {}, sendMessage: receive,
    } as any);
    handlers.get("session_start")!({}, ctx);
    shutdown = handlers.get("session_shutdown");

    await assert.rejects(call("subagent", { agent: "chesed", name: "missing-scope", task: "fix" }), /requires write_scope/);
    const abort = new AbortController();
    const pending = call("subagent", { agent: "chesed", name: "aborted-launch", task: "fix", cwd: dir, write_scope: ["src/a.ts"] }, abort.signal);
    abort.abort();
    await assert.rejects(pending, { name: "AbortError" });
    assert.equal(execFileSync("tmux", ["list-panes", "-t", sessionName, "-F", "#{pane_id}"], { encoding: "utf8" }).trim(), anchor, "aborted launch leaves no pane");
    ctx.hasUI = true;
    ctx.ui.setWidget = () => { throw new Error("synthetic UI failure"); };
    await assert.rejects(call("subagent", { agent: "chesed", name: "ui-failure", task: "fix", cwd: dir, write_scope: ["src/a.ts"] }), /synthetic UI failure/);
    ctx.hasUI = false;
    ctx.ui.setWidget = () => {};
    assert.equal(execFileSync("tmux", ["list-panes", "-t", sessionName, "-F", "#{pane_id}"], { encoding: "utf8" }).trim(), anchor, "UI failure leaves no pane");
    const first = await call("subagent", { agent: "chesed", name: "first", task: "fix", cwd: dir, write_scope: ["src/a.ts"], constraints: ["Preserve API"], checks: ["Report actual result"] });
    await assert.rejects(call("subagent", { agent: "hod", name: "overlap", task: "test", cwd: dir, write_scope: ["src"] }), /conflicts.*first/);
    await next("subagent_question", "first");
    const loadout = readSubagentLoadout(first.details.sessionFile)!;
    assert.deepEqual(loadout.writeScope, [join(dir, "src/a.ts")]);
    assert.equal(loadout.cwd, dir);
    assert.equal(loadout.model, "openai-codex/gpt-6-luna", "profile model takes precedence over the coordinator's model");
    assert.equal(loadout.spawnable, null);
    const argv = JSON.parse(readFileSync(first.details.sessionFile + ".argv", "utf8"));
    assert.ok(argv.includes("--no-extensions"));
    assert.equal(argv[argv.indexOf("--model") + 1], "openai-codex/gpt-6-luna:high");
    const allowlist = argv[argv.indexOf("--tools") + 1];
    assert.match(allowlist, /edit/);
    assert.doesNotMatch(allowlist, /subagent/);
    const taskPath = argv.find((arg: string) => arg.startsWith("@"));
    const task = readFileSync(taskPath.slice(1), "utf8");
    assert.match(task, /Preserve API/);
    assert.match(task, /Report actual result/);
    await call("subagent_message", { name: "first", message: "approved" });
    assert.match((await next("subagent_result", "first")).content, /Synthetic result: approved/);

    await call("subagent", { agent: "chesed", name: "second", task: "fix", cwd: dir, write_scope: ["src/a.ts"] });
    await next("subagent_question", "second");
    await assert.rejects(call("subagent_message", { name: "first", message: "follow up" }), /conflicts.*second/);
    await call("subagent_message", { name: "second", message: "done" });
    await next("subagent_result", "second");

    const resumed = await call("subagent_message", { name: "first", message: "follow up" });
    assert.equal(resumed.details.sessionFile, first.details.sessionFile);
    await next("subagent_question", "first");
    const resumedArgv = JSON.parse(readFileSync(first.details.sessionFile + ".argv", "utf8"));
    assert.equal(resumedArgv[resumedArgv.indexOf("--model") + 1], "openai-codex/gpt-6-luna:high");
    await call("subagent_message", { name: "first", message: "resumed" });
    assert.match((await next("subagent_result", "first")).content, /Synthetic result: resumed/);

    await call("subagent", { agent: "hod", name: "cancelled", task: "test", cwd: dir, write_scope: ["src/a.ts"] });
    await next("subagent_question", "cancelled");
    shutdown!({}, ctx);
    assert.notEqual((await next("subagent_result", "cancelled")).details.exitCode, 0);
    handlers.get("session_start")!({}, ctx);
    await call("subagent", { agent: "hod", name: "after-cancel", task: "test", cwd: dir, write_scope: ["src/a.ts"] });
    await next("subagent_question", "after-cancel");
    await call("subagent_message", { name: "after-cancel", message: "done" });
    await next("subagent_result", "after-cancel");
  } finally {
    shutdown?.({}, ctx);
    try { execFileSync("tmux", ["kill-session", "-t", sessionName], { stdio: "ignore" }); } catch {}
    for (const [key, value] of [["TMUX_PANE", old.pane], ["PI_CODING_AGENT_DIR", old.agentDir]]) {
      if (value === undefined) delete process.env[key!]; else process.env[key!] = value;
    }
    rmSync(dir, { recursive: true, force: true });
  }
});
