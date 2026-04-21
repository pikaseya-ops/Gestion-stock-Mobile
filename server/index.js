/**
 * Serveur Express pour Planning Pharmacie
 * - Démarre sur le port 3017 par défaut (configurable via PORT)
 * - Sert l'API REST sous /api/*
 * - Sert le front React buildé depuis client/dist
 * - Gère les sessions pour le mode édition
 */
const path = require('path');
const fs = require('fs');
const express = require('express');
const cors = require('cors');
const session = require('express-session');
const FileStore = require('session-file-store')(session);

const { initDatabase, getDataDir } = require('./db');
const { startBackupScheduler } = require('./backup');

const PORT = process.env.PORT || 3017;
const DATA_DIR = getDataDir();
const SESSIONS_DIR = path.join(DATA_DIR, 'sessions');

if (!fs.existsSync(SESSIONS_DIR)) fs.mkdirSync(SESSIONS_DIR, { recursive: true });

// Initialise / migre la base de données (crée le fichier au premier démarrage)
initDatabase();

const app = express();

// Middleware
app.use(cors({
  origin: true,
  credentials: true
}));
app.use(express.json({ limit: '10mb' }));

app.use(session({
  store: new FileStore({
    path: SESSIONS_DIR,
    ttl: 7200,            // 2h
    retries: 1,
    logFn: () => {}       // silence
  }),
  name: 'pharm.sid',
  secret: process.env.SESSION_SECRET || 'planning-pharmacie-default-secret-change-me',
  resave: false,
  saveUninitialized: false,
  cookie: {
    httpOnly: true,
    sameSite: 'lax',
    maxAge: 7200 * 1000   // 2h
  }
}));

// Routes API
app.use('/api/auth',          require('./routes/auth'));
app.use('/api/staff',         require('./routes/staff'));
app.use('/api/leaves',        require('./routes/leaves'));
app.use('/api/settings',      require('./routes/settings'));
app.use('/api/coverage',      require('./routes/coverage'));
app.use('/api/plannings',     require('./routes/plannings'));
app.use('/api/backup',        require('./routes/backup'));
app.use('/api/tasks',         require('./routes/tasks'));
app.use('/api/transmissions', require('./routes/transmissions'));

// Healthcheck
app.get('/api/health', (_req, res) => {
  res.json({ ok: true, version: '1.0.0', dataDir: DATA_DIR });
});

// Sert le front React buildé (en production)
const CLIENT_DIST = path.join(__dirname, '..', 'client', 'dist');
if (fs.existsSync(CLIENT_DIST)) {
  app.use(express.static(CLIENT_DIST));
  // SPA fallback : toutes les routes non-API renvoient index.html
  app.get(/^(?!\/api\/).*/, (_req, res) => {
    res.sendFile(path.join(CLIENT_DIST, 'index.html'));
  });
} else {
  console.warn('⚠️  client/dist introuvable — front non servi (mode dev ?)');
}

// Démarre les sauvegardes automatiques quotidiennes
startBackupScheduler();

// Lance le serveur sur 0.0.0.0 pour qu'il soit accessible en LAN
const server = app.listen(PORT, '0.0.0.0', () => {
  console.log(`✅ Planning Pharmacie — serveur en écoute sur le port ${PORT}`);
  console.log(`   Données stockées dans : ${DATA_DIR}`);
});

// Arrêt propre
process.on('SIGTERM', () => server.close(() => process.exit(0)));
process.on('SIGINT',  () => server.close(() => process.exit(0)));

module.exports = { app, server };
