#!/usr/bin/env node
/**
 * Script utilitaire : réinitialise le mot de passe d'un compte admin
 * en cas d'oubli. À exécuter directement sur le PC serveur.
 *
 * Usage (en dev) :
 *   node scripts/reset-password.js <username> <nouveau-mot-de-passe>
 *
 * Usage (après install Electron) :
 *   Demander à un dev de le lancer sur la machine ; ou utiliser DB Browser
 *   for SQLite pour éditer directement la table accounts.
 */
const path = require('path');
const fs = require('fs');
const bcrypt = require('bcryptjs');
const Database = require('better-sqlite3');

function usage() {
  console.log('Usage : node scripts/reset-password.js <username> <new-password>');
  console.log('');
  console.log('Liste les comptes existants : node scripts/reset-password.js --list');
  process.exit(1);
}

// Localisation de la base : même logique que db.js
function findDbPath() {
  // En mode Electron installé, on regarde dans %APPDATA%\Planning Pharmacie (Windows)
  // ou ~/Library/Application Support/Planning Pharmacie (macOS)
  const candidates = [];
  if (process.env.PHARM_DATA_DIR) {
    candidates.push(path.join(process.env.PHARM_DATA_DIR, 'pharmacy.db'));
  }
  if (process.platform === 'win32' && process.env.APPDATA) {
    candidates.push(path.join(process.env.APPDATA, 'Planning Pharmacie', 'pharmacy.db'));
  }
  if (process.platform === 'darwin') {
    candidates.push(path.join(require('os').homedir(), 'Library', 'Application Support', 'Planning Pharmacie', 'pharmacy.db'));
  }
  // Mode dev
  candidates.push(path.join(__dirname, '..', 'data', 'pharmacy.db'));

  for (const p of candidates) {
    if (fs.existsSync(p)) return p;
  }
  return null;
}

const args = process.argv.slice(2);
if (args.length === 0) usage();

const dbPath = findDbPath();
if (!dbPath) {
  console.error('Erreur : impossible de localiser la base de données pharmacy.db');
  console.error('Emplacements cherchés :');
  console.error('  - $PHARM_DATA_DIR/pharmacy.db');
  console.error('  - %APPDATA%\\Planning Pharmacie\\pharmacy.db (Windows)');
  console.error('  - ~/Library/Application Support/Planning Pharmacie/pharmacy.db (macOS)');
  console.error('  - ./data/pharmacy.db (mode dev)');
  process.exit(2);
}

console.log(`Base de données : ${dbPath}`);
const db = new Database(dbPath);

if (args[0] === '--list') {
  const rows = db.prepare('SELECT id, username, display_name, role FROM accounts ORDER BY role DESC, username').all();
  if (rows.length === 0) {
    console.log('Aucun compte trouvé dans la base.');
  } else {
    console.log('');
    console.log('Comptes existants :');
    console.log('-------------------');
    rows.forEach(r => console.log(`  [${r.role.padEnd(6)}] ${r.username} (${r.display_name || '—'})`));
    console.log('');
    console.log("Pour réinitialiser un mot de passe : node scripts/reset-password.js <username> <nouveau-mdp>");
  }
  process.exit(0);
}

if (args.length < 2) usage();
const [username, newPassword] = args;

if (newPassword.length < 6) {
  console.error('Erreur : le mot de passe doit faire au moins 6 caractères.');
  process.exit(1);
}

const account = db.prepare('SELECT id, username, role FROM accounts WHERE LOWER(username) = LOWER(?)').get(username);
if (!account) {
  console.error(`Erreur : aucun compte "${username}" trouvé.`);
  console.error('Utilisez --list pour voir les comptes existants.');
  process.exit(3);
}

const hash = bcrypt.hashSync(newPassword, 10);
db.prepare('UPDATE accounts SET password_hash = ? WHERE id = ?').run(hash, account.id);

console.log('');
console.log(`✅ Mot de passe réinitialisé pour "${account.username}" (${account.role})`);
console.log('   Vous pouvez maintenant vous connecter avec ce nouveau mot de passe.');
console.log('');
