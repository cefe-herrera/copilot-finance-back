import { createWorker } from 'tesseract.js';
import sharp from 'sharp';
import { 
  ExtractedMovementData, 
  OCRProcessingOptions, 
  ExtractionPatterns,
  VendorCategoryMapping 
} from '../types/ocr.js';

class OCRService {
  private worker: any = null;
  private isInitialized = false;

  // Patrones para extraer información de facturas mexicanas/latinoamericanas
  private extractionPatterns: ExtractionPatterns = {
    amount: [
      // Patrones específicos para TOTAL
      /total[:\s]*\$?\s*([0-9,]+\.?[0-9]*)/gi,
      /total[:\s]*([0-9,]+\.?[0-9]*)/gi,
      // Patrones para números con formato específico (ej: 11709.75)
      /([0-9]{2,}\.?[0-9]{2})\s*$/gm, // Números al final de línea
      /([0-9]{3,}\.?[0-9]{2})/g, // Números de 3+ dígitos con decimales
      // Patrones para importes y montos
      /importe[:\s]*\$?\s*([0-9,]+\.?[0-9]*)/gi,
      /monto[:\s]*\$?\s*([0-9,]+\.?[0-9]*)/gi,
      // Patrones con símbolos de moneda
      /\$\s*([0-9,]+\.?[0-9]*)/g,
      /([0-9,]+\.?[0-9]*)\s*pesos/gi,
      /([0-9,]+\.?[0-9]*)\s*MXN/gi,
      // Patrón específico para facturas de farmacia
      /total\s*([0-9,]+\.?[0-9]*)/gi,
      // Patrón para capturar números grandes después de productos
      /(?:total|importe|monto|pagar)\s*[:\s]*([0-9,]+\.?[0-9]*)/gi
    ],
    date: [
      /fecha[:\s]*(\d{1,2}\/\d{1,2}\/\d{2,4})/gi,
      /(\d{1,2}\/\d{1,2}\/\d{2,4})/g,
      /(\d{1,2}-\d{1,2}-\d{2,4})/g,
      /(\d{2,4}-\d{1,2}-\d{1,2})/g,
      /(\d{1,2}\s+de\s+\w+\s+de\s+\d{4})/gi
    ],
    vendor: [
      /razón\s+social[:\s]*(.+?)(?:\n|RFC|$)/gi,
      /empresa[:\s]*(.+?)(?:\n|RFC|$)/gi,
      /proveedor[:\s]*(.+?)(?:\n|RFC|$)/gi,
      /expedido\s+por[:\s]*(.+?)(?:\n|RFC|$)/gi
    ],
    rfc: [
      /RFC[:\s]*([A-Z&Ñ]{3,4}\d{6}[A-Z0-9]{3})/gi,
      /([A-Z&Ñ]{3,4}\d{6}[A-Z0-9]{3})/g
    ],
    folio: [
      /folio[:\s]*([A-Z0-9\-]+)/gi,
      /factura[:\s]*([A-Z0-9\-]+)/gi,
      /número[:\s]*([A-Z0-9\-]+)/gi
    ],
    total: [
      /total[:\s]*\$?\s*([0-9,]+\.?[0-9]*)/gi,
      /importe\s+total[:\s]*\$?\s*([0-9,]+\.?[0-9]*)/gi
    ],
    subtotal: [
      /subtotal[:\s]*\$?\s*([0-9,]+\.?[0-9]*)/gi,
      /base[:\s]*\$?\s*([0-9,]+\.?[0-9]*)/gi
    ],
    iva: [
      /iva[:\s]*\$?\s*([0-9,]+\.?[0-9]*)/gi,
      /impuesto[:\s]*\$?\s*([0-9,]+\.?[0-9]*)/gi,
      /16%[:\s]*\$?\s*([0-9,]+\.?[0-9]*)/gi
    ]
  };

  // Mapeo de palabras clave a categorías
  private vendorCategoryMapping: VendorCategoryMapping = {
    'oxxo': { categoria: 'Alimentación', tipo: 'egreso', keywords: ['oxxo', 'tienda'] },
    'walmart': { categoria: 'Compras', tipo: 'egreso', keywords: ['walmart', 'supercenter'] },
    'soriana': { categoria: 'Alimentación', tipo: 'egreso', keywords: ['soriana', 'super'] },
    'chedraui': { categoria: 'Alimentación', tipo: 'egreso', keywords: ['chedraui'] },
    'pemex': { categoria: 'Transporte', tipo: 'egreso', keywords: ['pemex', 'gasolina', 'combustible'] },
    'cfe': { categoria: 'Servicios', tipo: 'egreso', keywords: ['cfe', 'comisión federal', 'electricidad'] },
    'telmex': { categoria: 'Servicios', tipo: 'egreso', keywords: ['telmex', 'teléfono', 'internet'] },
    'telcel': { categoria: 'Servicios', tipo: 'egreso', keywords: ['telcel', 'celular', 'móvil'] },
    'uber': { categoria: 'Transporte', tipo: 'egreso', keywords: ['uber', 'viaje'] },
    'netflix': { categoria: 'Entretenimiento', tipo: 'egreso', keywords: ['netflix', 'streaming'] },
    'spotify': { categoria: 'Entretenimiento', tipo: 'egreso', keywords: ['spotify', 'música'] },
    'farmacias': { categoria: 'Salud', tipo: 'egreso', keywords: ['farmacia', 'guadalajara', 'benavides', 'del ahorro'] },
    'farmacity': { categoria: 'Salud', tipo: 'egreso', keywords: ['farmacity', 'farma'] },
    'dia': { categoria: 'Alimentación', tipo: 'egreso', keywords: ['dia argentina', 'dia', 'supermercado dia'] },
    'carrefour': { categoria: 'Alimentación', tipo: 'egreso', keywords: ['carrefour', 'carrefour express'] },
    'disco': { categoria: 'Alimentación', tipo: 'egreso', keywords: ['disco', 'supermercado disco'] },
    'jumbo': { categoria: 'Alimentación', tipo: 'egreso', keywords: ['jumbo', 'supermercado jumbo'] },
    'restaurante': { categoria: 'Alimentación', tipo: 'egreso', keywords: ['restaurante', 'comida', 'alimentos'] },
    'gasolinera': { categoria: 'Transporte', tipo: 'egreso', keywords: ['gasolinera', 'gas', 'combustible'] }
  };

  async initialize(): Promise<void> {
    if (this.isInitialized) return;

    try {
      this.worker = await createWorker('spa+eng', 1, {
        logger: m => {
          if (m.status === 'recognizing text') {
            console.log(`OCR Progress: ${Math.round(m.progress * 100)}%`);
          }
        }
      });
      
      this.isInitialized = true;
      console.log('🔍 OCR Service initialized successfully');
    } catch (error) {
      console.error('❌ Error initializing OCR Service:', error);
      throw new Error('Failed to initialize OCR service');
    }
  }

  async processImage(
    base64Image: string, 
    options: OCRProcessingOptions = {}
  ): Promise<{ text: string; confidence: number; processingTime: number }> {
    if (!this.isInitialized) {
      await this.initialize();
    }

    const startTime = Date.now();
    
    try {
      // Convertir base64 a buffer
      const imageBuffer = Buffer.from(base64Image.replace(/^data:image\/[a-z]+;base64,/, ''), 'base64');
      
      // Preprocesar imagen si es necesario
      let processedImageBuffer = imageBuffer;
      if (options.preprocessImage !== false) {
        processedImageBuffer = await this.preprocessImage(imageBuffer, options.imageQuality);
      }

      // Ejecutar OCR
      const { data: { text, confidence } } = await this.worker.recognize(processedImageBuffer);
      
      const processingTime = Date.now() - startTime;
      
      return {
        text: text.trim(),
        confidence: Math.round(confidence),
        processingTime
      };
    } catch (error) {
      console.error('Error processing OCR:', error);
      throw new Error('Failed to process image with OCR');
    }
  }

  private async preprocessImage(imageBuffer: Buffer, quality: string = 'medium'): Promise<Buffer> {
    try {
      console.log('🖼️ Preprocesando imagen con calidad:', quality);
      
      let sharpInstance = sharp(imageBuffer);
      
      // Obtener metadatos de la imagen
      const metadata = await sharpInstance.metadata();
      console.log(`📐 Imagen original: ${metadata.width}x${metadata.height}`);

      // Configuraciones según la calidad
      switch (quality) {
        case 'high':
          sharpInstance = sharpInstance
            .resize(null, 2400, { withoutEnlargement: true, kernel: sharp.kernel.lanczos3 })
            .sharpen({ sigma: 1, m1: 1, m2: 2 })
            .normalize()
            .linear(1.2, -(128 * 1.2) + 128) // Aumentar contraste
            .threshold(140); // Umbral más agresivo
          break;
        case 'low':
          sharpInstance = sharpInstance
            .resize(null, 1000, { withoutEnlargement: true })
            .normalize()
            .linear(1.1, -(128 * 1.1) + 128); // Contraste suave
          break;
        default: // medium
          sharpInstance = sharpInstance
            .resize(null, 1600, { withoutEnlargement: true, kernel: sharp.kernel.lanczos3 })
            .sharpen({ sigma: 1, m1: 1, m2: 1.5 })
            .normalize()
            .linear(1.15, -(128 * 1.15) + 128) // Mejorar contraste
            .threshold(130); // Binarización para mejor OCR
      }

      // Convertir a escala de grises y aplicar filtros finales
      const processedBuffer = await sharpInstance
        .greyscale()
        .median(1) // Reducir ruido
        .png({ 
          quality: 95,
          compressionLevel: 1,
          adaptiveFiltering: false
        })
        .toBuffer();
        
      console.log('✅ Imagen preprocesada exitosamente');
      return processedBuffer;
      
    } catch (error) {
      console.error('❌ Error preprocessing image:', error);
      // Si falla el preprocesamiento, devolver imagen original
      return imageBuffer;
    }
  }

  extractMovementData(ocrText: string): ExtractedMovementData {
    const extractedData: ExtractedMovementData = {
      confidence: {}
    };

    try {
      // Limpiar texto
      const cleanText = ocrText.replace(/\s+/g, ' ').trim();

      // Extraer monto
      const amountResult = this.extractAmount(cleanText);
      if (amountResult) {
        extractedData.monto = amountResult.value;
        extractedData.confidence!.monto = amountResult.confidence;
      }

      // Extraer fecha
      const dateResult = this.extractDate(cleanText);
      if (dateResult) {
        extractedData.fecha = dateResult.value;
        extractedData.confidence!.fecha = dateResult.confidence;
      }

      // Extraer vendor/proveedor
      const vendorResult = this.extractVendor(cleanText);
      if (vendorResult) {
        extractedData.vendor = vendorResult.value;
        extractedData.confidence!.vendor = vendorResult.confidence;
        
        // Auto-detectar categoría basada en vendor
        const categoryData = this.detectCategory(vendorResult.value);
        if (categoryData) {
          extractedData.categoria = categoryData.categoria;
          extractedData.tipo = categoryData.tipo;
        }
      }

      // Extraer otros datos
      extractedData.rfc = this.extractWithPatterns(cleanText, this.extractionPatterns.rfc);
      extractedData.folio = this.extractWithPatterns(cleanText, this.extractionPatterns.folio);
      extractedData.subtotal = this.extractNumericValue(cleanText, this.extractionPatterns.subtotal);
      extractedData.iva = this.extractNumericValue(cleanText, this.extractionPatterns.iva);

      // Generar descripción automática
      if (extractedData.vendor) {
        extractedData.descripcion = `Factura - ${extractedData.vendor}`;
        if (extractedData.folio) {
          extractedData.descripcion += ` (${extractedData.folio})`;
        }
      }

      // Calcular confianza general
      const confidenceValues = Object.values(extractedData.confidence || {}).filter(c => c !== undefined);
      extractedData.confidence!.overall = confidenceValues.length > 0 
        ? Math.round(confidenceValues.reduce((a, b) => a + b, 0) / confidenceValues.length)
        : 0;

      // Siempre establecer como egreso (todas las facturas son gastos)
      extractedData.tipo = 'egreso';

    } catch (error) {
      console.error('Error extracting movement data:', error);
    }

    return extractedData;
  }

  private extractAmount(text: string): { value: number; confidence: number } | null {
    console.log('🔍 Extrayendo monto del texto...');
    
    // Dividir texto en líneas para análisis línea por línea
    const lines = text.split('\n');
    const amounts: { value: number; confidence: number; line: string; lineIndex: number }[] = [];
    
    // Paso 1: Buscar líneas que contengan "total" (case insensitive)
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i].trim();
      console.log(`📄 Línea ${i}: "${line}"`);
      
      if (/total/gi.test(line)) {
        console.log(`💰 Línea con TOTAL encontrada: "${line}"`);
        
        const extractedAmounts = this.extractNumbersFromLine(line);
        extractedAmounts.forEach(amount => {
          amounts.push({
            ...amount,
            confidence: 95, // Muy alta confianza para líneas con TOTAL
            line,
            lineIndex: i
          });
        });
      }
    }
    
    // Paso 2: Si no encontramos TOTAL, buscar números grandes al final del texto
    if (amounts.length === 0) {
      console.log('🔍 No se encontró TOTAL, buscando números grandes...');
      
      // Buscar en las últimas 10 líneas (donde suele estar el total)
      const lastLines = lines.slice(-10);
      
      for (let i = 0; i < lastLines.length; i++) {
        const line = lastLines[i].trim();
        const realLineIndex = lines.length - 10 + i;
        
        // Buscar números grandes (probables totales)
        const extractedAmounts = this.extractNumbersFromLine(line);
        extractedAmounts.forEach(amount => {
          // Solo considerar números grandes como posibles totales
          if (amount.value >= 1000) {
            amounts.push({
              ...amount,
              confidence: 75, // Buena confianza para números grandes al final
              line,
              lineIndex: realLineIndex
            });
            console.log(`💰 Número grande encontrado: ${amount.value} - Línea: "${line}"`);
          }
        });
      }
    }
    
    // Paso 3: Si aún no hay resultados, buscar cualquier número de 4+ dígitos
    if (amounts.length === 0) {
      console.log('🔍 Buscando cualquier número de 4+ dígitos...');
      
      for (let i = 0; i < lines.length; i++) {
        const line = lines[i].trim();
        
        const extractedAmounts = this.extractNumbersFromLine(line);
        extractedAmounts.forEach(amount => {
          // Solo números de 4+ dígitos
          if (amount.value >= 1000 && amount.value <= 999999999) {
            amounts.push({
              ...amount,
              confidence: 50, // Menor confianza para números genéricos
              line,
              lineIndex: i
            });
          }
        });
      }
    }
    
    if (amounts.length === 0) {
      console.log('❌ No se encontró ningún monto válido');
      return null;
    }
    
    // Ordenar por confianza y luego por valor (números más grandes suelen ser totales)
    amounts.sort((a, b) => {
      if (Math.abs(a.confidence - b.confidence) > 10) {
        return b.confidence - a.confidence;
      }
      return b.value - a.value;
    });
    
    const bestAmount = amounts[0];
    console.log(`✅ MONTO SELECCIONADO: ${bestAmount.value} (confianza: ${bestAmount.confidence}) - Línea ${bestAmount.lineIndex}: "${bestAmount.line}"`);
    
    return {
      value: bestAmount.value,
      confidence: bestAmount.confidence
    };
  }
  
  private extractNumbersFromLine(line: string): { value: number }[] {
    const numbers: { value: number }[] = [];
    
    // Patrones para extraer números: 44017,00 | 44017.00 | 44017 | 1.234,56 | 1,234.56
    const numberPatterns = [
      /([0-9]{1,3}(?:[.,][0-9]{3})*[.,][0-9]{2})/g, // Formato con separadores de miles y decimales
      /([0-9]{3,}[.,][0-9]{2})/g, // Números con decimales (ej: 44017,00)
      /([0-9]{4,})/g // Números enteros de 4+ dígitos
    ];
    
    for (const pattern of numberPatterns) {
      const matches = [...line.matchAll(pattern)];
      
      for (const match of matches) {
        let amountStr = match[1];
        
        // Normalizar formato: convertir coma decimal a punto
        if (amountStr.includes(',') && amountStr.lastIndexOf(',') === amountStr.length - 3) {
          // Si la coma está en posición de decimal (ej: 44017,00)
          amountStr = amountStr.replace(/,([0-9]{2})$/, '.$1');
          // Remover otras comas (separadores de miles)
          amountStr = amountStr.replace(/,/g, '');
        } else {
          // Remover todas las comas si no son decimales
          amountStr = amountStr.replace(/,/g, '');
        }
        
        const amount = parseFloat(amountStr);
        
        if (!isNaN(amount) && amount >= 100 && amount <= 999999999) {
          // Evitar duplicados en la misma línea
          if (!numbers.some(n => n.value === amount)) {
            numbers.push({ value: amount });
          }
        }
      }
    }
    
    return numbers;
  }

  private extractDate(text: string): { value: string; confidence: number } | null {
    console.log('📅 Extrayendo fecha del texto...');
    
    // Dividir texto en líneas para análisis línea por línea
    const lines = text.split('\n');
    const dates: { value: string; confidence: number; line: string; lineIndex: number }[] = [];
    
    // Paso 1: Buscar líneas que contengan "fecha" (case insensitive)
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i].trim();
      console.log(`📄 Línea ${i}: "${line}"`);
      
      if (/fecha/gi.test(line)) {
        console.log(`📅 Línea con FECHA encontrada: "${line}"`);
        
        const extractedDates = this.extractDatesFromLine(line);
        extractedDates.forEach(dateInfo => {
          dates.push({
            ...dateInfo,
            confidence: 95, // Muy alta confianza para líneas con FECHA
            line,
            lineIndex: i
          });
        });
      }
    }
    
    // Paso 2: Si no encontramos FECHA, buscar fechas en las primeras líneas
    if (dates.length === 0) {
      console.log('🔍 No se encontró FECHA, buscando fechas en primeras líneas...');
      
      // Buscar en las primeras 15 líneas (donde suele estar la fecha)
      const firstLines = lines.slice(0, 15);
      
      for (let i = 0; i < firstLines.length; i++) {
        const line = firstLines[i].trim();
        
        const extractedDates = this.extractDatesFromLine(line);
        extractedDates.forEach(dateInfo => {
          dates.push({
            ...dateInfo,
            confidence: 75, // Buena confianza para fechas en primeras líneas
            line,
            lineIndex: i
          });
          console.log(`📅 Fecha encontrada: ${dateInfo.value} - Línea: "${line}"`);
        });
      }
    }
    
    // Paso 3: Buscar fechas en cualquier parte del texto
    if (dates.length === 0) {
      console.log('🔍 Buscando fechas en todo el texto...');
      
      for (let i = 0; i < lines.length; i++) {
        const line = lines[i].trim();
        
        const extractedDates = this.extractDatesFromLine(line);
        extractedDates.forEach(dateInfo => {
          dates.push({
            ...dateInfo,
            confidence: 50, // Menor confianza para fechas genéricas
            line,
            lineIndex: i
          });
        });
      }
    }
    
    if (dates.length === 0) {
      console.log('❌ No se encontró ninguna fecha válida');
      return null;
    }
    
    // Ordenar por confianza y luego por proximidad a fecha actual
    dates.sort((a, b) => {
      if (Math.abs(a.confidence - b.confidence) > 10) {
        return b.confidence - a.confidence;
      }
      
      // Si la confianza es similar, preferir fechas más cercanas a hoy
      const dateA = new Date(a.value);
      const dateB = new Date(b.value);
      const now = new Date();
      
      const diffA = Math.abs(dateA.getTime() - now.getTime());
      const diffB = Math.abs(dateB.getTime() - now.getTime());
      
      return diffA - diffB;
    });
    
    const bestDate = dates[0];
    console.log(`✅ FECHA SELECCIONADA: ${bestDate.value} (confianza: ${bestDate.confidence}) - Línea ${bestDate.lineIndex}: "${bestDate.line}"`);
    
    return {
      value: bestDate.value,
      confidence: bestDate.confidence
    };
  }
  
  private extractDatesFromLine(line: string): { value: string }[] {
    const dates: { value: string }[] = [];
    
    // Patrones de fecha: DD/MM/YYYY, DD-MM-YYYY, DD/MM/YY, DD-MM-YY
    const datePatterns = [
      /(\d{1,2}\/\d{1,2}\/\d{4})/g,  // DD/MM/YYYY
      /(\d{1,2}-\d{1,2}-\d{4})/g,   // DD-MM-YYYY
      /(\d{1,2}\/\d{1,2}\/\d{2})/g, // DD/MM/YY
      /(\d{1,2}-\d{1,2}-\d{2})/g    // DD-MM-YY
    ];
    
    for (const pattern of datePatterns) {
      const matches = [...line.matchAll(pattern)];
      
      for (const match of matches) {
        const dateStr = match[1];
        const parsedDate = this.parseDate(dateStr);
        
        if (parsedDate) {
          // Validar que la fecha no sea muy futura (probablemente vencimiento)
          const date = new Date(parsedDate);
          const now = new Date();
          const daysDiff = (date.getTime() - now.getTime()) / (1000 * 60 * 60 * 24);
          
          // Solo aceptar fechas que no sean más de 365 días en el futuro
          if (daysDiff <= 365) {
            // Evitar duplicados
            if (!dates.some(d => d.value === parsedDate)) {
              dates.push({ value: parsedDate });
            }
          }
        }
      }
    }
    
    return dates;
  }

  private extractVendor(text: string): { value: string; confidence: number } | null {
    for (const pattern of this.extractionPatterns.vendor) {
      const match = text.match(pattern);
      if (match && match[1]) {
        const vendor = match[1].trim().replace(/\s+/g, ' ');
        if (vendor.length > 2 && vendor.length < 100) {
          return {
            value: vendor,
            confidence: 75
          };
        }
      }
    }
    return null;
  }

  private extractWithPatterns(text: string, patterns: RegExp[]): string | undefined {
    for (const pattern of patterns) {
      const match = text.match(pattern);
      if (match && match[1]) {
        return match[1].trim();
      }
    }
    return undefined;
  }

  private extractNumericValue(text: string, patterns: RegExp[]): number | undefined {
    const result = this.extractWithPatterns(text, patterns);
    if (result) {
      const numValue = parseFloat(result.replace(/,/g, ''));
      return !isNaN(numValue) ? numValue : undefined;
    }
    return undefined;
  }

  private parseDate(dateStr: string): string | null {
    try {
      // Intentar varios formatos de fecha
      const formats = [
        /(\d{1,2})\/(\d{1,2})\/(\d{2,4})/, // DD/MM/YYYY o DD/MM/YY
        /(\d{1,2})-(\d{1,2})-(\d{2,4})/, // DD-MM-YYYY
        /(\d{2,4})-(\d{1,2})-(\d{1,2})/, // YYYY-MM-DD
      ];

      for (const format of formats) {
        const match = dateStr.match(format);
        if (match) {
          let day, month, year;
          
          if (match[0].includes('-') && match[1].length === 4) {
            // YYYY-MM-DD
            year = parseInt(match[1]);
            month = parseInt(match[2]);
            day = parseInt(match[3]);
          } else {
            // DD/MM/YYYY o DD-MM-YYYY
            day = parseInt(match[1]);
            month = parseInt(match[2]);
            year = parseInt(match[3]);
            
            // Convertir año de 2 dígitos
            if (year < 100) {
              year += year < 50 ? 2000 : 1900;
            }
          }

          const date = new Date(year, month - 1, day);
          if (!isNaN(date.getTime()) && date <= new Date()) {
            return date.toISOString().split('T')[0];
          }
        }
      }
    } catch (error) {
      console.error('Error parsing date:', error);
    }
    return null;
  }

  private detectCategory(vendor: string): { categoria: string; tipo: 'ingreso' | 'egreso' } | null {
    const vendorLower = vendor.toLowerCase();
    
    for (const [key, mapping] of Object.entries(this.vendorCategoryMapping)) {
      if (mapping.keywords.some(keyword => vendorLower.includes(keyword))) {
        return {
          categoria: mapping.categoria,
          tipo: mapping.tipo
        };
      }
    }
    return null;
  }

  async terminate(): Promise<void> {
    if (this.worker && this.isInitialized) {
      await this.worker.terminate();
      this.isInitialized = false;
      console.log('🔍 OCR Service terminated');
    }
  }
}

export default new OCRService();
