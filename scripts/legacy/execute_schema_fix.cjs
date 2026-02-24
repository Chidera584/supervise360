const mysql = require('mysql2/promise');
const fs = require('fs');
require('dotenv').config({ path: './.env' });

async function executeSchemaFix() {
  console.log('🔧 Executing schema fix...\n');
  
  const dbConfig = {
    host: process.env.DB_HOST || '127.0.0.1',
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || 'Chidera_2468',
    database: process.env.DB_NAME || 'supervise360',
    port: parseInt(process.env.DB_PORT || '3307'),
    multipleStatements: true
  };
  
  try {
    const connection = await mysql.createConnection(dbConfig);
    console.log('✅ Connected to database');
    
    // Read and execute the schema fix SQL
    const sqlContent = fs.readFileSync('../database/simple_schema_fix.sql', 'utf8');
    
    // Split by semicolon and execute each statement
    const statements = sqlContent.split(';').filter(stmt => stmt.trim().length > 0);
    
    for (let i = 0; i < statements.length; i++) {
      const statement = statements[i].trim();
      if (statement.length > 0) {
        try {
          await connection.execute(statement);
          console.log(`✅ Executed statement ${i + 1}/${statements.length}`);
        } catch (error) {
          if (error.message.includes('already exists') || error.message.includes('Duplicate')) {
            console.log(`⚠️  Statement ${i + 1} - Already exists (skipped)`);
          } else {
            console.log(`❌ Statement ${i + 1} failed:`, error.message);
          }
        }
      }
    }
    
    await connection.end();
    console.log('\n🎉 Schema fix completed!');
    
  } catch (error) {
    console.error('❌ Schema fix failed:', error.message);
    process.exit(1);
  }
}

executeSchemaFix();