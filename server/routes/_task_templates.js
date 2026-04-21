/**
 * Modèles de tableaux Kanban préfaits pour officine.
 * Inspirés des modèles Bakofi mais entièrement réécrits.
 */

const OFFICINE_TEMPLATES = [
  {
    key: 'routine',
    title: 'Routine officinale',
    description: 'Tâches récurrentes du quotidien : ouverture, fermeture, frigos, contrôles de température, ménage.',
    icon: 'CalendarCheck',
    color: 'emerald',
    columns: [
      { key: 'todo', title: 'À faire',   color: 'slate' },
      { key: 'doing', title: 'En cours', color: 'amber' },
      { key: 'done', title: 'Terminé',   color: 'emerald', done: true }
    ],
    tasks: [
      { column: 'todo', title: 'Ouverture officine', priority: 'high',
        description: 'Procédure d\'ouverture matinale.',
        labels: ['Quotidien', 'Matin'],
        checklist: [
          'Allumer enseigne et vitrine',
          'Démarrer postes de comptoir',
          'Vérifier caisses (fond de caisse)',
          'Relever températures frigo',
          'Consulter mails et fax',
          'Vérifier les commandes du jour'
        ]
      },
      { column: 'todo', title: 'Fermeture officine', priority: 'high',
        description: 'Procédure de fermeture du soir.',
        labels: ['Quotidien', 'Soir'],
        checklist: [
          'Compter les caisses',
          'Faire le Z des caisses',
          'Sauvegarde LGO',
          'Relever températures frigo',
          'Éteindre postes',
          'Activer alarme et fermer'
        ]
      },
      { column: 'todo', title: 'Contrôle température frigo', priority: 'normal',
        description: 'Relever et noter les températures matin et soir.',
        labels: ['Quotidien', 'Qualité'],
        checklist: ['Relevé matin', 'Relevé soir', 'Noter dans le registre']
      },
      { column: 'todo', title: 'Vérification stock chambre froide', priority: 'normal',
        labels: ['Hebdomadaire'],
        checklist: ['Inventaire visuel', 'Repérer périmés', 'Réorganiser si besoin']
      },
      { column: 'todo', title: 'Contrôle des dates de péremption', priority: 'normal',
        labels: ['Mensuel'],
        description: 'Faire le tour des rayons et tiroirs.',
        checklist: ['Rayon avant', 'Tiroirs', 'Réserve', 'Frigo', 'Commander remplacements si besoin']
      },
      { column: 'todo', title: 'Ménage espace de vente', priority: 'normal',
        labels: ['Quotidien'],
        checklist: ['Comptoirs', 'Vitrines', 'Sol', 'Sanitaires']
      }
    ]
  },

  {
    key: 'commandes',
    title: 'Commandes labos',
    description: 'Suivi des commandes auprès des laboratoires : passées, en attente, livrées.',
    icon: 'Truck',
    color: 'sky',
    columns: [
      { key: 'aprep', title: 'À préparer',   color: 'slate' },
      { key: 'envoyee', title: 'Envoyée',    color: 'sky' },
      { key: 'attente', title: 'En attente', color: 'amber' },
      { key: 'recue', title: 'Reçue',        color: 'emerald', done: true },
      { key: 'litige', title: 'Litige',      color: 'rose' }
    ],
    tasks: [
      { column: 'aprep', title: 'Exemple : Commande Pierre Fabre',
        description: 'Modifier ce modèle avec votre vraie commande.',
        labels: ['Direct labo'],
        checklist: ['Préparer le bon de commande', 'Valider quantités', 'Envoyer au labo'] }
    ]
  },

  {
    key: 'formations',
    title: 'Formations équipe',
    description: 'Planification et suivi des formations DPC, e-learning, journées labo.',
    icon: 'GraduationCap',
    color: 'violet',
    columns: [
      { key: 'aplanifier', title: 'À planifier', color: 'slate' },
      { key: 'inscrit', title: 'Inscrit(s)',     color: 'sky' },
      { key: 'enrcours', title: 'En cours',      color: 'amber' },
      { key: 'termine', title: 'Terminée',       color: 'emerald', done: true }
    ],
    tasks: [
      { column: 'aplanifier', title: 'Exemple : Formation observance traitements chroniques',
        description: 'Module DPC à planifier pour l\'équipe.',
        labels: ['DPC'],
        checklist: ['Choisir l\'organisme', 'Inscrire les participants', 'Réserver date'] }
    ]
  },

  {
    key: 'aq',
    title: 'AQ / Anomalies',
    description: 'Assurance qualité : signalement, traitement et suivi des anomalies (réception, délivrance, matériel).',
    icon: 'AlertTriangle',
    color: 'rose',
    columns: [
      { key: 'signale', title: 'Signalée',      color: 'rose' },
      { key: 'analyse', title: 'En analyse',    color: 'amber' },
      { key: 'action', title: 'Action en cours', color: 'sky' },
      { key: 'resolu', title: 'Résolue',         color: 'emerald', done: true }
    ],
    tasks: [
      { column: 'signale', title: 'Exemple : Erreur de délivrance',
        description: 'Décrire l\'incident, la date, la personne concernée, l\'action immédiate prise.',
        priority: 'high',
        labels: ['Délivrance'],
        checklist: [
          'Décrire l\'incident', 'Identifier cause racine',
          'Mesure corrective immédiate', 'Action préventive', 'Information équipe'
        ] }
    ]
  },

  {
    key: 'challenges',
    title: 'Challenges labos',
    description: 'Suivi des objectifs commerciaux et challenges des laboratoires.',
    icon: 'Trophy',
    color: 'amber',
    columns: [
      { key: 'aniti', title: 'À initier',     color: 'slate' },
      { key: 'cours', title: 'En cours',      color: 'amber' },
      { key: 'atteint', title: 'Atteint',     color: 'emerald', done: true },
      { key: 'manque', title: 'Manqué',       color: 'rose' }
    ],
    tasks: []
  },

  {
    key: 'merch',
    title: 'Promo & Merch',
    description: 'Opérations promotionnelles, mises en avant vitrine, opérations saisonnières.',
    icon: 'Tag',
    color: 'pink',
    columns: [
      { key: 'idee', title: 'Idée',           color: 'slate' },
      { key: 'prep', title: 'En préparation', color: 'amber' },
      { key: 'live', title: 'En vitrine',     color: 'sky' },
      { key: 'fini', title: 'Terminée',       color: 'emerald', done: true }
    ],
    tasks: []
  },

  {
    key: 'tachespriori',
    title: 'Tâches prioritaires',
    description: 'Tâches urgentes à traiter rapidement, transverses à toute l\'équipe.',
    icon: 'Flame',
    color: 'rose',
    columns: [
      { key: 'todo', title: 'À faire',   color: 'rose' },
      { key: 'doing', title: 'En cours', color: 'amber' },
      { key: 'done', title: 'Fait',      color: 'emerald', done: true }
    ],
    tasks: []
  },

  {
    key: 'vierge',
    title: 'Tableau vierge',
    description: 'Trois colonnes simples : À faire, En cours, Terminé. Pour démarrer de zéro.',
    icon: 'Layout',
    color: 'slate',
    columns: [
      { key: 'todo', title: 'À faire',   color: 'slate' },
      { key: 'doing', title: 'En cours', color: 'amber' },
      { key: 'done', title: 'Terminé',   color: 'emerald', done: true }
    ],
    tasks: []
  }
];

module.exports = { OFFICINE_TEMPLATES };
