// lib/audit/journaliser.ts
// ═══════════════════════════════════════════════════════════════
// Trace d'une correction d'écriture.
//
// Décision produit D4 : une écriture fausse se corrige sur place — la
// ligne garde son identifiant et ses valeurs changent — mais jamais en
// silence. L'ancienne valeur, son auteur et sa date sont conservés ici,
// et l'écran de détail de l'écriture les affiche.
//
// On réutilise `audit_logs`, qui portait déjà `reference_type` /
// `reference_id` sans que personne s'en serve : les vues d'audit de
// Manetec Administration reprennent donc ces traces sans un mot de code
// en plus.
// ═══════════════════════════════════════════════════════════════

import { createAdminClient } from '@/lib/supabase/admin'

type Acteur = {
    user_metadata?: {
        user_id?:     string
        public_id?:   string
        nom_complet?: string
        shop_id?:     string
    }
}

export type ChampModifie = {
    champ:   string
    libelle: string
    avant:   unknown
    apres:   unknown
}

/**
 * Compare deux jeux de valeurs et ne retient que ce qui a réellement
 * changé — journaliser « rien n'a bougé » brouillerait l'historique.
 */
export function champsModifies(
    avant: Record<string, unknown>,
    apres: Record<string, unknown>,
    libelles: Record<string, string>,
): ChampModifie[] {
    return Object.keys(libelles)
        .filter(champ => {
            const a = avant[champ] ?? null
            const b = apres[champ] ?? null
            return String(a) !== String(b)
        })
        .map(champ => ({
            champ,
            libelle: libelles[champ],
            avant:   avant[champ] ?? null,
            apres:   apres[champ] ?? null,
        }))
}

export async function journaliserCorrection(opts: {
    user:              Acteur
    eventType:         string
    referenceType:     string
    referenceId:       string
    referencePublicId?: string | null
    modifications?:    ChampModifie[]
    motif?:            string | null
}) {
    const meta = opts.user.user_metadata ?? {}
    const adminClient = createAdminClient()

    await adminClient.from('audit_logs').insert({
        shop_id:             meta.shop_id ?? null,
        user_id:             meta.user_id ?? null,
        user_public_id:      meta.public_id ?? null,
        user_nom:            meta.nom_complet ?? null,
        type_acteur:         'shop',
        event_type:          opts.eventType,
        reference_type:      opts.referenceType,
        reference_id:        opts.referenceId,
        reference_public_id: opts.referencePublicId ?? null,
        details_json: {
            modifications: opts.modifications ?? [],
            motif:         opts.motif ?? null,
        },
    })
}

/** Historique des corrections d'une écriture, pour son écran de détail. */
export async function historiqueCorrections(
    shopId: string,
    referenceId: string,
) {
    const adminClient = createAdminClient()

    const { data } = await adminClient
        .from('audit_logs')
        .select('event_type, user_nom, user_public_id, details_json, created_at')
        .eq('shop_id', shopId)
        .eq('reference_id', referenceId)
        .order('created_at', { ascending: false })

    return data ?? []
}
