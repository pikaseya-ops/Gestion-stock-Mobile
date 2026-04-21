const { buildSingletonRouter } = require('./_singleton');

const DEFAULT_SETTINGS = {
  pharmacyName: 'Ma Pharmacie',
  openingHours: {
    0: null,
    1: { start: '09:00', end: '19:00' },
    2: { start: '08:30', end: '19:00' },
    3: { start: '08:30', end: '19:00' },
    4: { start: '08:30', end: '19:00' },
    5: { start: '08:30', end: '19:00' },
    6: { start: '08:30', end: '19:00' }
  },
  defaultMinPharmacist: 1,
  defaultMinCounter: 2,
  defaultMinTotal: 3,
  slotDuration: 30,
  cpPerYear: 25
};

module.exports = buildSingletonRouter('pharm:settings', 'settings', DEFAULT_SETTINGS);
