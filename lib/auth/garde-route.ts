// lib/auth/garde-route.ts
// ═══════════════════════════════════════════════════════════════
// Garde unique des routes API boutique (les PDF, aujourd'hui).
//
// Avant : chaque route recopiait « session + plan » et une seule
// vérifiait la permission. Un vendeur pouvait donc ouvrir le rapport
// de paie ou le compte de résultat en tapant l'URL — le menu qui les
// masque n'est que cosmétique.
//
// Le garde renvoie toujours le shop_id LU DANS LA SESSION : une route
// ne doit jamais accepter une boutique passée en paramètre.
// ═══════════════════════════════════════════════════════════════

import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getPlanBoutique } from '@/lib/supabase/getPlanBoutique'
import { aPermission } from '@/lib/auth/permissions-serveur'

type Options = {
    /** Toutes ces permissions sont exigées, pas une seule d'entre elles. */
    permissions: string[]
    /** Le document fait partie des rapports réservés aux plans Pro/Enterprise. */
    exigePlanRapports?: boolean
}

// `refus?: undefined` sur la branche accordée : c'est ce qui permet à
// TypeScript de comprendre qu'après `if (garde.refus) return garde.refus`,
// `garde.shopId` est bien une chaîne.
type Refus   = { refus: NextResponse; shopId?: undefined; userId?: undefined }
type Accorde = { refus?: undefined; shopId: string; userId: string }

export async function gardeRouteBoutique(
    options: Options
): Promise<Refus | Accorde> {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user || user.user_metadata?.type_acteur !== 'shop') {
        return { refus: new NextResponse('Non autorisé', { status: 401 }) }
    }

    for (const permission of options.permissions) {
        if (!aPermission(user, permission)) {
            return {
                refus: new NextResponse(
                    'Vous n\'avez pas la permission de consulter ce document.',
                    { status: 403 }
                ),
            }
        }
    }

    const shopId = user.user_metadata.shop_id as string

    if (options.exigePlanRapports) {
        const { limites } = await getPlanBoutique(shopId)
        if (!limites.rapports) {
            return {
                refus: new NextResponse(
                    'Rapports réservés aux plans Pro et Enterprise.',
                    { status: 403 }
                ),
            }
        }
    }

    return { shopId, userId: user.user_metadata.user_id as string }
}

// ── Paramètres de période ─────────────────────────────────────
// Avant, `parseInt` sans contrôle : « ?mois=abc » produisait NaN et un
// rapport vide plutôt qu'une erreur, « ?mois=99 » une période qui
// n'existe pas.

const AUJOURDHUI = () => new Date().toISOString().split('T')[0]

export function moisAnneeDepuisURL(
    searchParams: URLSearchParams
): { mois: number; annee: number } | NextResponse {
    const maintenant = new Date()
    const brutMois   = searchParams.get('mois')
    const brutAnnee  = searchParams.get('annee')

    const mois  = brutMois  === null ? maintenant.getMonth() + 1  : Number(brutMois)
    const annee = brutAnnee === null ? maintenant.getFullYear()   : Number(brutAnnee)

    if (!Number.isInteger(mois) || mois < 1 || mois > 12) {
        return new NextResponse('Mois invalide : attendu un nombre de 1 à 12.', { status: 400 })
    }
    if (!Number.isInteger(annee) || annee < 2000 || annee > 2100) {
        return new NextResponse('Année invalide.', { status: 400 })
    }

    return { mois, annee }
}

/** Vérifie qu'une chaîne est bien une date AAAA-MM-JJ réelle (pas le 31 février). */
function dateValide(iso: string): boolean {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(iso)) return false
    const d = new Date(iso + 'T00:00:00Z')
    return !Number.isNaN(d.getTime()) && d.toISOString().split('T')[0] === iso
}

function PREMIER_DU_MOIS() {
    const m = new Date()
    return new Date(Date.UTC(m.getFullYear(), m.getMonth(), 1)).toISOString().split('T')[0]
}

export function periodeDepuisURL(
    searchParams: URLSearchParams,
    // Chaque rapport garde le début de période qu'il avait avant : le
    // rapport fournisseurs partait du 1er du mois, les autres du jour même.
    debutParDefaut: 'aujourdhui' | 'debut-mois' = 'aujourdhui'
): { debut: string; fin: string } | NextResponse {
    const parDefaut = debutParDefaut === 'debut-mois' ? PREMIER_DU_MOIS() : AUJOURDHUI()
    const debut = searchParams.get('debut') ?? parDefaut
    const fin   = searchParams.get('fin')   ?? (searchParams.get('debut') ?? AUJOURDHUI())

    if (!dateValide(debut) || !dateValide(fin)) {
        return new NextResponse('Période invalide : dates attendues au format AAAA-MM-JJ.', { status: 400 })
    }
    if (fin < debut) {
        return new NextResponse('Période invalide : la date de fin précède la date de début.', { status: 400 })
    }

    return { debut, fin }
}

export function estRefus(valeur: unknown): valeur is NextResponse {
    return valeur instanceof NextResponse
}
