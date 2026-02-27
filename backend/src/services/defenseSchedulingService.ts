/**
 * Defense Scheduling Service
 * ASP-style logic for:
 * - Assessor team formation (exclude HOD/Dean, leadership, role composition, even distribution)
 * - Venue assignment (1:1 team-venue)
 * - Group range assignment (no overlap)
 */

const EXCLUDED_RANKS = ['HOD', 'Dean'];
const LEADERSHIP_RANKS = ['Professor', 'Associate Professor'];
const LECTURER_RANKS = ['Lecturer', 'Assistant Lecturer'];
const LAB_TECH_RANK = 'Lab Technician';

export interface StaffMember {
  staff_id: string;
  name: string;
  rank: string;
}

export interface Venue {
  venue_id: string;
  venue_name: string;
}

export interface GroupRange {
  venue_index: number;
  department: string;
  start: number;
  end: number;
}

export interface AssessorTeam {
  id: number;
  members: StaffMember[];
  leader: StaffMember;
}

export interface VenueAllocation {
  venue: Venue;
  team: AssessorTeam;
  groupRange?: GroupRange;
}

function normalizeRank(rank: string): string {
  return String(rank || '').trim();
}

function isExcluded(rank: string): boolean {
  const r = normalizeRank(rank);
  return EXCLUDED_RANKS.some(ex => r.toLowerCase() === ex.toLowerCase());
}

function isLeader(rank: string): boolean {
  const r = normalizeRank(rank);
  return LEADERSHIP_RANKS.some(l => r.toLowerCase().includes(l.toLowerCase()));
}

function isLecturer(rank: string): boolean {
  const r = normalizeRank(rank);
  return LECTURER_RANKS.some(l => r.toLowerCase().includes(l.toLowerCase()));
}

function isLabTech(rank: string): boolean {
  const r = normalizeRank(rank);
  return r.toLowerCase().includes(LAB_TECH_RANK.toLowerCase());
}

/**
 * Parse staff from CSV rows. Expected columns: staff_id, name, rank (case-insensitive)
 */
export function parseStaffFromRows(rows: any[]): StaffMember[] {
  const staff: StaffMember[] = [];
  for (const row of rows) {
    const keys = Object.keys(row);
    const idKey = keys.find(k => /staff_id|staffid|staff\s*id/i.test(k)) || keys[0];
    const nameKey = keys.find(k => /^name$|full\s*name/i.test(k)) || keys.find(k => /name/i.test(k)) || keys[1];
    const rankKey = keys.find(k => /^rank$|^title$/i.test(k)) || keys.find(k => /rank|title/i.test(k)) || keys[2];

    const sid = String(row[idKey] ?? '').trim();
    const name = String(row[nameKey] ?? '').trim();
    const rank = String(row[rankKey] ?? '').trim();

    if (name && rank) {
      staff.push({ staff_id: sid || name, name, rank });
    }
  }
  return staff;
}

/**
 * Parse venues from CSV rows. Expected columns: venue_id, venue_name (case-insensitive)
 */
export function parseVenuesFromRows(rows: any[]): Venue[] {
  const venues: Venue[] = [];
  for (const row of rows) {
    const keys = Object.keys(row);
    const idKey = keys.find(k => /venue_id|venueid|venue\s*id/i.test(k)) || keys[0];
    const nameKey = keys.find(k => /venue_name|venuename|venue\s*name/i.test(k)) || keys.find(k => /name/i.test(k)) || keys[1];
    const vid = String(row[idKey] ?? '').trim();
    const vname = String(row[nameKey] ?? '').trim();
    if (vname) {
      venues.push({ venue_id: vid || vname, venue_name: vname });
    }
  }
  return venues;
}

/**
 * ASP Rule: Exclude HOD and Dean from assessor teams
 */
export function filterEligibleStaff(staff: StaffMember[]): StaffMember[] {
  return staff.filter(s => !isExcluded(s.rank));
}

/** Target assessors per team (prefer 4 when staff available) */
const TARGET_ASSESSORS_PER_TEAM = 4;

/**
 * ASP-style assessor team formation:
 * - Leadership: at least 1 Prof or Assoc Prof per team
 * - Role: at least 1 Lecturer/Assistant Lecturer + at least 1 Lab Technician per team
 * - Target 4 assessors per team when staff available (uses more of 75 staff)
 * - Even distribution across teams
 */
export function formAssessorTeams(eligibleStaff: StaffMember[]): AssessorTeam[] {
  const leaders = eligibleStaff.filter(s => isLeader(s.rank));
  const lecturers = eligibleStaff.filter(s => isLecturer(s.rank));
  const labTechs = eligibleStaff.filter(s => isLabTech(s.rank));
  const others = eligibleStaff.filter(s => !isLeader(s.rank) && !isLecturer(s.rank) && !isLabTech(s.rank));

  if (leaders.length === 0) {
    throw new Error('No Professor or Associate Professor available. Each team must have a leader.');
  }
  if (lecturers.length === 0) {
    throw new Error('No Lecturer or Assistant Lecturer available. Each team must have at least one.');
  }
  if (labTechs.length === 0) {
    throw new Error('No Lab Technician available. Each team must have at least one.');
  }

  const teamCount = Math.min(leaders.length, lecturers.length, labTechs.length);
  if (teamCount === 0) {
    throw new Error('Cannot form any valid teams. Need at least one Professor/Assoc Prof, one Lecturer, and one Lab Technician.');
  }

  const teams: AssessorTeam[] = [];
  for (let t = 0; t < teamCount; t++) {
    const leader = leaders[t];
    const lecturer = lecturers[t % lecturers.length];
    const labTech = labTechs[t % labTechs.length];

    const members: StaffMember[] = [];
    const addIfNew = (s: StaffMember) => { if (s && !members.some(m => (m.staff_id || m.name) === (s.staff_id || s.name))) members.push(s); };
    addIfNew(leader);
    addIfNew(lecturer);
    addIfNew(labTech);

    // Add 4th member: use surplus staff (lecturers, lab techs, or leaders) when available
    if (members.length < TARGET_ASSESSORS_PER_TEAM) {
      if (lecturers.length > teamCount) {
        const idx = teamCount + t;
        if (idx < lecturers.length) addIfNew(lecturers[idx]);
      } else if (labTechs.length > teamCount) {
        const idx = teamCount + t;
        if (idx < labTechs.length) addIfNew(labTechs[idx]);
      } else if (leaders.length > teamCount) {
        const idx = teamCount + t;
        if (idx < leaders.length) addIfNew(leaders[idx]);
      }
    }

    const teamLeader = members.find(m => isLeader(m.rank)) || members[0];
    teams.push({ id: t + 1, members, leader: teamLeader });
  }

  return balanceTeamSizes(teams, eligibleStaff);
}

function balanceTeamSizes(teams: AssessorTeam[], pool: StaffMember[]): AssessorTeam[] {
  const used = new Set<string>();
  teams.forEach(t => t.members.forEach(m => used.add(m.staff_id || m.name)));
  const remaining = pool.filter(s => !used.has(s.staff_id || s.name));

  // Phase 1: Add 4th member to each team when available
  for (const team of teams) {
    if (team.members.length < TARGET_ASSESSORS_PER_TEAM && remaining.length > 0) {
      const extra = remaining.shift();
      if (extra) team.members.push(extra);
    }
  }

  // Phase 2: Distribute remaining staff evenly (5th, 6th, etc. as needed)
  while (remaining.length > 0) {
    const smallestTeam = teams.reduce((a, b) => a.members.length <= b.members.length ? a : b);
    const extra = remaining.shift();
    if (extra) smallestTeam.members.push(extra);
    else break;
  }

  return teams;
}

/**
 * Assign assessor teams to venues. Spreads teams across all venues:
 * - When teams < venues: cycles through teams so each venue gets a team
 * - When teams >= venues: assigns one team per venue (extra teams unused)
 * No strict 1:1 constraint - lecturers are distributed across all locations.
 */
export function assignTeamsToVenues(teams: AssessorTeam[], venues: Venue[]): VenueAllocation[] {
  if (teams.length === 0) {
    throw new Error('No assessor teams available. Add staff with Professor, Lecturer, and Lab Technician roles.');
  }
  if (venues.length === 0) {
    throw new Error('No venues provided. Add at least one venue.');
  }

  return venues.map((venue, i) => ({
    venue,
    team: teams[i % teams.length],
    groupRange: undefined
  }));
}

/**
 * Validate group ranges: no overlap within the same department
 */
export function validateGroupRanges(ranges: GroupRange[]): void {
  const byDept = new Map<string, Array<{ start: number; end: number }>>();
  for (const r of ranges) {
    const dept = (r.department || '').trim();
    if (!dept) continue;
    if (!byDept.has(dept)) byDept.set(dept, []);
    byDept.get(dept)!.push({ start: r.start, end: r.end });
  }

  for (const [dept, arr] of byDept) {
    arr.sort((a, b) => a.start - b.start);
    for (let i = 1; i < arr.length; i++) {
      if (arr[i].start <= arr[i - 1].end) {
        throw new Error(
          `Group range overlap in ${dept}: Range ${arr[i - 1].start}–${arr[i - 1].end} overlaps with ${arr[i].start}–${arr[i].end}`
        );
      }
    }
  }
}

/**
 * Apply group ranges to venue allocations (by venue index)
 */
export function applyGroupRanges(
  allocations: VenueAllocation[],
  ranges: GroupRange[]
): VenueAllocation[] {
  const rangeByVenue = new Map<number, GroupRange>();
  for (const r of ranges) {
    rangeByVenue.set(r.venue_index, r);
  }

  return allocations.map((a, i) => ({
    ...a,
    groupRange: rangeByVenue.get(i)
  }));
}

/**
 * Full allocation pipeline
 */
export function computeAllocation(
  staffRows: any[],
  venueRows: any[],
  groupRanges: GroupRange[]
): { allocations: VenueAllocation[]; excludedCount: number } {
  const staff = parseStaffFromRows(staffRows);
  const eligible = filterEligibleStaff(staff);
  const excludedCount = staff.length - eligible.length;

  const teams = formAssessorTeams(eligible);
  let allocations = assignTeamsToVenues(teams, parseVenuesFromRows(venueRows));

  validateGroupRanges(groupRanges);
  allocations = applyGroupRanges(allocations, groupRanges);

  return { allocations, excludedCount };
}
