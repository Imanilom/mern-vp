import jwt from 'jsonwebtoken';
import { errorHandler } from './error.js';

export const verifyToken = (req, res, next) => {
  const token = req.cookies.access_token; // saya mendapatkan null
  
  // console.log({token})
  if (!token) return next(errorHandler(401, 'Unauthorized'));

  jwt.verify(token, "asnjkKkjsnklnly1xcx?23r", (err, user) => {
    // if (err) return next(errorHandler(403, 'Forbidden'));
    console.log({jwtsecret : process.env.JWT_SECRET});
    if (err) {
      console.log({err, token});
      return;
    }
    
    req.user = user;
    next();
  });
};
