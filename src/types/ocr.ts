export interface OCRRequest {
  image: string; // Base64 encoded image
  autoCreateMovement?: boolean; // Si debe crear automáticamente el movimiento
}

export interface OCRResponse {
  success: boolean;
  message: string;
  ocrText?: string;
  extractedData?: ExtractedMovementData;
  movement?: any; // Movimiento creado automáticamente
  confidence?: number; // Confianza del OCR (0-100)
  processingTime?: number; // Tiempo de procesamiento en ms
}

export interface ExtractedMovementData {
  // Datos extraídos de la factura
  monto?: number;
  fecha?: string;
  descripcion?: string;
  categoria?: string;
  tipo?: 'ingreso' | 'egreso';
  
  // Información adicional de la factura
  vendor?: string; // Nombre del proveedor/empresa
  rfc?: string; // RFC si es factura mexicana
  folio?: string; // Número de factura
  iva?: number; // IVA si está presente
  subtotal?: number; // Subtotal antes de impuestos
  
  // Metadatos de extracción
  confidence?: {
    monto?: number;
    fecha?: number;
    vendor?: number;
    overall?: number;
  };
}

export interface OCRProcessingOptions {
  language?: string; // Idioma para OCR (default: 'spa+eng')
  imageQuality?: 'low' | 'medium' | 'high'; // Calidad de procesamiento
  preprocessImage?: boolean; // Si debe preprocesar la imagen
  extractMovementData?: boolean; // Si debe extraer datos del movimiento
  autoDetectCategory?: boolean; // Si debe auto-detectar la categoría
}

// Patrones para extraer información de facturas
export interface ExtractionPatterns {
  amount: RegExp[];
  date: RegExp[];
  vendor: RegExp[];
  rfc: RegExp[];
  folio: RegExp[];
  total: RegExp[];
  subtotal: RegExp[];
  iva: RegExp[];
}

// Mapeo de vendedores a categorías
export interface VendorCategoryMapping {
  [key: string]: {
    categoria: string;
    tipo: 'ingreso' | 'egreso';
    keywords: string[];
  };
}

export interface OCRStats {
  totalProcessed: number;
  successfulExtractions: number;
  averageConfidence: number;
  averageProcessingTime: number;
  commonCategories: { [key: string]: number };
}
