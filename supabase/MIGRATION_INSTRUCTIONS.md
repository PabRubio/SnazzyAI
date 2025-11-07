# 🗄️ Database Migration Instructions

## Run These SQL Files in Supabase Dashboard

Since we're setting up the database for the first time, you need to run these SQL migration files in your Supabase Dashboard.

### Steps:

1. **Go to**: https://supabase.com/dashboard/project/lwyuwkcbcgfhhtbfyieo/sql/new

2. **Run the database schema** (copy and paste, then click "Run"):
   - Open: `supabase/migrations/20250113_initial_schema.sql`
   - Copy the entire file
   - Paste into SQL Editor
   - Click "Run" (bottom right)
   - ✅ You should see "Success. No rows returned"

3. **Run the storage policies** (copy and paste, then click "Run"):
   - Open: `supabase/migrations/20250113_storage_policies.sql`
   - Copy the entire file
   - Paste into SQL Editor
   - Click "Run" (bottom right)
   - ✅ You should see "Success. No rows returned"

### Verification:

After running both files, verify:
- Go to Table Editor → You should see: `profiles`, `outfit_analyses`, `product_recommendations`, `favorite_products`, `try_on_results`
- Click on any table → "RLS enabled" should show at the top

### All Done! 🎉

Once you've run both SQL files successfully, come back and let me know so I can continue with the edge functions setup.
