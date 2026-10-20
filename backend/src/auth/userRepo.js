const { pool } = require('../db/pool');
const { hashPassword, hashToken } = require('./jwt');
const crypto = require('crypto');

async function findByEmail(identifier) {
  const res = await pool.query(
    'SELECT * FROM core_users WHERE LOWER(email) = LOWER($1) OR LOWER(username) = LOWER($1) OR LOWER(name) = LOWER($1)',
    [identifier]
  );
  return res.rows[0] || null;
}

async function findById(id) {
  const res = await pool.query(
    `SELECT u.id, u.name, u.username, u.email, u.role_id, r.name as role_name,
            u.is_superadmin, u.is_active, u.created_at, u.updated_at 
     FROM core_users u
     LEFT JOIN core_roles r ON u.role_id = r.id
     WHERE u.id = $1`,
    [id]
  );
  return res.rows[0] || null;
}

async function createUser({ name, username, email, password, role_id, is_superadmin, is_active = true }) {
  const id = `usr_${crypto.randomBytes(8).toString('hex')}`;
  const passwordHash = hashPassword(password);
  const userUsername = username ? username.trim().toLowerCase() : name.trim().toLowerCase().replace(/\s+/g, '_');
  const roleId = role_id || 'role_fleet_operator';
  const isSuper = is_superadmin !== undefined ? is_superadmin : (roleId === 'role_superadmin');

  const res = await pool.query(
    `INSERT INTO core_users (id, name, username, email, password_hash, role_id, is_superadmin, is_active)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
     RETURNING id, name, username, email, role_id, is_superadmin, is_active, created_at, updated_at`,
    [id, name, userUsername, email.trim().toLowerCase(), passwordHash, roleId, isSuper, is_active]
  );
  const row = res.rows[0];
  return row ? { ...row, isSuperadmin: !!row.is_superadmin, isActive: !!row.is_active } : null;
}

async function listUsers() {
  const usersRes = await pool.query(
    `SELECT u.id, u.name, u.username, u.email, u.role_id, r.name as role_name, r.description as role_description,
            u.is_superadmin, u.is_active, u.created_at, u.updated_at 
     FROM core_users u
     LEFT JOIN core_roles r ON u.role_id = r.id
     ORDER BY u.created_at ASC`
  );
  const users = usersRes.rows;

  // Aggregate vessels and permissions for each user
  for (const user of users) {
    user.isSuperadmin = !!user.is_superadmin || user.role_id === 'role_superadmin';
    user.isActive = !!user.is_active;
    user.vessels = await getUserVessels(user.id);
    user.permissions = await getUserPermissions(user.id);
  }

  return users;
}

async function updateUser(id, { name, username, email, role_id, is_active, is_superadmin, password }) {
  const fields = [];
  const values = [];
  let idx = 1;

  if (name !== undefined) {
    fields.push(`name = $${idx++}`);
    values.push(name);
  }
  if (username !== undefined) {
    fields.push(`username = $${idx++}`);
    values.push(username ? username.trim().toLowerCase() : null);
  }
  if (email !== undefined) {
    fields.push(`email = $${idx++}`);
    values.push(email.trim().toLowerCase());
  }
  if (role_id !== undefined) {
    fields.push(`role_id = $${idx++}`);
    values.push(role_id);
    if (is_superadmin === undefined) {
      fields.push(`is_superadmin = $${idx++}`);
      values.push(role_id === 'role_superadmin');
    }
  }
  if (is_active !== undefined) {
    fields.push(`is_active = $${idx++}`);
    values.push(is_active);
  }
  if (is_superadmin !== undefined) {
    fields.push(`is_superadmin = $${idx++}`);
    values.push(is_superadmin);
  }
  if (password) {
    fields.push(`password_hash = $${idx++}`);
    values.push(hashPassword(password));
  }
  fields.push(`updated_at = NOW()`);

  values.push(id);
  const res = await pool.query(
    `UPDATE core_users SET ${fields.join(', ')} WHERE id = $${idx} RETURNING id, name, username, email, role_id, is_superadmin, is_active, updated_at`,
    values
  );
  const row = res.rows[0];
  return row ? { ...row, isSuperadmin: !!row.is_superadmin, isActive: !!row.is_active } : null;
}

async function deleteUser(id) {
  await pool.query('DELETE FROM core_users WHERE id = $1', [id]);
  return true;
}

async function getUserVessels(userId) {
  const res = await pool.query(
    'SELECT vessel_id, can_write FROM user_vessel_assignments WHERE user_id = $1',
    [userId]
  );
  return res.rows;
}

async function setUserVessels(userId, vessels = []) {
  // vessels can be array of strings or array of { vessel_id, can_write }
  await pool.query('DELETE FROM user_vessel_assignments WHERE user_id = $1', [userId]);
  for (const item of vessels) {
    const vesselId = typeof item === 'string' ? item : item.vessel_id;
    const canWrite = typeof item === 'object' && item.can_write !== undefined ? !!item.can_write : false;
    if (vesselId) {
      await pool.query(
        'INSERT INTO user_vessel_assignments (user_id, vessel_id, can_write) VALUES ($1, $2, $3)',
        [userId, vesselId, canWrite]
      );
    }
  }
}

async function getUserPermissions(userId) {
  const userRes = await pool.query('SELECT role_id, is_superadmin FROM core_users WHERE id = $1', [userId]);
  const user = userRes.rows[0];

  if (user?.is_superadmin || user?.role_id === 'role_superadmin') {
    return {
      pages: {
        overview: { read: true, write: true },
        marine_traffic: { read: true, write: true },
        vessels: { read: true, write: true },
        monitoring: { read: true, write: true },
        logs: { read: true, write: true },
      },
      features: {
        'vessel.decoder': { read: true, write: true },
        'vessel.agent': { read: true, write: true },
        'telemetry.export': { read: true, write: true },
      },
      sections: {
        'section-nav': { read: true, write: true },
        'section-engine': { read: true, write: true },
        '*': { read: true, write: true },
      },
      raw: []
    };
  }

  let query = 'SELECT resource_type, resource_key, can_read, can_write FROM core_role_permissions WHERE role_id = $1';
  let params = [user?.role_id];

  if (!user?.role_id) {
    query = 'SELECT resource_type, resource_key, can_read, can_write FROM user_permissions WHERE user_id = $1';
    params = [userId];
  }

  const res = await pool.query(query, params);
  const pages = {};
  const features = {};
  const sections = {};
  for (const row of res.rows) {
    if (row.resource_type === 'PAGE') {
      pages[row.resource_key] = { read: row.can_read, write: row.can_write };
    } else if (row.resource_type === 'SECTION') {
      sections[row.resource_key] = { read: row.can_read, write: row.can_write };
    } else {
      features[row.resource_key] = { read: row.can_read, write: row.can_write };
    }
  }
  return { pages, features, sections, raw: res.rows };
}

async function setUserPermissions(userId, permissions = []) {
  // permissions array of { resource_type, resource_key, can_read, can_write }
  await pool.query('DELETE FROM user_permissions WHERE user_id = $1', [userId]);
  for (const p of permissions) {
    if (p.resource_key) {
      await pool.query(
        `INSERT INTO user_permissions (user_id, resource_type, resource_key, can_read, can_write)
         VALUES ($1, $2, $3, $4, $5)`,
        [userId, p.resource_type || 'PAGE', p.resource_key, p.can_read ?? true, p.can_write ?? false]
      );
    }
  }
}

async function saveRefreshToken(userId, token, userAgent = '', ipAddress = '') {
  const id = `rt_${crypto.randomBytes(8).toString('hex')}`;
  const tokenHash = hashToken(token);
  // Default expire 7 days
  const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
  await pool.query(
    `INSERT INTO auth_refresh_tokens (id, user_id, token_hash, user_agent, ip_address, expires_at)
     VALUES ($1, $2, $3, $4, $5, $6)`,
    [id, userId, tokenHash, userAgent, ipAddress, expiresAt]
  );
  return { id, tokenHash, expiresAt };
}

async function findRefreshToken(token) {
  const tokenHash = hashToken(token);
  const res = await pool.query(
    `SELECT rt.*, u.is_active, u.is_superadmin 
     FROM auth_refresh_tokens rt
     JOIN core_users u ON rt.user_id = u.id
     WHERE rt.token_hash = $1 AND rt.expires_at > NOW()`,
    [tokenHash]
  );
  return res.rows[0] || null;
}

async function revokeRefreshToken(token) {
  const tokenHash = hashToken(token);
  await pool.query('DELETE FROM auth_refresh_tokens WHERE token_hash = $1', [tokenHash]);
}

async function revokeAllUserTokens(userId) {
  await pool.query('DELETE FROM auth_refresh_tokens WHERE user_id = $1', [userId]);
}

module.exports = {
  findByEmail,
  findById,
  createUser,
  listUsers,
  updateUser,
  deleteUser,
  getUserVessels,
  setUserVessels,
  getUserPermissions,
  setUserPermissions,
  saveRefreshToken,
  findRefreshToken,
  revokeRefreshToken,
  revokeAllUserTokens,
};
