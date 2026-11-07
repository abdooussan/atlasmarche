// Creates the two tables (if they don't exist) and inserts SAMPLE data, so you
// can try the app before your real data is ready.
// It does nothing if the tables already contain rows, so your data is safe.
// It uses the column names from src/fields.js.
import { close, connect, ident, pool, tableNames } from './db.js';
import { ATTRIBUTION_FIELDS as A, CONSULTATION_FIELDS as C } from './fields.js';

await connect();

const cTable = ident(tableNames.consultations);
const aTable = ident(tableNames.attributions || 'attributions');

const TYPES_C = {
  id: 'SERIAL PRIMARY KEY', reference: 'TEXT', objet: 'TEXT', acheteur: 'TEXT', lieuExecution: 'TEXT',
  region: 'TEXT', categorie: 'TEXT', procedure: 'TEXT', datePublication: 'TIMESTAMPTZ',
  dateLimite: 'TIMESTAMPTZ', dateOuverturePlis: 'TIMESTAMPTZ', visiteLieux: 'TIMESTAMPTZ',
  estimation: 'NUMERIC', cautionProvisoire: 'NUMERIC', reservePME: 'BOOLEAN DEFAULT false',
  documents: 'JSONB', urlPortail: 'TEXT',
};
const TYPES_A = {
  id: 'SERIAL PRIMARY KEY', consultationId: 'INTEGER', reference: 'TEXT', objet: 'TEXT', acheteur: 'TEXT',
  categorie: 'TEXT', statut: 'TEXT', attributaire: 'TEXT', montant: 'NUMERIC', nombreOffres: 'INTEGER',
  dateAttribution: 'TIMESTAMPTZ', pvUrl: 'TEXT',
};
const columnsDef = (fields, types) =>
  Object.entries(fields).filter(([, c]) => c).map(([k, c]) => `${ident(c)} ${types[k]}`).join(', ');

await pool.query(`CREATE TABLE IF NOT EXISTS ${cTable} (${columnsDef(C, TYPES_C)})`);
await pool.query(`CREATE TABLE IF NOT EXISTS ${aTable} (${columnsDef(A, TYPES_A)})`);

const [{ rows: rc }, { rows: ra }] = await Promise.all([
  pool.query(`SELECT count(*)::int AS n FROM ${cTable}`),
  pool.query(`SELECT count(*)::int AS n FROM ${aTable}`),
]);
if (rc[0].n > 0 || ra[0].n > 0) {
  console.log('Tables already contain data — seed skipped (your data is untouched).');
  await close();
  process.exit(0);
}

/** Insert one row using only the columns that exist in the mapping. */
async function insert(table, fields, row) {
  const keys = Object.keys(row).filter((k) => fields[k] && k !== 'id');
  const cols = keys.map((k) => ident(fields[k])).join(', ');
  const vals = keys.map((_, i) => `$${i + 1}`).join(', ');
  const params = keys.map((k) => (k === 'documents' && row[k] ? JSON.stringify(row[k]) : row[k]));
  const { rows } = await pool.query(`INSERT INTO ${table} (${cols}) VALUES (${vals}) RETURNING ${ident(fields.id)} AS id`, params);
  return rows[0].id;
}

const day = 86_400_000;
const inDays = (n) => {
  const d = new Date(Date.now() + n * day);
  d.setHours(10, 0, 0, 0);
  return d;
};

const buyers = [
  ['Commune de Casablanca', 'Casablanca', 'Casablanca-Settat'],
  ['Province de Settat', 'Settat', 'Casablanca-Settat'],
  ["Direction régionale de l'Équipement", 'Rabat', 'Rabat-Salé-Kénitra'],
  ['Académie régionale (AREF)', 'Marrakech', 'Marrakech-Safi'],
  ['Office régional de mise en valeur agricole', 'Agadir', 'Souss-Massa'],
  ['Délégation provinciale de la Santé', 'Fès', 'Fès-Meknès'],
];
const subjects = {
  Travaux: ["Travaux d'aménagement de la voirie urbaine", 'Réhabilitation des pistes rurales', "Construction d'un centre de santé de proximité", "Travaux d'assainissement liquide"],
  Fournitures: ['Acquisition de matériel informatique', 'Fourniture de mobilier scolaire', 'Acquisition de produits pharmaceutiques', 'Fourniture de carburant et lubrifiants'],
  Services: ['Gardiennage et surveillance des locaux', 'Nettoyage des bâtiments administratifs', 'Étude technique et suivi des travaux', 'Maintenance des équipements de climatisation'],
};
const procedures = ['AO ouvert', 'AO ouvert', 'AO restreint', 'Concours', 'Bon de commande'];

let n = 1;
let closedCount = 0;
for (const [categorie, list] of Object.entries(subjects)) {
  for (let i = 0; i < 12; i++, n++) {
    const [acheteur, ville, region] = buyers[(n + i) % buyers.length];
    const offset = ((n * 3) % 40) - 8;
    const estimation = Math.round((50_000 + ((n * 7919) % 50) * 120_000) / 1000) * 1000;
    const row = {
      reference: `${String(n).padStart(2, '0')}/2026/${categorie.slice(0, 2).toUpperCase()}`,
      objet: `${list[i % list.length]} — lot ${1 + (i % 3)}`,
      acheteur, lieuExecution: ville, region, categorie,
      procedure: procedures[n % procedures.length],
      datePublication: inDays(offset - 21), dateLimite: inDays(offset), dateOuverturePlis: inDays(offset),
      visiteLieux: categorie === 'Travaux' ? inDays(offset - 10) : null,
      estimation, cautionProvisoire: Math.round(estimation * 0.015), reservePME: n % 3 === 0,
      documents: [
        { nom: 'Dossier de consultation (DCE)', url: 'https://www.marchespublics.gov.ma/', taille: '' },
        { nom: "Avis d'appel d'offres", url: 'https://www.marchespublics.gov.ma/', taille: '' },
      ],
      urlPortail: 'https://www.marchespublics.gov.ma/pmmp/',
    };
    const id = await insert(cTable, C, row);

    if (offset < 0) {
      const ko = closedCount % 4 === 3;
      await insert(aTable, A, {
        consultationId: Number(id), reference: row.reference, objet: row.objet, acheteur, categorie,
        statut: ko ? 'infructueux' : 'attribue',
        attributaire: ko ? null : `Société exemple ${closedCount + 1} SARL`,
        montant: ko ? null : Math.round(estimation * 0.92),
        nombreOffres: 2 + (closedCount % 6),
        dateAttribution: new Date(row.dateLimite.getTime() + 5 * day),
        pvUrl: 'https://www.marchespublics.gov.ma/pmmp/',
      });
      closedCount++;
    }
  }
}

console.log(`Inserted ${n - 1} consultations and ${closedCount} attributions (sample data).`);
await close();
