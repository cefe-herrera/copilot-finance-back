import { Router, Request, Response } from 'express';
import jwt from 'jsonwebtoken';
import User from '../models/User.js';
import { JWT_CONFIG, AUTH_MESSAGES } from '../constants/auth.js';
import { RegisterRequest, LoginRequest, AuthResponse, JWTPayload } from '../types/auth.js';
import { authenticateToken } from '../middleware/auth.js';
import { AuthenticatedRequest } from '../types/auth.js';

const router = Router();

// Función para generar JWT
const generateToken = (user: any): string => {
  const payload: JWTPayload = {
    userId: user._id,
    email: user.email,
    nombre: user.nombre
  };
  
  return jwt.sign(payload, JWT_CONFIG.secret, {
    expiresIn: JWT_CONFIG.expiresIn
  });
};

// Función para formatear respuesta de usuario
const formatUserResponse = (user: any) => ({
  id: user._id,
  nombre: user.nombre,
  email: user.email,
  createdAt: user.createdAt
});

// POST /api/auth/register - Registro de usuario
router.post('/register', async (req: Request<{}, AuthResponse, RegisterRequest>, res: Response<AuthResponse>) => {
  try {
    const { nombre, email, password, confirmarPassword } = req.body;

    // Validaciones básicas
    if (!nombre || !email || !password || !confirmarPassword) {
      res.status(400).json({
        success: false,
        message: 'Todos los campos son requeridos'
      });
      return;
    }

    if (password !== confirmarPassword) {
      res.status(400).json({
        success: false,
        message: 'Las contraseñas no coinciden'
      });
      return;
    }

    if (password.length < 6) {
      res.status(400).json({
        success: false,
        message: 'La contraseña debe tener al menos 6 caracteres'
      });
      return;
    }

    // Verificar si el email ya existe
    const existingUser = await User.findOne({ email: email.toLowerCase() });
    if (existingUser) {
      res.status(400).json({
        success: false,
        message: AUTH_MESSAGES.EMAIL_ALREADY_EXISTS
      });
      return;
    }

    // Crear nuevo usuario
    const newUser = new User({
      nombre,
      email: email.toLowerCase(),
      password
    });

    await newUser.save();

    // Generar token
    const token = generateToken(newUser);

    res.status(201).json({
      success: true,
      message: AUTH_MESSAGES.REGISTRATION_SUCCESS,
      token,
      user: formatUserResponse(newUser)
    });

  } catch (error: any) {
    console.error('Error en registro:', error);
    
    // Manejar errores de validación de Mongoose
    if (error.name === 'ValidationError') {
      const messages = Object.values(error.errors).map((err: any) => err.message);
      res.status(400).json({
        success: false,
        message: messages.join(', ')
      });
      return;
    }

    res.status(500).json({
      success: false,
      message: 'Error interno del servidor'
    });
  }
});

// POST /api/auth/login - Inicio de sesión
router.post('/login', async (req: Request<{}, AuthResponse, LoginRequest>, res: Response<AuthResponse>) => {
  try {
    const { email, password } = req.body;

    // Validaciones básicas
    if (!email || !password) {
      res.status(400).json({
        success: false,
        message: 'Email y contraseña son requeridos'
      });
      return;
    }

    // Buscar usuario por email (incluir password para comparación)
    const user = await User.findOne({ email: email.toLowerCase() }).select('+password');
    if (!user) {
      res.status(401).json({
        success: false,
        message: AUTH_MESSAGES.INVALID_CREDENTIALS
      });
      return;
    }

    // Verificar contraseña
    const isPasswordValid = await user.comparePassword(password);
    if (!isPasswordValid) {
      res.status(401).json({
        success: false,
        message: AUTH_MESSAGES.INVALID_CREDENTIALS
      });
      return;
    }

    // Generar token
    const token = generateToken(user);

    res.json({
      success: true,
      message: AUTH_MESSAGES.LOGIN_SUCCESS,
      token,
      user: formatUserResponse(user)
    });

  } catch (error) {
    console.error('Error en login:', error);
    res.status(500).json({
      success: false,
      message: 'Error interno del servidor'
    });
  }
});

// GET /api/auth/profile - Obtener perfil del usuario autenticado
router.get('/profile', authenticateToken, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const user = req.user!;
    
    res.json({
      success: true,
      message: 'Perfil obtenido exitosamente',
      user: formatUserResponse(user)
    });

  } catch (error) {
    console.error('Error obteniendo perfil:', error);
    res.status(500).json({
      success: false,
      message: 'Error interno del servidor'
    });
  }
});

// POST /api/auth/verify - Verificar token
router.post('/verify', authenticateToken, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const user = req.user!;
    
    res.json({
      success: true,
      message: 'Token válido',
      user: formatUserResponse(user)
    });

  } catch (error) {
    console.error('Error verificando token:', error);
    res.status(500).json({
      success: false,
      message: 'Error interno del servidor'
    });
  }
});

export default router;
