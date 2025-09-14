import { Router } from 'express';
import { authenticateToken } from '../middleware/auth.js';
import authController from '../controllers/authController.js';

const router = Router();

// POST /api/auth/register - Registro de usuario
router.post('/register', authController.register);

// POST /api/auth/login - Inicio de sesión
router.post('/login', authController.login);

// GET /api/auth/profile - Obtener perfil del usuario autenticado
router.get('/profile', authenticateToken, authController.getProfile);

// POST /api/auth/verify - Verificar token
router.post('/verify', authenticateToken, authController.verifyToken);

export default router;