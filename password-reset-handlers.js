/**
 * Password Reset Handlers
 * Handles forgot password and password reset functionality
 */

import { Auth } from './auth.js';

/**
 * POST /auth/forgot-password
 * Generates password reset token and sends email
 *
 * Request body: { email: string }
 * Returns: { success: boolean, message: string }
 */
export async function handleForgotPassword(request, env, corsHeaders) {
  try {
    const { email } = await request.json();

    if (!email) {
      return new Response(JSON.stringify({ error: 'Email is required' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // Check if user exists
    const user = await env.DB.prepare(
      'SELECT id, email, full_name FROM users WHERE email = ? AND is_active = 1'
    ).bind(email).first();

    // Always return success (don't reveal if email exists - security best practice)
    if (!user) {
      console.log('Password reset requested for non-existent email:', email);
      return new Response(JSON.stringify({
        success: true,
        message: 'If an account exists with that email, a password reset link has been sent.'
      }), {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // Generate secure reset token
    const resetToken = crypto.randomUUID();
    const resetTokenHash = await hashToken(resetToken); // Hash token before storing
    const expiresAt = new Date(Date.now() + 60 * 60 * 1000); // 1 hour from now

    // Store reset token in database
    await env.DB.prepare(`
      INSERT INTO password_reset_tokens (id, user_id, token_hash, expires_at, created_at)
      VALUES (?, ?, ?, ?, ?)
    `).bind(
      crypto.randomUUID(),
      user.id,
      resetTokenHash,
      expiresAt.toISOString(),
      new Date().toISOString()
    ).run();

    // Send password reset email
    const resetUrl = `${env.FRONTEND_URL}/reset-password?token=${resetToken}`;
    await sendPasswordResetEmail(env, user.email, user.full_name, resetUrl);

    console.log('Password reset email sent to:', email);

    return new Response(JSON.stringify({
      success: true,
      message: 'If an account exists with that email, a password reset link has been sent.'
    }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });

  } catch (error) {
    console.error('Forgot password error:', error);
    return new Response(JSON.stringify({ error: 'Failed to process request' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
}

/**
 * POST /auth/reset-password
 * Validates reset token and updates password
 *
 * Request body: { token: string, newPassword: string }
 * Returns: { success: boolean, message: string }
 */
export async function handleResetPassword(request, env, corsHeaders) {
  try {
    const { token, newPassword } = await request.json();

    if (!token || !newPassword) {
      return new Response(JSON.stringify({ error: 'Token and new password are required' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // Validate password strength
    if (newPassword.length < 8) {
      return new Response(JSON.stringify({ error: 'Password must be at least 8 characters' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // Hash the token to look it up
    const tokenHash = await hashToken(token);

    // Find valid reset token
    const resetToken = await env.DB.prepare(`
      SELECT rt.id, rt.user_id, rt.expires_at, rt.used_at, u.email
      FROM password_reset_tokens rt
      JOIN users u ON rt.user_id = u.id
      WHERE rt.token_hash = ? AND rt.used_at IS NULL
    `).bind(tokenHash).first();

    if (!resetToken) {
      return new Response(JSON.stringify({ error: 'Invalid or expired reset token' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // Check if token is expired
    const expiresAt = new Date(resetToken.expires_at);
    if (expiresAt < new Date()) {
      return new Response(JSON.stringify({ error: 'Reset token has expired. Please request a new one.' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // Hash the new password with PBKDF2
    const auth = new Auth(env);
    const passwordHash = await auth.hashPassword(newPassword);

    // Update user's password
    await env.DB.prepare(`
      UPDATE users SET password_hash = ?, updated_at = ? WHERE id = ?
    `).bind(passwordHash, new Date().toISOString(), resetToken.user_id).run();

    // Mark token as used
    await env.DB.prepare(`
      UPDATE password_reset_tokens SET used_at = ? WHERE id = ?
    `).bind(new Date().toISOString(), resetToken.id).run();

    console.log('Password reset successful for user:', resetToken.email);

    // Send confirmation email
    await sendPasswordResetConfirmationEmail(env, resetToken.email);

    return new Response(JSON.stringify({
      success: true,
      message: 'Password has been reset successfully. You can now log in with your new password.'
    }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });

  } catch (error) {
    console.error('Reset password error:', error);
    return new Response(JSON.stringify({ error: 'Failed to reset password' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
}

/**
 * GET /auth/verify-reset-token
 * Verify if reset token is valid (before showing reset form)
 *
 * Query param: token
 * Returns: { valid: boolean }
 */
export async function handleVerifyResetToken(request, env, corsHeaders) {
  try {
    const url = new URL(request.url);
    const token = url.searchParams.get('token');

    if (!token) {
      return new Response(JSON.stringify({ valid: false, error: 'Token is required' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // Hash the token to look it up
    const tokenHash = await hashToken(token);

    // Find valid reset token
    const resetToken = await env.DB.prepare(`
      SELECT expires_at, used_at FROM password_reset_tokens
      WHERE token_hash = ? AND used_at IS NULL
    `).bind(tokenHash).first();

    if (!resetToken) {
      return new Response(JSON.stringify({ valid: false, error: 'Invalid token' }), {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // Check if expired
    const expiresAt = new Date(resetToken.expires_at);
    if (expiresAt < new Date()) {
      return new Response(JSON.stringify({ valid: false, error: 'Token expired' }), {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    return new Response(JSON.stringify({ valid: true }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });

  } catch (error) {
    console.error('Verify reset token error:', error);
    return new Response(JSON.stringify({ valid: false, error: 'Failed to verify token' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
}

/**
 * Hash reset token using SHA-256 (for token lookup, not password)
 * Tokens are single-use and expire in 1 hour, so SHA-256 is acceptable here
 */
async function hashToken(token) {
  const encoder = new TextEncoder();
  const data = encoder.encode(token);
  const hash = await crypto.subtle.digest('SHA-256', data);
  return Array.from(new Uint8Array(hash))
    .map(b => b.toString(16).padStart(2, '0'))
    .join('');
}

/**
 * Send password reset email via MailChannels
 */
async function sendPasswordResetEmail(env, toEmail, fullName, resetUrl) {
  const emailContent = {
    personalizations: [
      {
        to: [{ email: toEmail, name: fullName || toEmail }],
      }
    ],
    from: {
      email: env.EMAIL_FROM_ADDRESS,
      name: env.EMAIL_FROM_NAME
    },
    subject: 'Reset Your Password - ManuscriptHub',
    content: [
      {
        type: 'text/html',
        value: `
          <!DOCTYPE html>
          <html>
          <head>
            <meta charset="utf-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
          </head>
          <body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
            <div style="background-color: #f8f9fa; padding: 20px; border-radius: 5px;">
              <h2 style="color: #007bff; margin-top: 0;">Password Reset Request</h2>

              <p>Hi${fullName ? ' ' + fullName : ''},</p>

              <p>We received a request to reset your password for your ManuscriptHub account. If you didn't make this request, you can safely ignore this email.</p>

              <p>To reset your password, click the button below:</p>

              <div style="text-align: center; margin: 30px 0;">
                <a href="${resetUrl}"
                   style="background-color: #007bff; color: white; padding: 12px 30px; text-decoration: none; border-radius: 5px; display: inline-block; font-weight: bold;">
                  Reset Password
                </a>
              </div>

              <p style="color: #666; font-size: 14px;">Or copy and paste this link into your browser:</p>
              <p style="word-break: break-all; color: #007bff; font-size: 14px;">${resetUrl}</p>

              <div style="margin-top: 30px; padding-top: 20px; border-top: 1px solid #ddd;">
                <p style="color: #666; font-size: 12px; margin: 5px 0;">
                  <strong>Security Notice:</strong> This link will expire in 1 hour.
                </p>
                <p style="color: #666; font-size: 12px; margin: 5px 0;">
                  If you didn't request a password reset, please contact support immediately at ${env.EMAIL_ADMIN_ADDRESS}.
                </p>
              </div>

              <div style="margin-top: 20px; padding-top: 20px; border-top: 1px solid #ddd; text-align: center; color: #666; font-size: 12px;">
                <p>© 2025 ManuscriptHub. All rights reserved.</p>
              </div>
            </div>
          </body>
          </html>
        `
      }
    ]
  };

  // Send email via MailChannels
  const emailResponse = await fetch('https://api.mailchannels.net/tx/v1/send', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(emailContent)
  });

  if (!emailResponse.ok) {
    console.error('Failed to send password reset email:', await emailResponse.text());
    throw new Error('Failed to send email');
  }

  console.log('Password reset email sent successfully to:', toEmail);
}

/**
 * Send password reset confirmation email
 */
async function sendPasswordResetConfirmationEmail(env, toEmail) {
  const emailContent = {
    personalizations: [
      {
        to: [{ email: toEmail }],
      }
    ],
    from: {
      email: env.EMAIL_FROM_ADDRESS,
      name: env.EMAIL_FROM_NAME
    },
    subject: 'Password Reset Successful - ManuscriptHub',
    content: [
      {
        type: 'text/html',
        value: `
          <!DOCTYPE html>
          <html>
          <head>
            <meta charset="utf-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
          </head>
          <body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
            <div style="background-color: #f8f9fa; padding: 20px; border-radius: 5px;">
              <h2 style="color: #28a745; margin-top: 0;">✓ Password Reset Successful</h2>

              <p>Your ManuscriptHub password has been successfully reset.</p>

              <p>You can now log in to your account using your new password.</p>

              <div style="text-align: center; margin: 30px 0;">
                <a href="${env.FRONTEND_URL}/login"
                   style="background-color: #007bff; color: white; padding: 12px 30px; text-decoration: none; border-radius: 5px; display: inline-block; font-weight: bold;">
                  Log In Now
                </a>
              </div>

              <div style="margin-top: 30px; padding-top: 20px; border-top: 1px solid #ddd;">
                <p style="color: #666; font-size: 12px; margin: 5px 0;">
                  <strong>Security Alert:</strong> If you didn't make this change, your account may be compromised.
                </p>
                <p style="color: #666; font-size: 12px; margin: 5px 0;">
                  Please contact support immediately at ${env.EMAIL_ADMIN_ADDRESS}.
                </p>
              </div>

              <div style="margin-top: 20px; padding-top: 20px; border-top: 1px solid #ddd; text-align: center; color: #666; font-size: 12px;">
                <p>© 2025 ManuscriptHub. All rights reserved.</p>
              </div>
            </div>
          </body>
          </html>
        `
      }
    ]
  };

  await fetch('https://api.mailchannels.net/tx/v1/send', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(emailContent)
  });
}
