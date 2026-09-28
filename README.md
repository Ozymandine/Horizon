# Horizon

Horizon is a private, password-protected entertainment release radar built with the Next.js App Router, Tailwind CSS, Prisma, and PostgreSQL. It uses no LLMs.

## What it does

- Lists future movies and TV releases from TMDB, upcoming Steam games, and MusicBrainz album releases.
- Lets you save releases to My List and follow them on an interactive timeline or calendar.
- Stores private 1–5 star reviews and comments. Discover ranks items using the categories and TMDB genres in high-rated reviews.
- Shows TMDB cast and trailers, watch-provider links, and Google News/Reddit RSS coverage on supported details.
- Uses a password-only login form and signed, HTTP-only session cookies.

Release catalogs change and may contain approximate or unannounced dates. Horizon filters dated movie and TV results to the future and labels fuzzy dates.

## Local setup

1. Install dependencies with `npm install`.
2. Copy `.env.example` to `.env.local` and configure `DATABASE_URL`, `DIRECT_URL`, TMDB credentials, `SITE_PASSWORD`, and a random `AUTH_SECRET`.
3. Run `npx prisma generate` and `npx prisma migrate deploy`.
4. Start the app with `npm run dev`.

Keep `.env.local` private. It is excluded from Git.

## Deploy

The app deploys to Vercel. Configure the same server-only variables in Vercel Production and Preview. Apply committed database migrations with `npx prisma migrate deploy` before deploying a schema change.

Horizon uses TMDB data but is not endorsed or certified by TMDB.
