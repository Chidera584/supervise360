import { execFile } from 'child_process';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { promisify } from 'util';

const execFileAsync = promisify(execFile);

export type ClingoAtom = { name: string; args: string[] };

function resolveClingoExecutable(): string {
  const fromEnv = process.env.CLINGO_PATH?.trim();
  if (fromEnv) return fromEnv;
  return 'clingo';
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
  const exe = resolveClingoExecutable();
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'supervise360-asp-'));
  const lpPath = path.join(dir, 'program.lp');
  try {
    fs.writeFileSync(lpPath, program, 'utf8');
    const args = [
      '--quiet=1',
      '--opt-mode=opt',
      '-n',
      '1',
      ...(options?.extraArgs ?? []),
      lpPath,
      '0',
    ];
    const { stdout, stderr } = await execFileAsync(exe, args, {
      timeout: timeoutMs,
      maxBuffer: 20 * 1024 * 1024,
      windowsHide: true,
    });
    const out = `${stdout}\n${stderr}`;
    const sat = /Answer:\s*\d+/i.test(stdout) && !/UNSATISFIABLE/i.test(stdout);
    const atoms = sat ? parseAnswerSet(stdout) : [];
    return { ok: true, sat, stdout, stderr: stderr || '', atoms };
  } catch (e: unknown) {
    const err = e as NodeJS.ErrnoException & { stdout?: string; stderr?: string };
    const stdout = typeof err.stdout === 'string' ? err.stdout : '';
    const stderr = typeof err.stderr === 'string' ? err.stderr : '';
    const combined = `${stdout}\n${stderr}`;
    if (err.code === 'ENOENT') {
      return {
        ok: false,
        sat: false,
        stdout,
        stderr: stderr || String(e),
        atoms: [],
      };
    }
    if (/UNSATISFIABLE/i.test(combined)) {
      return { ok: true, sat: false, stdout, stderr, atoms: [] };
    }
    throw e;
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
  return process.env.CLINGO_PATH
    ? `CLINGO_PATH=${process.env.CLINGO_PATH}`
    : 'clingo on PATH (set CLINGO_PATH to a full path to clingo.exe if needed)';
}
