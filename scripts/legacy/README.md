# Legacy Utility Scripts

These are one-off utility scripts used during development for testing, debugging, and database fixes. They are not part of the main application.

**Do not run these unless you understand what they do.** Some modify the database.

- `run-migration.cjs` – Database migration runner
- `check-*.cjs` – Diagnostic scripts (read-only)
- `test-*.cjs` – Test scripts
- `fix-*.cjs` – One-time database fix scripts
- `test-*.html` – Manual API test pages (open in browser; backend must be running)

For the main app, use:
- `npm run test-db` – Tests database connection (uses `scripts/test-database.js`)
