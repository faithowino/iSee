# iSee — Missed Connections

Campus-only anonymous missed connections board.

Stack: React/Vite, Express, PostgreSQL. The UI only calls the API; PostgreSQL access lives in `server/repositories` and `server/db`, so the storage implementation can be changed later without rewriting the UI.

## Local
1. Install Node 20+ and PostgreSQL.
2. Create database `isee`.
3. Copy `.env.example` to `.env` and set `DATABASE_URL`.
4. `npm install`
5. `npm run db:migrate`
6. `npm run dev`
7. Open http://localhost:5173

Set `ADMIN_USERNAME` and `ADMIN_PASSWORD` before `npm run db:migrate` to create the first admin account. Production email OTP requires SMTP settings; without SMTP, local development logs the OTP to the server console.

## Fly.io
Deploy the web app separately from PostgreSQL. Set the production `DATABASE_URL` as a Fly secret. The browser never connects directly to the database.
