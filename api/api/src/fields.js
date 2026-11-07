/**
 * COLUMN MAPPING — matches your "tenders" table in the marches_publics database.
 *
 * Left side  = the name the API (and the mobile app) uses.
 * Right side = the column name in YOUR table, or null if the table has no such
 *              column (the API then returns null and the app hides that item).
 *              At startup the API checks the table: a column named here that
 *              doesn't exist is treated as null (a warning is logged), so adding
 *              a name before the scraper fills it never breaks the API.
 */
export const CONSULTATION_FIELDS = {
  id: 'id', // primary key
  reference: 'reference',
  objet: 'objet',
  acheteur: 'acheteur',
  lieuExecution: 'lieux',
  region: null, // no region column: the Région filter is hidden
  categorie: 'categorie', // "Travaux" | "Fournitures" | "Services"
  procedure: 'procedure',
  datePublication: 'date_publication',
  dateLimite: 'date_limite', // date limite de remise des plis
  dateOuverturePlis: null,
  visiteLieux: null,
  estimation: 'estimation_ttc_dh', // MAD TTC, filled by the scraper
  cautionProvisoire: 'caution_provisoire_dh', // MAD; ignored automatically if the column doesn't exist yet
  reservePME: null,
  documents: null,
  urlPortail: 'url', // link to the tender on marchespublics.gov.ma
};

/**
 * Optional PostgreSQL full-text column (tsvector) used to speed up search.
 * Search also matches partial words and accents, so null works fine too.
 */
export const CONSULTATION_SEARCH_VECTOR = 'search_vector';
export const SEARCH_LANGUAGE = 'french'; // text-search configuration used to build search_vector

/**
 * Award results. Your database has no attributions table yet, so ATTRIBUTIONS_TABLE
 * is left empty in .env and the Attributions tab shows an empty list. If you add
 * such a table later, set its name in .env and adjust the column names here.
 */
export const ATTRIBUTION_FIELDS = {
  id: 'id',
  consultationId: 'consultation_id',
  reference: 'reference',
  objet: 'objet',
  acheteur: 'acheteur',
  categorie: 'categorie',
  statut: 'statut', // "attribue" | "infructueux"
  attributaire: 'attributaire',
  montant: 'montant',
  nombreOffres: 'nombre_offres',
  dateAttribution: 'date_attribution',
  pvUrl: 'pv_url',
};
