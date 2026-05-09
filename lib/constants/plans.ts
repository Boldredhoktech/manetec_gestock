export const PLANS = {
    STARTER: 'starter',
    PRO: 'pro',
    ENTERPRISE: 'enterprise',
} as const

export type Plan = typeof PLANS[keyof typeof PLANS]

export const PLAN_LIMITES = {
    starter: {
        utilisateurs_max: 1,
        entrepots_max: 1,
        produits_max: 100,
        modules: ['ventes_basique', 'stock_consultation', 'clients_basique'],
        historique_jours: 30,
        email_notifications: false,
        export_pdf: false,
        api_access: false,
    },
    pro: {
        utilisateurs_max: 5,
        entrepots_max: 3,
        produits_max: -1, // illimité
        modules: ['tous'],
        historique_jours: -1, // illimité
        email_notifications: true,
        export_pdf: true,
        api_access: false,
    },
    enterprise: {
        utilisateurs_max: -1,
        entrepots_max: -1,
        produits_max: -1,
        modules: ['tous'],
        historique_jours: -1,
        email_notifications: true,
        export_pdf: true,
        api_access: true,
    },
} as const

export const PLAN_LABELS: Record<Plan, string> = {
    starter: 'Starter',
    pro: 'Pro',
    enterprise: 'Enterprise',
}