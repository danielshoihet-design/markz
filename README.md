# Marketersz — Spice Market

Mobile-first spice marketplace for a manager, clients, and sellers.

- **Clients** browse spices, choose quantity, and send orders (paid from credits)
- **Sellers** send supply offers to the manager
- **Manager** gets live inbox notifications, grants credits, creates accounts, edits prices, and views monthly buy/sell results
- Languages: **Hebrew / English / Russian** (RTL for Hebrew)
- Backend: [Supabase](https://esqeimakebwtjaztbsuz.supabase.co)

## Setup

1. Copy env and fill keys from Supabase → Settings → API:

```bash
cp .env.example .env.local
```

```bash
NEXT_PUBLIC_SUPABASE_URL=https://esqeimakebwtjaztbsuz.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=...
SUPABASE_SERVICE_ROLE_KEY=...
```

2. Apply the database schema in the Supabase SQL Editor:

- Open `supabase/migrations/001_schema.sql`
- Paste and run it in the project SQL editor

3. Create the first manager:

```bash
node scripts/bootstrap-manager.mjs manager@example.com 'YourPassword' 'Manager Name'
```

4. Run the app:

```bash
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

## Roles

| Role    | Can do                                              |
|---------|-----------------------------------------------------|
| Manager | Inbox, credits, create users, products, monthly report |
| Client  | Catalog, place orders with credits                  |
| Seller  | Catalog, place supplies                             |

Product images live in `public/products/` (18 spice illustrations).
