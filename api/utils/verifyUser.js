import jwt from 'jsonwebtoken';
import { errorHandler } from './error.js';

export const verifyToken = (req, res, next) => {
  let token = req.cookies.access_token; // Web UI
  
  if (!token && req.headers.authorization && req.headers.authorization.startsWith('Bearer ')) {
    token = req.headers.authorization.split(' ')[1]; // Flutter App
  }

  if (!token) return next(errorHandler(401, 'Unauthorized'));

  jwt.verify(token, process.env.JWT_SECRET, (err, user) => {
    if (err) {
      console.log('JWT Verify Error:', err.message);
      return next(errorHandler(401, 'Token tidak valid atau sudah kedaluwarsa.'));
    }
    
    req.user = user;
    next();
  });
};
