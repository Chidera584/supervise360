import { Pool } from 'mysql2/promise';

export interface BulkScheduleRequest {
  date: string;
  startTime: string;
  durationMinutes: number;
  assignments: Array<{
    rangeStart: number;
    rangeEnd: number;
    location: string;
  }>;
}

export class DefensePanelService {
  constructor(private db: Pool) {}

  private parseGroupNumber(groupName: string): number | null {
    const match = String(groupName).match(/group\s*(\d+)/i);
    if (!match) return null;
    return parseInt(match[1], 10);
  }

  private async resolveSupervisorIdByName(name: string, department?: string) {
    const [users] = await this.db.execute(
      `SELECT id FROM users 
       WHERE role IN ('supervisor','external_supervisor')
       AND CONCAT(first_name, ' ', last_name) = ?`,
      [name.trim()]
    );
    const userRows = users as any[];
    if (userRows.length === 0) return null;

    const userId = userRows[0].id;
    const [supervisors] = await this.db.execute(
      'SELECT id FROM supervisors WHERE user_id = ?',
      [userId]
    );
    const supRows = supervisors as any[];
    if (supRows.length > 0) {
      return supRows[0].id;
    }

    const [insertResult] = await this.db.execute(
      `INSERT INTO supervisors (user_id, department, current_load, is_available)
       VALUES (?, ?, 0, TRUE)`,
      [userId, department || 'General']
    );
    return (insertResult as any).insertId;
  }

  async scheduleBulk(payload: BulkScheduleRequest) {
    const [groups] = await this.db.execute(
      'SELECT id, name, department, supervisor_name, supervisor_id FROM project_groups ORDER BY id ASC'
    );
    const groupRows = (groups as any[]).map(group => ({
      ...group,
      group_number: this.parseGroupNumber(group.name)
    })).filter(group => group.group_number !== null) as any[];

    const [projects] = await this.db.execute(
      'SELECT id, group_id FROM projects'
    );
    const projectMap = new Map<number, number>();
    (projects as any[]).forEach(p => projectMap.set(p.group_id, p.id));

    const assignments = [];
    const skipped: Array<{ groupId: number; groupName: string; reason: string }> = [];

    const startDateTime = `${payload.date}T${payload.startTime}:00`;
    let currentIndex = 0;

    for (const assignment of payload.assignments) {
      const rangeGroups = groupRows
        .filter(g => g.group_number >= assignment.rangeStart && g.group_number <= assignment.rangeEnd)
        .sort((a, b) => a.group_number - b.group_number);

      for (const group of rangeGroups) {
        const projectId = projectMap.get(group.id);
        if (!projectId) {
          skipped.push({ groupId: group.id, groupName: group.name, reason: 'No project found' });
          continue;
        }

        let supervisorId = group.supervisor_id;
        if (!supervisorId && group.supervisor_name) {
          supervisorId = await this.resolveSupervisorIdByName(group.supervisor_name, group.department);
        }

        if (!supervisorId) {
          skipped.push({ groupId: group.id, groupName: group.name, reason: 'Supervisor account missing' });
          continue;
        }

        const defenseDate = new Date(startDateTime);
        defenseDate.setMinutes(defenseDate.getMinutes() + (payload.durationMinutes * currentIndex));
        currentIndex += 1;

        await this.db.execute(
          `INSERT INTO defense_panels 
           (group_number, project_id, internal_supervisor_id, defense_date, location, duration_minutes, status) 
           VALUES (?, ?, ?, ?, ?, ?, 'scheduled')
           ON DUPLICATE KEY UPDATE 
             project_id = VALUES(project_id),
             internal_supervisor_id = VALUES(internal_supervisor_id),
             defense_date = VALUES(defense_date),
             location = VALUES(location),
             duration_minutes = VALUES(duration_minutes),
             status = 'scheduled',
             updated_at = NOW()`,
          [
            group.group_number,
            projectId,
            supervisorId,
            defenseDate,
            assignment.location,
            payload.durationMinutes
          ]
        );

        assignments.push({
          groupId: group.id,
          groupName: group.name,
          groupNumber: group.group_number,
          defenseDate,
          location: assignment.location
        });
      }
    }

    return { assignments, skipped };
  }

  async listPanels() {
    const [rows] = await this.db.execute(
      `SELECT dp.*, p.title as project_title
       FROM defense_panels dp
       LEFT JOIN projects p ON dp.project_id = p.id
       ORDER BY dp.defense_date ASC`
    );
    return rows as any[];
  }

  async updatePanel(panelId: number, updates: any) {
    const fields: string[] = [];
    const values: any[] = [];

    Object.entries(updates).forEach(([key, value]) => {
      fields.push(`${key} = ?`);
      values.push(value);
    });

    if (fields.length === 0) {
      return { success: false, message: 'No updates provided' };
    }

    values.push(panelId);
    await this.db.execute(
      `UPDATE defense_panels SET ${fields.join(', ')}, updated_at = NOW() WHERE id = ?`,
      values
    );

    return { success: true };
  }

  async getStudentDefense(matricNumber: string) {
    const [memberRows] = await this.db.execute(
      'SELECT group_id FROM group_members WHERE matric_number = ? LIMIT 1',
      [matricNumber]
    );
    const members = memberRows as any[];
    if (members.length === 0) return null;

    const [groupRows] = await this.db.execute(
      'SELECT name FROM project_groups WHERE id = ?',
      [members[0].group_id]
    );
    const groups = groupRows as any[];
    if (groups.length === 0) return null;

    const groupNumber = this.parseGroupNumber(groups[0].name);
    if (!groupNumber) return null;

    const [defenseRows] = await this.db.execute(
      'SELECT * FROM defense_panels WHERE group_number = ? LIMIT 1',
      [groupNumber]
    );
    return (defenseRows as any[])[0] || null;
  }
}
