# Cafe Chaos

Cafe Chaos is a React + Vite browser game with:

- local solo mode
- local couch co-op
- online room-based co-op with invite links / room codes
- click/tap-to-move pathfinding alongside the original direct controls

## Local setup

1. Install dependencies:

```bash
npm install
```

2. Create a local env file from the template:

```bash
copy .env.example .env
```

3. Add your public Supabase values to `.env`:

- `VITE_SUPABASE_URL`
- `VITE_SUPABASE_ANON_KEY`

4. Run the dev server:

```bash
npm run dev
```

## Production build

```bash
npm run build
```

The compiled site is output to `dist/`.

## Realtime setup

Online rooms use Supabase Realtime public channels. Create a Supabase project, then copy the project URL and anon key into:

- local `.env`
- Vercel environment variables
- GitHub repository secrets if you deploy with Pages

The room creator becomes the host and runs the simulation. The guest joins through the shared invite link or 6-character room code.

## Deploy on Vercel

1. Push this project to GitHub.
2. Import the repo into Vercel.
3. Add:
   - `VITE_SUPABASE_URL`
   - `VITE_SUPABASE_ANON_KEY`
4. Build command: `npm run build`
5. Output directory: `dist`

## Deploy on GitHub Pages

1. Push this project to a GitHub repo.
2. Add repo secrets:
   - `VITE_SUPABASE_URL`
   - `VITE_SUPABASE_ANON_KEY`
3. In GitHub, enable Pages and choose GitHub Actions as the source.
4. The included workflow at `.github/workflows/deploy-pages.yml` will publish `dist/` on pushes to `main`.

## Next upgrade ideas

- ambient cafe NPCs waiting in the customer area
- richer lobby polish, reconnect handling, and spectator support
