# Cloudflare Access Setup Guide
## Complete Step-by-Step Instructions

---

## What is Cloudflare Access?

Cloudflare Access puts a login page in front of your dashboard. Only people you authorize can access it. No database, no password management - Cloudflare handles everything!

---

## Setup Steps (5 minutes)

### Step 1: Go to Zero Trust Dashboard

1. Open browser and go to: **https://one.dash.cloudflare.com/**
2. You'll see "Zero Trust" in the sidebar
3. Click **Zero Trust**
4. If this is your first time:
   - Click **Get Started**
   - Choose a team name (e.g., "manuscripthub")
   - Click **Next**

### Step 2: Add Your Dashboard Application

1. In Zero Trust dashboard, click **Access** in left sidebar
2. Click **Applications**
3. Click **Add an application** button (top right)
4. Select **Self-hosted** (first option)

### Step 3: Configure Application

**Application Configuration:**

| Field | Value |
|-------|-------|
| Application name | `ManuscriptHub Dashboard` |
| Session Duration | `24 hours` (or choose what you want) |
| Application domain | See below ⬇️ |

**Application Domain Settings:**
- Click **Add domain**
- Subdomain: `dashboard`
- Domain: Select `scarter4workmanuscripthub.com` from dropdown
- Full domain should show: `dashboard.scarter4workmanuscripthub.com`

**Identity Providers:**
- Leave defaults checked (One-time PIN, Google, etc.)
- These let users login with email or Google account

Click **Next** →

### Step 4: Add Access Policy

**Policy Configuration:**

| Field | Value |
|-------|-------|
| Policy name | `Authorized Users` |
| Action | `Allow` (should be selected by default) |

**Configure Rules - Include Section:**

1. Click **+ Add include**
2. Selector: Choose **Emails**
3. Value: Enter email addresses (one per line):
   ```
   your-email@example.com
   client1@example.com
   client2@example.com
   ```

**Alternative - If all users share same domain:**
- Selector: Choose **Emails ending in**
- Value: `@yourdomain.com`

Click **Next** →

### Step 5: Additional Settings (Optional)

- **Purpose justification:** Leave disabled (not needed)
- **Approval groups:** Leave disabled (not needed)

Click **Add application**

---

## Step 6: Test It!

1. Open **incognito/private browser window**
2. Go to: `https://dashboard.scarter4workmanuscripthub.com`
3. You should see **Cloudflare Access login page**
4. Enter your email
5. Check email for login code (if using email login)
6. Or click "Sign in with Google"
7. After login → Dashboard appears with your name in header! 🎉

---

## Important Notes

### ✅ What's Protected:
- `dashboard.scarter4workmanuscripthub.com` ← Protected, requires login

### ⚠️ What's NOT Protected (API remains public):
- `api.scarter4workmanuscripthub.com` ← Still public
- This is CORRECT - the API needs to be accessible by the dashboard

### If you want to protect the API too:
1. Add another application in Cloudflare Access
2. Use domain: `api.scarter4workmanuscripthub.com`
3. Same policy (authorized users only)

---

## Managing Users

### Add New User:
1. Zero Trust → Access → Applications
2. Click your application
3. Click **Policies** tab
4. Edit the "Authorized Users" policy
5. Add new email to the list
6. Save

### Remove User:
1. Same steps as above
2. Remove email from list
3. Save
4. User immediately loses access

### View Active Sessions:
1. Zero Trust → Logs → Access
2. See who's logged in and when

---

## Pricing

- **Free tier:** Up to 50 users
- **Paid tier:** $3/user/month for 50+ users

You're definitely fine on free tier for now!

---

## Troubleshooting

**Problem: "Access Denied" when trying to login**
- Solution: Make sure your email is in the allowed list

**Problem: Still seeing dashboard without login**
- Solution: Clear browser cache and try incognito mode
- Or: Wait 1-2 minutes for Cloudflare to propagate changes

**Problem: API not working after setup**
- Solution: Make sure you only protected the dashboard, NOT the API domain

**Problem: Can't find Zero Trust in dashboard**
- Solution: Check you're logged into the correct Cloudflare account
- Or: Look under account settings → Products

---

## What Happens After Setup

### User Experience:
1. User visits dashboard URL
2. Cloudflare shows login page
3. User logs in (email code or Google)
4. Cloudflare creates secure session
5. User sees dashboard
6. User's email automatically used for uploads
7. Session lasts 24 hours (or whatever you set)

### Your Experience:
- Add/remove users in Cloudflare dashboard
- View login logs
- No passwords to manage
- No database to maintain
- Zero code to write

---

## Next Steps After Setup

1. ✅ Test login with your account
2. ✅ Upload a test manuscript
3. ✅ Invite your wife to test
4. ✅ Add first client email
5. ✅ Remove the test-author uploads (if you want)

---

## Security Notes

- Sessions are encrypted by Cloudflare
- Login requires email verification or OAuth
- You can enable 2FA in Zero Trust settings
- All access is logged
- Users can't share sessions (tied to their identity)

---

## Questions?

If you get stuck on any step, take a screenshot and I can help troubleshoot!

The main thing is:
1. Go to one.dash.cloudflare.com
2. Click Zero Trust
3. Add Application
4. Protect dashboard.scarter4workmanuscripthub.com
5. Add your email to allowed list

That's it! 🎉
