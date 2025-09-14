import { Request, Response, NextFunction } from 'express';
import { CreateMovementRequest, UpdateMovementRequest, ALL_CATEGORIAS } from '../types/movement.js';

// Validación para crear movimiento
export const validateCreateMovement = (
  req: Request<{}, {}, CreateMovementRequest>,
  res: Response,
  next: NextFunction
): void => {
  const { tipo, categoria, monto, fecha, descripcion } = req.body;

  // Validaciones requeridas
  if (!tipo) {
    res.status(400).json({
      success: false,
      message: 'El tipo de movimiento es requerido'
    });
    return;
  }

  if (!categoria) {
    res.status(400).json({
      success: false,
      message: 'La categoría es requerida'
    });
    return;
  }

  if (monto === undefined || monto === null) {
    res.status(400).json({
      success: false,
      message: 'El monto es requerido'
    });
    return;
  }

  if (!fecha) {
    res.status(400).json({
      success: false,
      message: 'La fecha es requerida'
    });
    return;
  }

  // Validar tipo
  if (!['ingreso', 'egreso'].includes(tipo)) {
    res.status(400).json({
      success: false,
      message: 'El tipo debe ser "ingreso" o "egreso"'
    });
    return;
  }

  // Validar categoría
  if (!ALL_CATEGORIAS.includes(categoria as any)) {
    res.status(400).json({
      success: false,
      message: 'Categoría no válida'
    });
    return;
  }

  // Validar monto
  if (typeof monto !== 'number' || monto <= 0) {
    res.status(400).json({
      success: false,
      message: 'El monto debe ser un número mayor a 0'
    });
    return;
  }

  if (monto > 999999999.99) {
    res.status(400).json({
      success: false,
      message: 'El monto es demasiado grande'
    });
    return;
  }

  // Validar fecha
  const fechaDate = new Date(fecha);
  if (isNaN(fechaDate.getTime())) {
    res.status(400).json({
      success: false,
      message: 'Fecha inválida'
    });
    return;
  }

  if (fechaDate > new Date()) {
    res.status(400).json({
      success: false,
      message: 'La fecha no puede ser futura'
    });
    return;
  }

  // Validar descripción (opcional)
  if (descripcion && typeof descripcion !== 'string') {
    res.status(400).json({
      success: false,
      message: 'La descripción debe ser texto'
    });
    return;
  }

  if (descripcion && descripcion.length > 200) {
    res.status(400).json({
      success: false,
      message: 'La descripción no puede exceder 200 caracteres'
    });
    return;
  }

  next();
};

// Validación para actualizar movimiento
export const validateUpdateMovement = (
  req: Request<{}, {}, UpdateMovementRequest>,
  res: Response,
  next: NextFunction
): void => {
  const { tipo, categoria, monto, fecha, descripcion } = req.body;

  // Al menos un campo debe estar presente para actualizar
  if (!tipo && !categoria && monto === undefined && !fecha && descripcion === undefined) {
    res.status(400).json({
      success: false,
      message: 'Al menos un campo debe ser proporcionado para actualizar'
    });
    return;
  }

  // Validar tipo si está presente
  if (tipo && !['ingreso', 'egreso'].includes(tipo)) {
    res.status(400).json({
      success: false,
      message: 'El tipo debe ser "ingreso" o "egreso"'
    });
    return;
  }

  // Validar categoría si está presente
  if (categoria && !ALL_CATEGORIAS.includes(categoria as any)) {
    res.status(400).json({
      success: false,
      message: 'Categoría no válida'
    });
    return;
  }

  // Validar monto si está presente
  if (monto !== undefined) {
    if (typeof monto !== 'number' || monto <= 0) {
      res.status(400).json({
        success: false,
        message: 'El monto debe ser un número mayor a 0'
      });
      return;
    }

    if (monto > 999999999.99) {
      res.status(400).json({
        success: false,
        message: 'El monto es demasiado grande'
      });
      return;
    }
  }

  // Validar fecha si está presente
  if (fecha) {
    const fechaDate = new Date(fecha);
    if (isNaN(fechaDate.getTime())) {
      res.status(400).json({
        success: false,
        message: 'Fecha inválida'
      });
      return;
    }

    if (fechaDate > new Date()) {
      res.status(400).json({
        success: false,
        message: 'La fecha no puede ser futura'
      });
      return;
    }
  }

  // Validar descripción si está presente
  if (descripcion !== undefined) {
    if (descripcion !== null && typeof descripcion !== 'string') {
      res.status(400).json({
        success: false,
        message: 'La descripción debe ser texto'
      });
      return;
    }

    if (descripcion && descripcion.length > 200) {
      res.status(400).json({
        success: false,
        message: 'La descripción no puede exceder 200 caracteres'
      });
      return;
    }
  }

  next();
};

// Validación de parámetros de consulta
export const validateQueryParams = (
  req: Request,
  res: Response,
  next: NextFunction
): void => {
  const { page, limit, tipo, categoria, fechaInicio, fechaFin, sortBy, sortOrder } = req.query;

  // Validar page
  if (page && (isNaN(Number(page)) || Number(page) < 1)) {
    res.status(400).json({
      success: false,
      message: 'La página debe ser un número mayor a 0'
    });
    return;
  }

  // Validar limit
  if (limit && (isNaN(Number(limit)) || Number(limit) < 1 || Number(limit) > 100)) {
    res.status(400).json({
      success: false,
      message: 'El límite debe ser un número entre 1 y 100'
    });
    return;
  }

  // Validar tipo
  if (tipo && !['ingreso', 'egreso'].includes(tipo as string)) {
    res.status(400).json({
      success: false,
      message: 'El tipo debe ser "ingreso" o "egreso"'
    });
    return;
  }

  // Validar categoría
  if (categoria && !ALL_CATEGORIAS.includes(categoria as any)) {
    res.status(400).json({
      success: false,
      message: 'Categoría no válida'
    });
    return;
  }

  // Validar fechas
  if (fechaInicio && isNaN(new Date(fechaInicio as string).getTime())) {
    res.status(400).json({
      success: false,
      message: 'Fecha de inicio inválida'
    });
    return;
  }

  if (fechaFin && isNaN(new Date(fechaFin as string).getTime())) {
    res.status(400).json({
      success: false,
      message: 'Fecha de fin inválida'
    });
    return;
  }

  // Validar que fechaInicio sea menor que fechaFin
  if (fechaInicio && fechaFin) {
    const inicio = new Date(fechaInicio as string);
    const fin = new Date(fechaFin as string);
    if (inicio > fin) {
      res.status(400).json({
        success: false,
        message: 'La fecha de inicio debe ser menor que la fecha de fin'
      });
      return;
    }
  }

  // Validar sortBy
  if (sortBy && !['fecha', 'monto', 'categoria'].includes(sortBy as string)) {
    res.status(400).json({
      success: false,
      message: 'sortBy debe ser "fecha", "monto" o "categoria"'
    });
    return;
  }

  // Validar sortOrder
  if (sortOrder && !['asc', 'desc'].includes(sortOrder as string)) {
    res.status(400).json({
      success: false,
      message: 'sortOrder debe ser "asc" o "desc"'
    });
    return;
  }

  next();
};
