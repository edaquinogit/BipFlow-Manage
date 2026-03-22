const express = require('express');
const multer = require('multer');
const path = require('path');
const cors = require('cors');
const fs = require('fs');

const app = express();
const PORT = process.env.PORT || 3000;

// ==========================================
// 1. INFRASTRUCTURE SETUP
// ==========================================

// Garante que a pasta de uploads exista ao iniciar o servidor
const uploadDir = path.join(__dirname, 'uploads');
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

// Middlewares Globais
app.use(cors()); // Permite que seu Front-end acesse a API
app.use(express.json()); // Parse de JSON payloads
app.use(express.urlencoded({ extended: true })); // Parse de Form Data comum

// Expor pasta estática com cache-control básico
app.use('/uploads', express.static(uploadDir, { maxAge: '1d' }));

// ==========================================
// 2. STORAGE ENGINE (NYC CLOUD STYLE)
// ==========================================

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, 'uploads/');
  },
  filename: (req, file, cb) => {
    // Gerar nome único: timestamp-random-original.ext
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, `asset-${uniqueSuffix}${path.extname(file.originalname)}`);
  }
});

/**
 * 🛡️ MULTIMODAL UPLOAD FILTER
 * Trava de segurança para garantir que apenas imagens < 2MB entrem no sistema.
 */
const upload = multer({ 
  storage: storage,
  limits: { 
    fileSize: 2 * 1024 * 1024 // 🚀 Trava de 2MB Hard-Coded no Servidor
  },
  fileFilter: (req, file, cb) => {
    const allowedTypes = /jpeg|jpg|png|webp/;
    const mimetype = allowedTypes.test(file.mimetype);
    const extname = allowedTypes.test(path.extname(file.originalname).toLowerCase());

    if (mimetype && extname) {
      return cb(null, true);
    }
    cb(new Error("Only images (jpeg, jpg, png, webp) are allowed!"));
  }
});

// ==========================================
// 3. API ROUTES (BIPFLOW REGISTRY)
// ==========================================

/**
 * 🛰️ POST /api/products
 * Provisionamento de novos ativos no ecossistema.
 */
app.post('/api/products', upload.single('image'), (req, res) => {
  try {
    // 1. Captura a URL do arquivo se ele foi enviado
    const imageUrl = req.file ? `http://localhost:${PORT}/uploads/${req.file.filename}` : null;

    // 2. Mock de Integração com Banco de Dados
    const newProduct = {
      id: Math.floor(Math.random() * 1000), // ID Gerado pelo DB
      ...req.body, // Dados do produto (name, price, stock)
      image: imageUrl,
      created_at: new Date().toISOString()
    };

    console.log(`✅ BipFlow Core: Asset ${newProduct.id} registered.`);
    
    // 3. Resposta de Sucesso Padrão NYC
    res.status(201).json(newProduct);

  } catch (error) {
    res.status(500).json({ status: 'Error', message: 'Deployment failed.' });
  }
});

// ==========================================
// 4. GLOBAL ERROR HANDLER
// ==========================================

// Intercepta erros do Multer (como o de 2MB) e envia resposta amigável
app.use((err, req, res, next) => {
  if (err instanceof multer.MulterError) {
    if (err.code === 'LIMIT_FILE_SIZE') {
      return res.status(413).json({ 
        status: 'Error', 
        message: 'File too large. NYC Registry limit is 2MB.' 
      });
    }
  }
  res.status(500).json({ status: 'Error', message: err.message });
});

// ==========================================
// 5. BOOTSEQUENCE
// ==========================================
app.listen(PORT, () => {
  console.log(`
  🚀 BIPFLOW CORE SERVER ACTIVE
  📡 Port: ${PORT}
  📂 Storage: ${uploadDir}
  ----------------------------
  Ready for deployment.
  `);
});