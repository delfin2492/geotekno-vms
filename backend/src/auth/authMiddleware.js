const { verifyAccessToken } = require('./jwt');

function authenticate(req, res, next) {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    req.user = null;
    return next();
  }

  const token = authHeader.split(' ')[1];
  const decoded = verifyAccessToken(token);
  if (!decoded) {
    req.user = null;
    return next();
  }

  req.user = decoded;
  next();
}

function requireAuth(req, res, next) {
  if (!req.user) {
    return res.status(401).json({
      error: 'Unauthorized: Sesi tidak valid atau telah berakhir. Silakan login kembali.',
      code: 'AUTH_REQUIRED',
    });
  }
  next();
}

function requireSuperadmin(req, res, next) {
  if (!req.user) {
    return res.status(401).json({ error: 'Unauthorized', code: 'AUTH_REQUIRED' });
  }
  if (!req.user.isSuperadmin) {
    return res.status(403).json({
      error: 'Forbidden: Hanya Superadmin yang memiliki wewenang ini.',
      code: 'SUPERADMIN_REQUIRED',
    });
  }
  next();
}

function requirePermission(resourceKey, action = 'read') {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({ error: 'Unauthorized', code: 'AUTH_REQUIRED' });
    }

    // Superadmin bypasses all checks
    if (req.user.isSuperadmin) {
      return next();
    }

    const perms = req.user.permissions || {};
    const pages = perms.pages || {};
    const features = perms.features || {};

    // Check in pages or features
    const target = pages[resourceKey] || features[resourceKey];

    if (!target) {
      return res.status(403).json({
        error: `Forbidden: Anda tidak memiliki izin akses untuk ${resourceKey}.`,
        code: 'PERMISSION_DENIED',
      });
    }

    if (action === 'write' && !target.write) {
      return res.status(403).json({
        error: `Forbidden: Anda hanya memiliki izin Baca (Read Only) untuk ${resourceKey}.`,
        code: 'WRITE_PERMISSION_REQUIRED',
      });
    }

    if (action === 'read' && !target.read) {
      return res.status(403).json({
        error: `Forbidden: Anda tidak memiliki izin membaca ${resourceKey}.`,
        code: 'READ_PERMISSION_REQUIRED',
      });
    }

    next();
  };
}

function requireVesselAccess(paramName = 'id') {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({ error: 'Unauthorized', code: 'AUTH_REQUIRED' });
    }

    if (req.user.isSuperadmin) {
      return next();
    }

    const allowedVessels = req.user.vessels || [];
    if (allowedVessels.includes('*')) {
      return next();
    }

    const targetVesselId = req.params[paramName] || req.body?.vesselId || req.query?.vesselId;

    // If no specific vessel is targeted, proceed (e.g. list view which will filter output)
    if (!targetVesselId) {
      return next();
    }

    // Check string match or object match
    const hasAccess = allowedVessels.some((v) => {
      const vId = typeof v === 'string' ? v : v.vessel_id;
      return vId === targetVesselId || vId === '*';
    });

    if (!hasAccess) {
      return res.status(403).json({
        error: `Forbidden: Akun Anda tidak ditugaskan untuk mengakses kapal [${targetVesselId}].`,
        code: 'VESSEL_ACCESS_DENIED',
      });
    }

    next();
  };
}

module.exports = {
  authenticate,
  requireAuth,
  requireSuperadmin,
  requirePermission,
  requireVesselAccess,
};
