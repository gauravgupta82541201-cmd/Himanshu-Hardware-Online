# Himanshu Hardware — Online Edition

This version is designed for public deployment:
Customer website -> Express API -> Supabase PostgreSQL database.

## Local setup
1. Install Node.js.
2. `npm install`
3. Create `.env` from `.env.example`.
4. Create a Supabase project and run `supabase/schema.sql` in its SQL Editor.
5. Put the Supabase URL and SERVICE ROLE KEY in `.env`. Never expose the service role key in frontend code.
6. Set ADMIN_EMAIL and ADMIN_PASSWORD.
7. Run `npm run setup-admin`.
8. Run `npm start`.
9. Open `http://127.0.0.1:3000`.

The public customer pages read products/settings from the online database. Admin changes are therefore visible to all visitors after refresh.

For production, deploy the Node server on a persistent host and keep the Supabase service-role key only in server environment variables.
