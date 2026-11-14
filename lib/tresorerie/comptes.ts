// ═══════════════════════════════════════════════════════════════
// Comptes de trésorerie (mig 041) — règles et libellés partagés.
// Pas de 'use server' : importable côté client comme côté serveur.
// ═══════════════════════════════════════════════════════════════

export const TYPES_COMPTE = ['caisse', 'mobile_money', 'banque', 'tpe'] as const
export type TypeCompte = typeof TYPES_COMPTE[number]

export const LIBELLES_TYPE: Record<TypeCompte, string> = {
    caisse:       'Caisse',
    mobile_money: 'Mobile Money',
    banque:       'Banque',
    tpe:          'Carte (TPE)',
}

export const OPERATEURS_MM = [
    { code: 'mtn',     label: 'MTN Mobile Money' },
    { code: 'moov',    label: 'Moov Money' },
    { code: 'celtiis', label: 'Celtiis Cash' },
    { code: 'wave',    label: 'Wave' },
    { code: 'autre',   label: 'Autre opérateur' },
] as const

/** Même règle que la fonction SQL moyen_du_compte() (mig 041). */
export function moyenDuCompte(type: string, operateur?: string | null): string {
    if (type === 'caisse') return 'cash'
    if (type === 'banque') return 'bank_transfer'
    if (type === 'tpe')    return 'bank_card'
    return ({ mtn: 'mtn_momo', moov: 'moov_money', celtiis: 'celtiis_cash', wave: 'wave' } as Record<string, string>)[operateur ?? ''] ?? 'other_mobile'
}

/** Caisse et Mobile Money ne peuvent pas passer sous zéro (la base refuse). */
export function decouvertInterdit(type: string): boolean {
    return type === 'caisse' || type === 'mobile_money'
}

/** Comme MOYENS_PAIEMENT.reference_requise : tout sauf les espèces et la carte. */
export function referenceRequise(type: string): boolean {
    return type === 'mobile_money' || type === 'banque'
}

export interface CompteChoix {
    id:           string
    public_id:    string
    type:         TypeCompte
    nom:          string
    operateur:    string | null
    numero:       string | null
    warehouse_id: string | null
    /** Présent seulement si l'utilisateur peut voir les soldes. */
    solde?:       number
}

export const ORIGINES_MOUVEMENT: Record<string, string> = {
    vente:                'Vente',
    reglement_facture:    'Règlement client',
    depense:              'Dépense',
    salaire:              'Salaire',
    paiement_fournisseur: 'Paiement fournisseur',
    virement:             'Virement',
    retrait:              'Retrait du propriétaire',
    apport:               'Apport du propriétaire',
}

/**
 * Messages de la base faits pour l'utilisateur (trigger de garde, RPC) :
 * on les laisse passer ; tout autre message brut est remplacé.
 */
const MESSAGES_METIER = [
    'Solde insuffisant', 'Le compte', 'Choisissez le compte', 'Compte de trésorerie introuvable',
    'Impossible :', 'Choisissez deux comptes',
]

export function messageTresorerie(brut: string | null | undefined, repli: string): string {
    if (!brut) return repli
    return MESSAGES_METIER.some(m => brut.startsWith(m)) ? brut : repli
}

export function formatF(n: number): string {
    return `${Math.round(n).toLocaleString('fr-FR').replace(/ | /g, ' ')} F`
}
