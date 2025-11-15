/**
 * Team Collaboration Handlers (MAN-13)
 *
 * Implements team management for Enterprise tier:
 * - Create and manage teams
 * - Invite and manage members
 * - Share manuscripts with teams
 * - Role-based permissions (admin, editor, viewer)
 * - Team activity feed
 *
 * All endpoints require authentication.
 * Some endpoints require team admin role.
 */

import { getUserFromRequest } from '../utils/auth-utils.js';
import { sendTeamInvitationEmail } from '../services/email-service.js';
import { initCache } from '../utils/db-cache.js';
import crypto from 'crypto';

/**
 * Verify user has required team role
 * @param {string} userId - User ID
 * @param {string} teamId - Team ID
 * @param {string[]} allowedRoles - Allowed roles (e.g., ['admin'])
 * @param {Object} env - Environment
 * @returns {Promise<boolean>}
 */
async function hasTeamRole(userId, teamId, allowedRoles, env) {
  const member = await env.DB.prepare(
    'SELECT role FROM team_members WHERE team_id = ? AND user_id = ?'
  ).bind(teamId, userId).first();

  return member && allowedRoles.includes(member.role);
}

/**
 * Check if user can access a team (is member or owner)
 */
async function canAccessTeam(userId, teamId, env) {
  const access = await env.DB.prepare(`
    SELECT 1 FROM teams WHERE id = ? AND owner_id = ?
    UNION
    SELECT 1 FROM team_members WHERE team_id = ? AND user_id = ?
  `).bind(teamId, userId, teamId, userId).first();

  return !!access;
}

/**
 * Log team activity
 */
async function logTeamActivity(teamId, userId, action, resourceType, resourceId, metadata, env) {
  await env.DB.prepare(`
    INSERT INTO team_activity (id, team_id, user_id, action, resource_type, resource_id, metadata, timestamp)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `).bind(
    crypto.randomUUID(),
    teamId,
    userId,
    action,
    resourceType,
    resourceId,
    JSON.stringify(metadata || {}),
    Math.floor(Date.now() / 1000)
  ).run();
}

export const teamHandlers = {
  /**
   * POST /teams
   * Create a new team (Enterprise tier only)
   */
  async createTeam(request, env) {
    try {
      const userId = await getUserFromRequest(request, env);
      if (!userId) {
        return new Response(JSON.stringify({ error: 'Unauthorized' }), {
          status: 401,
          headers: { 'Content-Type': 'application/json' }
        });
      }

      // Check if user has Enterprise tier
      const user = await env.DB.prepare(
        'SELECT subscription_tier FROM users WHERE id = ?'
      ).bind(userId).first();

      if (user?.subscription_tier !== 'ENTERPRISE') {
        return new Response(JSON.stringify({
          error: 'Team collaboration requires Enterprise tier subscription'
        }), {
          status: 403,
          headers: { 'Content-Type': 'application/json' }
        });
      }

      const { name, description } = await request.json();

      if (!name || name.trim().length === 0) {
        return new Response(JSON.stringify({ error: 'Team name is required' }), {
          status: 400,
          headers: { 'Content-Type': 'application/json' }
        });
      }

      const teamId = crypto.randomUUID();
      const now = Math.floor(Date.now() / 1000);

      // Create team
      await env.DB.prepare(`
        INSERT INTO teams (id, owner_id, name, description, max_members, created_at, updated_at)
        VALUES (?, ?, ?, ?, 5, ?, ?)
      `).bind(teamId, userId, name.trim(), description || null, now, now).run();

      // Add owner as admin member
      await env.DB.prepare(`
        INSERT INTO team_members (id, team_id, user_id, role, joined_at)
        VALUES (?, ?, ?, 'admin', ?)
      `).bind(crypto.randomUUID(), teamId, userId, now).run();

      // Log activity
      await logTeamActivity(teamId, userId, 'created_team', 'team', teamId, { name }, env);

      return new Response(JSON.stringify({
        success: true,
        team: { id: teamId, name, description, owner_id: userId, created_at: now }
      }), {
        status: 201,
        headers: { 'Content-Type': 'application/json' }
      });

    } catch (error) {
      console.error('Create team error:', error);
      return new Response(JSON.stringify({ error: error.message }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' }
      });
    }
  },

  /**
   * GET /teams
   * List user's teams
   */
  async listTeams(request, env) {
    try {
      const userId = await getUserFromRequest(request, env);
      if (!userId) {
        return new Response(JSON.stringify({ error: 'Unauthorized' }), {
          status: 401,
          headers: { 'Content-Type': 'application/json' }
        });
      }

      // Get teams where user is owner or member
      const { results } = await env.DB.prepare(`
        SELECT DISTINCT t.*, u.email as owner_email, u.full_name as owner_name
        FROM teams t
        JOIN users u ON t.owner_id = u.id
        LEFT JOIN team_members tm ON t.id = tm.team_id
        WHERE t.owner_id = ? OR tm.user_id = ?
        ORDER BY t.created_at DESC
      `).bind(userId, userId).all();

      // Get member counts for each team
      const teamsWithCounts = await Promise.all(results.map(async (team) => {
        const { count } = await env.DB.prepare(
          'SELECT COUNT(*) as count FROM team_members WHERE team_id = ?'
        ).bind(team.id).first();

        const userMember = await env.DB.prepare(
          'SELECT role FROM team_members WHERE team_id = ? AND user_id = ?'
        ).bind(team.id, userId).first();

        return {
          ...team,
          member_count: count,
          user_role: userMember?.role || (team.owner_id === userId ? 'owner' : null)
        };
      }));

      return new Response(JSON.stringify({
        success: true,
        teams: teamsWithCounts
      }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' }
      });

    } catch (error) {
      console.error('List teams error:', error);
      return new Response(JSON.stringify({ error: error.message }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' }
      });
    }
  },

  /**
   * GET /teams/:id
   * Get team details with members
   */
  async getTeam(request, env, teamId) {
    try {
      const userId = await getUserFromRequest(request, env);
      if (!userId) {
        return new Response(JSON.stringify({ error: 'Unauthorized' }), {
          status: 401,
          headers: { 'Content-Type': 'application/json' }
        });
      }

      // Check access
      if (!(await canAccessTeam(userId, teamId, env))) {
        return new Response(JSON.stringify({ error: 'Access denied' }), {
          status: 403,
          headers: { 'Content-Type': 'application/json' }
        });
      }

      // Get team details
      const team = await env.DB.prepare(`
        SELECT t.*, u.email as owner_email, u.full_name as owner_name
        FROM teams t
        JOIN users u ON t.owner_id = u.id
        WHERE t.id = ?
      `).bind(teamId).first();

      if (!team) {
        return new Response(JSON.stringify({ error: 'Team not found' }), {
          status: 404,
          headers: { 'Content-Type': 'application/json' }
        });
      }

      // Get team members
      const { results: members } = await env.DB.prepare(`
        SELECT tm.id, tm.role, tm.joined_at, u.id as user_id, u.email, u.full_name
        FROM team_members tm
        JOIN users u ON tm.user_id = u.id
        WHERE tm.team_id = ?
        ORDER BY tm.joined_at ASC
      `).bind(teamId).all();

      // Get pending invitations (admin only)
      let invitations = [];
      if (await hasTeamRole(userId, teamId, ['admin'], env) || team.owner_id === userId) {
        const { results } = await env.DB.prepare(`
          SELECT id, email, role, created_at, expires_at, status
          FROM team_invitations
          WHERE team_id = ? AND status = 'pending'
          ORDER BY created_at DESC
        `).bind(teamId).all();
        invitations = results;
      }

      return new Response(JSON.stringify({
        success: true,
        team: {
          ...team,
          members,
          invitations,
          user_role: members.find(m => m.user_id === userId)?.role || (team.owner_id === userId ? 'owner' : null)
        }
      }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' }
      });

    } catch (error) {
      console.error('Get team error:', error);
      return new Response(JSON.stringify({ error: error.message }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' }
      });
    }
  },

  /**
   * POST /teams/:id/invite
   * Invite user to team (admin only)
   */
  async inviteToTeam(request, env, teamId) {
    try {
      const userId = await getUserFromRequest(request, env);
      if (!userId) {
        return new Response(JSON.stringify({ error: 'Unauthorized' }), {
          status: 401,
          headers: { 'Content-Type': 'application/json' }
        });
      }

      // Check admin permission
      if (!(await hasTeamRole(userId, teamId, ['admin'], env))) {
        const team = await env.DB.prepare('SELECT owner_id FROM teams WHERE id = ?').bind(teamId).first();
        if (!team || team.owner_id !== userId) {
          return new Response(JSON.stringify({ error: 'Admin permission required' }), {
            status: 403,
            headers: { 'Content-Type': 'application/json' }
          });
        }
      }

      const { email, role = 'viewer' } = await request.json();

      if (!email || !['admin', 'editor', 'viewer'].includes(role)) {
        return new Response(JSON.stringify({ error: 'Invalid email or role' }), {
          status: 400,
          headers: { 'Content-Type': 'application/json' }
        });
      }

      // Check if team is at capacity
      const { count } = await env.DB.prepare(
        'SELECT COUNT(*) as count FROM team_members WHERE team_id = ?'
      ).bind(teamId).first();

      const team = await env.DB.prepare('SELECT max_members FROM teams WHERE id = ?').bind(teamId).first();

      if (count >= team.max_members) {
        return new Response(JSON.stringify({
          error: `Team is at capacity (${team.max_members} members max)`
        }), {
          status: 400,
          headers: { 'Content-Type': 'application/json' }
        });
      }

      // Check if user already exists and is a member
      const existingUser = await env.DB.prepare(
        'SELECT id FROM users WHERE email = ?'
      ).bind(email.toLowerCase()).first();

      if (existingUser) {
        const existingMember = await env.DB.prepare(
          'SELECT id FROM team_members WHERE team_id = ? AND user_id = ?'
        ).bind(teamId, existingUser.id).first();

        if (existingMember) {
          return new Response(JSON.stringify({ error: 'User is already a team member' }), {
            status: 400,
            headers: { 'Content-Type': 'application/json' }
          });
        }
      }

      // Check for existing pending invitation
      const existingInvite = await env.DB.prepare(`
        SELECT id FROM team_invitations
        WHERE team_id = ? AND email = ? AND status = 'pending'
      `).bind(teamId, email.toLowerCase()).first();

      if (existingInvite) {
        return new Response(JSON.stringify({ error: 'Invitation already sent to this email' }), {
          status: 400,
          headers: { 'Content-Type': 'application/json' }
        });
      }

      // Create invitation
      const invitationId = crypto.randomUUID();
      const token = crypto.randomUUID();
      const now = Math.floor(Date.now() / 1000);
      const expiresAt = now + (7 * 24 * 60 * 60); // 7 days

      await env.DB.prepare(`
        INSERT INTO team_invitations (id, team_id, email, role, token, invited_by, created_at, expires_at, status)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'pending')
      `).bind(invitationId, teamId, email.toLowerCase(), role, token, userId, now, expiresAt).run();

      // Log activity
      await logTeamActivity(teamId, userId, 'invited_member', 'invitation', invitationId, { email, role }, env);

      // Send invitation email
      try {
        // Get team and inviter details
        const team = await env.DB.prepare(
          'SELECT name FROM teams WHERE id = ?'
        ).bind(teamId).first();

        const inviter = await env.DB.prepare(
          'SELECT full_name FROM users WHERE id = ?'
        ).bind(userId).first();

        if (team && inviter) {
          await sendTeamInvitationEmail({
            to: email,
            inviterName: inviter.full_name || 'Team Admin',
            teamName: team.name,
            role: role,
            inviteToken: token,
            expiresAt: new Date(expiresAt * 1000).toLocaleDateString(),
            env
          });
          console.log(`Team invitation email sent to ${email}`);
        }
      } catch (emailError) {
        console.error(`Failed to send team invitation email:`, emailError);
        // Don't fail the invitation if email fails
      }

      return new Response(JSON.stringify({
        success: true,
        invitation: {
          id: invitationId,
          email,
          role,
          token, // Include token for now (remove in production, send via email)
          expires_at: expiresAt
        }
      }), {
        status: 201,
        headers: { 'Content-Type': 'application/json' }
      });

    } catch (error) {
      console.error('Invite to team error:', error);
      return new Response(JSON.stringify({ error: error.message }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' }
      });
    }
  },

  /**
   * POST /teams/accept-invitation/:token
   * Accept team invitation
   */
  async acceptInvitation(request, env, token) {
    try {
      const userId = await getUserFromRequest(request, env);
      if (!userId) {
        return new Response(JSON.stringify({ error: 'Unauthorized' }), {
          status: 401,
          headers: { 'Content-Type': 'application/json' }
        });
      }

      const user = await env.DB.prepare('SELECT email FROM users WHERE id = ?').bind(userId).first();

      // Get invitation
      const invitation = await env.DB.prepare(`
        SELECT * FROM team_invitations WHERE token = ? AND status = 'pending'
      `).bind(token).first();

      if (!invitation) {
        return new Response(JSON.stringify({ error: 'Invalid or expired invitation' }), {
          status: 404,
          headers: { 'Content-Type': 'application/json' }
        });
      }

      const now = Math.floor(Date.now() / 1000);

      if (invitation.expires_at < now) {
        await env.DB.prepare(
          "UPDATE team_invitations SET status = 'expired' WHERE id = ?"
        ).bind(invitation.id).run();

        return new Response(JSON.stringify({ error: 'Invitation has expired' }), {
          status: 400,
          headers: { 'Content-Type': 'application/json' }
        });
      }

      // Verify email matches
      if (user.email.toLowerCase() !== invitation.email.toLowerCase()) {
        return new Response(JSON.stringify({
          error: 'This invitation was sent to a different email address'
        }), {
          status: 403,
          headers: { 'Content-Type': 'application/json' }
        });
      }

      // Check if already a member
      const existingMember = await env.DB.prepare(
        'SELECT id FROM team_members WHERE team_id = ? AND user_id = ?'
      ).bind(invitation.team_id, userId).first();

      if (existingMember) {
        return new Response(JSON.stringify({ error: 'Already a team member' }), {
          status: 400,
          headers: { 'Content-Type': 'application/json' }
        });
      }

      // Add to team
      const memberId = crypto.randomUUID();
      await env.DB.prepare(`
        INSERT INTO team_members (id, team_id, user_id, role, invited_by, joined_at)
        VALUES (?, ?, ?, ?, ?, ?)
      `).bind(memberId, invitation.team_id, userId, invitation.role, invitation.invited_by, now).run();

      // Update invitation status
      await env.DB.prepare(`
        UPDATE team_invitations SET status = 'accepted', accepted_at = ? WHERE id = ?
      `).bind(now, invitation.id).run();

      // Log activity
      await logTeamActivity(invitation.team_id, userId, 'joined_team', 'member', memberId, { role: invitation.role }, env);

      return new Response(JSON.stringify({
        success: true,
        team_id: invitation.team_id,
        role: invitation.role
      }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' }
      });

    } catch (error) {
      console.error('Accept invitation error:', error);
      return new Response(JSON.stringify({ error: error.message }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' }
      });
    }
  },

  /**
   * DELETE /teams/:teamId/members/:userId
   * Remove team member (admin only)
   */
  async removeMember(request, env, teamId, memberId) {
    try {
      const userId = await getUserFromRequest(request, env);
      if (!userId) {
        return new Response(JSON.stringify({ error: 'Unauthorized' }), {
          status: 401,
          headers: { 'Content-Type': 'application/json' }
        });
      }

      // Check admin permission
      if (!(await hasTeamRole(userId, teamId, ['admin'], env))) {
        const team = await env.DB.prepare('SELECT owner_id FROM teams WHERE id = ?').bind(teamId).first();
        if (!team || team.owner_id !== userId) {
          return new Response(JSON.stringify({ error: 'Admin permission required' }), {
            status: 403,
            headers: { 'Content-Type': 'application/json' }
          });
        }
      }

      // Cannot remove team owner
      const team = await env.DB.prepare('SELECT owner_id FROM teams WHERE id = ?').bind(teamId).first();
      if (team.owner_id === memberId) {
        return new Response(JSON.stringify({ error: 'Cannot remove team owner' }), {
          status: 400,
          headers: { 'Content-Type': 'application/json' }
        });
      }

      // Get member info before deletion
      const member = await env.DB.prepare(`
        SELECT tm.id, u.email FROM team_members tm
        JOIN users u ON tm.user_id = u.id
        WHERE tm.team_id = ? AND tm.user_id = ?
      `).bind(teamId, memberId).first();

      if (!member) {
        return new Response(JSON.stringify({ error: 'Member not found' }), {
          status: 404,
          headers: { 'Content-Type': 'application/json' }
        });
      }

      // Remove member
      await env.DB.prepare(
        'DELETE FROM team_members WHERE team_id = ? AND user_id = ?'
      ).bind(teamId, memberId).run();

      // Log activity
      await logTeamActivity(teamId, userId, 'removed_member', 'member', member.id, { email: member.email }, env);

      return new Response(JSON.stringify({ success: true }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' }
      });

    } catch (error) {
      console.error('Remove member error:', error);
      return new Response(JSON.stringify({ error: error.message }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' }
      });
    }
  },

  /**
   * POST /teams/:teamId/share-manuscript
   * Share manuscript with team
   */
  async shareManuscript(request, env, teamId) {
    try {
      const userId = await getUserFromRequest(request, env);
      if (!userId) {
        return new Response(JSON.stringify({ error: 'Unauthorized' }), {
          status: 401,
          headers: { 'Content-Type': 'application/json' }
        });
      }

      const { manuscript_id, permission_level = 'view' } = await request.json();

      if (!manuscript_id || !['view', 'comment', 'edit'].includes(permission_level)) {
        return new Response(JSON.stringify({ error: 'Invalid manuscript ID or permission level' }), {
          status: 400,
          headers: { 'Content-Type': 'application/json' }
        });
      }

      // Verify user owns the manuscript
      const manuscript = await env.DB.prepare(
        'SELECT id, title FROM manuscripts WHERE id = ? AND user_id = ?'
      ).bind(manuscript_id, userId).first();

      if (!manuscript) {
        return new Response(JSON.stringify({ error: 'Manuscript not found or access denied' }), {
          status: 404,
          headers: { 'Content-Type': 'application/json' }
        });
      }

      // Verify user is a team member
      if (!(await canAccessTeam(userId, teamId, env))) {
        return new Response(JSON.stringify({ error: 'Not a team member' }), {
          status: 403,
          headers: { 'Content-Type': 'application/json' }
        });
      }

      // Check if already shared
      const existing = await env.DB.prepare(
        'SELECT id FROM manuscript_permissions WHERE manuscript_id = ? AND team_id = ?'
      ).bind(manuscript_id, teamId).first();

      if (existing) {
        // Update permission level
        await env.DB.prepare(
          'UPDATE manuscript_permissions SET permission_level = ? WHERE id = ?'
        ).bind(permission_level, existing.id).run();
      } else {
        // Create new permission
        const permissionId = crypto.randomUUID();
        await env.DB.prepare(`
          INSERT INTO manuscript_permissions (id, manuscript_id, team_id, user_id, permission_level, granted_by, granted_at)
          VALUES (?, ?, ?, NULL, ?, ?, ?)
        `).bind(
          permissionId,
          manuscript_id,
          teamId,
          permission_level,
          userId,
          Math.floor(Date.now() / 1000)
        ).run();
      }

      // Log activity
      await logTeamActivity(teamId, userId, 'shared_manuscript', 'manuscript', manuscript_id, {
        title: manuscript.title,
        permission_level
      }, env);

      return new Response(JSON.stringify({ success: true }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' }
      });

    } catch (error) {
      console.error('Share manuscript error:', error);
      return new Response(JSON.stringify({ error: error.message }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' }
      });
    }
  },

  /**
   * GET /teams/:teamId/manuscripts
   * Get manuscripts shared with team
   */
  async getTeamManuscripts(request, env, teamId) {
    try {
      const userId = await getUserFromRequest(request, env);
      if (!userId) {
        return new Response(JSON.stringify({ error: 'Unauthorized' }), {
          status: 401,
          headers: { 'Content-Type': 'application/json' }
        });
      }

      // Verify user is a team member
      if (!(await canAccessTeam(userId, teamId, env))) {
        return new Response(JSON.stringify({ error: 'Access denied' }), {
          status: 403,
          headers: { 'Content-Type': 'application/json' }
        });
      }

      // Get shared manuscripts
      const { results } = await env.DB.prepare(`
        SELECT
          m.id, m.title, m.status, m.genre, m.word_count, m.uploaded_at, m.updated_at,
          mp.permission_level,
          u.email as owner_email, u.full_name as owner_name
        FROM manuscript_permissions mp
        JOIN manuscripts m ON mp.manuscript_id = m.id
        JOIN users u ON m.user_id = u.id
        WHERE mp.team_id = ?
        ORDER BY mp.granted_at DESC
      `).bind(teamId).all();

      const manuscripts = results.map(m => ({
        ...m,
        metadata: m.metadata ? JSON.parse(m.metadata) : {}
      }));

      return new Response(JSON.stringify({
        success: true,
        manuscripts
      }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' }
      });

    } catch (error) {
      console.error('Get team manuscripts error:', error);
      return new Response(JSON.stringify({ error: error.message }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' }
      });
    }
  },

  /**
   * GET /teams/:teamId/activity
   * Get team activity feed
   */
  async getTeamActivity(request, env, teamId) {
    try {
      const userId = await getUserFromRequest(request, env);
      if (!userId) {
        return new Response(JSON.stringify({ error: 'Unauthorized' }), {
          status: 401,
          headers: { 'Content-Type': 'application/json' }
        });
      }

      // Verify user is a team member
      if (!(await canAccessTeam(userId, teamId, env))) {
        return new Response(JSON.stringify({ error: 'Access denied' }), {
          status: 403,
          headers: { 'Content-Type': 'application/json' }
        });
      }

      const url = new URL(request.url);
      const limit = parseInt(url.searchParams.get('limit') || '50');

      // Get activity feed
      const { results } = await env.DB.prepare(`
        SELECT
          ta.id, ta.action, ta.resource_type, ta.resource_id, ta.metadata, ta.timestamp,
          u.email as user_email, u.full_name as user_name
        FROM team_activity ta
        JOIN users u ON ta.user_id = u.id
        WHERE ta.team_id = ?
        ORDER BY ta.timestamp DESC
        LIMIT ?
      `).bind(teamId, limit).all();

      const activity = results.map(a => ({
        ...a,
        metadata: a.metadata ? JSON.parse(a.metadata) : {}
      }));

      return new Response(JSON.stringify({
        success: true,
        activity
      }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' }
      });

    } catch (error) {
      console.error('Get team activity error:', error);
      return new Response(JSON.stringify({ error: error.message }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' }
      });
    }
  }
};
