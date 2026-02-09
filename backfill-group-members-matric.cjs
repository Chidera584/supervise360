const mysql = require('mysql2/promise');

function normalizeName(name) {
  return String(name || '')
    .trim()
    .replace(/\s+/g, ' ')
    .toLowerCase();
}

async function backfillMatricNumbers() {
  const db = await mysql.createConnection({
    host: '127.0.0.1',
    user: 'root',
    password: 'Chidera_2468',
    database: 'supervise360',
    port: 3307
  });

  try {
    console.log('🔧 Backfilling group_members.matric_number (safe name match)...');

    const [studentRows] = await db.execute(
      `SELECT u.id as user_id, u.first_name, u.last_name, s.matric_number
       FROM users u
       JOIN students s ON s.user_id = u.id
       WHERE s.matric_number IS NOT NULL`
    );

    const nameToMatric = new Map();
    for (const row of studentRows) {
      const first = row.first_name || '';
      const last = row.last_name || '';

      const name1 = normalizeName(`${first} ${last}`);
      const name2 = normalizeName(`${last} ${first}`);

      if (!nameToMatric.has(name1)) nameToMatric.set(name1, []);
      if (!nameToMatric.has(name2)) nameToMatric.set(name2, []);

      nameToMatric.get(name1).push(row.matric_number);
      nameToMatric.get(name2).push(row.matric_number);
    }

    const [members] = await db.execute(
      `SELECT id, student_name, matric_number
       FROM group_members
       WHERE matric_number IS NULL`
    );

    let updated = 0;
    let skipped = 0;

    for (const member of members) {
      const key = normalizeName(member.student_name);
      const matches = nameToMatric.get(key) || [];

      const uniqueMatches = Array.from(new Set(matches));
      if (uniqueMatches.length === 1) {
        const matric = uniqueMatches[0];
        await db.execute(
          'UPDATE group_members SET matric_number = ? WHERE id = ?',
          [matric, member.id]
        );
        updated++;
      } else {
        skipped++;
        console.log(`⚠️  Skipping "${member.student_name}" - ${uniqueMatches.length} matches`);
      }
    }

    console.log(`✅ Backfill complete. Updated: ${updated}, Skipped: ${skipped}`);
  } catch (error) {
    console.error('❌ Error:', error.message);
  } finally {
    await db.end();
  }
}

backfillMatricNumbers();
