import { Request } from 'express';
import { IUser } from '../models/User.js';

export interface RegisterRequest {
  nombre: string;
  email: string;
  password: string;
  confirmarPassword: string;
}

export interface LoginRequest {
  email: string;
  password: string;
}

export interface JWTPayload {
  userId: string;
  email: string;
  nombre: string;
}

export interface AuthResponse {
  success: boolean;
  message: string;
  token?: string;
  user?: {
    id: string;
    nombre: string;
    email: string;
    createdAt: Date;
  };
}

// Extender Request de Express para incluir user
export interface AuthenticatedRequest extends Request {
  user?: IUser;
}
