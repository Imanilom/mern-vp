import { errorHandler } from './error.js';

export const requireRoles = (allowedRoles) => {
  return (req, res, next) => {
    if (!req.user || !req.user.role) {
      return next(errorHandler(403, 'Akses ditolak: Role pengguna tidak terdeteksi.'));
    }

    let userRole = req.user.role.toLowerCase();
    if (userRole === 'administrator') userRole = 'admin';

    if (!allowedRoles.includes(userRole)) {
      return next(errorHandler(403, `Akses ditolak: Fitur ini membutuhkan role ${allowedRoles.join(' atau ')}.`));
    }

    next();
  };
};
