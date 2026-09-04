// lib/facturation/etat-facture.ts
// ═══════════════════════════════════════════════════════════════
// L'état d'une facture, tel qu'on le montre.
//
// Décision D1 : le RETARD n'est pas un statut stocké. Une facture ne
// « devient » pas en retard un jour donné — elle l'est, ou non, au
// moment où on la regarde. Un statut écrit en base serait faux dès le
// lendemain de son écriture, et c'est bien ce qui se passait : la
// valeur `en_retard` existait dans la contrainte, l'écran lui réservait
// un badge rouge, et rien ne l'écrivait jamais. Une facture échue depuis
// soixante jours s'affichait « Émise ».
//
// Ici, le statut stocké dit où en est le RÈGLEMENT (émise, partiellement
// payée, payée, annulée) et le retard se déduit de la date d'échéance.
// Les deux se combinent pour l'affichage.
// ═══════════════════════════════════════════════════════════════

export type StatutFacture = 'emise' | 'partiellement_payee' | 'payee' | 'annulee'

export interface EtatFacture {
    /** Libellé complet, retard compris. */
    libelle:     string
    /** Rôle sémantique, pour choisir la couleur. */
    ton:         'neutre' | 'attente' | 'succes' | 'alerte' | 'inactif'
    enRetard:    boolean
    joursRetard: number
    /** Reste dû après règlements et avoirs. */
    resteDu:     number
}

const LIBELLES: Record<StatutFacture, string> = {
    emise:               'Émise',
    partiellement_payee: 'Partiellement payée',
    payee:               'Payée',
    annulee:             'Annulée',
}

/** Jours de retard sur une échéance, 0 si l'échéance n'est pas passée. */
export function joursDeRetard(dateEcheance: string | null, aujourdhui = new Date()): number {
    if (!dateEcheance) return 0

    // On compare des JOURS, pas des instants : une facture échue le 6 ne
    // l'est pas à 00 h 01 le 6, elle l'est le 7.
    const [a, m, j] = dateEcheance.split('-').map(Number)
    const echeance  = Date.UTC(a, m - 1, j)
    const jour      = Date.UTC(
        aujourdhui.getFullYear(), aujourdhui.getMonth(), aujourdhui.getDate(),
    )

    return Math.max(0, Math.floor((jour - echeance) / 86400000))
}

export function etatFacture(facture: {
    statut:          string
    date_echeance:   string | null
    montant_restant: number
}, aujourdhui = new Date()): EtatFacture {
    const statut  = facture.statut as StatutFacture
    const resteDu = facture.montant_restant

    if (statut === 'annulee') {
        return { libelle: 'Annulée', ton: 'inactif', enRetard: false, joursRetard: 0, resteDu: 0 }
    }
    if (statut === 'payee') {
        return { libelle: 'Payée', ton: 'succes', enRetard: false, joursRetard: 0, resteDu: 0 }
    }

    const jours    = joursDeRetard(facture.date_echeance, aujourdhui)
    const enRetard = jours > 0 && resteDu > 0

    if (enRetard) {
        return {
            libelle: jours === 1 ? 'En retard d’1 jour' : `En retard de ${jours} jours`,
            ton:         'alerte',
            enRetard:    true,
            joursRetard: jours,
            resteDu,
        }
    }

    return {
        libelle:     LIBELLES[statut] ?? statut,
        ton:         statut === 'partiellement_payee' ? 'attente' : 'neutre',
        enRetard:    false,
        joursRetard: 0,
        resteDu,
    }
}

/** Classes Tailwind par ton, pour un badge sur fond clair. */
export const CLASSES_TON: Record<EtatFacture['ton'], string> = {
    neutre:  'bg-blue-50 text-blue-700 border-blue-200',
    attente: 'bg-amber-50 text-amber-700 border-amber-200',
    succes:  'bg-green-50 text-green-700 border-green-200',
    alerte:  'bg-red-50 text-red-700 border-red-200',
    inactif: 'bg-muted text-muted-foreground border-border',
}

/** Mêmes tons, sur le bandeau marine de l'écran de détail. */
export const CLASSES_TON_SOMBRE: Record<EtatFacture['ton'], string> = {
    neutre:  'bg-blue-500/20 text-blue-200 border-blue-400/40',
    attente: 'bg-amber-500/20 text-amber-200 border-amber-400/40',
    succes:  'bg-green-500/20 text-green-200 border-green-400/40',
    alerte:  'bg-red-500/20 text-red-200 border-red-400/40',
    inactif: 'bg-white/10 text-white/70 border-white/25',
}
