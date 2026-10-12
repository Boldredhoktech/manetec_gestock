// lib/abonnement/catalogue.ts
// ═══════════════════════════════════════════════════════════════
// LE catalogue des plans (ABO-08). Avant, il était écrit six fois :
// prix dans entreprise.ts, limites dans plans.ts, et libellés, couleurs
// et listes de fonctionnalités recopiés dans la page Abonnement, le
// profil, la sidebar, le badge et l'e-mail d'alerte. Changer un prix
// voulait dire penser à cinq fichiers.
//
// Ici : prix (D5), remise annuelle (D6), durées (D4), mode de paiement
// (D7), présentation. Les LIMITES restent dans lib/constants/plans.ts
// (lues aussi par les quotas) ; ce fichier les réutilise.
// Aucune dépendance serveur : utilisable côté client.
// ═══════════════════════════════════════════════════════════════

import { getPlanLimites, ILLIMITE, type PlanId, type PlanLimites } from '@/lib/constants/plans'

export type { PlanId }
export type Duree = 'mensuel' | 'annuel'

export const DUREES: Record<Duree, { label: string; nbMois: number }> = {
    mensuel: { label: '1 mois',  nbMois: 1 },
    annuel:  { label: '12 mois', nbMois: 12 },
}

/** D6 : l'annuel coûte 12 mois moins 20 %. */
export const REMISE_ANNUELLE_PCT = 20

/** D2 : un Starter neuf démarre par 30 jours d'essai. */
export const JOURS_ESSAI = 30

export const DEVISE_ABONNEMENT = 'FCFA'

type FichePlan = {
    id:              PlanId
    label:           string
    description:     string
    /** D5 : prix mensuel en FCFA ; null = sur devis (Enterprise). */
    prixMensuel:     number | null
    /** D7 : faux = activation par la plateforme uniquement. */
    payableEnLigne:  boolean
    /** Couleur de marque (hex) — page d'accueil, e-mails, page Abonnement. */
    couleur:         string
    /** Teinte lisible sur le fond sombre de la sidebar. */
    couleurSurFonce: string
    populaire:       boolean
    /** Ce qui n'est pas déjà dit par les limites. */
    extras:          string[]
}

const FICHES: Record<PlanId, FichePlan> = {
    starter: {
        id: 'starter', label: 'Starter',
        description:    'Pour démarrer',
        prixMensuel:    5000,
        payableEnLigne: true,
        couleur:        '#64748b',
        couleurSurFonce: 'rgba(255,255,255,0.65)',
        populaire:      false,
        extras:         ['Caisse POS', 'Gestion de stock', 'Reçus thermiques'],
    },
    pro: {
        id: 'pro', label: 'Pro',
        description:    'Pour les PME en croissance',
        prixMensuel:    15000,
        payableEnLigne: true,
        couleur:        '#15335a',
        couleurSurFonce: '#f59e0b',
        populaire:      true,
        extras:         ['Alertes stock par e-mail'],
    },
    enterprise: {
        id: 'enterprise', label: 'Enterprise',
        description:    'Pour les grandes structures',
        prixMensuel:    null,
        payableEnLigne: false,
        couleur:        '#059669',
        couleurSurFonce: '#10b981',
        populaire:      false,
        extras:         ['Support prioritaire', 'Formation incluse'],
    },
}

export const PLANS_ORDONNES: PlanId[] = ['starter', 'pro', 'enterprise']

export function estPlan(valeur: unknown): valeur is PlanId {
    return typeof valeur === 'string' && valeur in FICHES
}

export function estDuree(valeur: unknown): valeur is Duree {
    return valeur === 'mensuel' || valeur === 'annuel'
}

export function fichePlan(plan: string): FichePlan & { limites: PlanLimites } {
    const id = estPlan(plan) ? plan : 'starter'
    return { ...FICHES[id], limites: getPlanLimites(id) }
}

export function labelPlan(plan: string): string {
    return estPlan(plan) ? FICHES[plan].label : plan
}

/** Prix d'une période, ou null si le plan n'a pas de prix public. */
export function prixPeriode(plan: string, duree: Duree): number | null {
    const mensuel = fichePlan(plan).prixMensuel
    if (mensuel === null) return null
    if (duree === 'mensuel') return mensuel
    return Math.round(mensuel * 12 * (100 - REMISE_ANNUELLE_PCT) / 100)
}

function quota(n: number, singulier: string, pluriel: string): string {
    if (n >= ILLIMITE) return `${pluriel.charAt(0).toUpperCase()}${pluriel.slice(1)} illimités`
    return `${n.toLocaleString('fr-FR')} ${n > 1 ? pluriel : singulier}`
}

/** Liste affichée partout (page d'accueil, page Abonnement, e-mails). */
export function fonctionnalitesPlan(plan: string): string[] {
    const f = fichePlan(plan)
    const l = f.limites
    return [
        quota(l.max_produits,     'produit',     'produits'),
        quota(l.max_utilisateurs, 'utilisateur', 'utilisateurs'),
        quota(l.max_clients,      'client',      'clients'),
        ...(l.factures_a4     ? ['Factures A4 + proforma'] : []),
        ...(l.multi_entrepots ? ['Multi-entrepôts']        : []),
        ...(l.rapports        ? ['Rapports avancés']       : []),
        ...(l.communications  ? ['E-mails promotionnels']  : []),
        ...f.extras,
    ]
}

export function formatMontant(montant: number): string {
    return `${montant.toLocaleString('fr-FR')} ${DEVISE_ABONNEMENT}`
}
