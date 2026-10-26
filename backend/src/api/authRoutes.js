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
const { assetManager } = require('../assets/assetManager');

function resolveUserVessels(user, isSuper, isCompAdmin, vesselsRaw) {
  if (isSuper) return ['*'];
  if (isCompAdmin) {
    const userCompId = user.company_id || 'comp_geotekno';
    const compAssets = assetManager.getAllAssets().filter(a => (a.company_id || 'comp_geotekno') === userCompId);
    return compAssets.map(a => a.id);
  }
  return vesselsRaw.map((v) => v.vessel_id);
}

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
      const isSuper = !!user.is_superadmin || user.role_id === 'role_superadmin';
      const isCompAdmin = !!user.is_company_admin || user.role_id === 'role_company_admin';
      const vessels = resolveUserVessels(user, isSuper, isCompAdmin, vesselsRaw);

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
          role_id: user.role_id,
          roleId: user.role_id,
          role_name: user.role_name || (isSuper ? 'Superadmin' : isCompAdmin ? 'Company Admin' : 'Fleet Operator'),
          roleName: user.role_name || (isSuper ? 'Superadmin' : isCompAdmin ? 'Company Admin' : 'Fleet Operator'),
          company_id: user.company_id || 'comp_geotekno',
          company_name: user.company_name || 'PT Geo Tekno Indonesia',
          company_code: user.company_code || 'GEOTEKNO',
          companyId: user.company_id || 'comp_geotekno',
          companyName: user.company_name || 'PT Geo Tekno Indonesia',
          isSuperadmin: isSuper,
          isCompanyAdmin: isCompAdmin,
          is_company_admin: isCompAdmin,
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
      const isSuper = !!user.is_superadmin || user.role_id === 'role_superadmin';
      const isCompAdmin = !!user.is_company_admin || user.role_id === 'role_company_admin';
      const vessels = resolveUserVessels(user, isSuper, isCompAdmin, vesselsRaw);

      const newAccessToken = generateAccessToken(user, permissions, vessels);

      return res.json({
        success: true,
        accessToken: newAccessToken,
        user: {
          id: user.id,
          name: user.name,
          email: user.email,
          role_id: user.role_id,
          roleId: user.role_id,
          role_name: user.role_name || (isSuper ? 'Superadmin' : isCompAdmin ? 'Company Admin' : 'Fleet Operator'),
          roleName: user.role_name || (isSuper ? 'Superadmin' : isCompAdmin ? 'Company Admin' : 'Fleet Operator'),
          company_id: user.company_id || 'comp_geotekno',
          company_name: user.company_name || 'PT Geo Tekno Indonesia',
          company_code: user.company_code || 'GEOTEKNO',
          companyId: user.company_id || 'comp_geotekno',
          companyName: user.company_name || 'PT Geo Tekno Indonesia',
          isSuperadmin: isSuper,
          isCompanyAdmin: isCompAdmin,
          is_company_admin: isCompAdmin,
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
      const isSuper = !!user.is_superadmin || user.role_id === 'role_superadmin';
      const isCompAdmin = !!user.is_company_admin || user.role_id === 'role_company_admin';
      const vessels = resolveUserVessels(user, isSuper, isCompAdmin, vesselsRaw);

      return res.json({
        id: user.id,
        name: user.name,
        email: user.email,
        role_id: user.role_id,
        roleId: user.role_id,
        role_name: user.role_name || (isSuper ? 'Superadmin' : isCompAdmin ? 'Company Admin' : 'Fleet Operator'),
        roleName: user.role_name || (isSuper ? 'Superadmin' : isCompAdmin ? 'Company Admin' : 'Fleet Operator'),
        company_id: user.company_id || 'comp_geotekno',
        company_name: user.company_name || 'PT Geo Tekno Indonesia',
        company_code: user.company_code || 'GEOTEKNO',
        companyId: user.company_id || 'comp_geotekno',
        companyName: user.company_name || 'PT Geo Tekno Indonesia',
        isSuperadmin: isSuper,
        isCompanyAdmin: isCompAdmin,
        is_company_admin: isCompAdmin,
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
  router.get('/roles', authenticate, (req, res, next) => {
    if (req.user && (req.user.isSuperadmin || req.user.isCompanyAdmin || req.user.permissions?.pages?.users?.read)) {
      return next();
    }
    return res.status(403).json({ error: 'Forbidden: Akses ditolak', code: 'SUPERADMIN_REQUIRED' });
  }, async (req, res) => {
    try {
      const userCompId = req.user.companyId || req.user.company_id || 'comp_geotekno';
      let roles = await listRoles(userCompId, req.user.isSuperadmin);
      if (!req.user.isSuperadmin) {
        roles = roles.filter(r => r.id !== 'role_superadmin');
      }
      return res.json({ roles });
    } catch (err) {
      console.error('[ROLE ERROR] List roles failed:', err);
      return res.status(500).json({ error: 'Failed to load roles list.' });
    }
  });

  // GET /roles/:id - Get single role detail
  router.get('/roles/:id', authenticate, async (req, res) => {
    try {
      const role = await getRoleById(req.params.id);
      if (!role) {
        return res.status(404).json({ error: 'Role not found.' });
      }
      if (!req.user.isSuperadmin && role.company_id) {
        const userCompId = req.user.companyId || req.user.company_id || 'comp_geotekno';
        if (role.company_id !== userCompId) {
          return res.status(403).json({ error: 'Forbidden: Role ini milik organisasi lain.' });
        }
      }
      return res.json({ role });
    } catch (err) {
      return res.status(500).json({ error: 'Failed to load role details.' });
    }
  });

  // POST /roles - Create new custom role
  router.post('/roles', authenticate, async (req, res) => {
    try {
      if (!req.user.isSuperadmin && !req.user.isCompanyAdmin) {
        return res.status(403).json({ error: 'Forbidden: Hanya Superadmin atau Company Admin yang dapat membuat role baru.' });
      }
      const { name, description, company_id, permissions } = req.body;
      if (!name || !name.trim()) {
        return res.status(400).json({ error: 'Role name is required.' });
      }
      const targetComp = req.user.isSuperadmin ? (company_id || null) : (req.user.companyId || req.user.company_id || 'comp_geotekno');
      const newRole = await createRole({ name, description, company_id: targetComp, permissions });
      return res.status(201).json({ success: true, role: newRole });
    } catch (err) {
      console.error('[ROLE ERROR] Create role failed:', err);
      return res.status(500).json({ error: err.message || 'Failed to create role.' });
    }
  });

  // PUT /roles/:id - Update existing role
  router.put('/roles/:id', authenticate, async (req, res) => {
    try {
      const { id } = req.params;
      const existing = await getRoleById(id);
      if (!existing) {
        return res.status(404).json({ error: 'Role not found.' });
      }
      if (existing.is_system && !req.user.isSuperadmin) {
        return res.status(403).json({ error: 'Role template sistem bawaan tidak dapat diubah.' });
      }
      if (!req.user.isSuperadmin) {
        const userCompId = req.user.companyId || req.user.company_id || 'comp_geotekno';
        if (existing.company_id !== userCompId) {
          return res.status(403).json({ error: 'Forbidden: Anda hanya dapat mengubah role milik organisasi Anda.' });
        }
      }
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
  router.delete('/roles/:id', authenticate, async (req, res) => {
    try {
      const { id } = req.params;
      const existing = await getRoleById(id);
      if (!existing) {
        return res.status(404).json({ error: 'Role not found.' });
      }
      if (existing.is_system) {
        return res.status(403).json({ error: 'Role template sistem bawaan tidak dapat dihapus.' });
      }
      if (!req.user.isSuperadmin) {
        const userCompId = req.user.companyId || req.user.company_id || 'comp_geotekno';
        if (existing.company_id !== userCompId) {
          return res.status(403).json({ error: 'Forbidden: Anda hanya dapat menghapus role milik organisasi Anda.' });
        }
      }
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
  // USERS MANAGEMENT API (SCOPED FOR TENANTS & SUPERADMIN)
  // ==========================================

  // GET /users - List users with permissions & vessels
  router.get('/users', authenticate, (req, res, next) => {
    if (req.user && (req.user.isSuperadmin || req.user.permissions?.pages?.users?.read)) {
      return next();
    }
    return res.status(403).json({ error: 'Forbidden: Akses ditolak', code: 'PERMISSION_DENIED' });
  }, async (req, res) => {
    try {
      let users = await listUsers();
      if (!req.user.isSuperadmin) {
        const userComp = req.user.companyId || req.user.company_id || 'comp_geotekno';
        users = users.filter(u => (u.company_id || 'comp_geotekno') === userComp);
      }
      return res.json({ users });
    } catch (err) {
      console.error('[USER ERROR] List users failed:', err);
      return res.status(500).json({ error: 'Failed to load user list.' });
    }
  });

  // POST /users - Create new user account
  router.post('/users', authenticate, (req, res, next) => {
    if (req.user && (req.user.isSuperadmin || req.user.permissions?.pages?.users?.write)) {
      return next();
    }
    return res.status(403).json({ error: 'Forbidden: Hak tulis diperlukan', code: 'WRITE_PERMISSION_REQUIRED' });
  }, async (req, res) => {
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

      let targetCompany = company_id || companyId || 'comp_geotekno';
      let targetSuperadmin = false;
      let targetRoleId = role_id || 'role_fleet_operator';

      if (!req.user.isSuperadmin) {
        targetCompany = req.user.companyId || req.user.company_id || 'comp_geotekno';
        targetSuperadmin = false;
        if (targetRoleId === 'role_superadmin') {
          return res.status(403).json({ error: 'Hanya Superadmin yang berwenang membuat akun Superadmin.' });
        }
      } else {
        targetSuperadmin = is_superadmin !== undefined ? !!is_superadmin : (role_id === 'role_superadmin');
      }

      const newUser = await createUser({
        name,
        username,
        email,
        password,
        role_id: targetRoleId,
        company_id: targetCompany,
        is_superadmin: targetSuperadmin,
        is_active: is_active ?? true,
      });

      if (Array.isArray(permissions) && req.user.isSuperadmin) {
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

  // PUT /users/:id - Update user data
  router.put('/users/:id', authenticate, (req, res, next) => {
    if (req.user && (req.user.isSuperadmin || req.user.permissions?.pages?.users?.write)) {
      return next();
    }
    return res.status(403).json({ error: 'Forbidden: Hak tulis diperlukan', code: 'WRITE_PERMISSION_REQUIRED' });
  }, async (req, res) => {
    try {
      const { id } = req.params;
      const targetUser = await findById(id);
      if (!targetUser) {
        return res.status(404).json({ error: 'User not found.' });
      }

      if (!req.user.isSuperadmin) {
        const userComp = req.user.companyId || req.user.company_id || 'comp_geotekno';
        if ((targetUser.company_id || 'comp_geotekno') !== userComp) {
          return res.status(403).json({ error: 'Forbidden: Anda hanya dapat mengelola user di perusahaan Anda sendiri.' });
        }
        if (targetUser.is_superadmin) {
          return res.status(403).json({ error: 'Forbidden: Tidak dapat mengubah akun Superadmin.' });
        }
      }

      const { name, username, email, role_id, company_id, companyId, is_superadmin, is_active, password, permissions, vessels } = req.body;

      let nextCompanyId = targetUser.company_id;
      let nextIsSuperadmin = targetUser.is_superadmin;
      let nextRoleId = role_id || targetUser.role_id;

      if (req.user.isSuperadmin) {
        nextCompanyId = (company_id !== undefined ? company_id : (companyId !== undefined ? companyId : targetUser.company_id));
        nextIsSuperadmin = (is_superadmin !== undefined ? !!is_superadmin : targetUser.is_superadmin);
      } else {
        if (nextRoleId === 'role_superadmin') {
          return res.status(403).json({ error: 'Forbidden: Tidak dapat menetapkan role Superadmin.' });
        }
      }

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
        role_id: nextRoleId,
        company_id: nextCompanyId,
        is_active,
        is_superadmin: nextIsSuperadmin,
        password,
      });
      if (!updated) {
        return res.status(404).json({ error: 'User not found.' });
      }

      if (Array.isArray(permissions) && req.user.isSuperadmin) {
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

  // DELETE /users/:id - Delete user
  router.delete('/users/:id', authenticate, (req, res, next) => {
    if (req.user && (req.user.isSuperadmin || req.user.permissions?.pages?.users?.write)) {
      return next();
    }
    return res.status(403).json({ error: 'Forbidden: Hak tulis diperlukan', code: 'WRITE_PERMISSION_REQUIRED' });
  }, async (req, res) => {
    try {
      const { id } = req.params;
      if (req.user.sub === id || req.user.id === id) {
        return res.status(400).json({ error: 'You cannot delete your own account.' });
      }

      const targetUser = await findById(id);
      if (!targetUser) {
        return res.status(404).json({ error: 'User not found.' });
      }

      if (!req.user.isSuperadmin) {
        const userComp = req.user.companyId || req.user.company_id || 'comp_geotekno';
        if ((targetUser.company_id || 'comp_geotekno') !== userComp) {
          return res.status(403).json({ error: 'Forbidden: Anda hanya dapat menghapus user di perusahaan Anda sendiri.' });
        }
        if (targetUser.is_superadmin) {
          return res.status(403).json({ error: 'Forbidden: Tidak dapat menghapus akun Superadmin.' });
        }
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
