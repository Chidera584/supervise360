import { Pool } from 'mysql2/promise';

/**
 * Per-(supervisor_name, department) workload: project_groups.department defines which
 * supervisor_workload row is affected when a supervisor oversees a group in that department.
 */
export async function syncSupervisorWorkloadWithConnection(connection: any): Promise<void> {
  await connection.execute('UPDATE supervisor_workload SET current_groups = 0, updated_at = NOW()');

  const [rows] = await connection.execute(`
    SELECT
      supervisor_name,
      TRIM(COALESCE(department, '')) AS dept,
      COUNT(*) AS cnt
    FROM project_groups
    WHERE supervisor_name IS NOT NULL AND TRIM(COALESCE(supervisor_name, '')) != ''
    GROUP BY supervisor_name, TRIM(COALESCE(department, ''))
  `);

  for (const row of rows as any[]) {
    await connection.execute(
      `UPDATE supervisor_workload
       SET current_groups = ?, updated_at = NOW()
       WHERE supervisor_name = ? AND TRIM(COALESCE(department, '')) = ?`,
      [row.cnt, row.supervisor_name, row.dept]
    );
  }
}

export async function syncSupervisorWorkloadByDepartment(db: Pool): Promise<void> {
  const connection = await db.getConnection();
  try {
    await connection.beginTransaction();
    await syncSupervisorWorkloadWithConnection(connection);
    await connection.commit();
  } catch (e) {
    await connection.rollback();
    throw e;
  } finally {
    connection.release();
  }
}

export async function adjustSupervisorWorkload(
  connection: any,
  supervisorName: string,
  department: string,
  delta: number
): Promise<void> {
  const name = String(supervisorName || '').trim();
  const dept = String(department || '').trim();
  if (!name || !dept) return;
  await connection.execute(
    `UPDATE supervisor_workload
     SET current_groups = GREATEST(0, COALESCE(current_groups, 0) + ?), updated_at = NOW()
     WHERE supervisor_name = ? AND TRIM(COALESCE(department, '')) = TRIM(?)`,
    [delta, name, dept]
  );
}

/** Returns whether assigning one more group to this supervisor in this department is allowed. */
export async function checkSupervisorCap(
  connection: any,
  supervisorName: string,
  department: string
): Promise<{ ok: boolean; message?: string }> {
  const name = String(supervisorName || '').trim();
  const dept = String(department || '').trim();
  if (!name || !dept) {
    return { ok: false, message: 'Supervisor name and department are required' };
  }
  const [rows] = await connection.execute(
    `SELECT id, current_groups, max_groups FROM supervisor_workload
     WHERE supervisor_name = ? AND TRIM(COALESCE(department, '')) = TRIM(?)`,
    [name, dept]
  );
  const r = (rows as any[])[0];
  if (!r) {
    return {
      ok: false,
      message:
        'No supervisor workload row for this name and department. Add the supervisor for this department (CSV) before assigning.',
    };
  }
  if (r.max_groups == null) return { ok: true };
  if (Number(r.current_groups) >= Number(r.max_groups)) {
    return { ok: false, message: 'Supervisor has reached the maximum number of groups for this department.' };
  }
  return { ok: true };
}
