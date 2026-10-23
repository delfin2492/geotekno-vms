const express = require('express');
const { pool } = require('../db/pool');
const {
  findByEmail,
  findById,
  createUser,
  listUsers,
  updateUser,
  deleteUser,
  getUserPermissions,
  setUserPermissions,
  getUserVessels,
  setUserVessels,
  saveRefreshToken,
  findRefreshToken,
  revokeRefreshToken,
} = require('../auth/userRepo');
const {
  listRoles,
  getRoleById,
  createRole,
  updateRole,
  deleteRole,
} = require('../auth/roleRepo');
const {
  comparePassword,
  generateAccessToken,
  generateRefreshToken,
  verifyRefreshToken,
} = require('../auth/jwt');
const {
  authenticate,
  requireAuth,
  requireSuperadmin,
} = require('../auth/authMiddleware');

function createAuthRouter() {
  const router = express.Router();

  // ==========================================
  // PUBLIC AUTH ENDPOINTS
  // ==========================================

  // 1. POST /login
  router.post('/login', async (req, res) => {
    try {
      const { email, username, password } = req.body;
      const identifier = email || username;
      if (!identifier || !password) {
        return res.status(400).json({ error: 'Username/Email dan kata sandi wajib diisi.' });
      }

      const user = await findByEmail(identifier);
      if (!user) {
        return res.status(401).json({ error: 'Username/Email atau kata sandi salah.' });
      }

      if (!user.is_active) {
        return res.status(403).json({
          error: 'Akun Anda sedang dinonaktifkan. Silakan hubungi Superadmin.',
          code: 'ACCOUNT_INACTIVE',
        });
      }

      const isMatch = comparePassword(password, user.password_hash);
      if (!isMatch) {
        return res.status(401).json({ error: 'Email atau password salah.' });
      }

      // Ambil permissions & assigned vessels
      const permissions = await getUserPermissions(user.id);
      const vesselsRaw = await getUserVessels(user.id);
      const vessels = user.is_superadmin
        ? ['*']
        : vesselsRaw.map((v) => v.vessel_id);

      const accessToken = generateAccessToken(user, permissions, vessels);
      const refreshToken = generateRefreshToken(user);

      // Simpan refresh token di database
      const userAgent = req.headers['user-agent'] || '';
      const ipAddress = req.ip || req.connection.remoteAddress || '';
      await saveRefreshToken(user.id, refreshToken, userAgent, ipAddress);

      // Set HttpOnly cookie
      res.cookie('refreshToken', refreshToken, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'lax',
        maxAge: 7 * 24 * 60 * 60 * 1000,
      });

      return res.json({
        success: true,
        accessToken,
        refreshToken, // Dikirim juga di body untuk kemudahan client fallback
        user: {
          id: user.id,
          name: user.name,
          email: user.email,
          company_id: user.company_id || 'comp_geotekno',
          company_name: user.company_name || 'PT Geo Tekno Indonesia',
          company_code: user.company_code || 'GEOTEKNO',
          companyId: user.company_id || 'comp_geotekno',
          companyName: user.company_name || 'PT Geo Tekno Indonesia',
          isSuperadmin: !!user.is_superadmin,
          vessels,
          permissions,
        },
      });
    } catch (err) {
      console.error('[AUTH ERROR] Login failed:', err);
      return res.status(500).json({ error: 'Terjadi kesalahan pada server saat login.' });
    }
  });

  // 2. POST /register (Dinonaktifkan: Pendaftaran hanya oleh Superadmin via /users)
  router.post('/register', (req, res) => {
    return res.status(403).json({
      error: 'Pendaftaran akun publik tidak tersedia. Akun pengguna hanya dapat didaftarkan oleh Superadmin.',
      code: 'REGISTRATION_DISABLED',
    });
  });

  // 3. POST /refresh
  router.post('/refresh', async (req, res) => {
    try {
      const token = req.cookies?.refreshToken || req.body?.refreshToken;
      if (!token) {
        return res.status(401).json({ error: 'Refresh token tidak ditemukan.' });
      }

      const decoded = verifyRefreshToken(token);
      if (!decoded) {
        return res.status(401).json({ error: 'Refresh token kedaluwarsa atau tidak valid.' });
      }

      const record = await findRefreshToken(token);
      if (!record || !record.is_active) {
        return res.status(401).json({ error: 'Sesi telah dicabut atau dinonaktifkan.' });
      }

      const user = await findById(record.user_id);
      if (!user || !user.is_active) {
        return res.status(401).json({ error: 'Pengguna tidak ditemukan atau non-aktif.' });
      }

      const permissions = await getUserPermissions(user.id);
      const vesselsRaw = await getUserVessels(user.id);
      const vessels = user.is_superadmin ? ['*'] : vesselsRaw.map((v) => v.vessel_id);

      const newAccessToken = generateAccessToken(user, permissions, vessels);

      return res.json({
        success: true,
        accessToken: newAccessToken,
        user: {
          id: user.id,
          name: user.name,
          email: user.email,
          company_id: user.company_id || 'comp_geotekno',
          company_name: user.company_name || 'PT Geo Tekno Indonesia',
          company_code: user.company_code || 'GEOTEKNO',
          companyId: user.company_id || 'comp_geotekno',
          companyName: user.company_name || 'PT Geo Tekno Indonesia',
          isSuperadmin: !!user.is_superadmin,
          vessels,
          permissions,
        },
      });
    } catch (err) {
      console.error('[AUTH ERROR] Refresh token failed:', err);
      return res.status(500).json({ error: 'Gagal memperbarui token.' });
    }
  });

  // 4. POST /logout
  router.post('/logout', async (req, res) => {
    try {
      const token = req.cookies?.refreshToken || req.body?.refreshToken;
      if (token) {
        await revokeRefreshToken(token);
      }
      res.clearCookie('refreshToken');
      return res.json({ success: true, message: 'Berhasil keluar.' });
    } catch (err) {
      return res.status(500).json({ error: 'Gagal logout.' });
    }
  });

  // 5. GET /me
  router.get('/me', authenticate, requireAuth, async (req, res) => {
    try {
      const user = await findById(req.user.sub);
      if (!user) {
        return res.status(404).json({ error: 'Pengguna tidak ditemukan.' });
      }
      const permissions = await getUserPermissions(user.id);
      const vesselsRaw = await getUserVessels(user.id);
      const vessels = user.is_superadmin ? ['*'] : vesselsRaw.map((v) => v.vessel_id);

      return res.json({
        id: user.id,
        name: user.name,
        email: user.email,
        company_id: user.company_id || 'comp_geotekno',
        company_name: user.company_name || 'PT Geo Tekno Indonesia',
        company_code: user.company_code || 'GEOTEKNO',
        companyId: user.company_id || 'comp_geotekno',
        companyName: user.company_name || 'PT Geo Tekno Indonesia',
        isSuperadmin: !!user.is_superadmin,
        isActive: !!user.is_active,
        vessels,
        permissions,
      });
    } catch (err) {
      return res.status(500).json({ error: 'Gagal mengambil data profil.' });
    }
  });

  // ==========================================
  // SUPERADMIN CRUD & PERMISSIONS MANAGEMENT API
  // ==========================================

  // ==========================================
  // SUPERADMIN CRUD & ROLES MANAGEMENT API
  // ==========================================

  // GET /roles - List all roles with permission sets and user count
  router.get('/roles', authenticate, requireSuperadmin, async (req, res) => {
    try {
      const roles = await listRoles();
      return res.json({ roles });
    } catch (err) {
      console.error('[ROLE ERROR] List roles failed:', err);
      return res.status(500).json({ error: 'Failed to load roles list.' });
    }
  });

  // GET /roles/:id - Get single role detail
  router.get('/roles/:id', authenticate, requireSuperadmin, async (req, res) => {
    try {
      const role = await getRoleById(req.params.id);
      if (!role) {
        return res.status(404).json({ error: 'Role not found.' });
      }
      return res.json({ role });
    } catch (err) {
      return res.status(500).json({ error: 'Failed to load role details.' });
    }
  });

  // POST /roles - Create new custom role
  router.post('/roles', authenticate, requireSuperadmin, async (req, res) => {
    try {
      const { name, description, permissions } = req.body;
      if (!name || !name.trim()) {
        return res.status(400).json({ error: 'Role name is required.' });
      }
      const newRole = await createRole({ name, description, permissions });
      return res.status(201).json({ success: true, role: newRole });
    } catch (err) {
      console.error('[ROLE ERROR] Create role failed:', err);
      return res.status(500).json({ error: err.message || 'Failed to create role.' });
    }
  });

  // PUT /roles/:id - Update existing role
  router.put('/roles/:id', authenticate, requireSuperadmin, async (req, res) => {
    try {
      const { id } = req.params;
      const { name, description, permissions } = req.body;
      const updated = await updateRole(id, { name, description, permissions });
      if (!updated) {
        return res.status(404).json({ error: 'Role not found.' });
      }
      return res.json({ success: true, role: updated });
    } catch (err) {
      console.error('[ROLE ERROR] Update role failed:', err);
      return res.status(500).json({ error: err.message || 'Failed to update role.' });
    }
  });

  // DELETE /roles/:id - Delete role
  router.delete('/roles/:id', authenticate, requireSuperadmin, async (req, res) => {
    try {
      const { id } = req.params;
      const result = await deleteRole(id);
      if (!result.success) {
        return res.status(400).json({ error: result.error });
      }
      return res.json({ success: true, message: 'Role successfully deleted.' });
    } catch (err) {
      console.error('[ROLE ERROR] Delete role failed:', err);
      return res.status(500).json({ error: err.message || 'Failed to delete role.' });
    }
  });

  // ==========================================
  // SUPERADMIN CRUD & USERS MANAGEMENT API
  // ==========================================

  // GET /users - List all users with permissions & vessels
  router.get('/users', authenticate, requireSuperadmin, async (req, res) => {
    try {
      const users = await listUsers();
      return res.json({ users });
    } catch (err) {
      console.error('[USER ERROR] List users failed:', err);
      return res.status(500).json({ error: 'Failed to load user list.' });
    }
  });

  // POST /users - Superadmin creates a new user account
  router.post('/users', authenticate, requireSuperadmin, async (req, res) => {
    try {
      const { name, username, email, password, role_id, company_id, companyId, is_superadmin, is_active, permissions, vessels } = req.body;
      if (!name || !email || !password) {
        return res.status(400).json({ error: 'Name, email, and password are required.' });
      }

      const existingEmail = await findByEmail(email);
      if (existingEmail) {
        return res.status(409).json({ error: 'Email is already registered.' });
      }

      if (username) {
        const existingUsername = await findByEmail(username);
        if (existingUsername) {
          return res.status(409).json({ error: 'Username is already taken.' });
        }
      }

      const newUser = await createUser({
        name,
        username,
        email,
        password,
        role_id: role_id || 'role_fleet_operator',
        company_id: company_id || companyId || 'comp_geotekno',
        is_superadmin: is_superadmin !== undefined ? !!is_superadmin : (role_id === 'role_superadmin'),
        is_active: is_active ?? true,
      });

      if (Array.isArray(permissions)) {
        await setUserPermissions(newUser.id, permissions);
      }
      if (Array.isArray(vessels)) {
        await setUserVessels(newUser.id, vessels);
      }

      return res.status(201).json({ success: true, user: newUser });
    } catch (err) {
      console.error('[USER ERROR] Create user failed:', err);
      return res.status(500).json({ error: err.message });
    }
  });

  // PUT /users/:id - Superadmin updates user data
  router.put('/users/:id', authenticate, requireSuperadmin, async (req, res) => {
    try {
      const { id } = req.params;
      const { name, username, email, role_id, company_id, companyId, is_active, is_superadmin, password, permissions, vessels } = req.body;

      // Validate email uniqueness if changing email
      if (email) {
        const normalizedEmail = email.trim().toLowerCase();
        const existing = await pool.query(
          'SELECT id FROM core_users WHERE email = $1 AND id != $2',
          [normalizedEmail, id]
        );
        if (existing.rows.length > 0) {
          return res.status(409).json({ error: 'Email address is already used by another account.' });
        }
      }

      const updated = await updateUser(id, {
        name,
        username,
        email,
        role_id,
        company_id: company_id !== undefined ? company_id : companyId,
        is_active,
        is_superadmin,
        password,
      });
      if (!updated) {
        return res.status(404).json({ error: 'User not found.' });
      }

      if (Array.isArray(permissions)) {
        await setUserPermissions(id, permissions);
      }
      if (Array.isArray(vessels)) {
        await setUserVessels(id, vessels);
      }

      const updatedPermissions = await getUserPermissions(id);
      const updatedVessels = await getUserVessels(id);

      return res.json({
        success: true,
        user: {
          ...updated,
          permissions: updatedPermissions,
          vessels: updatedVessels,
        },
      });
    } catch (err) {
      console.error('[USER ERROR] Update user failed:', err);
      return res.status(500).json({ error: err.message });
    }
  });

  // DELETE /users/:id - Superadmin deletes user
  router.delete('/users/:id', authenticate, requireSuperadmin, async (req, res) => {
    try {
      const { id } = req.params;
      if (req.user.sub === id) {
        return res.status(400).json({ error: 'You cannot delete your own account.' });
      }

      await deleteUser(id);
      return res.json({ success: true, message: 'User deleted successfully.' });
    } catch (err) {
      console.error('[USER ERROR] Delete user failed:', err);
      return res.status(500).json({ error: err.message });
    }
  });

  return router;
}

module.exports = { createAuthRouter };
