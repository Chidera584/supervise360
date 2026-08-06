import { GroupFormationService, type GroupData, type StudentData } from '../groupFormationService';

// validateGroupFormation and classifyGpaTier don't touch the database, so a stub Pool is enough.
const service = new GroupFormationService({} as any);

function student(overrides: Partial<StudentData> = {}): StudentData {
  return { name: 'Student', gpa: 4.5, tier: 'HIGH', ...overrides };
}

function group(members: StudentData[], overrides: Partial<GroupData> = {}): GroupData {
  return { name: 'Group 1', members, avg_gpa: 0, status: 'formed', ...overrides };
}

describe('classifyGpaTier', () => {
  const thresholds = { high: 3.8, medium: 3.3, low: 0 };

  it('classifies at and above the high threshold as HIGH', () => {
    expect(service.classifyGpaTier(3.8, thresholds)).toBe('HIGH');
    expect(service.classifyGpaTier(5.0, thresholds)).toBe('HIGH');
  });

  it('classifies between medium and high as MEDIUM', () => {
    expect(service.classifyGpaTier(3.3, thresholds)).toBe('MEDIUM');
    expect(service.classifyGpaTier(3.79, thresholds)).toBe('MEDIUM');
  });

  it('classifies below medium as LOW', () => {
    expect(service.classifyGpaTier(3.29, thresholds)).toBe('LOW');
    expect(service.classifyGpaTier(0, thresholds)).toBe('LOW');
  });
});

describe('validateGroupFormation', () => {
  it('accepts a valid 3-member H+M+L group', () => {
    const groups = [
      group([student({ tier: 'HIGH' }), student({ tier: 'MEDIUM' }), student({ tier: 'LOW' })]),
    ];
    const result = service.validateGroupFormation(groups);
    expect(result).toEqual({ isValid: true, violations: [] });
  });

  it('accepts a valid 1-member HIGH-only group', () => {
    const groups = [group([student({ tier: 'HIGH' })])];
    expect(service.validateGroupFormation(groups).isValid).toBe(true);
  });

  it('rejects a 1-member group that is not HIGH tier', () => {
    const groups = [group([student({ tier: 'MEDIUM' })])];
    const result = service.validateGroupFormation(groups);
    expect(result.isValid).toBe(false);
    expect(result.violations[0]).toMatch(/1-member groups must have HIGH tier/);
  });

  it('rejects a 2-member group that is not H+M', () => {
    const groups = [group([student({ tier: 'HIGH' }), student({ tier: 'LOW' })])];
    const result = service.validateGroupFormation(groups);
    expect(result.isValid).toBe(false);
    expect(result.violations[0]).toMatch(/2-member groups must be H\+M only/);
  });

  it('accepts a valid 2-member H+M group', () => {
    const groups = [group([student({ tier: 'HIGH' }), student({ tier: 'MEDIUM' })])];
    expect(service.validateGroupFormation(groups).isValid).toBe(true);
  });

  it('rejects groups with more than 3 or fewer than 1 members', () => {
    const empty = service.validateGroupFormation([group([])]);
    expect(empty.isValid).toBe(false);
    expect(empty.violations[0]).toMatch(/Must have 1, 2, or 3 members/);

    const tooMany = service.validateGroupFormation([
      group([student(), student(), student(), student()]),
    ]);
    expect(tooMany.isValid).toBe(false);
    expect(tooMany.violations[0]).toMatch(/Must have 1, 2, or 3 members/);
  });

  it('reports every violated group, not just the first', () => {
    const groups = [
      group([student({ tier: 'MEDIUM' })], { name: 'Bad Solo' }),
      group([student({ tier: 'HIGH' }), student({ tier: 'LOW' })], { name: 'Bad Pair' }),
      group([student({ tier: 'HIGH' }), student({ tier: 'MEDIUM' }), student({ tier: 'LOW' })], {
        name: 'Good Trio',
      }),
    ];
    const result = service.validateGroupFormation(groups);
    expect(result.isValid).toBe(false);
    expect(result.violations).toHaveLength(2);
    expect(result.violations.some((v) => v.includes('Bad Solo'))).toBe(true);
    expect(result.violations.some((v) => v.includes('Bad Pair'))).toBe(true);
  });
});
