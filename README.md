# Planning Pharmacie

Application desktop Windows / macOS pour officine de pharmacie :
**planning d'équipe avec génération automatique**, **tâches Kanban**,
**transmissions équipe avec accusés de lecture**. Multi-postes, données 100 % en local.

> 🎉 **Projet complet.** Toutes les fonctionnalités sont livrées et packagées en
> installateurs natifs Windows et macOS via GitHub Actions.

## 📦 Installation pour ton équipe

Les utilisateurs finaux n'ont qu'à double-cliquer sur un installateur. Voir **[INSTALLATION.md](./INSTALLATION.md)**.

## 🚀 Pour le propriétaire du projet (toi)

### Première mise en route sur GitHub

1. Créer un dépôt GitHub (privé ou public) depuis `github.com/new`
2. Dans un terminal, à la racine du projet :
   ```bash
   git init
   git add .
   git commit -m "Initial commit"
   git remote add origin https://github.com/TON-COMPTE/planning-pharmacie.git
   git push -u origin main
   ```
3. Déclencher la première compilation : aller dans l'onglet **Actions** du dépôt, sélectionner **Build installers**, cliquer **Run workflow**. GitHub va compiler en parallèle une version Windows et une version macOS en ~10 minutes.
4. Les installateurs sont téléchargeables depuis l'onglet Artifacts de chaque run.

### Publier une nouvelle version (release)

```bash
# Bumper la version dans package.json (ex. 1.0.0 → 1.0.1)
npm version patch    # ou minor, ou major
git push --follow-tags
```

Un tag `v1.0.1` est créé, GitHub Actions compile, et **publie automatiquement une Release** sur GitHub avec les deux installateurs attachés. Tu n'as plus qu'à partager le lien de la Release avec ton équipe.

### Test en local (mode dev)

```bash
npm install            # installation des dépendances (3-5 min)
npm run server         # terminal 1 : backend
npm run client:dev     # terminal 2 : front Vite
```

Ou tout en un :
```bash
npm install
npm run client:build   # build du front
npm run electron:start # lance Electron qui boote serveur + client
```

### Arborescence finale

```
planning-pharmacie/
├── electron/               Wrapper Electron (main + tray + IPC)
│   └── main.js
├── server/                 Backend Node.js + Express + SQLite
│   ├── index.js, db.js, backup.js
│   └── routes/             auth, staff, leaves, plannings, tasks, transmissions...
├── client/                 Front React + Vite + Tailwind
│   ├── index.html
│   └── src/
│       ├── App.jsx, api.js, auth.jsx, ui.jsx, ...
│       ├── screens.jsx     Écrans du planning
│       ├── tasks/          Module Tâches (Kanban)
│       └── transmissions/  Module Transmissions
├── assets/                 Icônes (PNG, ICO, ICNS générés)
├── scripts/
│   └── reset-password.js   Outil de secours (mot de passe oublié)
├── .github/workflows/
│   └── build.yml           CI : compile Win + Mac
├── package.json            Config + deps + electron-builder
├── vite.config.js
├── tailwind.config.js
├── LICENSE.txt
├── README.md               ← vous êtes ici
└── INSTALLATION.md         Guide pour l'équipe
```

## ✅ Fonctionnalités (récap)

**Planning d'équipe**
- Personnel avec rôles (pharmacien, préparateur, logistique, alternant)
- Contraintes individuelles (OFF fixes / variables, dispos par jour, demi-journées, incompatibilités)
- Contrats avec heures cibles semaine paire / impaire
- Rotation samedi (équipe 1 / équipe 2)
- Génération automatique 2-phases (étale sur toute la semaine)
- Minima d'effectif par tranche de 30 min
- 5 types d'alertes (pas de pharmacien, sous-effectif, conflit...)
- Congés avec compteur CP restants
- Équité (heures, samedis, ouvertures, fermetures)
- Vue murale imprimable

**Tâches Kanban**
- Tableaux illimités, colonnes personnalisables, drag & drop
- Cartes : priorité, échéance, étiquettes, assignations multiples, checklist, commentaires
- Auto-complétion quand déposé dans colonne "Terminé"
- 8 modèles préfaits officine (routine, commandes, formations, AQ…)
- Vues rapides : Mes tâches, Aujourd'hui, En retard

**Transmissions équipe**
- Fil de notes avec titre, contenu, catégorie, important
- Accusés de lecture : qui a lu, quand, et qui n'a pas lu
- Commentaires thread
- Épinglage (admin), recherche plein texte, filtres
- Badge de notifications dans la sidebar (rafraîchissement toutes les 30s)

**Comptes & rôles**
- Compte titulaire (admin) au premier démarrage
- Comptes membres illimités
- Mot de passe individuel (bcrypt) + réinitialisation admin
- Droits différenciés admin / membre partout

**Technique**
- Données SQLite 100 % locales
- Sauvegardes automatiques quotidiennes (30 jours conservés)
- Export / import JSON portable
- Journal d'audit complet
- Serveur LAN accessible multi-postes
- Icône system tray avec menu contextuel (adresse réseau à copier, autostart, logs)

## 🔒 Sécurité et conformité

- **Données 100 % locales**, aucun cloud, aucune donnée ne quitte le PC serveur
- Mots de passe **hashés bcrypt** (10 rounds)
- Sessions **httpOnly** avec expiration 2h
- Aucun traitement de données patients ou données de santé
- **RGPD** : tu es responsable de traitement, mais les données restent dans tes locaux

## 🆘 Dépannage

**Mot de passe admin oublié** :
```bash
node scripts/reset-password.js --list                    # voir les comptes
node scripts/reset-password.js <username> <nouveau-mdp>  # réinitialiser
```
À exécuter directement sur le PC serveur (nécessite Node.js installé ou l'app en mode dev).

**Sauvegarde manuelle d'urgence** : copier le fichier `pharmacy.db` depuis le dossier de données (menu tray → "Ouvrir le dossier des données").

**Windows SmartScreen au premier lancement** : cliquer "Informations complémentaires" → "Exécuter quand même" (l'app n'est pas signée par un éditeur commercial, voir INSTALLATION.md).

**macOS Gatekeeper** : clic-droit sur le .dmg → "Ouvrir" → "Ouvrir" dans le dialog (même raison).

**Serveur qui ne démarre pas** : consulter le log via le menu tray → "Voir le journal".
