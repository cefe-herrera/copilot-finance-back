import mongoose, { Document, Schema } from 'mongoose';

export interface IMovement extends Document {
  userId: mongoose.Types.ObjectId;
  tipo: 'ingreso' | 'egreso';
  categoria: string;
  monto: number;
  descripcion?: string;
  fecha: Date;
  createdAt: Date;
  updatedAt: Date;
}

const MovementSchema = new Schema<IMovement>({
  userId: {
    type: Schema.Types.ObjectId,
    ref: 'User',
    required: [true, 'El ID del usuario es requerido'],
    index: true // Índice para consultas eficientes por usuario
  },
  tipo: {
    type: String,
    enum: {
      values: ['ingreso', 'egreso'],
      message: 'El tipo debe ser "ingreso" o "egreso"'
    },
    required: [true, 'El tipo de movimiento es requerido']
  },
  categoria: {
    type: String,
    required: [true, 'La categoría es requerida'],
    trim: true,
    maxlength: [50, 'La categoría no puede exceder 50 caracteres'],
    // Categorías predefinidas comunes
    enum: {
      values: [
        // Ingresos
        'Salario', 'Freelance', 'Inversiones', 'Bonos', 'Ventas', 'Otros Ingresos',
        // Egresos
        'Alimentación', 'Transporte', 'Servicios', 'Entretenimiento', 'Salud', 
        'Educación', 'Compras', 'Vivienda', 'Seguros', 'Impuestos', 'Otros Gastos'
      ],
      message: 'Categoría no válida'
    }
  },
  monto: {
    type: Number,
    required: [true, 'El monto es requerido'],
    min: [0.01, 'El monto debe ser mayor a 0'],
    max: [999999999.99, 'El monto es demasiado grande'],
    // Guardar como centavos para evitar problemas de precisión
    get: (value: number) => value / 100,
    set: (value: number) => Math.round(value * 100)
  },
  descripcion: {
    type: String,
    trim: true,
    maxlength: [200, 'La descripción no puede exceder 200 caracteres']
  },
  fecha: {
    type: Date,
    required: [true, 'La fecha es requerida'],
    validate: {
      validator: function(value: Date) {
        // No permitir fechas futuras más allá de hoy
        return value <= new Date();
      },
      message: 'La fecha no puede ser futura'
    }
  }
}, {
  timestamps: true,
  // Configuración para getters/setters
  toJSON: { getters: true },
  toObject: { getters: true }
});

// Índices compuestos para consultas eficientes
MovementSchema.index({ userId: 1, fecha: -1 }); // Movimientos por usuario ordenados por fecha
MovementSchema.index({ userId: 1, tipo: 1 }); // Movimientos por usuario y tipo
MovementSchema.index({ userId: 1, categoria: 1 }); // Movimientos por usuario y categoría

// Middleware para validar que el monto sea positivo para ingresos y egresos
MovementSchema.pre('save', function(next) {
  if (this.monto <= 0) {
    next(new Error('El monto debe ser mayor a 0'));
    return;
  }
  next();
});

export default mongoose.model<IMovement>('Movement', MovementSchema);
