# Quick Start: Adding Authentication

## Files Created:
✅ `database/schema.sql` - Database structure
✅ `auth.js` - Authentication module  
✅ `auth-handlers.js` - Route handlers (copy to worker.js)
✅ `frontend/login.html` - Login/signup page
✅ `AUTH-SETUP.md` - Detailed setup guide

## Quick Setup (5 minutes):

### 1. Create Database
```bash
npx wrangler d1 create manuscript-platform-db
# Copy the database_id from output
```

### 2. Update wrangler.toml
Add this section:
```toml
[[d1_databases]]
binding = "DB"
database_name = "manuscript-platform-db"
database_id = "PASTE_YOUR_ID_HERE"
```

### 3. Initialize Database
```bash
npx wrangler d1 execute manuscript-platform-db --file=./database/schema.sql
```

### 4. Set JWT Secret
```bash
npx wrangler secret put JWT_SECRET
# Enter: a-very-long-random-string-at-least-32-characters-long
```

### 5. Copy Auth Handlers
Open `auth-handlers.js`, copy all functions, paste at END of `worker.js`

### 6. Add Auth Check to Upload
In `worker.js`, find `handleManuscriptUpload` function, add at the top:

```javascript
async function handleManuscriptUpload(request, env, corsHeaders) {
  // 🔐 ADD AUTH CHECK
  const authCheck = await requireAuth(request, env);
  if (!authCheck.authorized) {
    return new Response(JSON.stringify({ error: authCheck.error }), {
      status: 401,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
  const userId = authCheck.user.id;

  try {
    // ... existing code ...
    
    // CHANGE:  const authorId = formData.get('authorId') || 'anonymous';
    // TO:      const authorId = userId;
    
    // ... rest of code ...
```

### 7. Deploy
```bash
git add .
git commit -m "Add authentication"
git push
```

### 8. Test
Visit: `https://dashboard.scarter4workmanuscripthub.com/login.html`

## That's it! 🎉

Now only authenticated users can:
- Upload manuscripts
- Run analyses
- View reports

## Default User Limits:
- **Free Plan**: 3 manuscripts, 10 analyses/month
- All new users start on Free plan

## Upgrade Users:
```bash
npx wrangler d1 execute manuscript-platform-db --command="UPDATE users SET plan='pro' WHERE email='email@example.com'"
```

## View Users:
```bash
npx wrangler d1 execute manuscript-platform-db --command="SELECT * FROM users"
```

## Need Help?
See `AUTH-SETUP.md` for detailed guide
