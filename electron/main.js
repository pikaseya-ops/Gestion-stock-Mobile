/**
 * Processus principal Electron.
 *
 * Responsabilités :
 *  - Démarrer le serveur Express interne (sur un port libre détecté automatiquement)
 *  - Pointer le dossier de données vers le userData d'Electron (persistance cross-session)
 *  - Créer la fenêtre principale qui charge le front
 *  - Créer une icône système tray avec menu contextuel
 *  - Gérer le démarrage automatique au boot du système (via paramètre utilisateur)
 *  - Gérer les mises à jour silencieuses (future extension)
 *
 * Architecture :
 *  - Ce processus lance `server/index.js` en tant que child process
 *  - Le serveur écoute sur 0.0.0.0:<port> pour être accessible en LAN
 *  - La fenêtre Electron affiche simplement http://localhost:<port>
 */

const { app, BrowserWindow, Tray, Menu, shell, nativeImage, dialog, clipboard } = require('electron');
const path = require('path');
const fs = require('fs');
const { fork } = require('child_process');
const net = require('net');
const os = require('os');

// --- Single instance lock -------------------------------------------
// Empêche de lancer plusieurs instances. Si on essaie, on focus la fenêtre existante.
const gotTheLock = app.requestSingleInstanceLock();
if (!gotTheLock) {
  app.quit();
  process.exit(0);
}

// --- Variables globales --------------------------------------------
let mainWindow = null;
let tray = null;
let serverProcess = null;
let serverPort = null;
let serverReady = false;
let isQuitting = false;

// --- Dossier userData : persistance des données -------------------
const USER_DATA_DIR = app.getPath('userData');
if (!fs.existsSync(USER_DATA_DIR)) fs.mkdirSync(USER_DATA_DIR, { recursive: true });

// Log vers un fichier (utile pour débogage en production)
const LOG_FILE = path.join(USER_DATA_DIR, 'app.log');
function log(...args) {
  const line = `[${new Date().toISOString()}] ${args.map(String).join(' ')}`;
  console.log(line);
  try { fs.appendFileSync(LOG_FILE, line + '\n'); } catch {}
}

log('========================================');
log('Planning Pharmacie — démarrage');
log(`Version : ${app.getVersion()}`);
log(`userData : ${USER_DATA_DIR}`);
log(`Plateforme : ${process.platform} ${process.arch}`);

// --- Détection d'un port libre -----------------------------------
function findFreePort(preferredPort = 3017) {
  return new Promise((resolve) => {
    const server = net.createServer();
    server.unref();
    server.on('error', () => {
      // Port occupé, essaie le suivant
      findFreePort(preferredPort + 1).then(resolve);
    });
    server.listen(preferredPort, '0.0.0.0', () => {
      const port = server.address().port;
      server.close(() => resolve(port));
    });
  });
}

// --- Lancement du serveur Express en child process ---------------
async function startServer() {
  serverPort = await findFreePort(3017);
  log(`Port sélectionné : ${serverPort}`);

  const serverScript = path.join(__dirname, '..', 'server', 'index.js');
  log(`Script serveur : ${serverScript}`);

  return new Promise((resolve, reject) => {
    serverProcess = fork(serverScript, [], {
      env: {
        ...process.env,
        PORT: String(serverPort),
        PHARM_DATA_DIR: USER_DATA_DIR,
        ELECTRON_USER_DATA: USER_DATA_DIR,
        NODE_ENV: 'production'
      },
      stdio: ['pipe', 'pipe', 'pipe', 'ipc']
    });

    serverProcess.stdout?.on('data', (data) => log('[server]', data.toString().trim()));
    serverProcess.stderr?.on('data', (data) => log('[server-err]', data.toString().trim()));

    serverProcess.on('error', (err) => {
      log('Erreur serveur :', err.message);
      reject(err);
    });

    serverProcess.on('exit', (code) => {
      log(`Serveur arrêté (code ${code})`);
      if (!isQuitting) {
        // Le serveur a crashé — on prévient l'utilisateur
        dialog.showErrorBox(
          'Serveur arrêté',
          `Le serveur interne s'est arrêté de manière inattendue (code ${code}).\n\nL'application va se fermer. Vous pouvez consulter le fichier de logs :\n${LOG_FILE}`
        );
        app.quit();
      }
    });

    // Attendre que le serveur réponde (polling simple)
    const checkInterval = setInterval(async () => {
      try {
        const res = await fetch(`http://127.0.0.1:${serverPort}/api/health`);
        if (res.ok) {
          clearInterval(checkInterval);
          serverReady = true;
          log('Serveur prêt !');
          resolve();
        }
      } catch {
        // Pas encore prêt
      }
    }, 200);

    // Timeout de 20 s
    setTimeout(() => {
      if (!serverReady) {
        clearInterval(checkInterval);
        reject(new Error('Timeout : serveur non prêt après 20 secondes'));
      }
    }, 20000);
  });
}

// --- Fenêtre principale ------------------------------------------
function createMainWindow() {
  // Charge les settings persistés (position, taille)
  const settings = loadWindowSettings();

  mainWindow = new BrowserWindow({
    width: settings.width || 1280,
    height: settings.height || 800,
    x: settings.x,
    y: settings.y,
    minWidth: 900,
    minHeight: 600,
    title: 'Planning Pharmacie',
    icon: getIconPath(),
    autoHideMenuBar: true,
    backgroundColor: '#f8fafc',
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
      webSecurity: true
    },
    show: false // On affiche seulement quand c'est prêt
  });

  // Sauvegarde position/taille à chaque changement
  const saveDebounced = debounce(() => saveWindowSettings(mainWindow), 500);
  mainWindow.on('resize', saveDebounced);
  mainWindow.on('move', saveDebounced);

  mainWindow.once('ready-to-show', () => {
    if (settings.maximized) mainWindow.maximize();
    mainWindow.show();
  });

  mainWindow.loadURL(`http://127.0.0.1:${serverPort}`);

  // Les liens externes (cible _blank) s'ouvrent dans le navigateur par défaut
  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    shell.openExternal(url);
    return { action: 'deny' };
  });

  // Pas de menu système par défaut (on le cache) sauf sur macOS où c'est attendu
  if (process.platform !== 'darwin') {
    mainWindow.setMenu(null);
  }

  // Fermeture → minimise dans le tray plutôt que de quitter
  mainWindow.on('close', (e) => {
    if (!isQuitting) {
      e.preventDefault();
      mainWindow.hide();
      // Notification discrète au premier masquage
      if (!global.__trayNotified) {
        global.__trayNotified = true;
        if (tray) {
          tray.displayBalloon?.({
            title: 'Planning Pharmacie',
            content: "L'application continue de tourner dans la barre système. Clic-droit sur l'icône pour quitter.",
            iconType: 'info'
          });
        }
      }
    }
  });
}

function loadWindowSettings() {
  try {
    const p = path.join(USER_DATA_DIR, 'window.json');
    if (fs.existsSync(p)) return JSON.parse(fs.readFileSync(p, 'utf-8'));
  } catch {}
  return {};
}
function saveWindowSettings(win) {
  try {
    const bounds = win.getBounds();
    const data = { ...bounds, maximized: win.isMaximized() };
    fs.writeFileSync(path.join(USER_DATA_DIR, 'window.json'), JSON.stringify(data));
  } catch {}
}
function debounce(fn, ms) {
  let t; return (...args) => { clearTimeout(t); t = setTimeout(() => fn(...args), ms); };
}

// --- Icône / tray -------------------------------------------------
function getIconPath() {
  const resourcesPath = process.resourcesPath || path.join(__dirname, '..');
  const candidates = [
    path.join(resourcesPath, 'assets', 'icon.png'),
    path.join(__dirname, '..', 'assets', 'icon.png'),
    path.join(__dirname, '..', 'assets', 'icon.ico')
  ];
  for (const c of candidates) {
    if (fs.existsSync(c)) return c;
  }
  return null;
}

function createTray() {
  const iconPath = getIconPath();
  const icon = iconPath ? nativeImage.createFromPath(iconPath) : nativeImage.createEmpty();
  // Resize pour tray (macOS préfère 16px, Windows 16/32)
  const trayIcon = icon.isEmpty() ? icon : icon.resize({ width: 16, height: 16 });

  tray = new Tray(trayIcon);
  tray.setToolTip('Planning Pharmacie');
  updateTrayMenu();

  // Clic simple → ouvrir/cacher la fenêtre
  tray.on('click', () => {
    if (mainWindow) {
      if (mainWindow.isVisible()) {
        mainWindow.hide();
      } else {
        mainWindow.show();
        mainWindow.focus();
      }
    }
  });
}

function updateTrayMenu() {
  const lanAddresses = getLanAddresses();
  const template = [
    {
      label: 'Ouvrir l\'application',
      click: () => {
        if (mainWindow) {
          mainWindow.show();
          mainWindow.focus();
        }
      }
    },
    { type: 'separator' },
    {
      label: 'Adresse réseau local',
      submenu: lanAddresses.length > 0
        ? lanAddresses.map(addr => ({
            label: `http://${addr}:${serverPort}`,
            click: () => {
              clipboard.writeText(`http://${addr}:${serverPort}`);
              if (tray) {
                tray.displayBalloon?.({
                  title: 'Copié !',
                  content: `L'adresse a été copiée dans le presse-papier. Vos collègues peuvent maintenant se connecter depuis leur poste à http://${addr}:${serverPort}`,
                  iconType: 'info'
                });
              }
            }
          }))
        : [{ label: 'Aucune adresse réseau disponible', enabled: false }]
    },
    {
      label: 'Ouvrir le dossier des données',
      click: () => shell.openPath(USER_DATA_DIR)
    },
    {
      label: 'Voir le journal',
      click: () => shell.openPath(LOG_FILE)
    },
    { type: 'separator' },
    {
      label: 'Démarrer avec le système',
      type: 'checkbox',
      checked: app.getLoginItemSettings().openAtLogin,
      click: (item) => {
        app.setLoginItemSettings({
          openAtLogin: item.checked,
          openAsHidden: true
        });
      }
    },
    { type: 'separator' },
    {
      label: `Version ${app.getVersion()}`,
      enabled: false
    },
    {
      label: 'Quitter',
      click: () => {
        isQuitting = true;
        app.quit();
      }
    }
  ];
  tray.setContextMenu(Menu.buildFromTemplate(template));
}

// --- Utilitaires réseau ------------------------------------------
function getLanAddresses() {
  const nets = os.networkInterfaces();
  const out = [];
  for (const name of Object.keys(nets)) {
    for (const n of nets[name]) {
      if (n.family === 'IPv4' && !n.internal) {
        out.push(n.address);
      }
    }
  }
  return out;
}

// --- Cycle de vie app --------------------------------------------

// Lors d'une seconde tentative de lancement : on focus la fenêtre existante
app.on('second-instance', () => {
  if (mainWindow) {
    if (mainWindow.isMinimized()) mainWindow.restore();
    if (!mainWindow.isVisible()) mainWindow.show();
    mainWindow.focus();
  }
});

app.whenReady().then(async () => {
  try {
    await startServer();
    createMainWindow();
    createTray();
  } catch (err) {
    log('Erreur au démarrage :', err.message);
    dialog.showErrorBox(
      'Erreur au démarrage',
      `Impossible de démarrer le serveur interne.\n\n${err.message}\n\nLog : ${LOG_FILE}`
    );
    app.quit();
  }
});

app.on('window-all-closed', () => {
  // Sur macOS : on garde l'app active via le tray
  // Sur Windows/Linux : pareil (le tray évite la fermeture automatique)
  // On ne quitte que quand l'utilisateur clique explicitement "Quitter"
});

app.on('activate', () => {
  // macOS : clic sur l'icône du dock
  if (BrowserWindow.getAllWindows().length === 0) {
    createMainWindow();
  } else if (mainWindow) {
    mainWindow.show();
    mainWindow.focus();
  }
});

app.on('before-quit', () => {
  isQuitting = true;
});

app.on('will-quit', () => {
  // Arrêt propre du serveur
  if (serverProcess) {
    log('Arrêt du serveur...');
    try { serverProcess.kill('SIGTERM'); } catch {}
  }
});
