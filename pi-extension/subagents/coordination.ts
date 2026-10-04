import { existsSync, realpathSync } from "node:fs";
import { basename, dirname, isAbsolute, join, relative, resolve, sep } from "node:path";

export interface TaskBrief {
  task: string;
  write_scope?: string[];
  constraints?: string[];
  checks?: string[];
}

/** Canonicalize existing ancestors too, so new files under symlinks conflict. */
export function canonicalScope(path: string, cwd: string): string {
  if (!path.trim() || /[*?\[\]{}]/.test(path)) {
    throw new Error("write_scope needs literal file or directory paths, not blanks or globs");
  }
  let ancestor = resolve(cwd, path);
  const suffix: string[] = [];
  while (!existsSync(ancestor)) {
    const parent = dirname(ancestor);
    if (parent === ancestor) throw new Error(`Cannot resolve scope: ${path}`);
    suffix.unshift(basename(ancestor));
    ancestor = parent;
  }
  return join(realpathSync(ancestor), ...suffix);
}

export function scopesOverlap(a: string, b: string): boolean {
  const nested = (parent: string, child: string) => {
    const rest = relative(parent, child);
    return rest === "" || (!isAbsolute(rest) && rest !== ".." && !rest.startsWith(`..${sep}`));
  };
  return nested(a, b) || nested(b, a);
}

/** Synchronous reservations include launches that have not yet created a pane. */
export class AssignmentGate {
  private active = new Map<symbol, { name: string; scopes: string[] }>();

  private limit: number;

  constructor(limit = 3) {
    if (!Number.isSafeInteger(limit) || limit < 1) throw new Error("Agent limit must be a positive integer");
    this.limit = limit;
  }

  acquire(name: string, scopes: string[]): () => void {
    for (const assignment of this.active.values()) {
      if (assignment.name === name) throw new Error(`Assignment "${name}" is already starting or running`);
      for (const scope of scopes) {
        if (assignment.scopes.some((other) => scopesOverlap(scope, other))) {
          throw new Error(`Write scope ${scope} conflicts with assignment "${assignment.name}"`);
        }
      }
    }
    if (this.active.size >= this.limit) {
      throw new Error(`Agent limit (${this.limit}) reached. Work directly or await an automatic result; do not poll.`);
    }
    const key = Symbol(name);
    this.active.set(key, { name, scopes: [...scopes] });
    return () => { this.active.delete(key); };
  }
}

export function formatTaskBrief(brief: TaskBrief): string {
  const blocks = [brief.task];
  if (brief.write_scope?.length) blocks.push(`Exclusive write scope (do not modify other paths):\n${brief.write_scope.map((s) => `- ${s}`).join("\n")}`);
  if (brief.constraints?.length) blocks.push(`Constraints:\n${brief.constraints.map((s) => `- ${s}`).join("\n")}`);
  if (brief.checks?.length) blocks.push(`Acceptance checks (report observed outcomes, not just commands):\n${brief.checks.map((s) => `- ${s}`).join("\n")}`);
  return blocks.join("\n\n");
}

export function prepareWriteScope(brief: TaskBrief, cwd: string, required: boolean): string[] {
  const scopes = [...new Set((brief.write_scope ?? []).map((path) => canonicalScope(path, cwd)))];
  if (required && scopes.length === 0) throw new Error("This writer requires write_scope: list the files or directories it owns");
  return scopes;
}
