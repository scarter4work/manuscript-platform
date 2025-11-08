# Authentication Setup Guide

## Step 1: Create D1 Database

Run these commands in your terminal:

```bash
# Create the database
cd C:\manuscript-platform
npx wrangler d1 create manuscript-platform-db

# This will output a database ID. Copy it!
```

## Step 2: Update wrangler.toml

Add this to your `wrangler.toml`:

```toml
[[d1_databases]]
binding = "DB"
database_name = "manuscript-platform-db"
database_id = "YOUR_DATABASE_ID_HERE"  # <-- Paste the ID from Step 1
```

## Step 3: Run Database Schema

```bash
# Apply the schema to your D1 database
npx wrangler d1 execute manuscript-platform-db --file=./database/schema.sql
```

## Step 4: Set JWT Secret

```bash
# Add JWT secret to your worker secrets
npx wrangler secret put JWT_SECRET
# When prompted, enter a strong random string (at least 32 characters)
```

Or add to `.dev.vars` for local development:
```
JWT_SECRET=your-super-secret-key-change-this-to-something-random
```

## Step 5: Copy Auth Handler Functions

Add these functions to the END of your `worker.js` file (after the last function):

```javascript
// Copy the entire content from auth-handlers.js here
```

## Step 6: Protect Upload Routes

Update `handleManuscriptUpload` to require authentication:

```javascript
async function handleManuscriptUpload(request, env, corsHeaders) {
  // ADD THIS AT THE TOP:
  const authCheck = await requireAuth(request, env);
  if (!authCheck.authorized) {
    return new Response(JSON.stringify({ error: authCheck.error }), {
      status: 401,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
  const userId = authCheck.user.id;
  
  // Check if user can upload
  const auth = new Auth(env);
  const canUpload = await auth.canPerformAction(userId, 'upload');
  if (!canUpload.allowed) {
    return new Response(JSON.stringify({ error: canUpload.reason }), {
      status: 403,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }

  try {
    // ... rest of existing upload code ...
    
    // CHANGE THIS LINE:
    // const authorId = formData.get('authorId') || 'anonymous';
    // TO:
    const authorId = userId; // Use authenticated user ID
    
    // ... rest of code ...
  }
}
```

## Step 7: Protect Analysis Routes

Similarly protect `/analyze/developmental`, `/analyze/line-editing`, and `/analyze/copy-editing` routes.

## Step 8: Update Dashboard

Add auth check at the top of `frontend/index.html` script:

```javascript
// Add this at the very top of the <script> tag
window.addEventListener('DOMContentLoaded', async () => {
    const token = localStorage.getItem('auth_token');
    
    if (!token) {
        window.location.href = '/login.html';
        return;
    }
    
    // Verify token is still valid
    try {
        const response = await fetch(`${API_BASE}/auth/verify`, {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        const data = await response.json();
        
        if (!data.valid) {
            localStorage.clear();
            window.location.href = '/login.html';
            return;
        }
        
        // Display user info
        const userName = localStorage.getItem('user_name') || data.user.email;
        // Add user info to header
        
    } catch (error) {
        console.error('Auth check failed:', error);
        window.location.href = '/login.html';
    }
});
```

## Step 9: Deploy

```bash
git add .
git commit -m "Add user authentication and database"
git push
```

## Step 10: Test

1. Visit `https://dashboard.selfpubhub.co/login.html`
2. Create an account
3. Login
4. Upload a manuscript (should work)
5. Try accessing dashboard without logging in (should redirect to login)

## Default Plan Limits

- **Free**: 3 manuscripts, 10 analyses/month
- **Pro**: 50 manuscripts, 100 analyses/month  
- **Enterprise**: Unlimited

## Admin Tasks

### View all users:
```bash
npx wrangler d1 execute manuscript-platform-db --command="SELECT email, full_name, plan, created_at FROM users"
```

### Upgrade a user to Pro:
```bash
npx wrangler d1 execute manuscript-platform-db --command="UPDATE users SET plan='pro' WHERE email='user@example.com'"
```

### Reset monthly analysis count (run at start of each month):
```bash
npx wrangler d1 execute manuscript-platform-db --command="UPDATE users SET monthly_analyses=0"
```

## Troubleshooting

**"DB is not defined"**
- Make sure you added the d1_databases binding to wrangler.toml
- Redeploy the worker

**"JWT_SECRET is not set"**
- Run `npx wrangler secret put JWT_SECRET`
- Or add to `.dev.vars` for local testing

**"Table does not exist"**
- Run the schema: `npx wrangler d1 execute manuscript-platform-db --file=./database/schema.sql`

## Security Notes

1. Never commit `.dev.vars` to git
2. Use strong JWT_SECRET (at least 32 random characters)
3. Passwords are hashed with SHA-256 (consider upgrading to bcrypt for production)
4. Tokens expire after 7 days
5. HttpOnly cookies prevent XSS attacks
