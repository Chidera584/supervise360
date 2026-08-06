import {
  filterEligibleStaff,
  computeBalancedVenueSizes,
  parseStaffFromRows,
  parseVenuesFromRows,
  spreadStaffAcrossVenues,
  validateGroupRanges,
  validateVenuePanelComposition,
  computeAllocation,
  type StaffMember,
} from '../defenseSchedulingService';

function staff(rank: string, count: number, prefix: string): StaffMember[] {
  return Array.from({ length: count }, (_, i) => ({
    staff_id: `${prefix}${i}`,
    name: `${prefix} ${i}`,
    rank,
  }));
}

describe('filterEligibleStaff', () => {
  it('excludes HOD and Dean regardless of case', () => {
    const input: StaffMember[] = [
      { staff_id: '1', name: 'A', rank: 'HOD' },
      { staff_id: '2', name: 'B', rank: 'dean' },
      { staff_id: '3', name: 'C', rank: 'Professor' },
    ];
    const result = filterEligibleStaff(input);
    expect(result.map((s) => s.staff_id)).toEqual(['3']);
  });
});

describe('computeBalancedVenueSizes', () => {
  it('gives each venue at least 3 and distributes extras round-robin', () => {
    expect(computeBalancedVenueSizes(9, 3)).toEqual([3, 3, 3]);
    expect(computeBalancedVenueSizes(11, 3)).toEqual([4, 4, 3]);
    expect(computeBalancedVenueSizes(10, 3)).toEqual([4, 3, 3]);
  });

  it('throws when there are no venues', () => {
    expect(() => computeBalancedVenueSizes(10, 0)).toThrow(/No venues/);
  });

  it('throws when there is not enough staff for the minimum of 3 per venue', () => {
    expect(() => computeBalancedVenueSizes(5, 2)).toThrow(/Need at least/);
  });
});

describe('parseStaffFromRows / parseVenuesFromRows', () => {
  it('parses staff rows case-insensitively and skips rows missing name or rank', () => {
    const rows = [
      { Staff_ID: 'S1', Name: 'Ada Lovelace', Rank: 'Professor' },
      { staff_id: 'S2', name: '', rank: 'Lecturer' },
    ];
    const result = parseStaffFromRows(rows);
    expect(result).toEqual([{ staff_id: 'S1', name: 'Ada Lovelace', rank: 'Professor' }]);
  });

  it('parses venue rows and falls back to venue_name when venue_id is blank', () => {
    const rows = [{ 'Venue Name': 'Hall A' }];
    const result = parseVenuesFromRows(rows);
    expect(result).toEqual([{ venue_id: 'Hall A', venue_name: 'Hall A' }]);
  });
});

describe('spreadStaffAcrossVenues', () => {
  it('assigns every eligible staff member to exactly one venue', () => {
    const eligible = [
      ...staff('Professor', 2, 'lead'),
      ...staff('Lecturer', 4, 'lec'),
      ...staff('Lab Technician', 2, 'tech'),
    ];
    const venues = [
      { venue_id: 'v1', venue_name: 'Hall A' },
      { venue_id: 'v2', venue_name: 'Hall B' },
    ];

    const allocations = spreadStaffAcrossVenues(eligible, venues);

    const allAssignedIds = allocations.flatMap((a) => a.team.members.map((m) => m.staff_id));
    expect(allAssignedIds.sort()).toEqual(eligible.map((s) => s.staff_id).sort());
    // No one appears at more than one venue.
    expect(new Set(allAssignedIds).size).toBe(allAssignedIds.length);
  });

  it('throws when there are no eligible staff', () => {
    expect(() =>
      spreadStaffAcrossVenues([], [{ venue_id: 'v1', venue_name: 'Hall A' }])
    ).toThrow(/No eligible staff/);
  });
});

describe('validateGroupRanges', () => {
  it('allows non-overlapping ranges within a department', () => {
    expect(() =>
      validateGroupRanges([
        { venue_index: 0, department: 'CS', start: 1, end: 10 },
        { venue_index: 1, department: 'CS', start: 11, end: 20 },
      ])
    ).not.toThrow();
  });

  it('throws on overlapping ranges within the same department', () => {
    expect(() =>
      validateGroupRanges([
        { venue_index: 0, department: 'CS', start: 1, end: 10 },
        { venue_index: 1, department: 'CS', start: 5, end: 15 },
      ])
    ).toThrow(/overlap/);
  });

  it('does not compare ranges across different departments', () => {
    expect(() =>
      validateGroupRanges([
        { venue_index: 0, department: 'CS', start: 1, end: 10 },
        { venue_index: 1, department: 'SE', start: 1, end: 10 },
      ])
    ).not.toThrow();
  });
});

describe('validateVenuePanelComposition', () => {
  const venue = { venue_id: 'v1', venue_name: 'Hall A' };

  it('passes with exactly one leader, one lecturer, one lab tech', () => {
    const members = [
      { staff_id: '1', name: 'A', rank: 'Professor' },
      { staff_id: '2', name: 'B', rank: 'Lecturer' },
      { staff_id: '3', name: 'C', rank: 'Lab Technician' },
    ];
    expect(() =>
      validateVenuePanelComposition({ venue, team: { id: 1, members, leader: members[0] } })
    ).not.toThrow();
  });

  it('rejects a panel with zero leaders', () => {
    const members = [
      { staff_id: '2', name: 'B', rank: 'Lecturer' },
      { staff_id: '3', name: 'C', rank: 'Lab Technician' },
    ];
    expect(() =>
      validateVenuePanelComposition({ venue, team: { id: 1, members, leader: members[0] } })
    ).toThrow(/exactly one Professor or Associate Professor/);
  });

  it('rejects a panel with two leaders', () => {
    const members = [
      { staff_id: '1', name: 'A', rank: 'Professor' },
      { staff_id: '4', name: 'D', rank: 'Associate Professor' },
      { staff_id: '2', name: 'B', rank: 'Lecturer' },
      { staff_id: '3', name: 'C', rank: 'Lab Technician' },
    ];
    expect(() =>
      validateVenuePanelComposition({ venue, team: { id: 1, members, leader: members[0] } })
    ).toThrow(/exactly one Professor or Associate Professor/);
  });
});

describe('computeAllocation (full pipeline)', () => {
  it('excludes HOD/Dean, spreads staff, and validates panel composition end to end', () => {
    const staffRows = [
      { staff_id: 'h1', name: 'Head Person', rank: 'HOD' },
      ...staff('Professor', 2, 'lead').map((s) => ({ staff_id: s.staff_id, name: s.name, rank: s.rank })),
      ...staff('Lecturer', 2, 'lec').map((s) => ({ staff_id: s.staff_id, name: s.name, rank: s.rank })),
      ...staff('Lab Technician', 2, 'tech').map((s) => ({ staff_id: s.staff_id, name: s.name, rank: s.rank })),
    ];
    const venueRows = [
      { venue_id: 'v1', venue_name: 'Hall A' },
      { venue_id: 'v2', venue_name: 'Hall B' },
    ];

    const { allocations, excludedCount } = computeAllocation(staffRows, venueRows, []);

    expect(excludedCount).toBe(1);
    expect(allocations).toHaveLength(2);
    allocations.forEach((a) => expect(() => validateVenuePanelComposition(a)).not.toThrow());
  });

  it('throws a descriptive error when there are not enough lab technicians', () => {
    const staffRows = [
      ...staff('Professor', 2, 'lead').map((s) => ({ staff_id: s.staff_id, name: s.name, rank: s.rank })),
      ...staff('Lecturer', 2, 'lec').map((s) => ({ staff_id: s.staff_id, name: s.name, rank: s.rank })),
    ];
    const venueRows = [
      { venue_id: 'v1', venue_name: 'Hall A' },
      { venue_id: 'v2', venue_name: 'Hall B' },
    ];

    expect(() => computeAllocation(staffRows, venueRows, [])).toThrow(/Lab Technician/);
  });
});
