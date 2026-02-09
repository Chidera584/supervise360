# 🔍 Debug HTTP 500 Error - Step by Step Guide

## 🎯 Current Status
- ✅ Backend API is working correctly (tested successfully)
- ✅ Groups page loads without issues
- ❌ Frontend shows "HTTP error! status: 500" when uploading CSV files
- ✅ Enhanced error logging added to frontend

## 🧪 Debugging Steps

### **Step 1: Check Browser Console**
1. Open Groups page: `http://localhost:5173`
2. Login as admin: `admin@supervise360.com`
3. Open browser Developer Tools (F12)
4. Go to **Console** tab
5. Try uploading a CSV file
6. **Look for these specific log messages:**

```
🔄 Calling formGroupsFromStudents with: X students
🚀 Making API call to formGroups...
📥 API response: [response object]
```

### **Step 2: Check Network Tab**
1. In Developer Tools, go to **Network** tab
2. Try uploading CSV file again
3. Look for the API request to `/api/groups/form`
4. **Check the request details:**
   - Status code (should be 200, not 500)
   - Response body
   - Request payload

### **Step 3: Check Backend Logs**
The backend server should show these logs when you upload:
```
🔍 Form groups endpoint called
📊 Received students for grouping: X for department: Software Engineering
🔍 ASP Group Formation - Input students: X
📊 Tier distribution: HIGH: X, MEDIUM: X, LOW: X
```

### **Step 4: Test with Sample Data**
Use this exact CSV content to test:

```csv
Name,GPA
John High,4.2
Jane Medium,3.5
Bob Low,3.1
Alice High,4.0
Charlie Medium,3.4
Eve Low,2.9
```

## 🔍 **What to Look For**

### **If you see in console:**
- ✅ `✅ API call successful` → Backend is working
- ❌ `❌ API returned error response` → Check the error details
- ❌ `Network error: Cannot connect` → Backend server is down
- ❌ `Server Error (HTTP 500)` → Backend internal error

### **Common Issues & Solutions:**

#### **Issue 1: Backend Server Not Running**
**Symptoms:** Network connection errors
**Solution:** 
```bash
cd backend
node server.js
```

#### **Issue 2: Authentication Token Expired**
**Symptoms:** HTTP 401 errors
**Solution:** Log out and log back in

#### **Issue 3: CSV Format Issues**
**Symptoms:** "No valid student data found"
**Solution:** Ensure CSV has `Name,GPA` headers and proper data

#### **Issue 4: Database Connection Issues**
**Symptoms:** Backend shows database errors
**Solution:** Check MySQL server is running

## 🚀 **Quick Test Commands**

### Test Backend Directly:
```bash
cd backend
node test-file-upload-debug.cjs
```
**Expected:** Should show successful group formation

### Test Frontend API:
Open browser console and run:
```javascript
// Test API connection
fetch('http://localhost:5000/api/groups')
  .then(r => r.json())
  .then(console.log)
```

## 📋 **Report Back**

Please share:
1. **Browser console logs** when uploading CSV
2. **Network tab details** for the `/api/groups/form` request
3. **Backend server logs** during upload attempt
4. **Exact error message** you see in the UI

## 🔧 **Enhanced Error Messages**

The frontend now shows more specific errors:
- `Server Error (HTTP 500): [details]` - Backend internal error
- `Authentication Error (HTTP 401)` - Need to log in again  
- `API Not Found (HTTP 404)` - Backend endpoint missing
- `Network error: Cannot connect` - Backend server down

---

**Next Steps:** Follow the debugging steps above and report what you find in the browser console and network tab. This will help identify the exact cause of the HTTP 500 error.