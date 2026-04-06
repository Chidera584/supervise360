/**
 * Export utilities for PDF and Word (HTML) downloads
 */
import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';

export type AllocationColumn = {
  venue: string;
  groupRange: string;
  assessors: string[];
};

export function downloadAllocationAsPDF(allocations: AllocationColumn[], excludedCount: number): void {
  const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' });
  const margin = 10;
  const pageWidth = doc.internal.pageSize.getWidth();
  const maxWidth = pageWidth - margin * 2;
  const colWidth = Math.min(50, maxWidth / allocations.length);

  // Title
  doc.setFontSize(14);
  doc.text('Defense Allocation', margin, 15);
  if (excludedCount > 0) {
    doc.setFontSize(9);
    doc.text(`${excludedCount} staff excluded (HOD/Dean).`, margin, 22);
  }

  const startY = excludedCount > 0 ? 28 : 22;

  // Header: venue names and group ranges (two rows)
  const head = [
    allocations.map(c => c.venue),
    allocations.map(c => c.groupRange || '')
  ];
  // Body: Assessors
  const maxAssessors = Math.max(...allocations.map(c => c.assessors.length), 1);
  const body = Array.from({ length: maxAssessors }, (_, rowIdx) =>
    allocations.map(col => col.assessors[rowIdx] ?? '')
  );

  autoTable(doc, {
    startY,
    head,
    body,
    theme: 'grid',
    styles: { fontSize: 8 },
    columnStyles: Object.fromEntries(
      allocations.map((_, i) => [i, { cellWidth: colWidth }])
    )
  });

  doc.save(`defense_allocation_${new Date().toISOString().slice(0, 10)}.pdf`);
}

export function downloadAllocationAsWord(allocations: AllocationColumn[], excludedCount: number): void {
  const maxAssessors = Math.max(...allocations.map(c => c.assessors.length), 1);

  let html = `
<!DOCTYPE html>
<html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:w="urn:schemas-microsoft-com:office:word">
<head>
<meta charset="UTF-8">
<title>Defense Allocation</title>
<style>
  table { border-collapse: collapse; width: 100%; }
  th, td { border: 1px solid #333; padding: 6px 8px; text-align: left; font-size: 11pt; }
  th { background: #f0f0f0; font-weight: bold; }
  .sub { font-weight: normal; color: #555; }
  h1 { font-size: 14pt; }
  p { font-size: 9pt; color: #666; }
</style>
</head>
<body>
<h1>Defense Allocation</h1>
${excludedCount > 0 ? `<p>${excludedCount} staff excluded (HOD/Dean).</p>` : ''}
<table>
<thead>
<tr>
${allocations.map(c => `<th>${c.venue}<br><span class="sub">${c.groupRange || ''}</span></th>`).join('')}
</tr>
</thead>
<tbody>
`;

  for (let r = 0; r < maxAssessors; r++) {
    html += '<tr>';
    allocations.forEach(col => {
      html += `<td>${col.assessors[r] ?? ''}</td>`;
    });
    html += '</tr>';
  }

  html += `
</tbody>
</table>
</body>
</html>`;

  const blob = new Blob(['\ufeff' + html], { type: 'application/msword' });
  const link = document.createElement('a');
  link.href = URL.createObjectURL(blob);
  link.download = `defense_allocation_${new Date().toISOString().slice(0, 10)}.doc`;
  link.click();
  URL.revokeObjectURL(link.href);
}

// --- Supervisor/Group assignments (grouped format) ---

export type GroupAssignmentRow = {
  group: string;
  matricNo: string;
  name: string;
  supervisor: string;
};

function buildGroupedAssignmentRows(
  groups: Array<{ id: number; name: string; members: string[]; supervisor: string | null }>,
  getMemberMatric: (groupId: number, memberIndex: number) => string
): GroupAssignmentRow[] {
  const rows: GroupAssignmentRow[] = [];
  groups.forEach((group) => {
    const members = group.members || [];
    const m = String(group.name || '').match(/Group\s*(\d+)/i) || String(group.name || '').match(/(\d+)\s*$/);
    const groupLabel = m ? `Group ${m[1]}` : String(group.name || '').trim();
    const supervisor = group.supervisor || 'Not Assigned';
    members.forEach((memberName, mIdx) => {
      rows.push({
        group: mIdx === 0 ? groupLabel : '',
        matricNo: getMemberMatric(group.id, mIdx),
        name: memberName,
        supervisor: mIdx === 0 ? supervisor : ''
      });
    });
  });
  return rows;
}

export function downloadAssignmentsAsCSV(
  groups: Array<{ id: number; name: string; members: string[]; supervisor: string | null }>,
  getMemberMatric: (groupId: number, memberIndex: number) => string,
  filename: string
): void {
  const rows = buildGroupedAssignmentRows(groups, getMemberMatric);
  const csvLines = ['GROUP,MATRIC NO,NAME,SUPERVISOR'];
  rows.forEach(r => {
    csvLines.push(`"${r.group}","${r.matricNo}","${r.name.replace(/"/g, '""')}","${r.supervisor}"`);
  });
  const blob = new Blob([csvLines.join('\n')], { type: 'text/csv;charset=utf-8;' });
  const link = document.createElement('a');
  link.href = URL.createObjectURL(blob);
  link.download = filename;
  link.click();
  URL.revokeObjectURL(link.href);
}

export function downloadAssignmentsAsPDF(
  groups: Array<{ id: number; name: string; members: string[]; supervisor: string | null }>,
  getMemberMatric: (groupId: number, memberIndex: number) => string
): void {
  const rows = buildGroupedAssignmentRows(groups, getMemberMatric);
  const doc = new jsPDF();
  autoTable(doc, {
    head: [['GROUP', 'MATRIC NO', 'NAME', 'SUPERVISOR']],
    body: rows.map(r => [r.group, r.matricNo, r.name, r.supervisor]),
    theme: 'grid',
    styles: { fontSize: 9 },
    columnStyles: { 0: { cellWidth: 18 }, 1: { cellWidth: 28 }, 2: { cellWidth: 80 }, 3: { cellWidth: 45 } }
  });
  doc.save('supervisor_assignments.pdf');
}

export function downloadAssignmentsAsWord(
  groups: Array<{ id: number; name: string; members: string[]; supervisor: string | null }>,
  getMemberMatric: (groupId: number, memberIndex: number) => string
): void {
  const rows = buildGroupedAssignmentRows(groups, getMemberMatric);
  const escape = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  let html = `
<!DOCTYPE html>
<html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:w="urn:schemas-microsoft-com:office:word">
<head><meta charset="UTF-8"><title>Supervisor Assignments</title>
<style>table{border-collapse:collapse;width:100%}th,td{border:1px solid #333;padding:6px 8px;text-align:left;font-size:11pt}th{background:#f0f0f0}</style>
</head><body><h1>Supervisor Assignments</h1><table>
<thead><tr><th>GROUP</th><th>MATRIC NO</th><th>NAME</th><th>SUPERVISOR</th></tr></thead><tbody>`;
  rows.forEach(r => {
    html += `<tr><td>${escape(r.group)}</td><td>${escape(r.matricNo)}</td><td>${escape(r.name)}</td><td>${escape(r.supervisor)}</td></tr>`;
  });
  html += '</tbody></table></body></html>';
  const blob = new Blob(['\ufeff' + html], { type: 'application/msword' });
  const link = document.createElement('a');
  link.href = URL.createObjectURL(blob);
  link.download = 'supervisor_assignments.doc';
  link.click();
  URL.revokeObjectURL(link.href);
}
