import mysql from 'mysql2/promise';
import dotenv from 'dotenv';

dotenv.config();

// Database configuration
const dbConfig = {
  host: process.env.DB_HOST || 'localhost',
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD || '',
  database: process.env.DB_NAME || 'supervise360',
  port: parseInt(process.env.DB_PORT || '3306'),
  charset: 'utf8mb4',
  timezone: '+00:00',
  connectionLimit: 10,
  queueLimit: 0,
  waitForConnections: true,
  enableKeepAlive: true,
  keepAliveInitialDelay: 0
};

// Create connection pool for better performance
export const pool = mysql.createPool(dbConfig);

// Test database connection
export async function testConnection(): Promise<boolean> {
  try {
    const connection = await pool.getConnection();
    console.log('✅ Database connected successfully');
    connection.release();
    return true;
  } catch (error) {
    console.error('❌ Database connection failed:', error);
    return false;
  }
}

// Execute query with error handling
export async function executeQuery(query: string, params: any[] = []): Promise<{ success: boolean; data?: any; error?: any }> {
  try {
    const [results] = await pool.execute(query, params);
    return { success: true, data: results };
  } catch (error) {
    console.error('Database query error:', error);
    return { success: false, error: error };
  }
}

// Get single record
export async function getOne(query: string, params: any[] = []): Promise<any> {
  const result = await executeQuery(query, params);
  if (result.success && Array.isArray(result.data)) {
    return result.data[0] || null;
  }
  return null;
}

// Get multiple records
export async function getMany(query: string, params: any[] = []): Promise<any[]> {
  const result = await executeQuery(query, params);
  if (result.success && Array.isArray(result.data)) {
    return result.data;
  }
  return [];
}

// Insert record and return ID
export async function insertRecord(table: string, data: Record<string, any>): Promise<{ success: boolean; insertId?: number; error?: any }> {
  const fields = Object.keys(data).join(', ');
  const placeholders = Object.keys(data).map(() => '?').join(', ');
  const values = Object.values(data);
  
  const query = `INSERT INTO ${table} (${fields}) VALUES (${placeholders})`;
  const result = await executeQuery(query, values);
  
  if (result.success && result.data && 'insertId' in result.data) {
    return { success: true, insertId: (result.data as any).insertId };
  }
  
  return { success: false, error: result.error };
}

// Update record
export async function updateRecord(table: string, data: Record<string, any>, whereClause: string, whereParams: any[] = []): Promise<{ success: boolean; error?: any }> {
  const setClause = Object.keys(data).map(key => `${key} = ?`).join(', ');
  const values = [...Object.values(data), ...whereParams];
  
  const query = `UPDATE ${table} SET ${setClause} WHERE ${whereClause}`;
  return await executeQuery(query, values);
}

// Delete record
export async function deleteRecord(table: string, whereClause: string, whereParams: any[] = []): Promise<{ success: boolean; error?: any }> {
  const query = `DELETE FROM ${table} WHERE ${whereClause}`;
  return await executeQuery(query, whereParams);
}

// Initialize database connection
export async function initializeDatabase(): Promise<mysql.Pool> {
  const isConnected = await testConnection();
  if (!isConnected) {
    console.error('Failed to connect to database. Please check your configuration.');
    process.exit(1);
  }
  return pool;
}