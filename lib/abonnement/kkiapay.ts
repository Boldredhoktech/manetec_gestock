// lib/abonnement/kkiapay.ts
// ═══════════════════════════════════════════════════════════════
// Dialogue serveur avec KkiaPay (D1). Rien de ce que dit le navigateur
// ou le corps d'un webhook n'est cru : une transaction n'est tenue pour
// payée qu'après relecture chez KkiaPay, avec nos clés.
//
// Le SDK officiel (@kkiapay-org/nodejs-sdk) n'est qu'un appel à
// POST /api/v1/transactions/status portant trois en-têtes, au-dessus
// d'axios 0.27 (2022) ; on fait le même appel avec fetch, sans
// dépendance, et avec un délai d'expiration.
// ═══════════════════════════════════════════════════════════════

const API = {
    sandbox: 'https://api-sandbox.kkiapay.me',
    live:    'https://api.kkiapay.me',
}

export function estSandboxKkiapay(): boolean {
    return process.env.KKIAPAY_SANDBOX !== 'false'
}

/** Ce que le navigateur a le droit de connaître pour ouvrir le widget. */
export function configWidgetKkiapay(): { cle: string; sandbox: boolean } | null {
    const cle = process.env.NEXT_PUBLIC_KKIAPAY_PUBLIC_KEY
    return cle ? { cle, sandbox: estSandboxKkiapay() } : null
}

export type TransactionKkiapay = {
    statut:  string           // SUCCESS, FAILED, PENDING, TRANSACTION_NOT_FOUND…
    montant: number | null
    brut:    Record<string, unknown>
}

/**
 * Relit une transaction chez KkiaPay. Renvoie null quand KkiaPay est
 * injoignable ou mal configuré : l'appelant doit alors laisser le
 * paiement « en attente » (le webhook ou un nouvel essai tranchera),
 * jamais le déclarer échoué.
 */
export async function lireTransactionKkiapay(transactionId: string): Promise<TransactionKkiapay | null> {
    const pub  = process.env.NEXT_PUBLIC_KKIAPAY_PUBLIC_KEY
    const priv = process.env.KKIAPAY_PRIVATE_KEY
    const sec  = process.env.KKIAPAY_SECRET_KEY
    if (!pub || !priv || !sec) {
        console.error('[KKIAPAY] clés absentes de l\'environnement')
        return null
    }

    try {
        const reponse = await fetch(`${estSandboxKkiapay() ? API.sandbox : API.live}/api/v1/transactions/status`, {
            method:  'POST',
            headers: {
                'content-type':  'application/json',
                'x-api-key':     pub,
                'x-private-key': priv,
                'x-secret-key':  sec,
            },
            body:   JSON.stringify({ transactionId }),
            cache:  'no-store',
            signal: AbortSignal.timeout(15_000),
        })

        const brut = await reponse.json().catch(() => ({})) as Record<string, unknown>
        const statut = typeof brut.status === 'string' ? brut.status : `HTTP_${reponse.status}`

        // 5xx : panne chez KkiaPay, rien n'est tranché.
        if (reponse.status >= 500) {
            console.error(`[KKIAPAY] ${reponse.status} sur la vérification de ${transactionId}`)
            return null
        }

        const montant = Number(brut.amount)
        return { statut, montant: Number.isFinite(montant) ? montant : null, brut }
    } catch (erreur) {
        console.error('[KKIAPAY] vérification impossible :', erreur instanceof Error ? erreur.message : erreur)
        return null
    }
}
