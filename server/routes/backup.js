/**
 * Endpoints de sauvegarde / restauration.
 *
 * GET  /api/backup/list       -> liste les sauvegardes .db disponibles
 * POST /api/backup/now        -> déclenche une sauvegarde immédiate (admin)
 * GET  /api/backup/export     -> télécharge un export JSON portable
 * POST /api/backup/import     -> restaure depuis un export JSON (admin)
 */
const express = require('express');
const fs = require('fs');
const path = require('path');
const { listBackups, performBackup, exportJson, importJson, getBackupDir } = require('../backup');
const { requireAuth } = require('./auth');

const router = express.Router();

router.get('/list', requireAuth, (_req, res) => {
  res.json(listBackups());
});

router.post('/now', requireAuth, async (_req, res) => {
  try {
    const file = await performBackup();
    res.json({ ok: true, file: path.basename(file) });
  } catch (e) {
    res.status(500).json({ error: 'backup_failed', message: e.message });
  }
});

router.get('/export', (_req, res) => {
  // Accessible aussi en lecture seule : c'est juste une copie des données
  const data = exportJson();
  const filename = `planning-pharmacie-${new Date().toISOString().slice(0, 10)}.json`;
  res.setHeader('Content-Type', 'application/json');
  res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
  res.send(JSON.stringify(data, null, 2));
});

router.post('/import', requireAuth, (req, res) => {
  try {
    const count = importJson(req.body);
    res.json({ ok: true, imported: count });
  } catch (e) {
    res.status(400).json({ error: 'import_failed', message: e.message });
  }
});

router.get('/download/:name', requireAuth, (req, res) => {
  // Sécurité : éviter le path traversal
  const safe = path.basename(req.params.name);
  if (!safe.startsWith('pharmacy_') || !safe.endsWith('.db')) {
    return res.status(400).json({ error: 'invalid_filename' });
  }
  const file = path.join(getBackupDir(), safe);
  if (!fs.existsSync(file)) return res.status(404).json({ error: 'not_found' });
  res.download(file);
});

module.exports = router;
