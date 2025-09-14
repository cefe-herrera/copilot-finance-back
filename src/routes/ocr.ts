import { Router } from 'express';
import { authenticateToken } from '../middleware/auth.js';
import ocrController from '../controllers/ocrController.js';

const router = Router();

// Aplicar autenticación a todas las rutas
router.use(authenticateToken);

// POST /api/ocr/extract - Extraer texto de imagen
router.post('/extract', ocrController.extractFromImage);

// POST /api/ocr/process-and-create - Procesar imagen y crear movimiento
router.post('/process-and-create', ocrController.processAndCreate);

// GET /api/ocr/health - Verificar estado del servicio AI
router.get('/health', ocrController.checkHealth);

// POST /api/ocr/preview - Previsualizar extracción sin crear movimiento
router.post('/preview', ocrController.previewExtraction);

// POST /api/ocr/test-ai - Probar extracción con AI (para debugging)
router.post('/test-ai', ocrController.testAI);

export default router;