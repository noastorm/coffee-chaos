# Deploy Coffee Chaos

This project is ready to ship as a website plus Supabase-powered online rooms.

## 1. Confirm local readiness

Run:

```powershell
npm.cmd run check:deploy
```

If that passes, you can also do:

```powershell
npm.cmd run ready:deploy
```

That checks deployment requirements and builds the production site.

## 2. Create a GitHub repo

From this folder:

```powershell
git add .
git commit -m "Prepare Coffee Chaos for deployment"
git remote add origin https://github.com/YOUR_USERNAME/YOUR_REPO.git
git push -u origin main
```

Notes:

- `.env` is ignored and will not be uploaded.
- If you already have a GitHub repo, use its URL in the `git remote add origin` command.

## 3. Create Supabase project settings

You need these public values:

- `VITE_SUPABASE_URL`
- `VITE_SUPABASE_ANON_KEY`

Use only the public anon key, not the service-role key.

## 4. Deploy on Vercel

1. Sign in to Vercel.
2. Import the GitHub repo.
3. When asked for environment variables, add:
   - `VITE_SUPABASE_URL`
   - `VITE_SUPABASE_ANON_KEY`
4. Keep the default Vite build command:
   - `npm run build`
5. Keep the output directory:
   - `dist`
6. Deploy.

## 5. Share with friends

After deployment:

1. Open the Vercel URL on phone or desktop.
2. Use `ONLINE ROOM`.
3. Create a room.
4. Share the invite link or room code.

## Optional: GitHub Pages

This repo already includes:

- `.github/workflows/deploy-pages.yml`

If you want GitHub Pages instead of Vercel:

1. Add GitHub repo secrets:
   - `VITE_SUPABASE_URL`
   - `VITE_SUPABASE_ANON_KEY`
2. In GitHub Pages settings, choose `GitHub Actions` as the source.

Vercel is still the recommended first deployment path because the environment variable flow is simpler.
