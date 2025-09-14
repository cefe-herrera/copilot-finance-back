import { Router } from 'express';
import { authenticateToken } from '../middleware/auth.js';
import { 
  validateCreateMovement, 
  validateUpdateMovement, 
  validateQueryParams 
} from '../middleware/validation.js';
import movementController from '../controllers/movementController.js';

const router = Router();

// Aplicar autenticación a todas las rutas
router.use(authenticateToken);

// POST /api/movements - Crear nuevo movimiento
router.post('/', validateCreateMovement, movementController.createMovement);

// GET /api/movements - Obtener todos los movimientos del usuario con filtros y paginación
router.get('/', validateQueryParams, movementController.getMovements);

// GET /api/movements/summary/stats - Obtener estadísticas resumidas
router.get('/summary/stats', movementController.getStats);

// GET /api/movements/chart/monthly - Obtener datos para gráfico de líneas mensual
router.get('/chart/monthly', movementController.getMonthlyChart);

// GET /api/movements/:id - Obtener un movimiento específico
router.get('/:id', movementController.getMovementById);

// PATCH /api/movements/:id - Actualizar movimiento
router.patch('/:id', validateUpdateMovement, movementController.updateMovement);

// DELETE /api/movements/:id - Eliminar movimiento
router.delete('/:id', movementController.deleteMovement);

export default router;