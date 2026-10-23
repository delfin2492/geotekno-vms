const { pool } = require('../db/pool');
const crypto = require('crypto');
const { createUser } = require('../auth/userRepo');

async function listCompanies() {
  const query = `
    SELECT 
      c.id, 
      c.name, 
      c.code, 
      c.description, 
      c.max_vessels,
      c.max_agents,
      c.created_at, 
      c.updated_at,
      (SELECT COUNT(*) FROM core_assets a WHERE a.company_id = c.id) as vessel_count,
      (SELECT COUNT(*) FROM core_users u WHERE u.company_id = c.id) as user_count,
      (SELECT COUNT(*) FROM core_agents ag WHERE ag.company_id = c.id) as agent_count,
      (SELECT json_build_object('id', u.id, 'name', u.name, 'email', u.email) 
       FROM core_users u 
       WHERE u.company_id = c.id AND (u.is_company_admin = true OR u.role_id = 'role_company_admin')
       ORDER BY u.created_at ASC
       LIMIT 1) as admin_user
    FROM core_companies c
    ORDER BY c.created_at ASC
  `;
  const res = await pool.query(query);
  return res.rows.map(row => ({
    id: row.id,
    name: row.name,
    code: row.code,
    description: row.description,
    adminUser: row.admin_user || null,
    maxVessels: row.max_vessels !== null ? parseInt(row.max_vessels, 10) : 10,
    maxAgents: row.max_agents !== null ? parseInt(row.max_agents, 10) : 2,
    max_vessels: row.max_vessels !== null ? parseInt(row.max_vessels, 10) : 10,
    max_agents: row.max_agents !== null ? parseInt(row.max_agents, 10) : 2,
    vesselCount: parseInt(row.vessel_count, 10),
    userCount: parseInt(row.user_count, 10),
    agentCount: parseInt(row.agent_count, 10),
    created_at: row.created_at,
    updated_at: row.updated_at,
  }));
}

async function getCompanyById(id) {
  const query = `
    SELECT 
      c.id, 
      c.name, 
      c.code, 
      c.description, 
      c.max_vessels,
      c.max_agents,
      c.created_at, 
      c.updated_at,
      (SELECT COUNT(*) FROM core_assets a WHERE a.company_id = c.id) as vessel_count,
      (SELECT COUNT(*) FROM core_users u WHERE u.company_id = c.id) as user_count,
      (SELECT COUNT(*) FROM core_agents ag WHERE ag.company_id = c.id) as agent_count,
      (SELECT json_build_object('id', u.id, 'name', u.name, 'email', u.email) 
       FROM core_users u 
       WHERE u.company_id = c.id AND (u.is_company_admin = true OR u.role_id = 'role_company_admin')
       ORDER BY u.created_at ASC
       LIMIT 1) as admin_user
    FROM core_companies c
    WHERE c.id = $1
  `;
  const res = await pool.query(query, [id]);
  if (!res.rows[0]) return null;
  const row = res.rows[0];
  return {
    id: row.id,
    name: row.name,
    code: row.code,
    description: row.description,
    adminUser: row.admin_user || null,
    maxVessels: row.max_vessels !== null ? parseInt(row.max_vessels, 10) : 10,
    maxAgents: row.max_agents !== null ? parseInt(row.max_agents, 10) : 2,
    max_vessels: row.max_vessels !== null ? parseInt(row.max_vessels, 10) : 10,
    max_agents: row.max_agents !== null ? parseInt(row.max_agents, 10) : 2,
    vesselCount: parseInt(row.vessel_count, 10),
    userCount: parseInt(row.user_count, 10),
    agentCount: parseInt(row.agent_count, 10),
    created_at: row.created_at,
    updated_at: row.updated_at,
  };
}

async function createCompany({
  name,
  code,
  description,
  max_vessels,
  max_agents,
  maxVessels,
  maxAgents,
  admin_name,
  admin_email,
  admin_password,
  adminName,
  adminEmail,
  adminPassword,
}) {
  if (!name || !name.trim()) {
    throw new Error('Nama perusahaan wajib diisi.');
  }

  const cleanName = name.trim();
  const slug = cleanName.toLowerCase().replace(/[^a-z0-9]+/g, '_').slice(0, 20);
  const id = `comp_${slug}_${crypto.randomBytes(3).toString('hex')}`;
  const cleanCode = (code || slug).trim().toUpperCase();
  const maxV = max_vessels !== undefined ? parseInt(max_vessels, 10) : (maxVessels !== undefined ? parseInt(maxVessels, 10) : 10);
  const maxA = max_agents !== undefined ? parseInt(max_agents, 10) : (maxAgents !== undefined ? parseInt(maxAgents, 10) : 2);

  const res = await pool.query(
    `INSERT INTO core_companies (id, name, code, description, max_vessels, max_agents)
     VALUES ($1, $2, $3, $4, $5, $6)
     RETURNING id, name, code, description, max_vessels, max_agents, created_at, updated_at`,
    [id, cleanName, cleanCode, (description || '').trim(), maxV, maxA]
  );
  const comp = res.rows[0];

  let adminUser = null;
  const aName = admin_name || adminName;
  const aEmail = admin_email || adminEmail;
  const aPass = admin_password || adminPassword;

  if (aName && aEmail && aPass) {
    adminUser = await createUser({
      name: aName.trim(),
      email: aEmail.trim().toLowerCase(),
      password: aPass,
      role_id: 'role_company_admin',
      company_id: comp.id,
      is_company_admin: true,
      is_superadmin: false,
    });
  }

  return {
    ...comp,
    adminUser,
    maxVessels: maxV,
    maxAgents: maxA,
    vesselCount: 0,
    userCount: adminUser ? 1 : 0,
    agentCount: 0,
  };
}

async function updateCompany(id, { name, code, description, max_vessels, max_agents, maxVessels, maxAgents, admin_name, admin_email, admin_password }) {
  const fields = [];
  const values = [];
  let idx = 1;

  if (name !== undefined) {
    fields.push(`name = $${idx++}`);
    values.push(name.trim());
  }
  if (code !== undefined) {
    fields.push(`code = $${idx++}`);
    values.push(code.trim().toUpperCase());
  }
  if (description !== undefined) {
    fields.push(`description = $${idx++}`);
    values.push(description.trim());
  }
  if (max_vessels !== undefined || maxVessels !== undefined) {
    fields.push(`max_vessels = $${idx++}`);
    values.push(parseInt(max_vessels ?? maxVessels, 10));
  }
  if (max_agents !== undefined || maxAgents !== undefined) {
    fields.push(`max_agents = $${idx++}`);
    values.push(parseInt(max_agents ?? maxAgents, 10));
  }

  if (fields.length > 0) {
    fields.push(`updated_at = NOW()`);
    values.push(id);

    await pool.query(
      `UPDATE core_companies 
       SET ${fields.join(', ')} 
       WHERE id = $${idx}`,
      values
    );
  }

  // Handle Company Admin account update or creation if admin fields are provided
  if (admin_name || admin_email || admin_password) {
    const adminRes = await pool.query(
      `SELECT id FROM core_users 
       WHERE company_id = $1 AND (is_company_admin = true OR role_id = 'role_company_admin')
       ORDER BY created_at ASC LIMIT 1`,
      [id]
    );

    if (adminRes.rows.length > 0) {
      const adminId = adminRes.rows[0].id;
      const { updateUser } = require('../auth/userRepo');
      await updateUser(adminId, {
        name: admin_name || undefined,
        email: admin_email || undefined,
        password: admin_password || undefined,
      });
    } else if (admin_name && admin_email && admin_password) {
      // If company previously had no admin, create one
      await createUser({
        name: admin_name.trim(),
        email: admin_email.trim().toLowerCase(),
        password: admin_password,
        role_id: 'role_company_admin',
        company_id: id,
        is_company_admin: true,
        is_superadmin: false,
      });
    }
  }

  return getCompanyById(id);
}

async function deleteCompany(id) {
  if (id === 'comp_geotekno') {
    throw new Error('Perusahaan bawaan utama (comp_geotekno) tidak dapat dihapus.');
  }

  // 1. Unbind any vessels belonging to this company (avoid breaking telemetry)
  await pool.query('UPDATE core_assets SET company_id = NULL WHERE company_id = $1', [id]);

  // 2. Unbind any connectivity agents belonging to this company
  await pool.query('UPDATE core_agents SET company_id = NULL WHERE company_id = $1', [id]);

  // 3. Delete tenant-specific users of this company
  await pool.query('DELETE FROM core_users WHERE company_id = $1', [id]);

  // 4. Delete tenant-specific custom roles of this company
  await pool.query('DELETE FROM core_roles WHERE company_id = $1', [id]);

  // 5. Delete company record
  await pool.query('DELETE FROM core_companies WHERE id = $1', [id]);
  return true;
}

module.exports = {
  listCompanies,
  getCompanyById,
  createCompany,
  updateCompany,
  deleteCompany,
};
