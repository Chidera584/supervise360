import type { StudentData, GroupData } from '../groupFormationService';
import type { SupervisorData, GroupData as SupGroupData, AssignmentResult } from '../supervisorAssignmentService';
import { parseAnswerSet, runClingoProgram, type ClingoAtom, type ClingoRunResult } from './clingoRunner';
import { logger } from '../../logger';

/**
 * Bounds how long an HTTP request can spend waiting on the solver before falling back. Both
 * values are well under typical reverse-proxy timeouts (Render/Railway free tier ~30s).
 * Empirically (see aspEncodings tests / dev notes): group formation finds a good candidate
 * within tens of milliseconds even on tier-skewed 17-31 student instances - the time budget
 * mostly affects whether that answer is *proven* optimal (ClingoRunResult.optimal) versus just
 * the best one found in time. Supervisor assignment needs closer to the full budget to find its
 * first candidate at 15-40 groups, hence the larger allowance.
 */
const GROUP_FORMATION_TIMEOUT_MS = 15_000;
const SUPERVISOR_ASSIGNMENT_TIMEOUT_MS = 10_000;

/** Reported back to the caller (and ultimately the admin UI) so it's visible which path actually ran. */
export interface SolverMeta {
  path: 'asp' | 'heuristic';
  solveTimeMs?: number;
  optimization?: number[] | null;
  /** False when the time budget was hit before clingo could prove the answer optimal. */
  optimal?: boolean;
  solverLabel?: string | null;
  message?: string;
}

function clingoHint(): string {
  return process.env.CLINGO_PATH
    ? 'Check CLINGO_PATH points to clingo.exe.'
    : 'Install Potassco Clingo and add to PATH, or set CLINGO_PATH.';
}

function escComment(s: string): string {
  return String(s).replace(/\r?\n/g, ' ').replace(/%/g, 'pct');
}

function metaFromResult(res: ClingoRunResult): SolverMeta {
  return {
    path: 'asp',
    solveTimeMs: res.solveTimeMs,
    optimization: res.optimization,
    optimal: res.optimal,
    solverLabel: res.solverLabel,
  };
}

/**
 * Group formation as ASP: partition students into groups of 1–3 with the same hard rules as
 * validateGroupFormation (2-member = H+M only; 1-member = HIGH only). Symmetry breaking: group id
 * equals the smallest student index in that group.
 */
export async function tryGroupFormationWithClingo(
  students: StudentData[],
  namePrefix: string
): Promise<{ groups: GroupData[]; meta: SolverMeta } | null> {
  if (students.length === 0) return null;

  const n = students.length;
  const lines: string[] = [
    '% Auto-generated group formation (Potassco clingo)',
    `student(1..${n}).`,
    `group(1..${n}).`,
    '',
    '% Each student in exactly one group',
    `1 { in_group(S,G) : group(G) } 1 :- student(S).`,
    '',
    '% Symmetry breaking: group label is the minimum student index in the group',
    ':- in_group(S,G), S < G.',
    'used(G) :- in_group(_,G).',
    ':- used(G), not in_group(G,G).',
    '',
    '% Group size 1..3',
    'cnt(G,N) :- N = #count { S : in_group(S,G) }, used(G).',
    ':- cnt(G,N), N > 3.',
    ':- cnt(G,N), N < 1.',
    '',
    '% Tier counts per group',
    'h_in(G,H) :- H = #count { S : in_group(S,G), tier_h(S) }, used(G).',
    'm_in(G,M) :- M = #count { S : in_group(S,G), tier_m(S) }, used(G).',
    'l_in(G,L) :- L = #count { S : in_group(S,G), tier_l(S) }, used(G).',
    '',
    '% 2-member groups: exactly H + M',
    ':- cnt(G,2), h_in(G,H), H != 1.',
    ':- cnt(G,2), m_in(G,M), M != 1.',
    ':- cnt(G,2), l_in(G,L), L != 0.',
    '',
    '% 1-member groups: HIGH only',
    ':- cnt(G,1), in_group(S,G), not tier_h(S).',
    '',
    '% Optimize quality with lexicographic priorities',
    '% 1) maximize ideal H+M+L groups',
    'ideal(G) :- cnt(G,3), h_in(G,1), m_in(G,1), l_in(G,1).',
    '#maximize { 1@4,G : ideal(G) }.',
    '% 2) maximize number of 3-member groups (prefer full trios)',
    'trio(G) :- cnt(G,3).',
    '#maximize { 1@3,G : trio(G) }.',
    '% 3) minimize number of 1-member groups (still allowed only for HIGH)',
    'solo(G) :- cnt(G,1).',
    '#minimize { 1@2,G : solo(G) }.',
    // NOTE: an earlier 4th priority level here (`#minimize { S*1000+G@1 : in_group(S,G) }`)
    // was meant as a cosmetic tie-break among equally-good partitions, but it sums a distinct
    // weight over every (student, group) pair - for any realistic tier-skewed cohort (e.g. many
    // HIGH, few MEDIUM) there are a huge number of ties on priorities 1-3, and proving THIS term
    // optimal too turned a sub-second solve into one that hadn't finished after 90s for just 17
    // students. It added no group-quality benefit (fully covered by priorities 1-3 above), only
    // a specific labeling preference among ties, so it's dropped. clingo's search is
    // deterministic for identical input, so results are still reproducible run-to-run.
    '',
    '#show in_group/2.',
  ];

  for (let i = 1; i <= n; i++) {
    const s = students[i - 1];
    if (s.tier === 'HIGH') lines.push(`tier_h(${i}). % ${escComment(s.name)}`);
    else if (s.tier === 'MEDIUM') lines.push(`tier_m(${i}). % ${escComment(s.name)}`);
    else lines.push(`tier_l(${i}). % ${escComment(s.name)}`);
  }

  const program = lines.join('\n');
  const res = await runClingoProgram(program, { timeoutMs: GROUP_FORMATION_TIMEOUT_MS });
  if (!res.ok) {
    logger.warn(`⚠️  [ASP] Clingo not available (${res.stderr || 'ENOENT'}). ${clingoHint()}`);
    return null;
  }
  if (!res.sat) {
    logger.warn('⚠️  [ASP] Clingo reported UNSAT for group formation; using heuristic fallback.');
    return null;
  }

  const atoms = res.atoms.length ? res.atoms : parseAnswerSet(res.stdout);
  const byGroup = new Map<number, number[]>();
  for (const a of atoms) {
    if (a.name !== 'in_group' || a.args.length !== 2) continue;
    const s = parseInt(a.args[0], 10);
    const g = parseInt(a.args[1], 10);
    if (Number.isNaN(s) || Number.isNaN(g)) continue;
    const list = byGroup.get(g) ?? [];
    list.push(s);
    byGroup.set(g, list);
  }

  const usedGroupIds = [...byGroup.keys()].filter((g) => (byGroup.get(g)?.length ?? 0) > 0).sort((a, b) => a - b);
  if (usedGroupIds.length === 0) return null;

  const tierOrder: Record<string, number> = { HIGH: 0, MEDIUM: 1, LOW: 2 };
  const groups: GroupData[] = [];
  let idx = 1;
  for (const gid of usedGroupIds) {
    const memberIdxs = (byGroup.get(gid) ?? []).sort((a, b) => a - b);
    const members = memberIdxs.map((i) => students[i - 1]);
    members.sort((a, b) => {
      const byTier = tierOrder[a.tier] - tierOrder[b.tier];
      if (byTier !== 0) return byTier;
      if (b.gpa !== a.gpa) return b.gpa - a.gpa;
      return a.name.localeCompare(b.name);
    });
    const avg = parseFloat(
      (members.reduce((sum, m) => sum + m.gpa, 0) / Math.max(1, members.length)).toFixed(2)
    );
    groups.push({
      name: `${namePrefix}Group ${idx}`,
      members,
      avg_gpa: avg,
      status: 'formed',
    });
    idx++;
  }

  const placed = groups.reduce((s, g) => s + g.members.length, 0);
  if (placed !== students.length) {
    logger.warn(`⚠️  [ASP] Clingo parse mismatch (placed ${placed}/${students.length}); using heuristic.`);
    return null;
  }

  logger.info(
    `✅ [ASP] Group formation solved with Clingo (${groups.length} groups, ${res.solveTimeMs}ms, optimal=${res.optimal}).`
  );
  return { groups, meta: metaFromResult(res) };
}

/**
 * Supervisor assignment: each group assigned to exactly one eligible supervisor (same department).
 * Minimize the maximum total load (existing currentGroups + new assignments).
 */
export async function trySupervisorAssignmentWithClingo(
  groups: SupGroupData[],
  supervisors: SupervisorData[]
): Promise<{ assignments: AssignmentResult[]; meta: SolverMeta } | null> {
  if (groups.length === 0) return { assignments: [], meta: { path: 'asp' } };

  const gCount = groups.length;
  const sCount = supervisors.length;
  if (sCount === 0) return null;

  const eligible: Array<{ g: number; s: number }> = [];
  for (let gi = 0; gi < gCount; gi++) {
    const gd = (groups[gi].department || '').trim();
    for (let si = 0; si < sCount; si++) {
      const sd = (supervisors[si].department || '').trim();
      if (gd === sd) eligible.push({ g: gi + 1, s: si + 1 });
    }
  }

  for (let gi = 0; gi < gCount; gi++) {
    if (!eligible.some((e) => e.g === gi + 1)) {
      logger.warn(`⚠️  [ASP] No eligible supervisor for group "${groups[gi].name}"; skipping Clingo assignment.`);
      return null;
    }
  }

  const maxBase = supervisors.reduce((m, s) => Math.max(m, s.currentGroups || 0), 0);
  const maxBound = maxBase + gCount + 5;

  const lines: string[] = [
    '% Auto-generated supervisor assignment (Potassco clingo)',
    `group(1..${gCount}).`,
    `supervisor(1..${sCount}).`,
    '',
  ];

  for (const e of eligible) {
    lines.push(`eligible(${e.g},${e.s}).`);
  }
  lines.push('');
  for (let si = 0; si < sCount; si++) {
    const b = supervisors[si].currentGroups ?? 0;
    lines.push(`base(${si + 1},${b}).`);
  }

  lines.push(
    '',
    // NOTE: must be `1 { ... } 1` (exactly one), not `{ ... } 1` (at most one) - the latter lets
    // the solver satisfy every objective by assigning NO groups at all (trivially minimizes
    // both max load and overload to 0), which is what "optimal" but empty answers were doing.
    '1 { assign(G,S) : eligible(G,S) } 1 :- group(G).',
    '',
    'tot(S,T) :- supervisor(S), base(S,B), C = #count { G : assign(G,S) }, T = B + C.',
    '',
    `gen(M) :- M = 0..${maxBound}.`,
    // Same "exactly one, not at most one" fix as assign/2 above: without the lower bound, the
    // solver could pick NO maxb(M) at all, making the `T > M` constraint vacuously true for
    // every supervisor and the #minimize below sum over nothing - i.e. "prove" a max load of 0
    // regardless of how many groups actually got assigned.
    '1 { maxb(M) : gen(M) } 1.',
    ':- supervisor(S), tot(S,T), maxb(M), T > M.',
    '#minimize { M@3 : maxb(M) }.',
    '% Secondary objective: minimize overload above current load',
    'over(S,O) :- supervisor(S), base(S,B), tot(S,T), O = T - B.',
    '#minimize { O@2,S : over(S,O) }.',
    '% Tertiary objective: deterministic tie-break by supervisor index',
    '#minimize { S@1,G : assign(G,S) }.',
    '',
    '#show assign/2.'
  );

  const program = lines.join('\n');
  // bb (branch-and-bound) beats usc here empirically: this encoding's "guess a bound, minimize
  // the bound" idiom (maxb/gen) doesn't suit unsatisfiable-core-guided search the way group
  // formation's weighted-sum objectives do - usc found zero candidates within budget at 15+
  // groups, while bb reliably finds a full valid assignment.
  const res = await runClingoProgram(program, {
    timeoutMs: SUPERVISOR_ASSIGNMENT_TIMEOUT_MS,
    optStrategy: 'bb',
  });
  if (!res.ok) {
    logger.warn(`⚠️  [ASP] Clingo not available for supervisor assignment. ${clingoHint()}`);
    return null;
  }
  if (!res.sat) {
    logger.warn('⚠️  [ASP] Clingo UNSAT for supervisor assignment; using greedy fallback.');
    return null;
  }

  const atoms = res.atoms.length ? res.atoms : parseAnswerSet(res.stdout);
  const assignPairs: ClingoAtom[] = atoms.filter((a) => a.name === 'assign' && a.args.length === 2);
  if (assignPairs.length !== gCount) {
    logger.warn(`⚠️  [ASP] Expected ${gCount} assign/2 atoms, got ${assignPairs.length}; using greedy fallback.`);
    return null;
  }

  const byGroup = new Map<number, number>();
  for (const a of assignPairs) {
    const g = parseInt(a.args[0], 10);
    const s = parseInt(a.args[1], 10);
    if (Number.isNaN(g) || Number.isNaN(s)) continue;
    byGroup.set(g, s);
  }
  if (byGroup.size !== gCount) {
    logger.warn('⚠️  [ASP] Duplicate or missing group in assign/2; using greedy fallback.');
    return null;
  }

  const out: AssignmentResult[] = [];
  for (let gi = 0; gi < gCount; gi++) {
    const sIdx = byGroup.get(gi + 1);
    if (sIdx === undefined) return null;
    const sup = supervisors[sIdx - 1];
    const g = groups[gi];
    out.push({
      groupId: g.id,
      groupName: g.name,
      supervisorName: sup.name,
      supervisorDepartment: sup.department,
    });
  }

  logger.info(
    `✅ [ASP] Supervisor assignment optimized with Clingo (minimize max total load, ${res.solveTimeMs}ms, optimal=${res.optimal}).`
  );
  return { assignments: out, meta: metaFromResult(res) };
}
