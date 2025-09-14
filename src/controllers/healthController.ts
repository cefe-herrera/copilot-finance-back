import { Request, Response } from 'express';

export class HealthController {
  // Verificar estado de salud de la API
  async checkHealth(_req: Request, res: Response) {
    try {
      res.json({ 
        status: 'ok',
        timestamp: new Date().toISOString(),
        uptime: process.uptime(),
        environment: process.env.NODE_ENV || 'development'
      });
    } catch (error) {
      console.error('Error en health check:', error);
      res.status(500).json({ 
        status: 'error',
        message: 'Health check failed'
      });
    }
  }
}

export default new HealthController();
