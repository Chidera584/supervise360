import type { StudentData, GroupData } from '../groupFormationService';
import type { SupervisorData, GroupData as SupGroupData, AssignmentResult } from '../supervisorAssignmentService';
import { parseAnswerSet, runClingoProgram, type ClingoAtom } from './clingoRunner';

function clingoHint(): string {
  return process.env.CLINGO_PATH
    ? 'Check CLINGO_PATH points to clingo.exe.'
    : 'Install Potassco Clingo and add to PATH, or set CLINGO_PATH.';
}

function escComment(s: string): string {
  return String(s).replace(/\r?\n/g, ' ').replace(/%/g, 'pct');
}

/**
 * Group formation as ASP: partition students into groups of 1–3 with the same hard rules as
 * validateGroupFormation (2-member = H+M only; 1-member = HIGH only). Symmetry breaking: group id
 * equals the smallest student index in that group.
 */
export async function tryGroupFormationWithClingo(
  students: StudentData[],
  namePrefix: string
): Promise<GroupData[] | null> {
  if (students.length === 0) return null;

  const n = students.length;
  const lines: string[] = [
    '% Auto-generated group formation (Potassco clingo)',
    `student(1..${n}).`,
    'group(1..n).',
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
    '% Prefer as many ideal 3-member H+M+L groups as possible',
    'ideal(G) :- cnt(G,3), h_in(G,1), m_in(G,1), l_in(G,1).',
    '#maximize { 1,G : ideal(G) }.',
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
  const res = await runClingoProgram(program, { timeoutMs: 120_000 });
  if (!res.ok) {
    console.warn(`⚠️  [ASP] Clingo not available (${res.stderr || 'ENOENT'}). ${clingoHint()}`);
    return null;
  }
  if (!res.sat) {
    console.warn('⚠️  [ASP] Clingo reported UNSAT for group formation; using heuristic fallback.');
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
    members.sort((a, b) => tierOrder[a.tier] - tierOrder[b.tier]);
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
    console.warn(`⚠️  [ASP] Clingo parse mismatch (placed ${placed}/${students.length}); using heuristic.`);
    return null;
  }

  console.log(`✅ [ASP] Group formation solved with Clingo (${groups.length} groups, maximize H+M+L triples).`);
  return groups;
}

/**
 * Supervisor assignment: each group assigned to exactly one eligible supervisor (same department).
 * Minimize the maximum total load (existing currentGroups + new assignments).
 */
export async function trySupervisorAssignmentWithClingo(
  groups: SupGroupData[],
  supervisors: SupervisorData[]
): Promise<AssignmentResult[] | null> {
  if (groups.length === 0) return [];

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
      console.warn(`⚠️  [ASP] No eligible supervisor for group "${groups[gi].name}"; skipping Clingo assignment.`);
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
    '{ assign(G,S) : eligible(G,S) } 1 :- group(G).',
    '',
    'tot(S,T) :- supervisor(S), base(S,B), C = #count { G : assign(G,S) }, T = B + C.',
    '',
    `gen(M) :- M = 0..${maxBound}.`,
    '{ maxb(M) : gen(M) } 1.',
    ':- supervisor(S), tot(S,T), maxb(M), T > M.',
    '#minimize { M@0 : maxb(M) }.',
    '',
    '#show assign/2.'
  );

  const program = lines.join('\n');
  const res = await runClingoProgram(program, { timeoutMs: 60_000 });
  if (!res.ok) {
    console.warn(`⚠️  [ASP] Clingo not available for supervisor assignment. ${clingoHint()}`);
    return null;
  }
  if (!res.sat) {
    console.warn('⚠️  [ASP] Clingo UNSAT for supervisor assignment; using greedy fallback.');
    return null;
  }

  const atoms = res.atoms.length ? res.atoms : parseAnswerSet(res.stdout);
  const assignPairs: ClingoAtom[] = atoms.filter((a) => a.name === 'assign' && a.args.length === 2);
  if (assignPairs.length !== gCount) {
    console.warn(`⚠️  [ASP] Expected ${gCount} assign/2 atoms, got ${assignPairs.length}; using greedy fallback.`);
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
    console.warn('⚠️  [ASP] Duplicate or missing group in assign/2; using greedy fallback.');
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

  console.log('✅ [ASP] Supervisor assignment optimized with Clingo (minimize max total load).');
  return out;
}
