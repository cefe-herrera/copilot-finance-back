import { Response } from 'express';
import { AuthenticatedRequest } from '../types/auth.js';
import { OCRRequest, OCRResponse } from '../types/ocr.js';
import aiService from '../services/aiService.js';
import Movement from '../models/Movement.js';

export class OCRController {
  // Extraer texto de imagen
  async extractFromImage(
    req: AuthenticatedRequest & { body: OCRRequest },
    res: Response<OCRResponse>
  ) {
    try {
      const { image, autoCreateMovement = false } = req.body;

      // Validaciones básicas
      if (!image) {
        res.status(400).json({
          success: false,
          message: 'La imagen es requerida'
        });
        return;
      }

      // Validar formato base64
      const base64Regex = /^data:image\/(jpeg|jpg|png|gif|bmp|webp);base64,/;
      if (!base64Regex.test(image)) {
        res.status(400).json({
          success: false,
          message: 'Formato de imagen inválido. Debe ser base64 con prefijo data:image/...'
        });
        return;
      }

      console.log('🤖 Iniciando procesamiento con AI...');
      
      const startTime = Date.now();
      
      // Procesar imagen con AI
      const extractedData = await aiService.extractMovementFromImage(image);
      const processingTime = Date.now() - startTime;

      let createdMovement = null;

      // Crear movimiento automáticamente si se solicita y hay datos suficientes
      if (autoCreateMovement && extractedData.monto && extractedData.monto > 0) {
        try {
          const userId = req.user!._id as string;

          // Usar fecha extraída o fecha actual
          const movementDate = extractedData.fecha 
            ? new Date(extractedData.fecha)
            : new Date();

          // Usar categoría detectada o categoría por defecto
          const categoria = extractedData.categoria || 'Otros Gastos';
          const tipo = extractedData.tipo || 'egreso';

          const newMovement = new Movement({
            userId,
            tipo,
            categoria,
            monto: extractedData.monto,
            descripcion: extractedData.descripcion || 'Factura procesada por AI',
            fecha: movementDate
          });

          createdMovement = await newMovement.save();
          console.log('✅ Movimiento creado automáticamente:', createdMovement._id);

        } catch (movementError) {
          console.error('Error creando movimiento automático:', movementError);
          // No fallar la respuesta OCR por error en creación de movimiento
        }
      }

      res.json({
        success: true,
        message: 'Información extraída exitosamente con AI',
        ocrText: 'Procesado con AI - no hay texto OCR',
        extractedData: {
          ...extractedData,
          descripcion: extractedData.descripcion ?? undefined,
          vendor: extractedData.vendor ?? undefined
        },
        movement: createdMovement,
        confidence: extractedData.confidence.overall,
        processingTime
      });

    } catch (error: any) {
      console.error('Error en OCR:', error);
      
      if (error.message.includes('API Key')) {
        res.status(503).json({
          success: false,
          message: 'Servicio AI temporalmente no disponible - configuración requerida'
        });
      } else if (error.message.includes('cuota')) {
        res.status(503).json({
          success: false,
          message: 'Servicio AI temporalmente no disponible - límite alcanzado'
        });
      } else if (error.message.includes('imagen')) {
        res.status(400).json({
          success: false,
          message: error.message
        });
      } else {
        res.status(500).json({
          success: false,
          message: 'Error procesando imagen con AI'
        });
      }
    }
  }

  // Procesar imagen y crear movimiento automáticamente
  async processAndCreate(
    req: AuthenticatedRequest & { body: OCRRequest },
    res: Response<OCRResponse>
  ) {
    try {
      const { image } = req.body;

      if (!image) {
        res.status(400).json({
          success: false,
          message: 'La imagen es requerida'
        });
        return;
      }

      // Validar formato base64
      const base64Regex = /^data:image\/(jpeg|jpg|png|gif|bmp|webp);base64,/;
      if (!base64Regex.test(image)) {
        res.status(400).json({
          success: false,
          message: 'Formato de imagen inválido. Debe ser base64 con prefijo data:image/...'
        });
        return;
      }

      console.log('🤖 Procesando imagen para crear movimiento automático...');

      const startTime = Date.now();
      
      // Procesar imagen con AI
      const extractedData = await aiService.extractMovementFromImage(image);
      const processingTime = Date.now() - startTime;

      // Validar que se hayan extraído datos mínimos
      if (!extractedData.monto || extractedData.monto <= 0) {
        res.status(400).json({
          success: false,
          message: 'No se pudo extraer un monto válido de la imagen',
          ocrText: 'Procesado con AI - no hay texto OCR',
          extractedData: {
            ...extractedData,
            descripcion: extractedData.descripcion ?? undefined,
            vendor: extractedData.vendor ?? undefined
          },
          confidence: extractedData.confidence.overall,
          processingTime
        });
        return;
      }

      // Crear movimiento
      const userId = req.user!._id as string;
      const movementDate = extractedData.fecha 
        ? new Date(extractedData.fecha)
        : new Date();

      const newMovement = new Movement({
        userId,
        tipo: extractedData.tipo || 'egreso',
        categoria: extractedData.categoria || 'Otros Gastos',
        monto: extractedData.monto,
        descripcion: extractedData.descripcion || `Factura AI - ${extractedData.vendor || 'Proveedor desconocido'}`,
        fecha: movementDate
      });

      const createdMovement = await newMovement.save();

      res.status(201).json({
        success: true,
        message: 'Movimiento creado exitosamente desde imagen con AI',
        ocrText: 'Procesado con AI - no hay texto OCR',
        extractedData: {
          ...extractedData,
          descripcion: extractedData.descripcion ?? undefined,
          vendor: extractedData.vendor ?? undefined
        },
        movement: createdMovement,
        confidence: extractedData.confidence.overall,
        processingTime
      });

    } catch (error: any) {
      console.error('Error procesando y creando movimiento:', error);

      if (error.name === 'ValidationError') {
        const messages = Object.values(error.errors).map((err: any) => err.message);
        res.status(400).json({
          success: false,
          message: `Error de validación: ${messages.join(', ')}`
        });
        return;
      }

      res.status(500).json({
        success: false,
        message: 'Error interno del servidor'
      });
    }
  }

  // Verificar estado del servicio AI
  async checkHealth(
    req: AuthenticatedRequest,
    res: Response<OCRResponse>
  ) {
    try {
      const startTime = Date.now();
      
      // Verificar conexión con OpenAI
      const isConnected = await aiService.testConnection();
      const processingTime = Date.now() - startTime;

      if (isConnected) {
        res.json({
          success: true,
          message: 'Servicio AI funcionando correctamente',
          processingTime
        });
      } else {
        res.status(503).json({
          success: false,
          message: 'Servicio AI no disponible'
        });
      }

    } catch (error) {
      console.error('Error verificando salud AI:', error);
      res.status(500).json({
        success: false,
        message: 'Error interno del servidor'
      });
    }
  }

  // Previsualizar extracción sin crear movimiento
  async previewExtraction(
    req: AuthenticatedRequest & { body: OCRRequest & { quality?: 'low' | 'medium' | 'high' } },
    res: Response<OCRResponse>
  ) {
    try {
      const { image, quality = 'medium' } = req.body;

      if (!image) {
        res.status(400).json({
          success: false,
          message: 'La imagen es requerida'
        });
        return;
      }

      // Validar formato
      const base64Regex = /^data:image\/(jpeg|jpg|png|gif|bmp|webp);base64,/;
      if (!base64Regex.test(image)) {
        res.status(400).json({
          success: false,
          message: 'Formato de imagen inválido'
        });
        return;
      }

      console.log(`🤖 Previsualizando extracción con AI...`);

      const startTime = Date.now();
      
      // Procesar con AI (no necesita calidad específica)
      const extractedData = await aiService.extractMovementFromImage(image);
      const processingTime = Date.now() - startTime;

      res.json({
        success: true,
        message: 'Preview de extracción completado con AI',
        ocrText: 'Procesado con AI - no hay texto OCR',
        extractedData: {
          ...extractedData,
          descripcion: extractedData.descripcion ?? undefined,
          vendor: extractedData.vendor ?? undefined
        },
        confidence: extractedData.confidence.overall,
        processingTime
      });

    } catch (error: any) {
      console.error('Error en preview OCR:', error);
      res.status(500).json({
        success: false,
        message: 'Error procesando preview'
      });
    }
  }

  // Probar extracción con AI (para debugging)
  async testAI(
    req: AuthenticatedRequest & { body: OCRRequest },
    res: Response
  ) {
    try {
      const { image } = req.body;

      if (!image) {
        res.status(400).json({
          success: false,
          message: 'La imagen es requerida'
        });
        return;
      }

      // Validar formato
      const base64Regex = /^data:image\/(jpeg|jpg|png|gif|bmp|webp);base64,/;
      if (!base64Regex.test(image)) {
        res.status(400).json({
          success: false,
          message: 'Formato de imagen inválido'
        });
        return;
      }

      console.log('🤖 Probando extracción con AI...');

      const startTime = Date.now();
      const extractedData = await aiService.extractMovementFromImage(image);
      const processingTime = Date.now() - startTime;

      res.json({
        success: true,
        message: 'Prueba de AI completada',
        extractedData,
        confidence: extractedData.confidence.overall,
        processingTime,
        details: {
          hasAmount: !!extractedData.monto,
          hasDate: !!extractedData.fecha,
          hasVendor: !!extractedData.vendor,
          categoria: extractedData.categoria,
          confidenceBreakdown: extractedData.confidence
        }
      });

    } catch (error: any) {
      console.error('Error en test de AI:', error);
      res.status(500).json({
        success: false,
        message: 'Error probando AI: ' + error.message
      });
    }
  }
}

export default new OCRController();
