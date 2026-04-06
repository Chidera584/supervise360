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
};

/**
 * Run clingo on a logic program string. Returns parsed atoms from the last printed answer set.
 */
export async function runClingoProgram(
  program: string,
  options?: { timeoutMs?: number; extraArgs?: string[] }
): Promise<ClingoRunResult> {
  const timeoutMs = options?.timeoutMs ?? 60_000;
  const invocations = resolveClingoInvocations();
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'supervise360-asp-'));
  const lpPath = path.join(dir, 'program.lp');
  try {
    fs.writeFileSync(lpPath, program, 'utf8');

    let lastFailure = '';
    for (const inv of invocations) {
      const args = [
        ...inv.argsPrefix,
        '--quiet=1',
        '--opt-mode=opt',
        '-n',
        '1',
        ...(options?.extraArgs ?? []),
        lpPath,
        '0',
      ];
      try {
        const { stdout, stderr } = await execFileAsync(inv.exe, args, {
          timeout: timeoutMs,
          maxBuffer: 20 * 1024 * 1024,
          windowsHide: true,
        });
        const sat = /Answer:\s*\d+/i.test(stdout) && !/UNSATISFIABLE/i.test(stdout);
        const atoms = sat ? parseAnswerSet(stdout) : [];
        if (sat) console.log(`✅ [ASP] Solver used: ${inv.label}`);
        return { ok: true, sat, stdout, stderr: stderr || '', atoms };
      } catch (e: unknown) {
        const err = e as NodeJS.ErrnoException & { stdout?: string; stderr?: string; status?: number };
        const stdout = typeof err.stdout === 'string' ? err.stdout : '';
        const stderr = typeof err.stderr === 'string' ? err.stderr : '';
        const combined = `${stdout}\n${stderr}`;
        if (/UNSATISFIABLE/i.test(combined)) {
          return { ok: true, sat: false, stdout, stderr, atoms: [] };
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
    };
  } catch (e: unknown) {
    return { ok: false, sat: false, stdout: '', stderr: String(e), atoms: [] };
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
