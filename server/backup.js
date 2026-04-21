/**
 * Système de sauvegardes automatiques.
 *
 * - Snapshot quotidien (vers 02:00) du fichier .db dans data/backups/
 * - Conserve les 30 derniers jours, supprime les plus anciens
 * - Permet aussi un export manuel JSON via l'API /api/backup/export
 * - Permet d'importer un export JSON via /api/backup/import
 */
const fs = require('fs');
const path = require('path');
const { getDataDir, getDbPath, getDb, kvAll, kvSet } = require('./db');

const BACKUP_RETENTION_DAYS = 30;

function getBackupDir() {
  const dir = path.join(getDataDir(), 'backups');
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  return dir;
}

function pad(n) { return String(n).padStart(2, '0'); }

function formatStamp(d = new Date()) {
  return `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}_${pad(d.getHours())}-${pad(d.getMinutes())}`;
}

/**
 * Effectue une sauvegarde via l'API native de better-sqlite3 (cohérente même
 * pendant l'écriture).
 */
function performBackup() {
  return new Promise((resolve, reject) => {
    try {
      const dest = path.join(getBackupDir(), `pharmacy_${formatStamp()}.db`);
      getDb().backup(dest)
        .then(() => {
          console.log(`💾 Sauvegarde créée : ${path.basename(dest)}`);
          cleanupOldBackups();
          resolve(dest);
        })
        .catch(reject);
    } catch (e) {
      reject(e);
    }
  });
}

function cleanupOldBackups() {
  const dir = getBackupDir();
  const cutoff = Date.now() - BACKUP_RETENTION_DAYS * 24 * 3600 * 1000;
  fs.readdirSync(dir).forEach(name => {
    if (!name.startsWith('pharmacy_') || !name.endsWith('.db')) return;
    const full = path.join(dir, name);
    const stat = fs.statSync(full);
    if (stat.mtimeMs < cutoff) {
      fs.unlinkSync(full);
      console.log(`🗑️  Sauvegarde ancienne supprimée : ${name}`);
    }
  });
}

function listBackups() {
  const dir = getBackupDir();
  return fs.readdirSync(dir)
    .filter(n => n.startsWith('pharmacy_') && n.endsWith('.db'))
    .map(name => {
      const stat = fs.statSync(path.join(dir, name));
      return {
        name,
        size: stat.size,
        createdAt: stat.mtime.toISOString()
      };
    })
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

/**
 * Exporte toutes les données métier sous forme d'objet JSON portable.
 * (Format simple, plus pratique qu'un .db pour les transferts manuels.)
 */
function exportJson() {
  return {
    format: 'planning-pharmacie/v1',
    exportedAt: new Date().toISOString(),
    data: kvAll()
  };
}

/**
 * Importe un export JSON (remplace les clés présentes dans le fichier).
 * Préserve les clés non présentes.
 */
function importJson(payload) {
  if (!payload || payload.format !== 'planning-pharmacie/v1' || typeof payload.data !== 'object') {
    throw new Error('Format de sauvegarde invalide');
  }
  let count = 0;
  Object.entries(payload.data).forEach(([key, value]) => {
    kvSet(key, value);
    count++;
  });
  return count;
}

/* ---------- Planificateur ---------- */

let scheduled = false;

function startBackupScheduler() {
  if (scheduled) return;
  scheduled = true;

  // Au démarrage : sauvegarde si la dernière date de plus de 24h (ou n'existe pas)
  const backups = listBackups();
  const last = backups[0];
  const stale = !last || (Date.now() - new Date(last.createdAt).getTime() > 23 * 3600 * 1000);
  if (stale) {
    performBackup().catch(err => console.error('Backup au démarrage échouée:', err));
  }

  // Vérification toutes les heures, sauvegarde si on a passé 02:00
  setInterval(() => {
    const now = new Date();
    const last = listBackups()[0];
    const lastDate = last ? new Date(last.createdAt) : null;
    const lastDay = lastDate ? lastDate.toDateString() : null;
    const today = now.toDateString();

    // Faire une sauvegarde si on est après 02:00 et qu'on n'en a pas encore une aujourd'hui
    if (now.getHours() >= 2 && lastDay !== today) {
      performBackup().catch(err => console.error('Sauvegarde planifiée échouée:', err));
    }
  }, 3600 * 1000);
}

module.exports = {
  performBackup,
  listBackups,
  exportJson,
  importJson,
  startBackupScheduler,
  getBackupDir
};
