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
      c.created_at, 
      c.updated_at,
      (SELECT COUNT(*) FROM core_assets a WHERE a.company_id = c.id) as vessel_count,
      (SELECT COUNT(*) FROM core_users u WHERE u.company_id = c.id) as user_count,
      (SELECT COUNT(*) FROM core_agents ag WHERE ag.company_id = c.id) as agent_count
    FROM core_companies c
    ORDER BY c.created_at ASC
  `;
  const res = await pool.query(query);
  return res.rows.map(row => ({
    id: row.id,
    name: row.name,
    code: row.code,
    description: row.description,
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
      c.created_at, 
      c.updated_at,
      (SELECT COUNT(*) FROM core_assets a WHERE a.company_id = c.id) as vessel_count,
      (SELECT COUNT(*) FROM core_users u WHERE u.company_id = c.id) as user_count,
      (SELECT COUNT(*) FROM core_agents ag WHERE ag.company_id = c.id) as agent_count
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
    vesselCount: parseInt(row.vessel_count, 10),
    userCount: parseInt(row.user_count, 10),
    agentCount: parseInt(row.agent_count, 10),
    created_at: row.created_at,
    updated_at: row.updated_at,
  };
}

async function createCompany({ name, code, description, admin_name, admin_email, admin_password, adminName, adminEmail, adminPassword }) {
  if (!name || !name.trim()) {
    throw new Error('Nama perusahaan wajib diisi.');
  }

  const cleanName = name.trim();
  const slug = cleanName.toLowerCase().replace(/[^a-z0-9]+/g, '_').slice(0, 20);
  const id = `comp_${slug}_${crypto.randomBytes(3).toString('hex')}`;
  const cleanCode = (code || slug).trim().toUpperCase();

  const res = await pool.query(
    `INSERT INTO core_companies (id, name, code, description)
     VALUES ($1, $2, $3, $4)
     RETURNING id, name, code, description, created_at, updated_at`,
    [id, cleanName, cleanCode, (description || '').trim()]
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
    vesselCount: 0,
    userCount: adminUser ? 1 : 0,
    agentCount: 0,
  };
}

async function updateCompany(id, { name, code, description }) {
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

  if (fields.length === 0) {
    return getCompanyById(id);
  }

  fields.push(`updated_at = NOW()`);
  values.push(id);

  const res = await pool.query(
    `UPDATE core_companies 
     SET ${fields.join(', ')} 
     WHERE id = $${idx}
     RETURNING id, name, code, description, created_at, updated_at`,
    values
  );

  if (!res.rows[0]) {
    throw new Error(`Perusahaan '${id}' tidak ditemukan`);
  }
  return getCompanyById(id);
}

async function deleteCompany(id) {
  if (id === 'comp_geotekno') {
    throw new Error('Perusahaan bawaan utama (comp_geotekno) tidak dapat dihapus.');
  }

  // Check if company has vessels or users
  const countRes = await pool.query(
    `SELECT 
      (SELECT COUNT(*) FROM core_assets WHERE company_id = $1) as v_cnt,
      (SELECT COUNT(*) FROM core_users WHERE company_id = $1) as u_cnt`,
    [id]
  );
  const { v_cnt, u_cnt } = countRes.rows[0];
  if (parseInt(v_cnt, 10) > 0 || parseInt(u_cnt, 10) > 0) {
    throw new Error(`Tidak dapat menghapus: Masih terdapat ${v_cnt} kapal dan ${u_cnt} pengguna terdaftar di perusahaan ini.`);
  }

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
