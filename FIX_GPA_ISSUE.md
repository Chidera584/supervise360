# Fix for Missing GPA and Tier Data

## Problem
Groups are being formed but all students show:
- GPA: 0.00
- Tier: LOW

## Root Cause
Your CSV file either:
1. Doesn't have a "GPA" column
2. Has the GPA column with a different name (e.g., "CGPA", "Grade", etc.)
3. Has empty/invalid GPA values

## Solution Steps

### Step 1: Check Your CSV Format

Your CSV file MUST have these columns:
- `name` or `Name` - Student's full name
- `gpa` or `GPA` - Student's GPA (numeric value between 0.0 and 5.0)

**Correct CSV format:**
```csv
name,gpa
Alice Johnson,4.0
Bob Smith,3.5
Charlie Brown,3.0
```

**OR with capital letters:**
```csv
Name,GPA
Alice Johnson,4.0
Bob Smith,3.5
Charlie Brown,3.0
```

### Step 2: Test Your CSV File

1. Open the file `test-csv-format.html` in your browser
2. Upload your CSV file
3. Check if:
   - Name column is detected ✅
   - GPA column is detected ✅
   - GPA values are being parsed correctly
   - Tier distribution shows HIGH, MEDIUM, and LOW students

### Step 3: Clear Existing Groups

Before uploading a new CSV with correct GPA data:

1. Go to the Groups page in your app
2. Click "Clear All Groups" button
3. Confirm the deletion

### Step 4: Upload Corrected CSV

1. Make sure your CSV has the correct format (see Step 1)
2. Upload the CSV file
3. Check that groups now show:
   - Correct GPA values
   - Correct tier classifications (HIGH, MEDIUM, LOW)
   - Students grouped by tier

## Common CSV Issues

### Issue 1: Wrong Column Names
❌ **Wrong:**
```csv
Student Name,CGPA
Alice,4.0
```

✅ **Correct:**
```csv
name,gpa
Alice,4.0
```

### Issue 2: Missing GPA Column
❌ **Wrong:**
```csv
name
Alice Johnson
Bob Smith
```

✅ **Correct:**
```csv
name,gpa
Alice Johnson,4.0
Bob Smith,3.5
```

### Issue 3: Invalid GPA Values
❌ **Wrong:**
```csv
name,gpa
Alice,N/A
Bob,
Charlie,ABC
```

✅ **Correct:**
```csv
name,gpa
Alice,4.0
Bob,3.5
Charlie,3.0
```

## GPA Tier Classification

The system classifies students into tiers based on GPA:

- **HIGH Tier**: GPA ≥ 3.80 (e.g., 3.80, 4.0, 4.5, 5.0)
- **MEDIUM Tier**: GPA 3.30 - 3.79 (e.g., 3.30, 3.50, 3.75)
- **LOW Tier**: GPA < 3.30 (e.g., 2.0, 2.5, 3.0, 3.29)

## Ideal Group Formation

For best results, your CSV should have:
- Total students divisible by 3
- Roughly equal numbers in each tier

**Example for 12 students:**
- 4 HIGH tier students (GPA ≥ 3.80)
- 4 MEDIUM tier students (GPA 3.30-3.79)
- 4 LOW tier students (GPA < 3.30)

This will form 4 perfect groups with 1 student from each tier.

## Sample CSV File

Download the sample CSV from `test-csv-format.html` or create one like this:

```csv
name,gpa
Alice Johnson,4.0
Bob Smith,3.5
Charlie Brown,3.0
Diana Prince,3.9
Eve Wilson,3.4
Frank Miller,2.8
Grace Lee,4.2
Henry Davis,3.6
Ivy Chen,3.1
Jack Wilson,3.85
Kate Brown,3.45
Leo Martinez,2.9
```

This will form 4 groups:
- Group A: Alice (4.0 HIGH) + Bob (3.5 MEDIUM) + Charlie (3.0 LOW)
- Group B: Diana (3.9 HIGH) + Eve (3.4 MEDIUM) + Frank (2.8 LOW)
- Group C: Grace (4.2 HIGH) + Henry (3.6 MEDIUM) + Ivy (3.1 LOW)
- Group D: Jack (3.85 HIGH) + Kate (3.45 MEDIUM) + Leo (2.9 LOW)

## Verification

After uploading, verify that:
1. Each group shows 3 members
2. Each member shows their actual GPA (not 0.00)
3. Each member shows their tier (HIGH, MEDIUM, or LOW)
4. The first member (with 👑 crown) is from HIGH tier

## If Problem Persists

If you still see GPA: 0.00 after following these steps:

1. Check the browser console (F12) for errors
2. Check the backend logs for "Backend processing" messages
3. Share your CSV file format (first 3 lines) so I can help debug
