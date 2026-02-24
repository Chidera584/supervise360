# Email Setup & Troubleshooting

## 1. Configure SMTP (Required for emails)

Add these to your `backend/.env` file:

```env
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=your_email@gmail.com
SMTP_PASS=your_app_password
FROM_EMAIL=noreply@supervise360.com
FROM_NAME=Supervise360
```

**For Gmail:** Use an [App Password](https://support.google.com/accounts/answer/185833), not your regular password.

**Restart the backend** after changing `.env`.

---

## 2. Test that email works

1. Log in as **Admin**
2. Call the test endpoint:
   ```bash
   curl -X POST http://localhost:5000/api/admin/test-email \
     -H "Authorization: Bearer YOUR_ADMIN_TOKEN" \
     -H "Content-Type: application/json" \
     -d '{}'
   ```
   Or add a "Send test email" button in Admin Settings that calls `api.sendTestEmail()`.

3. Check your inbox. If you get the email, SMTP is working.

---

## 3. Why didn't I get grouping/supervisor emails?

### A. SMTP not configured

- Check the **server terminal** when you run auto-assign. You should see:
  - `📧 Email not configured` → Add SMTP vars to `.env` and restart.
- If configured, you'll see logs like:
  - `📧 Notifying 3 student(s) for Group 1: a@x.com, b@x.com...`
  - `📧 Notifying supervisor x@x.com for Group 1`

### B. Student/supervisor not matched

Emails are sent only when we can match:

- **Students:** `group_members.matric_number` or `group_members.student_name` must match `students.matric_number` or `users.first_name/last_name`
- **Supervisors:** `project_groups.supervisor_name` must match a user in the `supervisors` table (by first/last name)

**Check:**

1. **Matric numbers:** The format in your CSV (e.g. `20/1234`) must match what students used when registering. Try trimming and normalizing slashes.
2. **Names:** `student_name` in group_members (from CSV) should match `first_name + last_name` in users.
3. **Supervisor names:** The name in `supervisor_workload` (from your supervisor upload) must match a registered supervisor user's first and last name.

### C. Server logs

When you run **Auto-assign**, watch the backend terminal for:

- `📧 Could not match student for email: ...` → Student lookup failed
- `📧 Could not match supervisor "..."` → Supervisor lookup failed
- `📧 No students matched for group X` → No students in that group could be matched

---

## 4. Quick checklist

- [ ] SMTP_HOST, SMTP_USER, SMTP_PASS in `backend/.env`
- [ ] Backend restarted after editing `.env`
- [ ] Test email sent successfully via `/api/admin/test-email`
- [ ] Matric numbers in group_members match students table
- [ ] Supervisor names in supervisor_workload match users table
