import { execFile } from 'child_process';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { promisify } from 'util';

const execFileAsync = promisify(execFile);

export type ClingoAtom = { name: string; args: string[] };

type ClingoInvocation = { exe: string; argsPrefix: string[]; label: string };

function deriveCondaPythonFromClingoPath(clingoPath: string): string | null {
  const normalized = path.normalize(clingoPath);
  const suffix = `${path.sep}Library${path.sep}bin${path.sep}clingo.exe`;
  if (!normalized.toLowerCase().endsWith(suffix.toLowerCase())) return null;
  const envRoot = normalized.slice(0, normalized.length - suffix.length);
  const py = path.join(envRoot, 'python.exe');
  return fs.existsSync(py) ? py : null;
}

function resolveClingoInvocations(): ClingoInvocation[] {
  const out: ClingoInvocation[] = [];
  const fromEnv = process.env.CLINGO_PATH?.trim();
  if (fromEnv) {
    out.push({ exe: fromEnv, argsPrefix: [], label: 'CLINGO_PATH executable' });
    const condaPy = deriveCondaPythonFromClingoPath(fromEnv);
    if (condaPy) {
      out.push({
        exe: condaPy,
        argsPrefix: ['-m', 'clingo'],
        label: 'derived conda python -m clingo',
      });
    }
  }
  const pyFromEnv = process.env.CLINGO_PYTHON_PATH?.trim();
  if (pyFromEnv) {
    out.push({ exe: pyFromEnv, argsPrefix: ['-m', 'clingo'], label: 'CLINGO_PYTHON_PATH -m clingo' });
  }
  out.push({ exe: 'clingo', argsPrefix: [], label: 'clingo on PATH' });
  return out;
}

/**
 * Parse clingo stdout for the last answer set (facts like assign(1,2) or in_group(3,4)).
 */
export function parseAnswerSet(stdout: string): ClingoAtom[] {
  const lines = stdout.split(/\r?\n/);
  const atoms: ClingoAtom[] = [];
  let capture = false;

  const parseAtomToken = (p: string) => {
    const m = /^(\w+)\(([^)]*)\)\.$/.exec(p) || /^(\w+)\(([^)]*)\)$/.exec(p);
    if (!m) return;
    const name = m[1];
    const rawArgs = m[2].trim();
    const args = rawArgs.length === 0 ? [] : rawArgs.split(',').map((a) => a.trim());
    atoms.push({ name, args });
  };

  for (const line of lines) {
    if (/^Answer:\s*\d+/i.test(line)) {
      atoms.length = 0;
      capture = true;
      continue;
    }
    if (!capture) continue;

    const trimmed = line.trim();
    if (
      trimmed.startsWith('Optimization:') ||
      trimmed.startsWith('OPTIMUM') ||
      trimmed.startsWith('Models') ||
      trimmed.startsWith('Calls') ||
      trimmed.startsWith('Time') ||
      trimmed.startsWith('SATISFIABLE') ||
      trimmed.startsWith('UNSATISFIABLE')
    ) {
      capture = false;
      continue;
    }
    if (!trimmed) continue;

    const parts = trimmed.split(/\s+/).filter(Boolean);
    for (const p of parts) parseAtomToken(p);
  }
  return atoms;
}

export type ClingoRunResult = {
  ok: boolean;
  sat: boolean;
  stdout: string;
  stderr: string;
  atoms: ClingoAtom[];
  /** Wall-clock time actually spent inside the solver (this process invocation only). */
  solveTimeMs: number;
  /** Parsed from the last "Optimization: a b c" line - lower is better per weak-constraint priority. */
  optimization: number[] | null;
  /** Which invocation (CLINGO_PATH, derived conda python, etc.) actually produced this result. */
  solverLabel: string | null;
  /**
   * True only if clingo printed "OPTIMUM FOUND" before the timeout - i.e. the answer is
   * proven optimal, not just the best one found within the time budget.
   */
  optimal: boolean;
};

/** Parses the last "Optimization: <n1> <n2> ..." line clingo prints (one number per weak-constraint priority). */
function parseOptimization(stdout: string): number[] | null {
  const matches = [...stdout.matchAll(/^Optimization:\s*(.+)$/gim)];
  if (matches.length === 0) return null;
  const last = matches[matches.length - 1][1];
  const nums = last.trim().split(/\s+/).map(Number);
  return nums.every((n) => Number.isFinite(n)) ? nums : null;
}

/**
 * Run clingo on a logic program string. Returns parsed atoms from the last printed answer set.
 *
 * `optStrategy` defaults to `usc` (unsatisfiable-core-guided optimization), which for the group
 * formation encoding's weighted-sum objectives reaches a good candidate answer far faster than
 * the default branch-and-bound strategy on tier-skewed cohorts - `bb` was observed to still be
 * searching after 90s on an 8-HIGH/2-MEDIUM/7-LOW 17-student instance, while `usc` finds an
 * equally good candidate within milliseconds. The supervisor assignment encoding is the opposite:
 * its "guess a bound, minimize the bound" idiom (maxb/gen) suits `bb` far better - `usc` found
 * zero candidates within budget at 15+ groups. Pass `optStrategy` explicitly per encoding rather
 * than relying on the default.
 *
 * Note: `--quiet=1` is deliberately NOT passed - with it, clingo's progression/answer lines never
 * reach the pipe before a timeout-kill (observed consistently: 89 bytes captured regardless of
 * how long a proven-optimal search would take), so a killed run always looked like total failure.
 * Without it, each candidate answer is flushed as it's found, which is what makes the salvage
 * behavior below possible.
 *
 * If clingo doesn't finish (and thus can't prove optimality) within timeoutMs, the process is
 * killed - but Node still delivers whatever stdout was flushed before the kill. Every printed
 * "Answer:" block already satisfies all hard integrity constraints (clingo never prints an
 * invalid answer while still searching for a better one - optimization only ever improves a
 * valid candidate), so a killed run with at least one Answer block is treated as a valid,
 * best-effort (not proven-optimal) result rather than a failure. `optimal: false` on the
 * returned result distinguishes this from a proven-optimal solve.
 */
export async function runClingoProgram(
  program: string,
  options?: { timeoutMs?: number; extraArgs?: string[]; optStrategy?: 'usc' | 'bb' }
): Promise<ClingoRunResult> {
  const timeoutMs = options?.timeoutMs ?? 60_000;
  const optStrategy = options?.optStrategy ?? 'usc';
  const invocations = resolveClingoInvocations();
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'supervise360-asp-'));
  const lpPath = path.join(dir, 'program.lp');
  try {
    fs.writeFileSync(lpPath, program, 'utf8');

    let lastFailure = '';
    for (const inv of invocations) {
      // NOTE: do not also pass `-n 1` here - clingo treats the trailing '0' (models to
      // compute) and `-n`/`--models` as the same option, and passing both errors with
      // "multiple occurrences: 'models'" (exit code non-zero, caught below as solver
      // failure -> silently falls back to the heuristic path). `--opt-mode=opt` with a
      // model count of 0 already stops at the first proven-optimal answer; it does not
      // enumerate every tied-optimal model the way `--opt-mode=optN` would.
      const args = [
        ...inv.argsPrefix,
        '--opt-mode=opt',
        `--opt-strategy=${optStrategy}`,
        ...(options?.extraArgs ?? []),
        lpPath,
        '0',
      ];
      const startedAt = Date.now();
      try {
        const { stdout, stderr } = await execFileAsync(inv.exe, args, {
          timeout: timeoutMs,
          maxBuffer: 20 * 1024 * 1024,
          windowsHide: true,
        });
        const solveTimeMs = Date.now() - startedAt;
        const sat = /Answer:\s*\d+/i.test(stdout) && !/UNSATISFIABLE/i.test(stdout);
        const atoms = sat ? parseAnswerSet(stdout) : [];
        const optimal = /OPTIMUM FOUND/i.test(stdout);
        if (sat) console.log(`✅ [ASP] Solver used: ${inv.label} (${solveTimeMs}ms, optimal=${optimal})`);
        return {
          ok: true,
          sat,
          stdout,
          stderr: stderr || '',
          atoms,
          solveTimeMs,
          optimization: parseOptimization(stdout),
          solverLabel: sat ? inv.label : null,
          optimal,
        };
      } catch (e: unknown) {
        const solveTimeMs = Date.now() - startedAt;
        const err = e as NodeJS.ErrnoException & { stdout?: string; stderr?: string; status?: number; killed?: boolean };
        const stdout = typeof err.stdout === 'string' ? err.stdout : '';
        const stderr = typeof err.stderr === 'string' ? err.stderr : '';
        const combined = `${stdout}\n${stderr}`;
        if (/UNSATISFIABLE/i.test(combined)) {
          return { ok: true, sat: false, stdout, stderr, atoms: [], solveTimeMs, optimization: null, solverLabel: null, optimal: false };
        }
        // Timed out (or otherwise killed) mid-search: salvage the best answer found so far if
        // one exists. It's still a fully valid (hard-constraint-satisfying) answer set - just
        // not proven optimal.
        const salvageable = /Answer:\s*\d+/i.test(stdout);
        if (err.killed && salvageable) {
          console.warn(
            `⚠️  [ASP] ${inv.label} hit the ${timeoutMs}ms time budget before proving optimality; using best answer found so far.`
          );
          return {
            ok: true,
            sat: true,
            stdout,
            stderr,
            atoms: parseAnswerSet(stdout),
            solveTimeMs,
            optimization: parseOptimization(stdout),
            solverLabel: inv.label,
            optimal: false,
          };
        }
        lastFailure = `${inv.label} failed (${err.code || err.status || 'error'}): ${stderr || String(e)}`;
      }
    }

    return {
      ok: false,
      sat: false,
      stdout: '',
      stderr: lastFailure || 'No clingo invocation succeeded',
      atoms: [],
      solveTimeMs: 0,
      optimization: null,
      solverLabel: null,
      optimal: false,
    };
  } catch (e: unknown) {
    return {
      ok: false,
      sat: false,
      stdout: '',
      stderr: String(e),
      atoms: [],
      solveTimeMs: 0,
      optimization: null,
      solverLabel: null,
      optimal: false,
    };
  } finally {
    try {
      fs.unlinkSync(lpPath);
      fs.rmdirSync(dir);
    } catch {
      /* ignore */
    }
  }
}

export function clingoConfiguredMessage(): string {
  const hasPath = process.env.CLINGO_PATH && process.env.CLINGO_PATH.trim().length > 0;
  const hasPy = process.env.CLINGO_PYTHON_PATH && process.env.CLINGO_PYTHON_PATH.trim().length > 0;
  if (hasPath || hasPy) {
    return `CLINGO_PATH=${process.env.CLINGO_PATH || '(not set)'}, CLINGO_PYTHON_PATH=${process.env.CLINGO_PYTHON_PATH || '(not set)'}`;
  }
  return 'clingo on PATH (or set CLINGO_PATH / CLINGO_PYTHON_PATH)';
}
