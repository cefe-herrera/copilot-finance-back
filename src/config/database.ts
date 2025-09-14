import mongoose from 'mongoose';

const connectDB = async (): Promise<void> => {
  try {
    const mongoURI = process.env.MONGO_URI || 'mongodb://localhost:27017/copilot-finance';
    
    await mongoose.connect(mongoURI);
    
    console.log('🍃 MongoDB conectado exitosamente');
  } catch (error) {
    console.error('❌ Error conectando a MongoDB:', error);
    process.exit(1);
  }
};

// Manejo de eventos de conexión
mongoose.connection.on('disconnected', () => {
  console.log('🍃 MongoDB desconectado');
});

mongoose.connection.on('error', (error) => {
  console.error('❌ Error en MongoDB:', error);
});

export default connectDB;
