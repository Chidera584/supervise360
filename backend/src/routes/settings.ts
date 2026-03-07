import { Router } from 'express';
import { Pool } from 'mysql2/promise';

export function createSettingsRouter(db: Pool) {
  const router = Router();

  router.get('/gpa-thresholds/global', async (_req, res) => {
    try {
      console.log('🔍 [API] Fetching global thresholds from database...');
      const [rows] = await db.execute(
        'SELECT setting_key, setting_value FROM system_settings WHERE setting_key IN (?, ?, ?)',
        ['gpa_tier_high_min', 'gpa_tier_medium_min', 'gpa_tier_low_min']
      );
      
      console.log('📥 [API] Raw database rows:', rows);
      
      const thresholds: { high?: number; medium?: number; low?: number } = {};
      
      (rows as any[]).forEach((row) => {
        const key = row.setting_key.replace('gpa_tier_', '').replace('_min', '');
        const value = parseFloat(row.setting_value);
        console.log(`  → ${row.setting_key} = "${row.setting_value}" → parsed as ${value} → key: ${key}`);
        if (!isNaN(value)) {
          thresholds[key as 'high' | 'medium' | 'low'] = value;
        } else {
          console.error(`  ❌ Failed to parse value for ${row.setting_key}: "${row.setting_value}"`);
        }
      });
      
      console.log('📊 [API] Parsed thresholds object:', thresholds);
      
      // Validate we have all three values - DO NOT use fallbacks if values exist but are wrong
      if (thresholds.high !== undefined && thresholds.medium !== undefined && thresholds.low !== undefined) {
        console.log('✅ [API] All thresholds found in database:', thresholds);
        res.json({ success: true, data: thresholds });
      } else {
        console.error('❌ [API] Missing threshold values! Found:', thresholds);
        console.error('   This means the database is missing required settings.');
        res.status(500).json({ 
          success: false, 
          message: 'Database is missing required threshold settings',
          data: thresholds 
        });
      }
    } catch (error) {
      console.error('❌ [API] Error fetching global GPA thresholds:', error);
      res.status(500).json({ success: false, message: 'Failed to fetch global GPA thresholds' });
    }
  });

  router.put('/gpa-thresholds/global', async (req, res) => {
    try {
      const { high, medium, low } = req.body;
      console.log('💾 [API] Updating global thresholds:', { high, medium, low });
      
      if (high === undefined || medium === undefined || low === undefined) {
        return res.status(400).json({ success: false, message: 'All threshold values required' });
      }
      if (high < medium || medium < low || low < 0 || high > 5.0) {
        return res.status(400).json({ success: false, message: 'Invalid threshold values' });
      }
      const connection = await db.getConnection();
      try {
        await connection.beginTransaction();
        
        console.log('📝 [API] Updating database with values:', {
          high: high.toString(),
          medium: medium.toString(),
          low: low.toString()
        });
        
        await connection.execute('UPDATE system_settings SET setting_value = ? WHERE setting_key = ?', [high.toString(), 'gpa_tier_high_min']);
        await connection.execute('UPDATE system_settings SET setting_value = ? WHERE setting_key = ?', [medium.toString(), 'gpa_tier_medium_min']);
        await connection.execute('UPDATE system_settings SET setting_value = ? WHERE setting_key = ?', [low.toString(), 'gpa_tier_low_min']);
        
        await connection.commit();
        
        // Verify the update
        const [verifyRows] = await connection.execute(
          'SELECT setting_key, setting_value FROM system_settings WHERE setting_key IN (?, ?, ?)',
          ['gpa_tier_high_min', 'gpa_tier_medium_min', 'gpa_tier_low_min']
        );
        console.log('✅ [API] Verified updated values in database:', verifyRows);
        
        res.json({ success: true, message: 'Updated successfully', data: { high, medium, low } });
      } catch (error) {
        await connection.rollback();
        throw error;
      } finally {
        connection.release();
      }
    } catch (error) {
      console.error('❌ [API] Error updating thresholds:', error);
      res.status(500).json({ success: false, message: 'Failed to update' });
    }
  });

  // Get global + all department thresholds (for Settings page)
  router.get('/gpa-thresholds/all', async (_req, res) => {
    try {
      const [globalRows] = await db.execute(
        'SELECT setting_key, setting_value FROM system_settings WHERE setting_key IN (?, ?, ?)',
        ['gpa_tier_high_min', 'gpa_tier_medium_min', 'gpa_tier_low_min']
      );
      const global: { high?: number; medium?: number; low?: number } = {};
      (globalRows as any[]).forEach((row) => {
        const key = row.setting_key.replace('gpa_tier_', '').replace('_min', '');
        const value = parseFloat(row.setting_value);
        if (!isNaN(value)) global[key as 'high' | 'medium' | 'low'] = value;
      });
      const defaultThresholds = { high: global.high ?? 3.8, medium: global.medium ?? 3.3, low: global.low ?? 0 };

      let departments: { id: number; name: string; code?: string }[] = [];
      try {
        const [deptRows] = await db.execute('SELECT id, name, code FROM departments ORDER BY name');
        departments = (deptRows as any[]).map((d) => ({ id: d.id, name: d.name, code: d.code }));
      } catch {
        const [altRows] = await db.execute('SELECT DISTINCT department as name FROM project_groups WHERE department IS NOT NULL ORDER BY department');
        departments = (altRows as any[]).map((d, i) => ({ id: i + 1, name: d.name, code: '' }));
      }

      const [settingsRows] = await db.execute(
        `SELECT department, use_custom_thresholds, gpa_tier_high_min, gpa_tier_medium_min, gpa_tier_low_min 
         FROM department_settings`
      );
      const settingsByDept: Record<string, { useCustomThresholds: boolean; thresholds: { high: number; medium: number; low: number } }> = {};
      (settingsRows as any[]).forEach((row) => {
        const useCustom = row.use_custom_thresholds === 1 || row.use_custom_thresholds === true;
        settingsByDept[row.department] = {
          useCustomThresholds: useCustom,
          thresholds: useCustom && row.gpa_tier_high_min != null
            ? { high: parseFloat(row.gpa_tier_high_min), medium: parseFloat(row.gpa_tier_medium_min), low: parseFloat(row.gpa_tier_low_min) }
            : defaultThresholds
        };
      });

      const departmentData = departments.map((d) => ({
        id: d.id,
        name: d.name,
        code: d.code,
        useCustomThresholds: settingsByDept[d.name]?.useCustomThresholds ?? false,
        thresholds: settingsByDept[d.name]?.thresholds ?? defaultThresholds
      }));

      res.json({ success: true, data: { global: defaultThresholds, departments: departmentData } });
    } catch (error) {
      console.error('Error fetching all thresholds:', error);
      res.status(500).json({ success: false, message: 'Failed to fetch thresholds' });
    }
  });

  // Get department-specific thresholds
  router.get('/gpa-thresholds/department/:department', async (req, res) => {
    try {
      // Decode department name from URL (handles spaces like "Software Engineering")
      const department = decodeURIComponent(req.params.department);
      console.log(`🔍 [SETTINGS] Fetching department thresholds for: "${department}"`);
      
      const [rows] = await db.execute(
        `SELECT use_custom_thresholds, gpa_tier_high_min, gpa_tier_medium_min, gpa_tier_low_min 
         FROM department_settings 
         WHERE department = ?`,
        [department]
      );

      if ((rows as any[]).length === 0) {
        // Department not found, fetch global thresholds and return them
        console.log(`ℹ️  [SETTINGS] No department settings found for "${department}", returning global thresholds`);
        const [globalRows] = await db.execute(
          'SELECT setting_key, setting_value FROM system_settings WHERE setting_key IN (?, ?, ?)',
          ['gpa_tier_high_min', 'gpa_tier_medium_min', 'gpa_tier_low_min']
        );
        
        const globalThresholds: { high?: number; medium?: number; low?: number } = {};
        
        (globalRows as any[]).forEach((row) => {
          const key = row.setting_key.replace('gpa_tier_', '').replace('_min', '');
          const value = parseFloat(row.setting_value);
          if (!isNaN(value)) {
            globalThresholds[key as 'high' | 'medium' | 'low'] = value;
          }
        });
        
        if (globalThresholds.high === undefined || globalThresholds.medium === undefined || globalThresholds.low === undefined) {
          console.error(`❌ [API] Missing threshold values for department "${department}"!`);
          console.error('   Found:', globalThresholds);
        }
        
        console.log(`📊 [API] Returning global thresholds (dept not found) for "${department}":`, globalThresholds);
        return res.json({
          success: true,
          data: {
            useCustomThresholds: false,
            thresholds: globalThresholds
          }
        });
      }

      const settings = (rows as any[])[0];
      const useCustom = settings.use_custom_thresholds === 1 || settings.use_custom_thresholds === true;
      
      // If department uses custom thresholds, use them; otherwise fetch global
      if (useCustom && settings.gpa_tier_high_min !== null) {
        const thresholds = {
          high: parseFloat(settings.gpa_tier_high_min),
          medium: parseFloat(settings.gpa_tier_medium_min),
          low: parseFloat(settings.gpa_tier_low_min)
        };
        
        console.log(`✅ [SETTINGS] Using department-specific thresholds for "${department}":`, thresholds);
        console.log(`📊 [API] Returning department thresholds:`, thresholds);
        
        return res.json({
          success: true,
          data: {
            useCustomThresholds: true,
            thresholds
          }
        });
      } else {
        // Department exists but doesn't use custom thresholds, return global
        console.log(`ℹ️  [SETTINGS] Department "${department}" doesn't use custom thresholds, returning global`);
        const [globalRows] = await db.execute(
          'SELECT setting_key, setting_value FROM system_settings WHERE setting_key IN (?, ?, ?)',
          ['gpa_tier_high_min', 'gpa_tier_medium_min', 'gpa_tier_low_min']
        );
        
        const globalThresholds: { high?: number; medium?: number; low?: number } = {};
        
        (globalRows as any[]).forEach((row) => {
          const key = row.setting_key.replace('gpa_tier_', '').replace('_min', '');
          const value = parseFloat(row.setting_value);
          if (!isNaN(value)) {
            globalThresholds[key as 'high' | 'medium' | 'low'] = value;
          }
        });
        
        if (globalThresholds.high === undefined || globalThresholds.medium === undefined || globalThresholds.low === undefined) {
          console.error(`❌ [API] Missing threshold values for department "${department}"!`);
          console.error('   Found:', globalThresholds);
        }
        
        console.log(`📊 [API] Returning global thresholds (dept doesn't use custom) for "${department}":`, globalThresholds);
        return res.json({
          success: true,
          data: {
            useCustomThresholds: false,
            thresholds: globalThresholds
          }
        });
      }
    } catch (error) {
      console.error('❌ [SETTINGS] Error fetching department GPA thresholds:', error);
      res.status(500).json({ success: false, message: 'Failed to fetch department GPA thresholds' });
    }
  });

  // Update department-specific thresholds
  router.put('/gpa-thresholds/department/:department', async (req, res) => {
    try {
      const { department } = req.params;
      const { useCustomThresholds, high, medium, low } = req.body;

      if (useCustomThresholds === undefined) {
        return res.status(400).json({ success: false, message: 'useCustomThresholds is required' });
      }

      if (useCustomThresholds) {
        if (high === undefined || medium === undefined || low === undefined) {
          return res.status(400).json({ success: false, message: 'All threshold values required when using custom thresholds' });
        }
        if (high < medium || medium < low || low < 0 || high > 5.0) {
          return res.status(400).json({ success: false, message: 'Invalid threshold values' });
        }
      }

      const connection = await db.getConnection();
      try {
        await connection.beginTransaction();

        // Check if department settings exist
        const [existing] = await connection.execute(
          'SELECT id FROM department_settings WHERE department = ?',
          [department]
        );

        if ((existing as any[]).length === 0) {
          // Insert new department settings
          await connection.execute(
            `INSERT INTO department_settings 
             (department, use_custom_thresholds, gpa_tier_high_min, gpa_tier_medium_min, gpa_tier_low_min, created_at, updated_at) 
             VALUES (?, ?, ?, ?, ?, NOW(), NOW())`,
            [
              department,
              useCustomThresholds ? 1 : 0,
              useCustomThresholds ? high : null,
              useCustomThresholds ? medium : null,
              useCustomThresholds ? low : null
            ]
          );
        } else {
          // Update existing department settings
          await connection.execute(
            `UPDATE department_settings 
             SET use_custom_thresholds = ?, 
                 gpa_tier_high_min = ?, 
                 gpa_tier_medium_min = ?, 
                 gpa_tier_low_min = ?,
                 updated_at = NOW()
             WHERE department = ?`,
            [
              useCustomThresholds ? 1 : 0,
              useCustomThresholds ? high : null,
              useCustomThresholds ? medium : null,
              useCustomThresholds ? low : null,
              department
            ]
          );
        }

        await connection.commit();
        res.json({
          success: true,
          message: 'Department settings updated successfully',
          data: {
            useCustomThresholds,
            thresholds: useCustomThresholds ? { high, medium, low } : null
          }
        });
      } catch (error) {
        await connection.rollback();
        throw error;
      } finally {
        connection.release();
      }
    } catch (error) {
      console.error('Error updating department thresholds:', error);
      res.status(500).json({ success: false, message: 'Failed to update department settings' });
    }
  });

  router.post('/gpa-thresholds/preview', async (req, res) => {
    try {
      const { high, medium, low, department } = req.body;
      console.log('🔍 [API] Preview request:', { high, medium, low, department });
      
      if (high === undefined || medium === undefined || low === undefined) {
        console.error('❌ [API] Missing threshold values in preview request');
        return res.status(400).json({ success: false, message: 'All threshold values (high, medium, low) are required' });
      }
      
      // If department is provided, filter by department
      // Students don't have department column - it's in the users table
      // Also filter out NULL GPAs
      let query = 'SELECT s.gpa FROM students s INNER JOIN users u ON s.user_id = u.id WHERE s.gpa IS NOT NULL';
      const params: any[] = [];
      
      if (department) {
        query += ' AND u.department = ?';
        params.push(department);
        console.log(`📊 [API] Filtering students by department: "${department}"`);
      } else {
        console.log('📊 [API] Previewing for all departments (no filter)');
      }
      
      console.log(`📊 [API] Executing query: ${query}`);
      console.log(`📊 [API] Query params:`, params);
      
      const [students] = await db.execute(query, params);
      const studentArray = students as any[];
      console.log(`📊 [API] Found ${studentArray.length} students for preview`);
      
      if (studentArray.length === 0) {
        console.log('⚠️  [API] No students found with GPAs for this department');
        return res.json({ 
          success: true, 
          data: { 
            distribution: { HIGH: 0, MEDIUM: 0, LOW: 0, total: 0 }, 
            thresholds: { high, medium, low },
            message: 'No students with GPA found for this department'
          } 
        });
      }
      
      const distribution = { HIGH: 0, MEDIUM: 0, LOW: 0, total: studentArray.length };
      studentArray.forEach((s: any) => {
        // Handle both string and number GPA values
        const gpaValue = s.gpa;
        const gpa = typeof gpaValue === 'number' ? gpaValue : parseFloat(gpaValue);
        
        if (isNaN(gpa) || gpa === null || gpa === undefined) {
          console.warn(`⚠️  [API] Invalid GPA value: ${gpaValue} (type: ${typeof gpaValue})`);
          return;
        }
        
        if (gpa >= high) {
          distribution.HIGH++;
        } else if (gpa >= medium) {
          distribution.MEDIUM++;
        } else {
          distribution.LOW++;
        }
      });
      
      console.log('📊 [API] Preview distribution:', distribution);
      res.json({ success: true, data: { distribution, thresholds: { high, medium, low } } });
    } catch (error) {
      console.error('❌ [API] Error previewing:', error);
      console.error('❌ [API] Error stack:', error instanceof Error ? error.stack : 'No stack trace');
      res.status(500).json({ 
        success: false, 
        message: error instanceof Error ? error.message : 'Failed to preview',
        error: process.env.NODE_ENV === 'development' ? (error instanceof Error ? error.stack : String(error)) : undefined
      });
    }
  });

  return router;
}
