// app/api/v1/abonnement/webhook/route.ts
// ═══════════════════════════════════════════════════════════════
// Webhook KkiaPay (Lot 3, ABO-02) — filet de sécurité quand le
// navigateur s'est fermé avant d'avoir confirmé le paiement.
//
// KkiaPay envoie un POST JSON portant l'en-tête `x-kkiapay-secret`
// (le « Secret hash » saisi dans son tableau de bord). Événements :
// transaction.success / transaction.failed. Faute de réponse 2xx, il
// réessaie 5 fois.
//
// Le corps n'est JAMAIS cru : il ne sert qu'à savoir QUELLE transaction
// relire. La décision vient de la relecture chez KkiaPay
// (confirmerPaiementEnLigne), comme pour le navigateur.
// ═══════════════════════════════════════════════════════════════

import { NextRequest, NextResponse } from 'next/server'
import { timingSafeEqual } from 'node:crypto'
import { createAdminClient } from '@/lib/supabase/admin'
import { confirmerPaiementEnLigne } from '@/lib/abonnement/confirmation'

const UUID = /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/i

function secretValide(recu: string | null): boolean {
    const attendu = process.env.KKIAPAY_WEBHOOK_SECRET
    if (!attendu || !recu) return false
    const a = Buffer.from(attendu)
    const b = Buffer.from(recu)
    return a.length === b.length && timingSafeEqual(a, b)
}

/** `data` passé au widget = identifiant de notre paiement ; KkiaPay le renvoie dans `stateData`. */
function paiementDepuisStateData(stateData: unknown): string | null {
    const texte = typeof stateData === 'string' ? stateData : JSON.stringify(stateData ?? '')
    return texte.match(UUID)?.[0] ?? null
}

export async function POST(request: NextRequest) {
    if (!secretValide(request.headers.get('x-kkiapay-secret'))) {
        return new NextResponse('Signature invalide', { status: 401 })
    }

    const corps = await request.json().catch(() => null) as Record<string, unknown> | null
    const transactionId = typeof corps?.transactionId === 'string' ? corps.transactionId : null
    if (!transactionId) {
        // Rien d'exploitable : un 2xx évite 5 renvois inutiles.
        return NextResponse.json({ recu: true, traite: false })
    }

    // Un échec n'est qu'une information : le paiement reste ouvert à un
    // nouvel essai (voir confirmation.ts). Seuls les succès sont relus.
    if (corps?.event !== 'transaction.success') {
        return NextResponse.json({ recu: true, traite: false })
    }

    let paiementId = paiementDepuisStateData(corps.stateData)
    if (!paiementId) {
        const { data } = await createAdminClient()
            .from('abonnement_paiements')
            .select('id')
            .eq('moyen', 'kkiapay')
            .eq('reference_transaction', transactionId)
            .maybeSingle()
        paiementId = data?.id ?? null
    }

    if (!paiementId) {
        console.error(`[WEBHOOK KKIAPAY] transaction ${transactionId} sans paiement rattaché`)
        return NextResponse.json({ recu: true, traite: false })
    }

    const issue = await confirmerPaiementEnLigne(paiementId, transactionId, 'webhook')

    // KkiaPay injoignable pendant la relecture : on demande un renvoi.
    if (issue.etat === 'en_attente') {
        return new NextResponse('Vérification différée', { status: 503 })
    }
    return NextResponse.json({ recu: true, traite: true, etat: issue.etat })
}
