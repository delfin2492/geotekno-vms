const { pool } = require('../db/pool');
const crypto = require('crypto');

async function getRolePermissions(roleId) {
  const res = await pool.query(
    'SELECT resource_type, resource_key, can_read, can_write FROM core_role_permissions WHERE role_id = $1',
    [roleId]
  );
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

async function setRolePermissions(roleId, permissions = []) {
  await pool.query('DELETE FROM core_role_permissions WHERE role_id = $1', [roleId]);
  for (const p of permissions) {
    if (p.resource_key) {
      await pool.query(
        `INSERT INTO core_role_permissions (role_id, resource_type, resource_key, can_read, can_write)
         VALUES ($1, $2, $3, $4, $5)`,
        [roleId, p.resource_type || 'PAGE', p.resource_key, p.can_read ?? true, p.can_write ?? false]
      );
    }
  }
}

async function listRoles() {
  const res = await pool.query(
    'SELECT id, name, description, is_system, created_at, updated_at FROM core_roles ORDER BY is_system DESC, created_at ASC'
  );
  const roles = res.rows;
  for (const r of roles) {
    r.permissions = await getRolePermissions(r.id);
    // Count users with this role
    const countRes = await pool.query('SELECT COUNT(*) FROM core_users WHERE role_id = $1', [r.id]);
    r.userCount = parseInt(countRes.rows[0].count, 10);
  }
  return roles;
}

async function getRoleById(id) {
  const res = await pool.query(
    'SELECT id, name, description, is_system, created_at, updated_at FROM core_roles WHERE id = $1',
    [id]
  );
  if (!res.rows[0]) return null;
  const role = res.rows[0];
  role.permissions = await getRolePermissions(role.id);
  return role;
}

async function createRole({ name, description, permissions = [] }) {
  const slug = name.trim().toLowerCase().replace(/[^a-z0-9]+/g, '_');
  const id = `role_${slug}_${crypto.randomBytes(3).toString('hex')}`;

  const res = await pool.query(
    `INSERT INTO core_roles (id, name, description, is_system)
     VALUES ($1, $2, $3, FALSE)
     RETURNING id, name, description, is_system, created_at, updated_at`,
    [id, name.trim(), description || '']
  );
  const newRole = res.rows[0];

  if (Array.isArray(permissions)) {
    await setRolePermissions(newRole.id, permissions);
  }
  newRole.permissions = await getRolePermissions(newRole.id);
  newRole.userCount = 0;
  return newRole;
}

async function updateRole(id, { name, description, permissions }) {
  const fields = [];
  const values = [];
  let idx = 1;

  if (name !== undefined) {
    fields.push(`name = $${idx++}`);
    values.push(name.trim());
  }
  if (description !== undefined) {
    fields.push(`description = $${idx++}`);
    values.push(description.trim());
  }
  fields.push(`updated_at = NOW()`);
  values.push(id);

  const res = await pool.query(
    `UPDATE core_roles SET ${fields.join(', ')} WHERE id = $${idx}
     RETURNING id, name, description, is_system, created_at, updated_at`,
    values
  );
  if (!res.rows[0]) return null;
  const updatedRole = res.rows[0];

  if (Array.isArray(permissions)) {
    await setRolePermissions(id, permissions);
  }
  updatedRole.permissions = await getRolePermissions(id);
  return updatedRole;
}

async function deleteRole(id) {
  const role = await getRoleById(id);
  if (!role) return { success: false, error: 'Role not found.' };
  if (role.is_system) {
    return { success: false, error: 'System default roles cannot be deleted.' };
  }

  // Set users having this role to fallback or null
  await pool.query('UPDATE core_users SET role_id = NULL WHERE role_id = $1', [id]);
  await pool.query('DELETE FROM core_roles WHERE id = $1', [id]);
  return { success: true };
}

module.exports = {
  listRoles,
  getRoleById,
  createRole,
  updateRole,
  deleteRole,
  getRolePermissions,
  setRolePermissions,
};
