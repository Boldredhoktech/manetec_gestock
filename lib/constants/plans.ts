export type PlanId = 'starter' | 'pro' | 'enterprise'
export type Plan = PlanId

export interface PlanLimites {
    max_produits:     number
    max_utilisateurs: number
    max_clients:      number
    factures_a4:      boolean
    devis:            boolean
    rapports:         boolean
    communications:   boolean
    multi_entrepots:  boolean
    label:            string
}

const PLANS: Record<PlanId, PlanLimites> = {
    starter: {
        max_produits:     50,
        max_utilisateurs: 2,
        max_clients:      100,
        factures_a4:      false,
        devis:            false,
        rapports:         false,
        communications:   false,
        multi_entrepots:  false,
        label:            'Starter',
    },
    pro: {
        max_produits:     500,
        max_utilisateurs: 10,
        max_clients:      1000,
        factures_a4:      true,
        devis:            true,
        rapports:         true,
        communications:   false,
        multi_entrepots:  true,
        label:            'Pro',
    },
    enterprise: {
        max_produits:     999999,
        max_utilisateurs: 999999,
        max_clients:      999999,
        factures_a4:      true,
        devis:            true,
        rapports:         true,
        communications:   true,
        multi_entrepots:  true,
        label:            'Enterprise',
    },
}

export function getPlanLimites(plan: string): PlanLimites {
    return PLANS[(plan as PlanId)] ?? PLANS.starter
}

// Valeur conventionnelle "illimité" (les plans n'utilisent jamais -1)
export const ILLIMITE = 999999

/** Renvoie true si le plan permet d'ajouter encore une entité (quota non atteint). */
export function peutAjouter(plan: string, max: keyof Pick<PlanLimites,
    'max_produits' | 'max_clients' | 'max_utilisateurs'>, nbActuel: number): boolean {
    const limite = getPlanLimites(plan)[max]
    return limite >= ILLIMITE || nbActuel < limite
}

export { PLANS }