// Variables de entorno requeridas:
// JWT_SECRET=tu-clave-secreta-super-segura-aqui
// MONGO_URI=mongodb://localhost:27017/copilot-finance
// PORT=5000
// OPENAI_API_KEY=sk-tu-api-key-de-openai-aqui

export const JWT_CONFIG = {
  secret: process.env.JWT_SECRET || 'copilot-finance-secret-key-2024',
  expiresIn: '7d', // Token expira en 7 días
  refreshExpiresIn: '30d' // Refresh token expira en 30 días
};

export const AUTH_MESSAGES = {
  INVALID_CREDENTIALS: 'Credenciales inválidas',
  EMAIL_ALREADY_EXISTS: 'El email ya está registrado',
  USER_NOT_FOUND: 'Usuario no encontrado',
  TOKEN_REQUIRED: 'Token de acceso requerido',
  TOKEN_INVALID: 'Token inválido',
  TOKEN_EXPIRED: 'Token expirado',
  REGISTRATION_SUCCESS: 'Usuario registrado exitosamente',
  LOGIN_SUCCESS: 'Inicio de sesión exitoso',
  UNAUTHORIZED: 'No autorizado'
};
