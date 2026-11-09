// Shapes returned by the API (see api/src/fields.js). Dates arrive as ISO strings.

export type DocumentLink = { nom: string; url: string; taille?: string };

/**
 * State of a tender's documents on the server:
 *   ready = files are there, idle = not downloaded yet, pending = being downloaded,
 *   failed = last try failed, none = the portal has no documents, unavailable = download service down.
 */
export type FilesStatus = 'ready' | 'idle' | 'pending' | 'failed' | 'none' | 'unavailable';

/** Files of a tender, from files-api (/opt/marches/dce/<id> on the server). */
export type TenderFiles = {
  id: string;
  count: number;
  zipUrl: string | null;
  files: DocumentLink[];
  status?: FilesStatus;
  message?: string;
};

/** Answer of POST /files/:id/fetch. */
export type FetchFilesResult = { status: FilesStatus; message?: string };

export type Consultation = {
  id: string;
  reference: string | null;
  objet: string | null;
  acheteur: string | null;
  lieuExecution: string | null;
  region: string | null;
  categorie: string | null;
  procedure: string | null;
  datePublication?: string | null;
  dateLimite: string | null;
  dateOuverturePlis?: string | null;
  visiteLieux?: string | null;
  estimation: number | null;
  cautionProvisoire?: number | null;
  reservePME: boolean | null;
  documents?: DocumentLink[] | null;
  urlPortail?: string | null;
};

export type Attribution = {
  id: string;
  consultationId: string | null;
  reference: string | null;
  objet: string | null;
  acheteur: string | null;
  categorie: string | null;
  statut: 'attribue' | 'infructueux' | null;
  attributaire: string | null;
  montant: number | null;
  nombreOffres: number | null;
  dateAttribution: string | null;
  pvUrl: string | null;
};

export type Page<T> = { items: T[]; total: number; page: number; pages: number };

export type Meta = {
  regions: string[];
  procedures: string[];
  ouvertesParCategorie: Record<string, number>;
  capabilities?: {
    region: boolean;
    pme: boolean;
    estimation: boolean;
    attributions: boolean;
  };
};

export type Sort = 'dateLimite' | 'recent' | 'estimation';
export type Echeance = 'toutes' | '7j' | '30j';

export type Filters = {
  q: string;
  categories: string[];
  procedures: string[];
  region: string | null;
  acheteur: string;
  statut: 'en_cours' | 'cloturee' | 'toutes';
  pme: boolean;
  echeance: Echeance;
  minEstimation: string;
  maxEstimation: string;
  sort: Sort;
};
/** Signed-in account (from /api/auth). */
export type User = { id: string; email: string; name: string; createdAt: string };
export type AuthResult = { token: string; user: User };
