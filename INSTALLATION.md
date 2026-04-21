# Installation Planning Pharmacie

Guide simple pour installer l'application sur les postes de la pharmacie.

---

## 🏥 Schéma général

1 **PC serveur** fait tourner l'application en permanence (un poste de comptoir ou un PC dédié allumé pendant les heures d'ouverture).

Les autres postes (comptoirs, back-office, tablettes) se connectent au PC serveur **via le navigateur** — aucune installation à faire dessus.

```
PC serveur (Planning Pharmacie.exe installé)
       │
       └──── réseau Wi-Fi / Ethernet ────┬─── Comptoir 2 (navigateur)
                                          ├─── Back-office (navigateur)
                                          └─── Tablette titulaire (navigateur)
```

---

## 📥 Installation du PC serveur

### Windows

1. Télécharger `PlanningPharmacie-Setup-X.Y.Z.exe` depuis la page des Releases.
2. Double-cliquer sur l'installateur.
3. **Windows SmartScreen** peut afficher "Windows a protégé votre PC" (l'app n'est pas signée par un éditeur commercial — c'est normal pour une app interne). Cliquer :
   - **Informations complémentaires**
   - **Exécuter quand même**
4. L'assistant d'installation :
   - Accepter la licence
   - Choisir le dossier d'installation (par défaut : `C:\Users\<votre-nom>\AppData\Local\Programs\Planning Pharmacie`)
   - Créer un raccourci bureau (recommandé)
5. Au premier lancement, un écran de bienvenue demande de créer le compte **titulaire** (administrateur). Remplir :
   - **Votre nom** (ex. "Marie Dupont")
   - **Identifiant** (ex. "marie")
   - **Mot de passe** (6 caractères minimum)

### macOS

1. Télécharger `PlanningPharmacie-X.Y.Z-arm64.dmg` (Mac Apple Silicon M1/M2/M3) ou `PlanningPharmacie-X.Y.Z-x64.dmg` (Mac Intel).
2. Double-cliquer sur le .dmg → une fenêtre s'ouvre avec l'icône de l'app et un raccourci vers "Applications".
3. **Glisser-déposer** l'icône sur "Applications".
4. Dans Launchpad, lancer "Planning Pharmacie". **Gatekeeper** peut afficher "Impossible d'ouvrir — développeur non identifié". Alors :
   - Ouvrir le **Finder → Applications**
   - **Clic-droit** sur Planning Pharmacie → **Ouvrir** → **Ouvrir** dans le dialog
   - Cette étape n'est nécessaire qu'au **premier** lancement.
5. Créer le compte titulaire (même étape que sur Windows).

### Linux (bonus — pas encore compilé par défaut, mais faisable)

Ajouter `linux` dans la config `build` de `package.json`. Support `AppImage`, `deb`, `rpm`.

---

## 🔧 Configuration après installation

### Activer le démarrage automatique

L'app est conçue pour tourner en permanence sur le PC serveur.

**Clic-droit sur l'icône système tray** (en bas à droite Windows, en haut à droite macOS) → cocher **Démarrer avec le système**.

Désormais, l'app se lance automatiquement au démarrage du PC, minimisée dans la barre système.

### Récupérer l'adresse réseau pour les autres postes

**Clic-droit sur l'icône tray** → sous-menu **Adresse réseau local** → cliquer sur l'adresse proposée (ex. `http://192.168.1.50:3017`).

L'adresse est copiée dans le presse-papier. Colle-la dans le navigateur des autres postes (Chrome, Firefox, Edge, Safari) et ajoute en favori. Tu peux aussi créer un raccourci bureau sur chaque poste.

---

## 👥 Créer les comptes de l'équipe

Une fois connecté en tant que titulaire :

1. Menu de gauche → **Comptes**
2. Bouton **Nouveau compte**
3. Pour chaque membre de l'équipe :
   - Nom affiché (ex. "Jean Martin")
   - Identifiant (ex. "jean" — simple, pas d'email nécessaire)
   - Mot de passe initial (les membres peuvent le changer ensuite via leur profil)
   - Rôle : **Membre** (par défaut)
   - Éventuellement lier à un employé du planning

Les comptes **membres** peuvent consulter leur planning, cocher leurs tâches, lire/écrire les transmissions. Ils ne peuvent pas modifier les plannings ni gérer les comptes.

---

## 💾 Sauvegardes

L'application effectue **automatiquement une sauvegarde quotidienne** vers 02:00 du fichier de base de données. Les 30 dernières sauvegardes sont conservées.

Emplacement :
- **Windows** : `%APPDATA%\Planning Pharmacie\backups\`
- **macOS** : `~/Library/Application Support/Planning Pharmacie/backups/`

Pour copier les sauvegardes sur une clé USB ou un disque externe, ouvre le dossier via **Clic-droit tray → Ouvrir le dossier des données**.

Tu peux aussi faire un **export JSON manuel** à tout moment depuis l'app (admin → Paramètres → Exporter).

---

## 🆘 Problèmes courants

### "Windows a protégé votre PC" à chaque lancement

C'est un avertissement de SmartScreen. Clique sur **Informations complémentaires** → **Exécuter quand même**. Après quelques lancements, Windows arrête d'afficher le message.

### L'app ne démarre pas / icône disparue

- Vérifie que le PC serveur est allumé
- Cherche "Planning Pharmacie" dans le menu Démarrer / Launchpad et relance
- Si rien ne se passe, consulter le log via le menu tray (ou ouvrir `%APPDATA%\Planning Pharmacie\app.log`)

### Un collègue n'arrive pas à se connecter depuis son poste

- Vérifie que son poste est sur le **même réseau Wi-Fi** que le PC serveur
- Vérifie que l'**adresse IP** donnée est bien la bonne (tray → Adresse réseau local)
- Le pare-feu Windows peut bloquer les connexions entrantes la première fois : autoriser "Planning Pharmacie" dans le dialogue qui s'affiche

### Mot de passe oublié

Si c'est un mot de passe membre : connecte-toi en admin → Comptes → clic sur la clé à côté du compte → nouveau mot de passe.

Si c'est le mot de passe titulaire (admin) : contacte ton informaticien ou exécute le script `reset-password.js` (voir README du projet).

### L'app est lente ou gèle

Quitte l'app complètement (tray → Quitter) et relance-la. Si le problème persiste, redémarre le PC serveur.

---

## ❓ Besoin d'aide

Consulte le **README.md** du projet pour la documentation technique ou ouvre un ticket sur le dépôt GitHub.
