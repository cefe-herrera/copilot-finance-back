import { Router, Response } from 'express';
import mongoose from 'mongoose';
import Movement from '../models/Movement.js';
import { authenticateToken } from '../middleware/auth.js';
import { 
  validateCreateMovement, 
  validateUpdateMovement, 
  validateQueryParams 
} from '../middleware/validation.js';
import { AuthenticatedRequest } from '../types/auth.js';
import { 
  CreateMovementRequest, 
  UpdateMovementRequest, 
  MovementResponse, 
  MovementQueryParams, 
  MovementFilters 
} from '../types/movement.js';

const router = Router();

// Aplicar autenticación a todas las rutas
router.use(authenticateToken);

// POST /api/movements - Crear nuevo movimiento
router.post('/', validateCreateMovement, async (
  req: AuthenticatedRequest & { body: CreateMovementRequest }, 
  res: Response<MovementResponse>
) => {
  try {
    const { tipo, categoria, monto, descripcion, fecha } = req.body;
    const userId = req.user!._id;

    const newMovement = new Movement({
      userId,
      tipo,
      categoria,
      monto,
      descripcion: descripcion?.trim() || undefined,
      fecha: new Date(fecha)
    });

    await newMovement.save();

    res.status(201).json({
      success: true,
      message: 'Movimiento creado exitosamente',
      movement: newMovement
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
});

// GET /api/movements - Obtener todos los movimientos del usuario con filtros y paginación
router.get('/', validateQueryParams, async (
  req: AuthenticatedRequest & { query: MovementQueryParams }, 
  res: Response<MovementResponse>
) => {
  try {
    const userId = req.user!._id;
    const {
      page = '1',
      limit = '10',
      tipo,
      categoria,
      fechaInicio,
      fechaFin,
      sortBy = 'fecha',
      sortOrder = 'desc'
    } = req.query;

    // Construir filtros
    const filters: MovementFilters = { userId: userId.toString() };

    if (tipo) {
      filters.tipo = tipo;
    }

    if (categoria) {
      filters.categoria = categoria;
    }

    // Filtros de fecha
    if (fechaInicio || fechaFin) {
      filters.fecha = {};
      if (fechaInicio) {
        filters.fecha.$gte = new Date(fechaInicio);
      }
      if (fechaFin) {
        // Incluir todo el día final
        const endDate = new Date(fechaFin);
        endDate.setHours(23, 59, 59, 999);
        filters.fecha.$lte = endDate;
      }
    }

    // Configurar paginación
    const pageNum = parseInt(page);
    const limitNum = parseInt(limit);
    const skip = (pageNum - 1) * limitNum;

    // Configurar ordenamiento
    const sortOptions: any = {};
    sortOptions[sortBy] = sortOrder === 'asc' ? 1 : -1;

    // Ejecutar consultas en paralelo para mejor rendimiento
    const [movements, totalCount] = await Promise.all([
      Movement.find(filters)
        .sort(sortOptions)
        .skip(skip)
        .limit(limitNum)
        .lean(),
      Movement.countDocuments(filters)
    ]);

    // Calcular información de paginación
    const totalPages = Math.ceil(totalCount / limitNum);
    const hasNext = pageNum < totalPages;
    const hasPrev = pageNum > 1;

    // Calcular resumen financiero
    const [summaryData] = await Movement.aggregate([
      { $match: { userId: new mongoose.Types.ObjectId(userId) } },
      {
        $group: {
          _id: null,
          totalIngresos: {
            $sum: {
              $cond: [{ $eq: ['$tipo', 'ingreso'] }, '$monto', 0]
            }
          },
          totalEgresos: {
            $sum: {
              $cond: [{ $eq: ['$tipo', 'egreso'] }, '$monto', 0]
            }
          },
          movimientosCount: { $sum: 1 }
        }
      }
    ]);

    const summary = summaryData ? {
      totalIngresos: summaryData.totalIngresos / 100, // Convertir de centavos
      totalEgresos: summaryData.totalEgresos / 100,
      balance: (summaryData.totalIngresos - summaryData.totalEgresos) / 100,
      movimientosCount: summaryData.movimientosCount
    } : {
      totalIngresos: 0,
      totalEgresos: 0,
      balance: 0,
      movimientosCount: 0
    };

    res.json({
      success: true,
      message: 'Movimientos obtenidos exitosamente',
      movements,
      pagination: {
        page: pageNum,
        limit: limitNum,
        total: totalCount,
        totalPages,
        hasNext,
        hasPrev
      },
      summary
    });

  } catch (error) {
    console.error('Error obteniendo movimientos:', error);
    res.status(500).json({
      success: false,
      message: 'Error interno del servidor'
    });
  }
});

// GET /api/movements/:id - Obtener un movimiento específico
router.get('/:id', async (
  req: AuthenticatedRequest, 
  res: Response<MovementResponse>
) => {
  try {
    const { id } = req.params;
    const userId = req.user!._id;

    // Validar ObjectId
    if (!mongoose.Types.ObjectId.isValid(id)) {
      res.status(400).json({
        success: false,
        message: 'ID de movimiento inválido'
      });
      return;
    }

    const movement = await Movement.findOne({ 
      _id: id, 
      userId 
    });

    if (!movement) {
      res.status(404).json({
        success: false,
        message: 'Movimiento no encontrado'
      });
      return;
    }

    res.json({
      success: true,
      message: 'Movimiento obtenido exitosamente',
      movement
    });

  } catch (error) {
    console.error('Error obteniendo movimiento:', error);
    res.status(500).json({
      success: false,
      message: 'Error interno del servidor'
    });
  }
});

// PATCH /api/movements/:id - Actualizar movimiento
router.patch('/:id', validateUpdateMovement, async (
  req: AuthenticatedRequest & { body: UpdateMovementRequest }, 
  res: Response<MovementResponse>
) => {
  try {
    const { id } = req.params;
    const userId = req.user!._id;
    const updateData = req.body;

    // Validar ObjectId
    if (!mongoose.Types.ObjectId.isValid(id)) {
      res.status(400).json({
        success: false,
        message: 'ID de movimiento inválido'
      });
      return;
    }

    // Procesar fecha si está presente
    if (updateData.fecha) {
      updateData.fecha = new Date(updateData.fecha).toISOString();
    }

    // Limpiar descripción si está presente
    if (updateData.descripcion !== undefined) {
      updateData.descripcion = updateData.descripcion?.trim() || undefined;
    }

    const movement = await Movement.findOneAndUpdate(
      { _id: id, userId },
      updateData,
      { 
        new: true, // Retornar documento actualizado
        runValidators: true // Ejecutar validaciones del schema
      }
    );

    if (!movement) {
      res.status(404).json({
        success: false,
        message: 'Movimiento no encontrado'
      });
      return;
    }

    res.json({
      success: true,
      message: 'Movimiento actualizado exitosamente',
      movement
    });

  } catch (error: any) {
    console.error('Error actualizando movimiento:', error);

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

// DELETE /api/movements/:id - Eliminar movimiento
router.delete('/:id', async (
  req: AuthenticatedRequest, 
  res: Response<MovementResponse>
) => {
  try {
    const { id } = req.params;
    const userId = req.user!._id;

    // Validar ObjectId
    if (!mongoose.Types.ObjectId.isValid(id)) {
      res.status(400).json({
        success: false,
        message: 'ID de movimiento inválido'
      });
      return;
    }

    const movement = await Movement.findOneAndDelete({ 
      _id: id, 
      userId 
    });

    if (!movement) {
      res.status(404).json({
        success: false,
        message: 'Movimiento no encontrado'
      });
      return;
    }

    res.json({
      success: true,
      message: 'Movimiento eliminado exitosamente'
    });

  } catch (error) {
    console.error('Error eliminando movimiento:', error);
    res.status(500).json({
      success: false,
      message: 'Error interno del servidor'
    });
  }
});

// GET /api/movements/summary/stats - Obtener estadísticas resumidas
router.get('/summary/stats', async (
  req: AuthenticatedRequest, 
  res: Response<MovementResponse>
) => {
  try {
    const userId = req.user!._id;

    // Estadísticas generales
    const [generalStats] = await Movement.aggregate([
      { $match: { userId: new mongoose.Types.ObjectId(userId) } },
      {
        $group: {
          _id: null,
          totalIngresos: {
            $sum: {
              $cond: [{ $eq: ['$tipo', 'ingreso'] }, '$monto', 0]
            }
          },
          totalEgresos: {
            $sum: {
              $cond: [{ $eq: ['$tipo', 'egreso'] }, '$monto', 0]
            }
          },
          movimientosCount: { $sum: 1 },
          promedioIngreso: {
            $avg: {
              $cond: [{ $eq: ['$tipo', 'ingreso'] }, '$monto', null]
            }
          },
          promedioEgreso: {
            $avg: {
              $cond: [{ $eq: ['$tipo', 'egreso'] }, '$monto', null]
            }
          }
        }
      }
    ]);

    // Estadísticas por categoría
    const categoryStats = await Movement.aggregate([
      { $match: { userId: new mongoose.Types.ObjectId(userId) } },
      {
        $group: {
          _id: { categoria: '$categoria', tipo: '$tipo' },
          total: { $sum: '$monto' },
          count: { $sum: 1 }
        }
      },
      {
        $group: {
          _id: '$_id.categoria',
          tipos: {
            $push: {
              tipo: '$_id.tipo',
              total: '$total',
              count: '$count'
            }
          },
          totalGeneral: { $sum: '$total' }
        }
      },
      { $sort: { totalGeneral: -1 } }
    ]);

    const summary = generalStats ? {
      totalIngresos: generalStats.totalIngresos / 100,
      totalEgresos: generalStats.totalEgresos / 100,
      balance: (generalStats.totalIngresos - generalStats.totalEgresos) / 100,
      movimientosCount: generalStats.movimientosCount,
      promedioIngreso: generalStats.promedioIngreso ? generalStats.promedioIngreso / 100 : 0,
      promedioEgreso: generalStats.promedioEgreso ? generalStats.promedioEgreso / 100 : 0,
      categorias: categoryStats.map(cat => ({
        categoria: cat._id,
        total: cat.totalGeneral / 100,
        tipos: cat.tipos.map((t: any) => ({
          tipo: t.tipo,
          total: t.total / 100,
          count: t.count
        }))
      }))
    } : {
      totalIngresos: 0,
      totalEgresos: 0,
      balance: 0,
      movimientosCount: 0,
      promedioIngreso: 0,
      promedioEgreso: 0,
      categorias: []
    };

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
});

export default router;
