// ═══════════════════════════════════════════════════════════════
// Imports Excel (mig 042) : les colonnes des trois modèles.
//
// UNE seule définition sert au modèle téléchargeable, à la lecture du
// fichier déposé et à l'aperçu : un en-tête renommé ici l'est partout.
// Obligatoire (décision 14/11) : produit = nom + prix de vente ;
// client = nom ; fournisseur = nom. Tout le reste est facultatif.
// ═══════════════════════════════════════════════════════════════

export const TYPES_IMPORT = ['produits', 'clients', 'fournisseurs'] as const
export type TypeImport = typeof TYPES_IMPORT[number]

export const LIBELLES_IMPORT: Record<TypeImport, string> = {
    produits:     'Produits et stock d\'ouverture',
    clients:      'Clients et créances',
    fournisseurs: 'Fournisseurs et dettes',
}

export type GenreColonne = 'texte' | 'nombre' | 'ouinon' | 'entrepot'

export interface Colonne {
    cle:          string
    titre:        string
    obligatoire?: boolean
    genre:        GenreColonne
    largeur:      number
    aide:         string
    exemple:      string | number
    /** Autres intitulés reconnus à la lecture (fichiers faits à la main). */
    alias?:       string[]
}

export const COLONNES: Record<TypeImport, Colonne[]> = {
    produits: [
        { cle: 'nom',          titre: 'Désignation',          obligatoire: true, genre: 'texte',  largeur: 34, aide: 'Nom du produit tel qu\'il apparaîtra sur les reçus.', exemple: 'Câble HDMI 2 m', alias: ['nom', 'produit', 'article', 'libelle'] },
        { cle: 'prix_vente',   titre: 'Prix de vente',        obligatoire: true, genre: 'nombre', largeur: 15, aide: 'Prix de vente unitaire, sans espace ni devise.', exemple: 2500, alias: ['prix', 'pv', 'prix unitaire'] },
        { cle: 'reference',    titre: 'Référence',            genre: 'texte',    largeur: 15, aide: 'Code interne (SKU). Sert à reconnaître un produit déjà enregistré.', exemple: 'CAB-HDMI2', alias: ['sku', 'code', 'code article'] },
        { cle: 'code_barres',  titre: 'Code-barres',          genre: 'texte',    largeur: 17, aide: 'Code EAN imprimé sur l\'emballage.', exemple: '6923410712345', alias: ['ean', 'code barre', 'codebarre'] },
        { cle: 'categorie',    titre: 'Catégorie',            genre: 'texte',    largeur: 16, aide: 'Doit déjà exister dans Manetec ; sinon le produit est importé sans catégorie, à choisir ensuite sur sa fiche.', exemple: 'Câbles' },
        { cle: 'marque',       titre: 'Marque',               genre: 'texte',    largeur: 14, aide: 'Doit déjà exister dans Manetec ; sinon le produit est importé sans marque, à choisir ensuite sur sa fiche.', exemple: 'Generic' },
        { cle: 'prix_achat',   titre: 'Prix d\'achat',        genre: 'nombre',   largeur: 14, aide: 'Coût unitaire : il valorise le stock d\'ouverture.', exemple: 1200, alias: ['pa', 'cout', 'cout unitaire'] },
        { cle: 'prix_gros',    titre: 'Prix de gros',         genre: 'nombre',   largeur: 13, aide: 'Prix pour les ventes en gros.', exemple: 2200 },
        { cle: 'prix_minimum', titre: 'Prix minimum',         genre: 'nombre',   largeur: 13, aide: 'Prix plancher autorisé à la vente.', exemple: 2300 },
        { cle: 'tva_pct',      titre: 'TVA %',                genre: 'nombre',   largeur: 9,  aide: 'Taux en pourcentage : 18 pour 18 %. Vide = 0.', exemple: 0, alias: ['tva'] },
        { cle: 'unite',        titre: 'Unité',                genre: 'texte',    largeur: 10, aide: 'pièce, kg, carton… Vide = pièce.', exemple: 'pièce' },
        { cle: 'seuil_alerte', titre: 'Seuil d\'alerte',      genre: 'nombre',   largeur: 12, aide: 'Quantité sous laquelle le produit est signalé.', exemple: 5 },
        { cle: 'imei',         titre: 'IMEI exigé',           genre: 'ouinon',   largeur: 11, aide: 'Oui : le POS demandera l\'IMEI de chaque appareil vendu.', exemple: 'Non' },
        { cle: 'serie',        titre: 'N° de série exigé',    genre: 'ouinon',   largeur: 13, aide: 'Oui : le POS demandera le n° de série.', exemple: 'Non', alias: ['serie exige', 'numero de serie'] },
        { cle: 'entrepot',     titre: 'Entrepôt',             genre: 'entrepot', largeur: 20, aide: 'Où se trouve le stock. Vide = entrepôt par défaut. Une ligne par entrepôt pour un même produit.', exemple: 'Magasin principal', alias: ['magasin', 'depot'] },
        { cle: 'quantite',     titre: 'Quantité d\'ouverture', genre: 'nombre',  largeur: 14, aide: 'Stock présent à la date de démarrage. Vide = pas de stock.', exemple: 40, alias: ['quantite', 'qte', 'stock'] },
    ],
    clients: [
        { cle: 'nom',            titre: 'Nom',                 obligatoire: true, genre: 'texte', largeur: 30, aide: 'Nom du client ou de l\'entreprise.', exemple: 'Koffi Distribution', alias: ['client', 'raison sociale'] },
        { cle: 'telephone',      titre: 'Téléphone',           genre: 'texte',  largeur: 18, aide: 'Sert à reconnaître un client déjà enregistré.', exemple: '+229 01 97 00 00 01', alias: ['tel', 'telephone', 'contact'] },
        { cle: 'email',          titre: 'E-mail',              genre: 'texte',  largeur: 24, aide: 'Adresse e-mail.', exemple: 'contact@koffi.bj', alias: ['email', 'mail'] },
        { cle: 'adresse',        titre: 'Adresse',             genre: 'texte',  largeur: 24, aide: 'Quartier, rue.', exemple: 'Akpakpa, rue 120' },
        { cle: 'ville',          titre: 'Ville',               genre: 'texte',  largeur: 14, aide: '', exemple: 'Cotonou' },
        { cle: 'ifu',            titre: 'IFU',                 genre: 'texte',  largeur: 16, aide: 'Identifiant fiscal (entreprises).', exemple: '3202212345678' },
        { cle: 'rccm',           titre: 'RCCM',                genre: 'texte',  largeur: 18, aide: 'Registre du commerce.', exemple: 'RB/COT/22 B 1234' },
        { cle: 'plafond_credit', titre: 'Plafond de crédit',   genre: 'nombre', largeur: 15, aide: 'Avertit au-delà, sans bloquer. Vide ou 0 = pas de limite.', exemple: 500000, alias: ['plafond'] },
        { cle: 'montant_du',     titre: 'Montant dû',          genre: 'nombre', largeur: 15, aide: 'Ce que le client doit déjà : devient une facture « Solde d\'ouverture ».', exemple: 150000, alias: ['creance', 'du', 'solde du'] },
        { cle: 'avance',         titre: 'Avance déjà versée',  genre: 'nombre', largeur: 15, aide: 'Argent déjà versé par le client, à déduire de ses prochains achats.', exemple: 0, alias: ['avance'] },
    ],
    fournisseurs: [
        { cle: 'nom',           titre: 'Nom',                  obligatoire: true, genre: 'texte', largeur: 30, aide: 'Nom du fournisseur. Sert à reconnaître un fournisseur déjà enregistré.', exemple: 'Grossiste Cotonou', alias: ['fournisseur', 'raison sociale'] },
        { cle: 'nom_contact',   titre: 'Contact',              genre: 'texte',  largeur: 20, aide: 'Personne à joindre.', exemple: 'M. Adjovi', alias: ['nom contact', 'interlocuteur'] },
        { cle: 'poste_contact', titre: 'Poste du contact',     genre: 'texte',  largeur: 16, aide: '', exemple: 'Commercial', alias: ['poste', 'fonction'] },
        { cle: 'telephone',     titre: 'Téléphone',            genre: 'texte',  largeur: 18, aide: '', exemple: '+229 01 96 00 00 02', alias: ['tel'] },
        { cle: 'email',         titre: 'E-mail',               genre: 'texte',  largeur: 24, aide: '', exemple: 'ventes@grossiste.bj', alias: ['email', 'mail'] },
        { cle: 'adresse',       titre: 'Adresse',              genre: 'texte',  largeur: 22, aide: '', exemple: 'Dantokpa' },
        { cle: 'ville',         titre: 'Ville',                genre: 'texte',  largeur: 14, aide: '', exemple: 'Cotonou' },
        { cle: 'pays',          titre: 'Pays',                 genre: 'texte',  largeur: 12, aide: '', exemple: 'Bénin' },
        { cle: 'ifu',           titre: 'IFU',                  genre: 'texte',  largeur: 16, aide: '', exemple: '3201912345678' },
        { cle: 'rccm',          titre: 'RCCM',                 genre: 'texte',  largeur: 18, aide: '', exemple: 'RB/COT/19 B 4321' },
        { cle: 'montant_du',    titre: 'Montant dû',           genre: 'nombre', largeur: 15, aide: 'Ce que la boutique doit déjà : devient une facture fournisseur « Solde d\'ouverture ».', exemple: 300000, alias: ['dette', 'du', 'solde du'] },
    ],
}

/** Intitulé de colonne → clé de comparaison (sans accents, astérisque, casse). */
export function cleEntete(v: unknown): string {
    return String(v ?? '')
        .normalize('NFD').replace(/[̀-ͯ]/g, '')
        .toLowerCase().replace(/\*/g, '').replace(/[^a-z0-9%]+/g, ' ').trim()
}

export function colonneDepuisEntete(type: TypeImport, entete: unknown): Colonne | undefined {
    const k = cleEntete(entete)
    if (!k) return undefined
    return COLONNES[type].find(c => cleEntete(c.titre) === k || (c.alias ?? []).some(a => cleEntete(a) === k))
}

export type LigneImport = Record<string, string | number | boolean | null> & { ligne: number }

export interface LigneAnalysee {
    ligne:    number
    valeurs:  LigneImport
    /** Bloquant : la ligne ne sera pas envoyée. */
    erreurs:  string[]
    /** Informations : « catégorie créée », « existe déjà »… */
    notes:    string[]
    statut:   'ok' | 'note' | 'rejet'
}

export const MAX_LIGNES_IMPORT = 5000
