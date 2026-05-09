import type { RoleBoutique, RolePlateforme } from '@/lib/constants/permissions'
import type { Plan } from '@/lib/constants/plans'

// ── Utilisateur plateforme (Bold Redhok Tech) ──────────────────
export interface UtilisateurPlateforme {
    id: string
    public_id: string
    nom_complet: string
    email: string
    role: RolePlateforme
    est_actif: boolean
    created_at: string
}

// ── Boutique ───────────────────────────────────────────────────
export interface Boutique {
    id: string
    public_id: string
    nom: string
    logo_url: string | null
    adresse: string | null
    ville: string | null
    pays: string
    telephone_1: string
    telephone_2: string | null
    email: string | null
    site_web: string | null
    ifu: string | null
    rccm: string | null
    devise: string
    remise_max_pct: number
    message_pied_facture: string | null
    message_recu_thermique: string | null
    plan: Plan
    plan_expire_le: string | null
    est_active: boolean
    activation_manuelle: boolean
    note_activation: string | null
    created_at: string
    updated_at: string
}

// ── Utilisateur boutique ───────────────────────────────────────
export interface UtilisateurBoutique {
    id: string
    public_id: string
    shop_id: string
    nom_complet: string
    identifiant: string
    role: RoleBoutique
    tentatives_echecs: number
    est_bloque: boolean
    bloque_le: string | null
    est_actif: boolean
    desactive_le: string | null
    preference_theme: 'clair' | 'sombre' | 'systeme'
    version: number
    created_at: string
    updated_at: string
}

// ── Session courante ───────────────────────────────────────────
export interface SessionBoutique {
    utilisateur_id: string
    public_id: string
    nom_complet: string
    role: RoleBoutique
    permissions: string[]
    shop_id: string
    shop_nom: string
    shop_plan: Plan
}

export interface SessionPlateforme {
    utilisateur_id: string
    public_id: string
    nom_complet: string
    role: RolePlateforme
    email: string
}

// ── Réponse API standard ───────────────────────────────────────
export interface ApiReponse<T = unknown> {
    succes: boolean
    data?: T
    erreur?: string
    code?: string
}