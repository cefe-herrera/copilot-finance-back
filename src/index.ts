import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import connectDB from './config/database.js';
import authRoutes from './routes/auth.js';
import movementRoutes from './routes/movements.js';
import ocrRoutes from './routes/ocr.js';

const app = express();
app.use(cors());
app.use(express.json({ limit: '50mb' })); // Aumentar límite para imágenes base64
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

// Rutas
app.use('/api/auth', authRoutes);
app.use('/api/movements', movementRoutes);
app.use('/api/ocr', ocrRoutes);

app.get('/health', (_req, res) => {
  res.json({ status: 'ok', uptime: process.uptime() });
});

const PORT = process.env.PORT ?? '5000';

const startServer = async () => {
  try {
    // Conectar a MongoDB
    await connectDB();
    
    // Iniciar servidor
    app.listen(PORT, () => {
      console.log(`🚀 API escuchando en http://localhost:${PORT}`);
    });
  } catch (error) {
    console.error('❌ Error iniciando el servidor:', error);
    process.exit(1);
  }
};

startServer();
