/**
 * Authentification multi-comptes :
 *  - Plusieurs comptes par pharmacie (titulaire admin + membres)
 *  - Chaque membre a son identifiant + mot de passe
 *  - Rôles : 'admin' (titulaire = tout faire) / 'member' (équipe = consulter, cocher ses tâches, lire les transmissions)
 *
 * Endpoints publics :
 *  GET  /api/auth/status          -> état (setup requis ? loggé ? rôle ?)
 *  POST /api/auth/setup           -> création du 1er compte admin (impossible si déjà existant)
 *  POST /api/auth/login           -> connexion
 *  POST /api/auth/logout          -> déconnexion
 *  POST /api/auth/password        -> changer son propre mot de passe
 *
 * Endpoints admin (gestion des comptes) :
 *  GET    /api/auth/users         -> liste des comptes
 *  POST   /api/auth/users         -> créer un compte (admin ou member)
 *  PUT    /api/auth/users/:id     -> modifier un compte (rôle, displayName, link staff)
 *  DELETE /api/auth/users/:id     -> supprimer un compte
 *  POST   /api/auth/users/:id/reset-password -> réinitialiser le mot de passe d'un membre
 */
const express = require('express');
const bcrypt = require('bcryptjs');
const { getDb, logAudit } = require('../db');

const router = express.Router();

/* ---------- Middlewares exportés ---------- */

function requireAuth(req, res, next) {
  if (!req.session?.userId) {
    return res.status(401).json({ error: 'auth_required', message: 'Connexion requise' });
  }
  next();
}

function requireAdmin(req, res, next) {
  if (!req.session?.userId) {
    return res.status(401).json({ error: 'auth_required', message: 'Connexion requise' });
  }
  if (req.session.role !== 'admin') {
    return res.status(403).json({ error: 'admin_required', message: 'Droits administrateur requis' });
  }
  next();
}

/* ---------- Helpers ---------- */

function publicAccount(row) {
  if (!row) return null;
  return {
    id: row.id,
    username: row.username,
    displayName: row.display_name,
    role: row.role,
    staffId: row.staff_id,
    createdAt: row.created_at,
    lastLogin: row.last_login
  };
}

function getAccountByUsername(username) {
  return getDb().prepare(
    'SELECT * FROM accounts WHERE LOWER(username) = LOWER(?)'
  ).get(username.trim());
}

/* ---------- Routes publiques ---------- */

router.get('/team', requireAuth, (_req, res) => {
  // Liste allégée des membres visible par tous les utilisateurs connectés
  // (pour les assignations de tâches et les mentions de transmissions)
  const rows = getDb().prepare(`
    SELECT id, username, display_name AS displayName, role, staff_id AS staffId
    FROM accounts ORDER BY display_name, username
  `).all();
  res.json(rows);
});

router.get('/status', (req, res) => {
  const count = getDb().prepare('SELECT COUNT(*) AS n FROM accounts').get().n;
  res.json({
    setupRequired: count === 0,
    isAuthenticated: !!req.session?.userId,
    user: req.session?.userId ? {
      id: req.session.userId,
      username: req.session.username,
      displayName: req.session.displayName,
      role: req.session.role,
      staffId: req.session.staffId || null
    } : null
  });
});

router.post('/setup', (req, res) => {
  const count = getDb().prepare('SELECT COUNT(*) AS n FROM accounts').get().n;
  if (count > 0) {
    return res.status(403).json({ error: 'already_setup', message: 'Compte déjà existant' });
  }

  const { username, password, displayName } = req.body || {};
  if (!username || !password) {
    return res.status(400).json({ error: 'missing_fields', message: 'Identifiant et mot de passe requis' });
  }
  if (password.length < 6) {
    return res.status(400).json({ error: 'weak_password', message: 'Mot de passe trop court (6 caractères min.)' });
  }

  const hash = bcrypt.hashSync(password, 10);
  const info = getDb().prepare(`
    INSERT INTO accounts (username, password_hash, role, display_name)
    VALUES (?, ?, 'admin', ?)
  `).run(username.trim(), hash, displayName?.trim() || username.trim());

  req.session.userId = info.lastInsertRowid;
  req.session.username = username.trim();
  req.session.displayName = displayName?.trim() || username.trim();
  req.session.role = 'admin';
  logAudit('setup', 'account', { username: username.trim() });

  res.json({
    ok: true,
    user: {
      id: info.lastInsertRowid,
      username: username.trim(),
      displayName: displayName?.trim() || username.trim(),
      role: 'admin'
    }
  });
});

router.post('/login', (req, res) => {
  const { username, password } = req.body || {};
  if (!username || !password) {
    return res.status(400).json({ error: 'missing_fields' });
  }

  const account = getAccountByUsername(username);
  if (!account || !bcrypt.compareSync(password, account.password_hash)) {
    logAudit('login_failed', 'account', { username: username.trim() });
    return res.status(401).json({ error: 'invalid_credentials', message: 'Identifiant ou mot de passe incorrect' });
  }

  getDb().prepare('UPDATE accounts SET last_login = unixepoch() WHERE id = ?').run(account.id);
  req.session.userId = account.id;
  req.session.username = account.username;
  req.session.displayName = account.display_name;
  req.session.role = account.role;
  req.session.staffId = account.staff_id;
  logAudit('login', 'account', { username: account.username });

  res.json({
    ok: true,
    user: publicAccount(account)
  });
});

router.post('/logout', (req, res) => {
  const username = req.session?.username;
  req.session?.destroy(() => {
    if (username) logAudit('logout', 'account', { username });
    res.clearCookie('pharm.sid');
    res.json({ ok: true });
  });
});

router.post('/password', requireAuth, (req, res) => {
  const { oldPassword, newPassword } = req.body || {};
  if (!oldPassword || !newPassword) {
    return res.status(400).json({ error: 'missing_fields' });
  }
  if (newPassword.length < 6) {
    return res.status(400).json({ error: 'weak_password', message: 'Mot de passe trop court (6 caractères min.)' });
  }

  const account = getDb().prepare('SELECT password_hash FROM accounts WHERE id = ?').get(req.session.userId);
  if (!account || !bcrypt.compareSync(oldPassword, account.password_hash)) {
    return res.status(401).json({ error: 'invalid_old_password' });
  }

  const hash = bcrypt.hashSync(newPassword, 10);
  getDb().prepare('UPDATE accounts SET password_hash = ? WHERE id = ?').run(hash, req.session.userId);
  logAudit('password_changed', 'account', { username: req.session.username });
  res.json({ ok: true });
});

/* ---------- Gestion des utilisateurs (admin only) ---------- */

router.get('/users', requireAuth, (req, res) => {
  const rows = getDb().prepare(`
    SELECT id, username, display_name, role, staff_id, created_at, last_login
    FROM accounts ORDER BY role DESC, username ASC
  `).all();
  // Les membres ne voient pas les timestamps (created_at, last_login) par souci de confidentialité
  if (req.session.role !== 'admin') {
    res.json(rows.map(r => ({
      id: r.id,
      username: r.username,
      displayName: r.display_name,
      role: r.role,
      staffId: r.staff_id
    })));
  } else {
    res.json(rows.map(publicAccount));
  }
});

router.post('/users', requireAdmin, (req, res) => {
  const { username, password, displayName, role, staffId } = req.body || {};
  if (!username || !password || !displayName) {
    return res.status(400).json({ error: 'missing_fields', message: 'Identifiant, mot de passe et nom affiché requis' });
  }
  if (password.length < 6) {
    return res.status(400).json({ error: 'weak_password' });
  }
  if (!['admin', 'member'].includes(role || 'member')) {
    return res.status(400).json({ error: 'invalid_role' });
  }
  if (getAccountByUsername(username)) {
    return res.status(409).json({ error: 'username_taken', message: 'Identifiant déjà utilisé' });
  }

  const hash = bcrypt.hashSync(password, 10);
  const info = getDb().prepare(`
    INSERT INTO accounts (username, password_hash, role, display_name, staff_id)
    VALUES (?, ?, ?, ?, ?)
  `).run(username.trim(), hash, role || 'member', displayName.trim(), staffId || null);

  logAudit('user_created', 'account', { username: username.trim(), role: role || 'member' });
  res.json(publicAccount(getDb().prepare('SELECT * FROM accounts WHERE id = ?').get(info.lastInsertRowid)));
});

router.put('/users/:id', requireAdmin, (req, res) => {
  const id = Number(req.params.id);
  const account = getDb().prepare('SELECT * FROM accounts WHERE id = ?').get(id);
  if (!account) return res.status(404).json({ error: 'not_found' });

  const { displayName, role, staffId } = req.body || {};

  // Empêcher de retirer le dernier admin
  if (role && role !== 'admin' && account.role === 'admin') {
    const adminCount = getDb().prepare("SELECT COUNT(*) AS n FROM accounts WHERE role = 'admin'").get().n;
    if (adminCount <= 1) {
      return res.status(400).json({ error: 'last_admin', message: 'Au moins un administrateur est requis' });
    }
  }

  getDb().prepare(`
    UPDATE accounts
       SET display_name = COALESCE(?, display_name),
           role         = COALESCE(?, role),
           staff_id     = ?
     WHERE id = ?
  `).run(
    displayName?.trim() || null,
    role || null,
    staffId !== undefined ? staffId : account.staff_id,
    id
  );

  logAudit('user_updated', 'account', { id, username: account.username });
  res.json(publicAccount(getDb().prepare('SELECT * FROM accounts WHERE id = ?').get(id)));
});

router.delete('/users/:id', requireAdmin, (req, res) => {
  const id = Number(req.params.id);
  const account = getDb().prepare('SELECT * FROM accounts WHERE id = ?').get(id);
  if (!account) return res.status(404).json({ error: 'not_found' });

  // Empêcher de supprimer le dernier admin
  if (account.role === 'admin') {
    const adminCount = getDb().prepare("SELECT COUNT(*) AS n FROM accounts WHERE role = 'admin'").get().n;
    if (adminCount <= 1) {
      return res.status(400).json({ error: 'last_admin', message: 'Impossible de supprimer le dernier administrateur' });
    }
  }
  // Empêcher l'auto-suppression
  if (id === req.session.userId) {
    return res.status(400).json({ error: 'self_delete', message: 'Impossible de supprimer son propre compte' });
  }

  getDb().prepare('DELETE FROM accounts WHERE id = ?').run(id);
  logAudit('user_deleted', 'account', { id, username: account.username });
  res.json({ ok: true });
});

router.post('/users/:id/reset-password', requireAdmin, (req, res) => {
  const id = Number(req.params.id);
  const { newPassword } = req.body || {};
  if (!newPassword || newPassword.length < 6) {
    return res.status(400).json({ error: 'weak_password' });
  }
  const account = getDb().prepare('SELECT * FROM accounts WHERE id = ?').get(id);
  if (!account) return res.status(404).json({ error: 'not_found' });

  const hash = bcrypt.hashSync(newPassword, 10);
  getDb().prepare('UPDATE accounts SET password_hash = ? WHERE id = ?').run(hash, id);
  logAudit('password_reset', 'account', { id, username: account.username, by: req.session.username });
  res.json({ ok: true });
});

module.exports = router;
module.exports.requireAuth = requireAuth;
module.exports.requireAdmin = requireAdmin;
