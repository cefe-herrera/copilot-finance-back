import OpenAI from 'openai';
import { z } from 'zod';
import { zodResponseFormat } from 'openai/helpers/zod';

// Esquema Zod para el movimiento financiero (compatible con OpenAI Structured Outputs)
const MovementSchema = z.object({
  tipo: z.enum(['ingreso', 'egreso']).describe('Tipo de movimiento financiero'),
  categoria: z.enum([
    // Ingresos
    'Salario', 'Freelance', 'Inversiones', 'Bonos', 'Ventas', 'Otros Ingresos',
    // Egresos
    'Alimentación', 'Transporte', 'Servicios', 'Entretenimiento', 'Salud', 
    'Educación', 'Compras', 'Vivienda', 'Seguros', 'Impuestos', 'Otros Gastos'
  ]).describe('Categoría del movimiento'),
  monto: z.number().positive().describe('Monto del movimiento en números decimales'),
  descripcion: z.string().nullable().describe('Descripción del movimiento o null si no hay descripción'),
  fecha: z.string().describe('Fecha en formato YYYY-MM-DD'),
  vendor: z.string().nullable().describe('Nombre del proveedor o empresa, o null si no se puede identificar'),
  confidence: z.object({
    monto: z.number().min(0).max(100).describe('Confianza en la extracción del monto (0-100)'),
    fecha: z.number().min(0).max(100).describe('Confianza en la extracción de la fecha (0-100)'),
    vendor: z.number().min(0).max(100).describe('Confianza en la extracción del vendor (0-100)'),
    overall: z.number().min(0).max(100).describe('Confianza general (0-100)')
  }).describe('Niveles de confianza para cada campo extraído')
});

export interface AIMovementExtraction {
  tipo: 'ingreso' | 'egreso';
  categoria: string;
  monto: number;
  descripcion: string | null;
  fecha: string;
  vendor: string | null;
  confidence: {
    monto: number;
    fecha: number;
    vendor: number;
    overall: number;
  };
}

class AIService {
  private openai: OpenAI;

  constructor() {
    if (!process.env.OPENAI_API_KEY) {
      throw new Error('OPENAI_API_KEY environment variable is required');
    }

    this.openai = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY,
    });

    console.log('🤖 AI Service initialized with OpenAI');
  }

  async extractMovementFromImage(base64Image: string): Promise<AIMovementExtraction> {
    try {
      console.log('🤖 Iniciando extracción con OpenAI GPT-4o-mini...');
      
      // Verificar API key
      if (!process.env.OPENAI_API_KEY) {
        throw new Error('OPENAI_API_KEY no está configurada');
      }
      
      console.log('🔑 API Key configurada:', process.env.OPENAI_API_KEY.substring(0, 10) + '...');
      
      // Remover el prefijo data:image/... si está presente
      const imageData = base64Image.replace(/^data:image\/[a-z]+;base64,/, '');
      
      console.log('📷 Tamaño de imagen base64:', imageData.length, 'caracteres');
      
      console.log('📤 Enviando request a OpenAI...');
      
      const completion = await this.openai.chat.completions.create({
        model: "gpt-4o-mini",
        messages: [
          {
            role: "system",
            content: `Eres un experto en análisis de facturas y recibos. Tu tarea es extraer información financiera de imágenes de facturas, tickets de compra, recibos, etc.

INSTRUCCIONES IMPORTANTES:
1. Extrae el MONTO TOTAL de la factura (no subtotales, no productos individuales)
2. El monto debe estar en PESOS con decimales (ej: 440.17, no 44017)
3. La fecha debe ser la fecha de la factura/compra (no vencimientos ni CAE)
4. Todas las facturas son EGRESOS (gastos)
5. Identifica la categoría más apropiada según el tipo de negocio/productos
6. Incluye el nombre del establecimiento como vendor si es posible
7. Si no puedes identificar algún campo, usa null para campos opcionales

CATEGORÍAS DISPONIBLES:
- Alimentación: Supermercados, restaurantes, comida
- Transporte: Combustible, transporte público, Uber
- Servicios: Electricidad, internet, teléfono, servicios públicos
- Salud: Farmacias, medicamentos, consultas médicas
- Entretenimiento: Streaming, cine, juegos
- Educación: Libros, cursos, material educativo
- Compras: Ropa, electrónicos, artículos generales
- Vivienda: Alquiler, mantenimiento del hogar
- Otros Gastos: Para gastos que no encajan en otras categorías

Proporciona niveles de confianza realistas basados en la calidad de la imagen y claridad del texto.`
          },
          {
            role: "user",
            content: [
              {
                type: "text",
                text: "Analiza esta imagen de factura/recibo y extrae la información del movimiento financiero:"
              },
              {
                type: "image_url",
                image_url: {
                  url: `data:image/jpeg;base64,${imageData}`
                }
              }
            ]
          }
        ],
        response_format: zodResponseFormat(MovementSchema, "movement_extraction"),
        temperature: 0.1, // Baja temperatura para mayor consistencia
        max_tokens: 1000
      });

      console.log('📥 Respuesta recibida de OpenAI');
      console.log('🔍 Completion object:', JSON.stringify({
        id: completion.id,
        model: completion.model,
        usage: completion.usage,
        choices_length: completion.choices?.length,
        first_choice: completion.choices?.[0] ? {
          finish_reason: completion.choices[0].finish_reason,
          has_message: !!completion.choices[0].message,
          has_parsed: !!completion.choices[0].message?.parsed,
          message_role: completion.choices[0].message?.role
        } : null
      }, null, 2));

      // Obtener el resultado parseado o parsear manualmente el contenido
      let result = completion.choices[0]?.message?.parsed;
      
      if (!result) {
        // Si no hay resultado parseado, intentar parsear el contenido manualmente
        const rawContent = completion.choices[0]?.message?.content;
        if (rawContent) {
          console.log('📝 Contenido raw de la respuesta:', rawContent);
          try {
            result = JSON.parse(rawContent);
            console.log('✅ JSON parseado manualmente:', result);
          } catch (parseError) {
            console.error('❌ Error parseando JSON manualmente:', parseError);
            throw new Error('No se pudo parsear la respuesta JSON de OpenAI');
          }
        } else {
          console.error('❌ No hay contenido en la respuesta');
          console.error('📄 Respuesta completa:', JSON.stringify(completion, null, 2));
          throw new Error('No se pudo extraer información de la imagen - respuesta vacía de OpenAI');
        }
      }

      console.log('✅ Extracción completada con OpenAI:', result);
      
      return result as AIMovementExtraction;

    } catch (error: any) {
      console.error('❌ Error en extracción con AI:', error);
      
      // Logs detallados del error
      if (error?.response) {
        console.error('📄 Response status:', error.response.status);
        console.error('📄 Response data:', JSON.stringify(error.response.data, null, 2));
      }
      
      if (error?.request) {
        console.error('📤 Request details:', {
          method: error.request.method,
          url: error.request.url,
          headers: error.request.getHeaders ? error.request.getHeaders() : 'N/A'
        });
      }
      
      // Manejo específico de errores de OpenAI
      if (error?.error?.code === 'invalid_api_key') {
        throw new Error('API Key de OpenAI inválida');
      } else if (error?.error?.code === 'insufficient_quota') {
        throw new Error('Cuota de OpenAI agotada');
      } else if (error?.error?.type === 'invalid_request_error') {
        throw new Error('Error en la solicitud a OpenAI: ' + error.error.message);
      } else if (error?.status === 401) {
        throw new Error('API Key de OpenAI inválida o no autorizada');
      } else if (error?.status === 429) {
        throw new Error('Límite de rate de OpenAI alcanzado');
      } else if (error?.status >= 500) {
        throw new Error('Error interno de OpenAI');
      }
      
      throw new Error('Error procesando imagen con AI: ' + (error.message || 'Error desconocido'));
    }
  }

  async testConnection(): Promise<boolean> {
    try {
      const response = await this.openai.models.list();
      console.log('🤖 Conexión con OpenAI exitosa');
      return true;
    } catch (error) {
      console.error('❌ Error conectando con OpenAI:', error);
      return false;
    }
  }
}

export default new AIService();
