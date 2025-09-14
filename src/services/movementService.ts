import mongoose from 'mongoose';
import Movement from '../models/Movement.js';
import { 
  CreateMovementRequest, 
  UpdateMovementRequest, 
  MovementQueryParams, 
  MovementFilters 
} from '../types/movement.js';

export class MovementService {
  // Crear nuevo movimiento
  async createMovement(userId: string, movementData: CreateMovementRequest) {
    const { tipo, categoria, monto, descripcion, fecha } = movementData;

    const newMovement = new Movement({
      userId,
      tipo,
      categoria,
      monto,
      descripcion: descripcion?.trim() || undefined,
      fecha: new Date(fecha)
    });

    return await newMovement.save();
  }

  // Obtener movimientos con filtros y paginación
  async getMovements(userId: string, queryParams: MovementQueryParams) {
    const {
      page = '1',
      limit = '10',
      tipo,
      categoria,
      fechaInicio,
      fechaFin,
      sortBy = 'fecha',
      sortOrder = 'desc'
    } = queryParams;

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
    const summary = await this.getFinancialSummary(userId);

    return {
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
    };
  }

  // Obtener un movimiento específico por ID
  async getMovementById(userId: string, movementId: string) {
    // Validar ObjectId
    if (!mongoose.Types.ObjectId.isValid(movementId)) {
      throw new Error('ID de movimiento inválido');
    }

    const movement = await Movement.findOne({ 
      _id: movementId, 
      userId 
    });

    if (!movement) {
      throw new Error('Movimiento no encontrado');
    }

    return movement;
  }

  // Actualizar movimiento
  async updateMovement(userId: string, movementId: string, updateData: UpdateMovementRequest) {
    // Validar ObjectId
    if (!mongoose.Types.ObjectId.isValid(movementId)) {
      throw new Error('ID de movimiento inválido');
    }

    // Procesar fecha si está presente
    const processedData = { ...updateData };
    if (processedData.fecha) {
      processedData.fecha = new Date(processedData.fecha).toISOString();
    }

    // Limpiar descripción si está presente
    if (processedData.descripcion !== undefined) {
      processedData.descripcion = processedData.descripcion?.trim() || undefined;
    }

    const movement = await Movement.findOneAndUpdate(
      { _id: movementId, userId },
      processedData,
      { 
        new: true, // Retornar documento actualizado
        runValidators: true // Ejecutar validaciones del schema
      }
    );

    if (!movement) {
      throw new Error('Movimiento no encontrado');
    }

    return movement;
  }

  // Eliminar movimiento
  async deleteMovement(userId: string, movementId: string) {
    // Validar ObjectId
    if (!mongoose.Types.ObjectId.isValid(movementId)) {
      throw new Error('ID de movimiento inválido');
    }

    const movement = await Movement.findOneAndDelete({ 
      _id: movementId, 
      userId 
    });

    if (!movement) {
      throw new Error('Movimiento no encontrado');
    }

    return movement;
  }

  // Obtener resumen financiero
  async getFinancialSummary(userId: string) {
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

    return summaryData ? {
      totalIngresos: summaryData.totalIngresos,
      totalEgresos: summaryData.totalEgresos,
      balance: (summaryData.totalIngresos - summaryData.totalEgresos),
      movimientosCount: summaryData.movimientosCount
    } : {
      totalIngresos: 0,
      totalEgresos: 0,
      balance: 0,
      movimientosCount: 0
    };
  }

  // Obtener estadísticas detalladas
  async getDetailedStats(userId: string) {
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

    return generalStats ? {
      totalIngresos: generalStats.totalIngresos,
      totalEgresos: generalStats.totalEgresos,
      balance: (generalStats.totalIngresos - generalStats.totalEgresos),
      movimientosCount: generalStats.movimientosCount,
      promedioIngreso: generalStats.promedioIngreso ? generalStats.promedioIngreso : 0,
      promedioEgreso: generalStats.promedioEgreso ? generalStats.promedioEgreso : 0,
      categorias: categoryStats.map(cat => ({
        categoria: cat._id,
        total: cat.totalGeneral,
        tipos: cat.tipos.map((t: any) => ({
          tipo: t.tipo,
          total: t.total,
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
  }

  // Obtener datos para gráfico mensual
  async getMonthlyChartData(userId: string) {
    // Obtener fechas del mes actual
    const now = new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const endOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0);
    
    console.log(`📊 Generando gráfico mensual para ${startOfMonth.toISOString()} - ${endOfMonth.toISOString()}`);

    // Agregar datos por día
    const dailyData = await Movement.aggregate([
      {
        $match: {
          userId: new mongoose.Types.ObjectId(userId),
          fecha: {
            $gte: startOfMonth,
            $lte: endOfMonth
          }
        }
      },
      {
        $group: {
          _id: {
            day: { $dayOfMonth: '$fecha' },
            tipo: '$tipo'
          },
          total: { $sum: '$monto' }
        }
      },
      {
        $group: {
          _id: '$_id.day',
          ingresos: {
            $sum: {
              $cond: [{ $eq: ['$_id.tipo', 'ingreso'] }, '$total', 0]
            }
          },
          egresos: {
            $sum: {
              $cond: [{ $eq: ['$_id.tipo', 'egreso'] }, '$total', 0]
            }
          }
        }
      },
      {
        $sort: { _id: 1 }
      }
    ]);

    console.log('🔍 Daily data:', dailyData);

    // Crear arrays separados para cada serie
    const daysInMonth = endOfMonth.getDate();
    const labels = [];
    const ingresosData = [];
    const egresosData = [];
    
    for (let day = 1; day <= daysInMonth; day++) {
      const dayData = dailyData.find(d => d._id === day);
      const date = new Date(now.getFullYear(), now.getMonth(), day).toISOString().split('T')[0];
      
      labels.push(date);
      ingresosData.push(dayData ? dayData.ingresos : 0);
      egresosData.push(dayData ? dayData.egresos : 0);
    }

    // Calcular totales del mes
    const monthTotals = dailyData.reduce((acc, day) => {
      acc.totalIngresos += day.ingresos;
      acc.totalEgresos += day.egresos;
      return acc;
    }, { totalIngresos: 0, totalEgresos: 0 });

    return {
      period: {
        month: now.getMonth() + 1,
        year: now.getFullYear(),
        monthName: now.toLocaleDateString('es-ES', { month: 'long' }),
        startDate: startOfMonth.toISOString().split('T')[0],
        endDate: endOfMonth.toISOString().split('T')[0]
      },
      labels,
      series: {
        ingresos: {
          name: 'Ingresos',
          data: ingresosData,
          color: '#10B981' // Verde para ingresos
        },
        egresos: {
          name: 'Egresos', 
          data: egresosData,
          color: '#EF4444' // Rojo para egresos
        }
      },
      summary: {
        totalIngresos: monthTotals.totalIngresos,
        totalEgresos: monthTotals.totalEgresos,
        balance: monthTotals.totalIngresos - monthTotals.totalEgresos,
        daysWithMovements: dailyData.length,
        totalDays: daysInMonth
      }
    };
  }
}

export default new MovementService();
