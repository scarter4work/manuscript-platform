// Auth route handlers
// Add these functions to your worker.js

// Handle user registration
async function handleRegister(request, env, corsHeaders) {
  try {
    const body = await request.json();
    const { email, password, fullName } = body;

    if (!email || !password) {
      return new Response(JSON.stringify({ error: 'Email and password required' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    const auth = new Auth(env);
    const result = await auth.register(email, password, fullName);

    return new Response(JSON.stringify(result), {
      status: 200,
      headers: { 
        ...corsHeaders, 
        'Content-Type': 'application/json',
        'Set-Cookie': `auth_token=${result.token}; Path=/; HttpOnly; Secure; SameSite=Strict; Max-Age=604800`
      }
    });

  } catch (error) {
    console.error('Register error:', error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 400,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
}

// Handle user login
async function handleLogin(request, env, corsHeaders) {
  try {
    const body = await request.json();
    const { email, password } = body;

    if (!email || !password) {
      return new Response(JSON.stringify({ error: 'Email and password required' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    const auth = new Auth(env);
    const result = await auth.login(email, password);

    return new Response(JSON.stringify(result), {
      status: 200,
      headers: { 
        ...corsHeaders, 
        'Content-Type': 'application/json',
        'Set-Cookie': `auth_token=${result.token}; Path=/; HttpOnly; Secure; SameSite=Strict; Max-Age=604800`
      }
    });

  } catch (error) {
    console.error('Login error:', error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 401,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
}

// Verify token
async function handleVerifyToken(request, env, corsHeaders) {
  try {
    const auth = new Auth(env);
    const token = auth.extractToken(request);

    if (!token) {
      return new Response(JSON.stringify({ valid: false }), {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    const user = await auth.getUserFromToken(token);

    if (user) {
      return new Response(JSON.stringify({ 
        valid: true, 
        user: {
          id: user.id,
          email: user.email,
          fullName: user.full_name,
          plan: user.plan
        }
      }), {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    } else {
      return new Response(JSON.stringify({ valid: false }), {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

  } catch (error) {
    console.error('Verify token error:', error);
    return new Response(JSON.stringify({ valid: false }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
}

// Middleware to require authentication
async function requireAuth(request, env) {
  const auth = new Auth(env);
  const token = auth.extractToken(request);

  if (!token) {
    return { authorized: false, error: 'No authentication token provided' };
  }

  const user = await auth.getUserFromToken(token);

  if (!user) {
    return { authorized: false, error: 'Invalid or expired token' };
  }

  return { authorized: true, user: user };
}
