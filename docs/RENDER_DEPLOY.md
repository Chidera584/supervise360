# Deploy Supervise360 on Render (free tier)

Render’s free tier includes:

- **Web Service** (Node): your Express API (sleeps after ~15 minutes idle; first request after sleep can take ~30–60 seconds — “cold start”).
- **Static Site**: your Vite build (fast, no sleep).

Render does **not** include MySQL. You must use a **hosted MySQL** elsewhere and point the API at it with `MYSQL_URL` or `DB_*` variables.

---

## 1. MySQL database (required)

Pick one (examples; offers change over time):

- **Aiven** — free trial / small MySQL plans
- **PlanetScale** — check current product (was MySQL-compatible)
- **Clever Cloud**, **Railway** (paid small plans), or any host that gives a MySQL connection string

Create a database and user, import your schema (`database/improved_schema.sql`, migrations, etc.), then note:

- Host, port, user, password, database name  
- Or a single `mysql://...` URL if the provider gives one

For SSL-required hosts, set in the API service:

- `DB_SSL=true`  
  or use `MYSQL_URL` if the provider documents it (often includes SSL).

---

## 2. Deploy the API (Web Service)

1. [Render Dashboard](https://dashboard.render.com) → **New** → **Web Service** (or **Blueprint** and select this repo to use `render.yaml`).
2. Connect the GitHub repo.
3. Configure:
   - **Root Directory**: `backend`
   - **Build Command**: `npm install && npm run build`
   - **Start Command**: `npm start`
   - **Instance type**: Free

4. **Environment variables** (API) — set at least:

| Variable | Example / notes |
|----------|------------------|
| `NODE_ENV` | `production` |
| `MYSQL_URL` | Full URL if your host provides it |
| *or* `DB_HOST`, `DB_USER`, `DB_PASSWORD`, `DB_NAME`, `DB_PORT` | As from your MySQL provider |
| `DB_SSL` | `true` if the provider requires SSL |
| `JWT_SECRET` | Long random string |
| `FRONTEND_URL` | Your static site URL (e.g. `https://supervise360-web.onrender.com`) — set after step 3 |
| `SMTP_HOST`, `SMTP_USER`, `SMTP_PASS` | Optional; for emails |
| `CORS` / origins | Usually covered by `FRONTEND_URL` in your app |

5. Deploy and wait until it’s live. Open `https://<your-service-name>.onrender.com/health` — it should return JSON.

6. Copy the service URL, e.g. `https://supervise360-api.onrender.com`.

---

## 3. Deploy the frontend (Static Site)

1. **New** → **Static Site** → same repo.
2. Configure:
   - **Root Directory**: `.` (repository root)
   - **Build Command**: `npm install && npm run build`
   - **Publish directory**: `dist`

3. **Environment variables** — must include **build-time** API URL:

| Variable | Value |
|----------|--------|
| `VITE_API_URL` | `https://<your-api-name>.onrender.com/api` |

Note the **`/api`** suffix — it must match how your Express app mounts routes.

4. Deploy. After the build finishes, open the static URL and test login.

5. Go back to the **API** service and set `FRONTEND_URL` to the static site URL (exact origin, no trailing slash), then **Manual Deploy** if needed.

---

## 4. Using the Blueprint (`render.yaml`)

1. **New** → **Blueprint** → connect the repo.
2. Render creates two services. You still must:
   - Add all secrets (DB, JWT, `VITE_API_URL`, `FRONTEND_URL`, SMTP).
   - For the static site, set `VITE_API_URL` to your real API URL (often after the API is deployed first).

---

## 5. Troubleshooting

| Issue | What to check |
|--------|----------------|
| `401` / CORS | `FRONTEND_URL` matches the static site origin; API CORS allows it. |
| API unreachable | Health URL; cold start on free tier (wait and retry). |
| DB errors | `DB_SSL`, credentials, firewall allow Render’s IPs if required. |
| Frontend still calls localhost | Rebuild static site after changing `VITE_API_URL`. |

---

## 6. Uploads (reports, files)

Free Web Service disk is **ephemeral** — files can disappear on redeploy. For production, use S3, Cloudflare R2, or similar; until then, treat uploads as best-effort on Render free tier.

---

## Quick reference

- API: `https://<api>.onrender.com` + `/api` for frontend env.
- Health: `GET /health`
- Redeploy static site whenever `VITE_API_URL` changes.
