// CSV Parser utility for handling file uploads
export interface ParsedCSVData {
  headers: string[];
  rows: any[];
}

export function parseCSV(csvText: string): ParsedCSVData {
  console.log('Raw CSV text:', csvText);
  
  // Try different delimiters
  const delimiters = [',', ';', '\t', '|'];
  let bestDelimiter = ',';
  let maxColumns = 0;
  
  // Find the best delimiter by checking which gives the most columns
  for (const delimiter of delimiters) {
    const firstLine = csvText.split(/\r?\n/)[0];
    if (firstLine) {
      const columns = firstLine.split(delimiter).length;
      if (columns > maxColumns) {
        maxColumns = columns;
        bestDelimiter = delimiter;
      }
    }
  }
  
  console.log('Best delimiter found:', bestDelimiter, 'with', maxColumns, 'columns');
  
  const lines = csvText.split(/\r?\n/).filter(line => line.trim());
  console.log('Lines after splitting:', lines);
  
  if (lines.length === 0) {
    throw new Error('CSV file is empty');
  }

  // Parse headers using the best delimiter
  const headerLine = lines[0];
  console.log('Header line:', headerLine);
  
  const headers = parseCSVLine(headerLine, bestDelimiter).map(h => h.trim());
  console.log('Parsed headers:', headers);
  
  if (headers.length === 0) {
    throw new Error('CSV headers are missing');
  }
  
  if (headers.length === 1 && headers[0].toLowerCase() === 'pk') {
    throw new Error('CSV appears to contain only a primary key column. Please ensure your CSV has the required data columns (Name for students or Name, Department, Max Groups for supervisors).');
  }

  const rows = [];

  for (let i = 1; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line) continue; // Skip empty lines
    
    console.log(`Processing line ${i + 1}:`, line);
    
    const values = parseCSVLine(line, bestDelimiter);
    console.log(`Parsed values:`, values);
    
    // Only process rows that have the same number of columns as headers
    if (values.length === headers.length) {
      const row: any = {};
      headers.forEach((header, index) => {
        row[header] = values[index] ? values[index].trim() : '';
      });
      console.log(`Created row object:`, row);
      rows.push(row);
    } else {
      console.warn(`Skipping line ${i + 1} - column count mismatch. Expected ${headers.length}, got ${values.length}`);
    }
  }

  console.log('Final parsed data:', { headers, rows });
  return { headers, rows };
}

// Helper function to parse a single CSV line, handling quoted values
function parseCSVLine(line: string, delimiter: string = ','): string[] {
  const result = [];
  let current = '';
  let inQuotes = false;
  
  for (let i = 0; i < line.length; i++) {
    const char = line[i];
    
    if (char === '"') {
      inQuotes = !inQuotes;
    } else if (char === delimiter && !inQuotes) {
      result.push(current.trim()); // Trim whitespace
      current = '';
    } else {
      current += char;
    }
  }
  
  result.push(current.trim()); // Trim whitespace
  return result.map(val => val.replace(/^"|"$/g, '').trim()); // Remove surrounding quotes and trim
}

export function generateCSV(data: any[], filename: string): void {
  if (data.length === 0) return;

  const headers = Object.keys(data[0]);
  const csvContent = [
    headers.join(','),
    ...data.map(row => headers.map(header => `"${row[header] || ''}"`).join(','))
  ].join('\n');

  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const link = document.createElement('a');
  const url = URL.createObjectURL(blob);
  link.setAttribute('href', url);
  link.setAttribute('download', filename);
  link.style.visibility = 'hidden';
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}

export function readFileAsText(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const text = e.target?.result as string;
      resolve(text);
    };
    reader.onerror = () => reject(new Error('Failed to read file'));
    reader.readAsText(file);
  });
}