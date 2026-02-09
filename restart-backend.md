# Backend Restart Required

The Settings API routes need the backend to be restarted to load properly.

## Quick Fix:

1. **Stop the current backend** (if running):
   - Press `Ctrl+C` in the terminal where backend is running
   - Or close that terminal

2. **Start the backend**:
   ```bash
   cd backend
   npm run dev
   ```

3. **Verify it's working**:
   - Backend should show: `🚀 Server running on port 5000`
   - You should see: `Settings: http://localhost:5000/api/settings`

4. **Test the Settings page**:
   - Refresh your browser
   - Try changing a threshold value
   - Click "Save Global Thresholds"
   - Should show success message

## Why This Happened:

The settings routes were added after the backend started, so it needs a restart to register the new `/api/settings/*` endpoints.

## Alternative (if above doesn't work):

Run this test to verify the API:
```bash
node test-settings-api.cjs
```

Should show: `✅ Settings API is working!`
