import { Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import User from '../models/User.js';
import { JWT_CONFIG, AUTH_MESSAGES } from '../constants/auth.js';
import { AuthenticatedRequest, JWTPayload } from '../types/auth.js';

export const authenticateToken = async (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    // Obtener token del header Authorization
    const authHeader = req.headers.authorization;
    const token = authHeader && authHeader.startsWith('Bearer ') 
      ? authHeader.substring(7) 
      : null;

    if (!token) {
      res.status(401).json({
        success: false,
        message: AUTH_MESSAGES.TOKEN_REQUIRED
      });
      return;
    }

    // Verificar el token
    const decoded = jwt.verify(token, JWT_CONFIG.secret) as JWTPayload;
    
    // Buscar el usuario en la base de datos
    const user = await User.findById(decoded.userId);
    if (!user) {
      res.status(401).json({
        success: false,
        message: AUTH_MESSAGES.USER_NOT_FOUND
      });
      return;
    }

    // Agregar usuario al request
    req.user = user;
    next();

  } catch (error) {
    if (error instanceof jwt.TokenExpiredError) {
      res.status(401).json({
        success: false,
        message: AUTH_MESSAGES.TOKEN_EXPIRED
      });
    } else if (error instanceof jwt.JsonWebTokenError) {
      res.status(401).json({
        success: false,
        message: AUTH_MESSAGES.TOKEN_INVALID
      });
    } else {
      res.status(500).json({
        success: false,
        message: 'Error interno del servidor'
      });
    }
  }
};

// Middleware opcional - no falla si no hay token
export const optionalAuth = async (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const authHeader = req.headers.authorization;
    const token = authHeader && authHeader.startsWith('Bearer ') 
      ? authHeader.substring(7) 
      : null;

    if (token) {
      const decoded = jwt.verify(token, JWT_CONFIG.secret) as JWTPayload;
      const user = await User.findById(decoded.userId);
      if (user) {
        req.user = user;
      }
    }
    
    next();
  } catch (error) {
    // En auth opcional, continuamos sin usuario si hay error
    next();
  }
};
