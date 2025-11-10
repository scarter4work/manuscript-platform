// Authentication Module
// Handles user signup, login, JWT tokens, and session management

export class Auth {
  constructor(env) {
    this.env = env;

    // CRITICAL: JWT_SECRET must be set in production environment
    // This prevents token forgery and unauthorized access
    if (!env.JWT_SECRET) {
      throw new Error('CRITICAL SECURITY ERROR: JWT_SECRET environment variable is required');
    }
    this.jwtSecret = env.JWT_SECRET;
  }

  /**
   * Hash password using PBKDF2 (secure password hashing)
   * Uses 100,000 iterations as recommended by NIST
   * Generates random salt per password
   * Returns: "salt:hash" format
   */
  async hashPassword(password) {
    // Generate random 16-byte salt
    const saltBuffer = crypto.getRandomValues(new Uint8Array(16));

    // Convert password to bytes
    const encoder = new TextEncoder();
    const passwordBuffer = encoder.encode(password);

    // Import password as key material
    const keyMaterial = await crypto.subtle.importKey(
      'raw',
      passwordBuffer,
      { name: 'PBKDF2' },
      false,
      ['deriveBits']
    );

    // Derive hash using PBKDF2 with 100,000 iterations
    const hashBuffer = await crypto.subtle.deriveBits(
      {
        name: 'PBKDF2',
        salt: saltBuffer,
        iterations: 100000,
        hash: 'SHA-256'
      },
      keyMaterial,
      256 // 256 bits = 32 bytes
    );

    // Convert to hex strings
    const saltHex = Array.from(saltBuffer)
      .map(b => b.toString(16).padStart(2, '0'))
      .join('');
    const hashHex = Array.from(new Uint8Array(hashBuffer))
      .map(b => b.toString(16).padStart(2, '0'))
      .join('');

    // Return salt:hash format for storage
    return `${saltHex}:${hashHex}`;
  }

  /**
   * Verify password against stored hash
   * Extracts salt from stored hash and recomputes to compare
   */
  async verifyPassword(password, storedHash) {
    try {
      // Parse stored hash format: "salt:hash"
      const [saltHex, originalHashHex] = storedHash.split(':');
      if (!saltHex || !originalHashHex) {
        console.error('Invalid stored hash format');
        return false;
      }

      // Convert salt from hex to bytes
      const saltBuffer = new Uint8Array(
        saltHex.match(/.{1,2}/g).map(byte => parseInt(byte, 16))
      );

      // Convert password to bytes
      const encoder = new TextEncoder();
      const passwordBuffer = encoder.encode(password);

      // Import password as key material
      const keyMaterial = await crypto.subtle.importKey(
        'raw',
        passwordBuffer,
        { name: 'PBKDF2' },
        false,
        ['deriveBits']
      );

      // Derive hash with same salt and iterations
      const hashBuffer = await crypto.subtle.deriveBits(
        {
          name: 'PBKDF2',
          salt: saltBuffer,
          iterations: 100000,
          hash: 'SHA-256'
        },
        keyMaterial,
        256
      );

      // Convert to hex string
      const computedHashHex = Array.from(new Uint8Array(hashBuffer))
        .map(b => b.toString(16).padStart(2, '0'))
        .join('');

      // Constant-time comparison to prevent timing attacks
      return this.constantTimeCompare(computedHashHex, originalHashHex);
    } catch (error) {
      console.error('Password verification error:', error);
      return false;
    }
  }

  /**
   * Constant-time string comparison to prevent timing attacks
   */
  constantTimeCompare(a, b) {
    if (a.length !== b.length) {
      return false;
    }
    let result = 0;
    for (let i = 0; i < a.length; i++) {
      result |= a.charCodeAt(i) ^ b.charCodeAt(i);
    }
    return result === 0;
  }

  /**
   * Generate JWT token
   */
  async generateToken(userId, email) {
    const header = {
      alg: 'HS256',
      typ: 'JWT'
    };

    const payload = {
      userId: userId,
      email: email,
      iat: Math.floor(Date.now() / 1000),
      exp: Math.floor(Date.now() / 1000) + (60 * 60 * 24 * 7) // 7 days
    };

    const encodedHeader = this.base64urlEncode(JSON.stringify(header));
    const encodedPayload = this.base64urlEncode(JSON.stringify(payload));
    
    const signature = await this.signJWT(`${encodedHeader}.${encodedPayload}`);
    
    return `${encodedHeader}.${encodedPayload}.${signature}`;
  }

  /**
   * Verify JWT token
   */
  async verifyToken(token) {
    try {
      const parts = token.split('.');
      if (parts.length !== 3) {
        throw new Error('Invalid token format');
      }

      const [encodedHeader, encodedPayload, signature] = parts;
      
      // Verify signature
      const expectedSignature = await this.signJWT(`${encodedHeader}.${encodedPayload}`);
      if (signature !== expectedSignature) {
        throw new Error('Invalid signature');
      }

      // Decode payload
      const payload = JSON.parse(this.base64urlDecode(encodedPayload));
      
      // Check expiration
      if (payload.exp < Math.floor(Date.now() / 1000)) {
        throw new Error('Token expired');
      }

      return payload;
    } catch (error) {
      console.error('Token verification failed:', error);
      return null;
    }
  }

  /**
   * Sign JWT using HMAC-SHA256
   */
  async signJWT(data) {
    const encoder = new TextEncoder();
    const keyData = encoder.encode(this.jwtSecret);
    const messageData = encoder.encode(data);

    const key = await crypto.subtle.importKey(
      'raw',
      keyData,
      { name: 'HMAC', hash: 'SHA-256' },
      false,
      ['sign']
    );

    const signature = await crypto.subtle.sign('HMAC', key, messageData);
    
    return this.base64urlEncode(Array.from(new Uint8Array(signature)));
  }

  /**
   * Base64URL encode
   */
  base64urlEncode(data) {
    if (typeof data === 'string') {
      data = new TextEncoder().encode(data);
    }
    if (Array.isArray(data)) {
      data = new Uint8Array(data);
    }
    
    const base64 = btoa(String.fromCharCode(...new Uint8Array(data)));
    return base64.replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '');
  }

  /**
   * Base64URL decode
   */
  base64urlDecode(str) {
    str = str.replace(/-/g, '+').replace(/_/g, '/');
    while (str.length % 4) {
      str += '=';
    }
    return atob(str);
  }

  /**
   * Register new user
   */
  async register(email, password, fullName) {
    try {
      // Validate email
      if (!this.isValidEmail(email)) {
        throw new Error('Invalid email format');
      }

      // Validate password
      if (password.length < 8) {
        throw new Error('Password must be at least 8 characters');
      }

      // Check if user exists
      const existing = await this.env.DB.prepare(
        'SELECT id FROM users WHERE email = ?'
      ).bind(email).first();

      if (existing) {
        throw new Error('Email already registered');
      }

      // Create user
      const userId = crypto.randomUUID();
      const passwordHash = await this.hashPassword(password);
      const now = Math.floor(Date.now() / 1000);

      await this.env.DB.prepare(`
        INSERT INTO users (id, email, password_hash, full_name, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?, ?)
      `).bind(userId, email, passwordHash, fullName || null, now, now).run();

      // Generate token
      const token = await this.generateToken(userId, email);

      return {
        success: true,
        userId: userId,
        email: email,
        fullName: fullName,
        token: token
      };
    } catch (error) {
      console.error('Registration error:', error);
      throw error;
    }
  }

  /**
   * Login user
   */
  async login(email, password) {
    try {
      // Get user
      const user = await this.env.DB.prepare(
        'SELECT * FROM users WHERE email = ? AND is_active = 1'
      ).bind(email).first();

      if (!user) {
        throw new Error('Invalid email or password');
      }

      // Verify password
      const isValid = await this.verifyPassword(password, user.password_hash);
      if (!isValid) {
        throw new Error('Invalid email or password');
      }

      // Update last login
      const now = Math.floor(Date.now() / 1000);
      await this.env.DB.prepare(
        'UPDATE users SET last_login = ?, updated_at = ? WHERE id = ?'
      ).bind(now, now, user.id).run();

      // Generate token
      const token = await this.generateToken(user.id, user.email);

      return {
        success: true,
        userId: user.id,
        email: user.email,
        fullName: user.full_name,
        plan: user.plan,
        token: token
      };
    } catch (error) {
      console.error('Login error:', error);
      throw error;
    }
  }

  /**
   * Get user from token
   */
  async getUserFromToken(token) {
    const payload = await this.verifyToken(token);
    if (!payload) {
      return null;
    }

    const user = await this.env.DB.prepare(
      'SELECT id, email, full_name, plan, manuscripts_count FROM users WHERE id = ? AND is_active = 1'
    ).bind(payload.userId).first();

    return user;
  }

  /**
   * Extract token from Authorization header
   */
  extractToken(request) {
    const authHeader = request.headers.get('Authorization');
    if (authHeader && authHeader.startsWith('Bearer ')) {
      return authHeader.substring(7);
    }

    // Also check for token in cookie
    const cookieHeader = request.headers.get('Cookie');
    if (cookieHeader) {
      const cookies = cookieHeader.split(';').map(c => c.trim());
      for (const cookie of cookies) {
        if (cookie.startsWith('auth_token=')) {
          return cookie.substring(11);
        }
      }
    }

    return null;
  }

  /**
   * Validate email format
   */
  isValidEmail(email) {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
  }

  /**
   * Check if user can perform action (rate limiting, plan limits, etc.)
   */
  async canPerformAction(userId, action) {
    const user = await this.env.DB.prepare(
      'SELECT plan, manuscripts_count, monthly_analyses FROM users WHERE id = ?'
    ).bind(userId).first();

    if (!user) {
      return { allowed: false, reason: 'User not found' };
    }

    // Define limits per plan
    const limits = {
      free: { manuscripts: 3, monthly_analyses: 10 },
      pro: { manuscripts: 50, monthly_analyses: 100 },
      enterprise: { manuscripts: -1, monthly_analyses: -1 } // unlimited
    };

    const userLimits = limits[user.plan] || limits.free;

    if (action === 'upload') {
      if (userLimits.manuscripts !== -1 && user.manuscripts_count >= userLimits.manuscripts) {
        return { 
          allowed: false, 
          reason: `Plan limit reached. Upgrade to upload more manuscripts.` 
        };
      }
    }

    if (action === 'analyze') {
      if (userLimits.monthly_analyses !== -1 && user.monthly_analyses >= userLimits.monthly_analyses) {
        return { 
          allowed: false, 
          reason: `Monthly analysis limit reached. Upgrade your plan.` 
        };
      }
    }

    return { allowed: true };
  }

  /**
   * Log usage for billing/analytics
   */
  async logUsage(userId, action, resourceType = null, resourceId = null) {
    try {
      await this.env.DB.prepare(`
        INSERT INTO usage_logs (id, user_id, action, resource_type, resource_id, timestamp)
        VALUES (?, ?, ?, ?, ?, ?)
      `).bind(
        crypto.randomUUID(),
        userId,
        action,
        resourceType,
        resourceId,
        new Date().toISOString()
      ).run();
    } catch (error) {
      console.error('Usage logging error:', error);
      // Don't fail the request if logging fails
    }
  }
}
