import { Router } from 'express';
import healthController from '../controllers/healthController.js';

const router = Router();

// GET /health - Verificar estado de salud de la API
router.get('/health', healthController.checkHealth);

export default router;