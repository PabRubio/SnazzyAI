# 🚀 Supabase Deployment Guide

## Part 1: Database Migrations (DO THIS FIRST!)

### Step 1: Run Database Schema Migration

1. Go to: https://supabase.com/dashboard/project/lwyuwkcbcgfhhtbfyieo/sql/new

2. Open the file: `supabase/migrations/20251031_initial_schema.sql`

3. Copy the entire contents

4. Paste into the SQL Editor

5. Click **"Run"** (bottom right)

6. ✅ You should see "Success. No rows returned"

### Step 2: Run Storage Policies Migration

1. Same SQL Editor: https://supabase.com/dashboard/project/lwyuwkcbcgfhhtbfyieo/sql/new

2. Open the file: `supabase/migrations/20251031_storage_policies.sql`

3. Copy the entire contents

4. Paste into the SQL Editor

5. Click **"Run"** (bottom right)

6. ✅ You should see "Success. No rows returned"

### Step 3: Verify Migrations

1. Go to **Table Editor** in Supabase Dashboard

2. You should see these tables:
   - `profiles`
   - `outfit_analyses`
   - `product_recommendations`
   - `favorite_products`
   - `try_on_results`

3. Click on any table → You should see "RLS enabled" badge at the top

---

## Part 2: Deploy Edge Functions

### Step 1: Get Supabase Access Token

1. Go to: https://supabase.com/dashboard/account/tokens

2. Click **"Generate New Token"**

3. Name it: `CLI Access Token`

4. Click **"Generate Token"**

5. **Copy the token** (you'll only see it once!)

### Step 2: Login to Supabase CLI

Run this command in your terminal (replace YOUR_TOKEN):

```bash
export SUPABASE_ACCESS_TOKEN=your_token_here
npx supabase login --token $SUPABASE_ACCESS_TOKEN
```

Or alternatively:

```bash
npx supabase login
```
(This will open a browser for you to login)

### Step 3: Link Local Project to Remote

```bash
cd /home/pablo/Documents/SnazzyAI-app
npx supabase link --project-ref lwyuwkcbcgfhhtbfyieo
```

You'll be asked for your database password (the one you set when creating the project).

### Step 4: Set Up Edge Function Secrets

Deploy the secrets from `.env.local`:

```bash
npx supabase secrets set --env-file supabase/.env.local
```

This uploads your API keys securely to Supabase.

### Step 5: Deploy All Edge Functions

```bash
npx supabase functions deploy analyze-outfit
npx supabase functions deploy search-products
npx supabase functions deploy virtual-try-on
```

Or deploy all at once:

```bash
npx supabase functions deploy
```

### Step 6: Verify Deployment

1. Go to: https://supabase.com/dashboard/project/lwyuwkcbcgfhhtbfyieo/functions

2. You should see 3 functions:
   - `analyze-outfit`
   - `search-products`
   - `virtual-try-on`

3. Each should show status: **"Healthy"** (green check)

---

## Part 3: Test Edge Functions (Optional)

### Test analyze-outfit:

```bash
npx supabase functions invoke analyze-outfit --data '{"base64Image":"your_base64_image_here"}'
```

### Test search-products:

```bash
npx supabase functions invoke search-products --data '{"searchTerms":"black leather jacket"}'
```

### Test virtual-try-on:

```bash
npx supabase functions invoke virtual-try-on --data '{"userPhotoBase64":"base64_here","clothingImageUrl":"https://example.com/image.jpg"}'
```

---

## Troubleshooting

### Error: "Access token not provided"
- Run `npx supabase login` again
- Or set `SUPABASE_ACCESS_TOKEN` environment variable

### Error: "Project not found"
- Make sure you're using the correct project ref: `lwyuwkcbcgfhhtbfyieo`
- Check you're logged into the correct Supabase account

### Error: "Deployment failed"
- Check your database password is correct
- Ensure you've linked the project first: `npx supabase link`
- Try deploying functions one at a time to isolate the issue

### Error: "Secrets not found"
- Verify `.env.local` file exists in `supabase/` directory
- Check all three API keys are present: `CLAUDE_API_KEY`, `OPENAI_API_KEY`, `GOOGLE_API_KEY`
- Run `npx supabase secrets set --env-file supabase/.env.local` again

---

## All Done! 🎉

Once all functions show "Healthy" in the dashboard, you're ready to proceed with the React Native integration!

Come back and let me know when you've completed deployment.
