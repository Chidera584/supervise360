/**
 * Display helpers for the supervisor portal.
 * Strips redundant department names and formats group/project labels.
 */

/** Extract "Group N" from names like "Software Engineering - Group 16" */
export function stripGroupName(name: string): string {
  if (!name || typeof name !== 'string') return name || '';
  const match = name.match(/(?:Group\s+(\d+))/i);
  if (match) return `Group ${match[1]}`;
  const parts = name.split(/\s*-\s*/);
  return parts.length > 1 ? parts[parts.length - 1].trim() : name.trim();
}

/** Extract group number for sorting (e.g. "Software Engineering - Group 16" → 16) */
export function getGroupNumber(name: string): number {
  if (!name || typeof name !== 'string') return 0;
  const match = name.match(/(?:Group\s+)(\d+)/i);
  return match ? parseInt(match[1], 10) : 0;
}

/** Sort groups by group number (1, 2, 3, ... n) */
export function sortGroupsByNumber<T extends { name?: string }>(groups: T[]): T[] {
  return [...groups].sort((a, b) => getGroupNumber(a.name || '') - getGroupNumber(b.name || ''));
}

/**
 * Simplify project title for display.
 * "Project for Software Engineering - Group 16" → "Group 16"
 * "Project for Group 16" → "Group 16"
 * Custom titles are returned as-is.
 */
export function stripProjectTitle(title: string, groupName?: string): string {
  if (!title || typeof title !== 'string') return title || 'No project yet';
  const groupPart = stripGroupName(groupName || title);
  if (title.toLowerCase().startsWith('project for ')) {
    const rest = title.slice(12).trim();
    const match = rest.match(/(?:Group\s+(\d+))/i);
    return match ? `Group ${match[1]}` : groupPart || rest;
  }
  return title;
}
