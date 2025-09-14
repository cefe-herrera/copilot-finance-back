import { Request } from 'express';
import { IMovement } from '../models/Movement.js';

export interface CreateMovementRequest {
  tipo: 'ingreso' | 'egreso';
  categoria: string;
  monto: number;
  descripcion?: string;
  fecha: string; // ISO date string
}

export interface UpdateMovementRequest {
  tipo?: 'ingreso' | 'egreso';
  categoria?: string;
  monto?: number;
  descripcion?: string;
  fecha?: string; // ISO date string
}

export interface MovementResponse {
  success: boolean;
  message: string;
  movement?: IMovement;
  movements?: IMovement[];
  pagination?: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
    hasNext: boolean;
    hasPrev: boolean;
  };
  summary?: {
    totalIngresos: number;
    totalEgresos: number;
    balance: number;
    movimientosCount: number;
  };
}

export interface MovementQueryParams {
  page?: string;
  limit?: string;
  tipo?: 'ingreso' | 'egreso';
  categoria?: string;
  fechaInicio?: string;
  fechaFin?: string;
  sortBy?: 'fecha' | 'monto' | 'categoria';
  sortOrder?: 'asc' | 'desc';
}

export interface MovementFilters {
  userId: string;
  tipo?: 'ingreso' | 'egreso';
  categoria?: string;
  fecha?: {
    $gte?: Date;
    $lte?: Date;
  };
}

// Categorías disponibles
export const CATEGORIAS_INGRESOS = [
  'Salario',
  'Freelance', 
  'Inversiones',
  'Bonos',
  'Ventas',
  'Otros Ingresos'
] as const;

export const CATEGORIAS_EGRESOS = [
  'Alimentación',
  'Transporte',
  'Servicios',
  'Entretenimiento',
  'Salud',
  'Educación',
  'Compras',
  'Vivienda',
  'Seguros',
  'Impuestos',
  'Otros Gastos'
] as const;

export const ALL_CATEGORIAS = [...CATEGORIAS_INGRESOS, ...CATEGORIAS_EGRESOS] as const;

export type CategoriaIngreso = typeof CATEGORIAS_INGRESOS[number];
export type CategoriaEgreso = typeof CATEGORIAS_EGRESOS[number];
export type Categoria = typeof ALL_CATEGORIAS[number];
