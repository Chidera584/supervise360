# Deploying Supervise360 to Vercel

## Quick Deploy (Recommended)

1. **Go to [vercel.com](https://vercel.com)** and sign in with GitHub.
2. **Import** your repo: `Chidera584/supervise360`
3. **Configure** (Vercel usually auto-detects Vite):
   - **Framework Preset:** Vite
   - **Build Command:** `npm run build`
   - **Output Directory:** `dist`
   - **Root Directory:** `./` (leave default)
4. **Environment Variables** (if you have a deployed backend):
   - `VITE_API_URL` = `https://your-backend-url.com/api`
5. Click **Deploy**.

## Backend Note

The frontend runs on Vercel. The **backend** (Express + MySQL) must be deployed separately:

- **Railway** or **Render** – good for Node.js + MySQL
- Set `VITE_API_URL` in Vercel to your backend URL (e.g. `https://your-app.railway.app/api`)

Without a deployed backend, the app will load but API calls will fail (e.g. login, data).

## CLI Deploy

```bash
npm i -g vercel
vercel login
vercel
```

Follow the prompts. Add `VITE_API_URL` in the Vercel dashboard after deployment.
