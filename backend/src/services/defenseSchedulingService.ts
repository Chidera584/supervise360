/**
 * Defense Scheduling Service
 * - Eligible staff: exclude HOD/Dean from assessor pools
 * - Spread each eligible person across exactly one venue (no repeated assessors across venues)
 * - Minimum 3 assessors per venue; sizes balanced as evenly as possible (extras round-robin)
 * - Group ranges: no overlap within a department
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

function sortByName(a: StaffMember, b: StaffMember): number {
  return (a.name || '').localeCompare(b.name || '', undefined, { sensitivity: 'base' });
}

/**
 * Per-venue headcounts: at least 3 each, extras distributed one-by-one in venue order (round-robin)
 * so sizes differ by at most 1 (only when remainder forces it).
 */
export function computeBalancedVenueSizes(totalStaff: number, venueCount: number): number[] {
  if (venueCount === 0) {
    throw new Error('No venues provided. Add at least one venue.');
  }
  if (totalStaff < venueCount * 3) {
    throw new Error(
      `Need at least ${venueCount * 3} eligible staff for ${venueCount} venues (minimum 3 per venue). You have ${totalStaff}.`
    );
  }
  const sizes = Array(venueCount).fill(3);
  let extra = totalStaff - 3 * venueCount;
  let i = 0;
  while (extra > 0) {
    sizes[i % venueCount]++;
    extra--;
    i++;
  }
  return sizes;
}

/**
 * Interleave role buckets so venues filled in round-robin order get a mix of ranks when possible.
 */
function mergeStaffByRoleRoundRobin(
  leaders: StaffMember[],
  lecturers: StaffMember[],
  labTechs: StaffMember[],
  others: StaffMember[]
): StaffMember[] {
  const L = [...leaders].sort(sortByName);
  const Le = [...lecturers].sort(sortByName);
  const T = [...labTechs].sort(sortByName);
  const O = [...others].sort(sortByName);
  const out: StaffMember[] = [];
  const maxLen = Math.max(L.length, Le.length, T.length, O.length);
  for (let k = 0; k < maxLen; k++) {
    if (k < L.length) out.push(L[k]);
    if (k < Le.length) out.push(Le[k]);
    if (k < T.length) out.push(T[k]);
    if (k < O.length) out.push(O[k]);
  }
  return out;
}

/**
 * One assessor appears at exactly one venue. Fill venues in round-robin order using balanced sizes.
 */
export function spreadStaffAcrossVenues(eligibleStaff: StaffMember[], venues: Venue[]): VenueAllocation[] {
  if (venues.length === 0) {
    throw new Error('No venues provided. Add at least one venue.');
  }
  if (eligibleStaff.length === 0) {
    throw new Error('No eligible staff after excluding HOD/Dean. Add assessors or adjust ranks.');
  }

  const sizes = computeBalancedVenueSizes(eligibleStaff.length, venues.length);

  const leaders = eligibleStaff.filter(s => isLeader(s.rank));
  const lecturers = eligibleStaff.filter(s => isLecturer(s.rank));
  const labTechs = eligibleStaff.filter(s => isLabTech(s.rank));
  const others = eligibleStaff.filter(
    s => !isLeader(s.rank) && !isLecturer(s.rank) && !isLabTech(s.rank)
  );

  const merged = mergeStaffByRoleRoundRobin(leaders, lecturers, labTechs, others);
  if (merged.length !== eligibleStaff.length) {
    throw new Error('Internal error: staff list mismatch when spreading across venues.');
  }

  const buckets: StaffMember[][] = Array.from({ length: venues.length }, () => []);
  let assigned = 0;
  const total = eligibleStaff.length;
  while (assigned < total) {
    for (let v = 0; v < venues.length && assigned < total; v++) {
      if (buckets[v].length < sizes[v]) {
        buckets[v].push(merged[assigned]);
        assigned++;
      }
    }
  }

  return venues.map((venue, i) => {
    const members = buckets[i];
    const leader = members.find(m => isLeader(m.rank)) || members[0];
    return {
      venue,
      team: { id: i + 1, members, leader },
      groupRange: undefined,
    };
  });
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

  let allocations = spreadStaffAcrossVenues(eligible, parseVenuesFromRows(venueRows));

  validateGroupRanges(groupRanges);
  allocations = applyGroupRanges(allocations, groupRanges);

  return { allocations, excludedCount };
}
