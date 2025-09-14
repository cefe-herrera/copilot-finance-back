import { Response } from 'express';
import { AuthenticatedRequest } from '../types/auth.js';
import { 
  CreateMovementRequest, 
  UpdateMovementRequest, 
  MovementResponse, 
  MovementQueryParams
} from '../types/movement.js';
import movementService from '../services/movementService.js';

export class MovementController {
  // Crear nuevo movimiento
  async createMovement(
    req: AuthenticatedRequest & { body: CreateMovementRequest }, 
    res: Response<MovementResponse>
  ) {
    try {
      const userId = req.user!._id as string;
      const movement = await movementService.createMovement(userId, req.body);

      res.status(201).json({
        success: true,
        message: 'Movimiento creado exitosamente',
        movement
      });

    } catch (error: any) {
      console.error('Error creando movimiento:', error);

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
  }

  // Obtener todos los movimientos del usuario con filtros y paginación
  async getMovements(
    req: AuthenticatedRequest & { query: MovementQueryParams }, 
    res: Response<MovementResponse>
  ) {
    try {
      const userId = req.user!._id as string;
      const result = await movementService.getMovements(userId, req.query);

      res.json({
        success: true,
        message: 'Movimientos obtenidos exitosamente',
        movements: result.movements,
        pagination: result.pagination,
        summary: result.summary
      });

    } catch (error) {
      console.error('Error obteniendo movimientos:', error);
      res.status(500).json({
        success: false,
        message: 'Error interno del servidor'
      });
    }
  }

  // Obtener un movimiento específico
  async getMovementById(
    req: AuthenticatedRequest, 
    res: Response<MovementResponse>
  ) {
    try {
      const { id } = req.params;
      const userId = req.user!._id as string;

      const movement = await movementService.getMovementById(userId, id);

      res.json({
        success: true,
        message: 'Movimiento obtenido exitosamente',
        movement
      });

    } catch (error: any) {
      console.error('Error obteniendo movimiento:', error);
      
      if (error.message === 'ID de movimiento inválido') {
        res.status(400).json({
          success: false,
          message: error.message
        });
        return;
      }

      if (error.message === 'Movimiento no encontrado') {
        res.status(404).json({
          success: false,
          message: error.message
        });
        return;
      }

      res.status(500).json({
        success: false,
        message: 'Error interno del servidor'
      });
    }
  }

  // Actualizar movimiento
  async updateMovement(
    req: AuthenticatedRequest & { body: UpdateMovementRequest }, 
    res: Response<MovementResponse>
  ) {
    try {
      const { id } = req.params;
      const userId = req.user!._id as string;

      const movement = await movementService.updateMovement(userId, id, req.body);

      res.json({
        success: true,
        message: 'Movimiento actualizado exitosamente',
        movement
      });

    } catch (error: any) {
      console.error('Error actualizando movimiento:', error);

      if (error.message === 'ID de movimiento inválido') {
        res.status(400).json({
          success: false,
          message: error.message
        });
        return;
      }

      if (error.message === 'Movimiento no encontrado') {
        res.status(404).json({
          success: false,
          message: error.message
        });
        return;
      }

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
  }

  // Eliminar movimiento
  async deleteMovement(
    req: AuthenticatedRequest, 
    res: Response<MovementResponse>
  ) {
    try {
      const { id } = req.params;
      const userId = req.user!._id as string;

      await movementService.deleteMovement(userId, id);

      res.json({
        success: true,
        message: 'Movimiento eliminado exitosamente'
      });

    } catch (error: any) {
      console.error('Error eliminando movimiento:', error);

      if (error.message === 'ID de movimiento inválido') {
        res.status(400).json({
          success: false,
          message: error.message
        });
        return;
      }

      if (error.message === 'Movimiento no encontrado') {
        res.status(404).json({
          success: false,
          message: error.message
        });
        return;
      }

      res.status(500).json({
        success: false,
        message: 'Error interno del servidor'
      });
    }
  }

  // Obtener estadísticas resumidas
  async getStats(
    req: AuthenticatedRequest, 
    res: Response<MovementResponse>
  ) {
    try {
      const userId = req.user!._id as string;
      const summary = await movementService.getDetailedStats(userId);

      res.json({
        success: true,
        message: 'Estadísticas obtenidas exitosamente',
        summary
      });

    } catch (error) {
      console.error('Error obteniendo estadísticas:', error);
      res.status(500).json({
        success: false,
        message: 'Error interno del servidor'
      });
    }
  }

  // Obtener datos para gráfico de líneas mensual
  async getMonthlyChart(
    req: AuthenticatedRequest, 
    res: Response<MovementResponse>
  ) {
    try {
      const userId = req.user!._id as string;
      const chart = await movementService.getMonthlyChartData(userId);

      res.json({
        success: true,
        message: 'Datos del gráfico mensual obtenidos exitosamente',
        chart
      });

    } catch (error) {
      console.error('Error generando gráfico mensual:', error);
      res.status(500).json({
        success: false,
        message: 'Error interno del servidor'
      });
    }
  }
}

export default new MovementController();