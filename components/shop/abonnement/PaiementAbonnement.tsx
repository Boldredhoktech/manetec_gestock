'use client'

// Choix du plan et de la durée, puis paiement par le widget KkiaPay.
// Le navigateur ne décide de rien : il obtient un paiement « en attente »
// au prix calculé par le serveur, ouvre le widget, puis transmet
// l'identifiant de transaction au serveur, qui le revérifie chez KkiaPay.

import { useEffect, useRef, useState } from 'react'
import Script from 'next/script'
import { useRouter } from 'next/navigation'
import { CheckCircle, Loader2, AlertTriangle, CreditCard, Clock } from 'lucide-react'
import { preparerPaiementAbonnement, confirmerPaiementAbonnement, type PaiementPrepare } from '@/actions/abonnement'
import { formatMontant, REMISE_ANNUELLE_PCT, type Duree } from '@/lib/abonnement/catalogue'

type ReponseWidget = { transactionId?: string }

declare global {
    interface Window {
        openKkiapayWidget?: (options: Record<string, unknown>) => void
        addSuccessListener?: (cb: (r: ReponseWidget) => void) => void
        addFailedListener?:  (cb: (r: unknown) => void) => void
    }
}

export interface OffrePlan {
    id:              string
    label:           string
    couleur:         string
    fonctionnalites: string[]
    prix:            Record<Duree, number>
}

type Message = { ton: 'succes' | 'erreur' | 'attente'; texte: string }

export default function PaiementAbonnement({
    offres, planActuel, sandbox,
}: {
    offres:     OffrePlan[]
    planActuel: string
    sandbox:    boolean
}) {
    const router = useRouter()
    const [plan,    setPlan]    = useState(offres.some(o => o.id === planActuel) ? planActuel : offres[0]?.id)
    const [duree,   setDuree]   = useState<Duree>('mensuel')
    const [pret,    setPret]    = useState(false)
    const [enCours, setEnCours] = useState(false)
    const [message, setMessage] = useState<Message | null>(null)

    // Paiement ouvert dans le widget ; lu par l'écouteur de succès.
    const courant   = useRef<PaiementPrepare | null>(null)
    const ecouteurs = useRef(false)

    useEffect(() => {
        if (!pret || ecouteurs.current || !window.addSuccessListener) return
        ecouteurs.current = true

        window.addSuccessListener(async (reponse) => {
            const p = courant.current
            if (!p || !reponse?.transactionId) return
            setEnCours(true)
            setMessage({ ton: 'attente', texte: 'Paiement reçu, vérification en cours…' })
            const issue = await confirmerPaiementAbonnement(p.paiementId, reponse.transactionId)
            setEnCours(false)
            if (issue.etat === 'reussi') {
                courant.current = null
                setMessage({ ton: 'succes', texte: `Paiement ${issue.publicId} confirmé. Abonnement actif jusqu'au ${new Date(issue.periodeFin).toLocaleDateString('fr-FR')}.` })
                router.refresh()
            } else {
                setMessage({ ton: issue.etat === 'en_attente' ? 'attente' : 'erreur', texte: issue.message })
            }
        })
        window.addFailedListener?.(() => {
            setMessage({ ton: 'erreur', texte: 'Le paiement n\'a pas abouti. Aucun montant n\'a été prélevé ; vous pouvez réessayer.' })
        })
    }, [pret, router])

    const offre = offres.find(o => o.id === plan)

    async function payer() {
        if (!offre || !window.openKkiapayWidget) return
        setMessage(null)
        setEnCours(true)
        const res = await preparerPaiementAbonnement(offre.id, duree)
        setEnCours(false)
        if ('erreur' in res) {
            setMessage({ ton: 'erreur', texte: res.erreur })
            return
        }
        courant.current = res.paiement
        window.openKkiapayWidget({
            amount:   res.paiement.montant,
            key:      res.paiement.cle,
            sandbox:  res.paiement.sandbox,
            // Rendu par KkiaPay dans le webhook (stateData) : c'est ainsi
            // qu'un paiement confirmé hors navigateur retrouve son abonnement.
            data:     res.paiement.paiementId,
            position: 'center',
            theme:    '#15335a',
        })
    }

    return (
        <div className="bg-white border border-gray-200 rounded-2xl p-5 shadow-sm space-y-4">
            <Script src="https://cdn.kkiapay.me/k.js" strategy="afterInteractive" onReady={() => setPret(true)} />

            <div className="flex items-center gap-2">
                <CreditCard className="w-4 h-4 text-[#15335a]" />
                <h2 className="text-sm font-bold text-gray-900">Payer ou renouveler en ligne</h2>
                {sandbox && <span className="ml-auto text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full bg-amber-100 text-amber-700">Mode test</span>}
            </div>

            {/* Durée */}
            <div className="inline-flex p-1 bg-gray-100 rounded-xl text-sm">
                {(['mensuel', 'annuel'] as Duree[]).map(d => (
                    <button key={d} type="button" onClick={() => setDuree(d)}
                            className={`px-4 py-1.5 rounded-lg font-semibold transition-colors ${duree === d ? 'bg-white shadow text-[#15335a]' : 'text-gray-500'}`}>
                        {d === 'mensuel' ? '1 mois' : `12 mois (−${REMISE_ANNUELLE_PCT} %)`}
                    </button>
                ))}
            </div>

            {/* Plans */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {offres.map(o => {
                    const choisi = o.id === plan
                    return (
                        <button key={o.id} type="button" onClick={() => setPlan(o.id)}
                                className={`text-left p-4 rounded-xl border-2 transition-colors ${choisi ? 'border-[#15335a] bg-[#15335a]/5' : 'border-gray-200 hover:border-gray-300'}`}>
                            <div className="flex items-center justify-between">
                                <span className="font-bold" style={{ color: o.couleur }}>{o.label}</span>
                                {o.id === planActuel && <span className="text-[10px] font-bold uppercase text-gray-500">Plan actuel</span>}
                            </div>
                            <p className="text-lg font-black text-gray-900 mt-1">{formatMontant(o.prix[duree])}</p>
                            <p className="text-xs text-gray-500">
                                {duree === 'mensuel' ? 'pour 1 mois' : `pour 12 mois, soit ${formatMontant(Math.round(o.prix.annuel / 12))} / mois`}
                            </p>
                            <ul className="mt-2 space-y-0.5">
                                {o.fonctionnalites.slice(0, 4).map(f => (
                                    <li key={f} className="text-xs text-gray-600 flex items-center gap-1.5">
                                        <CheckCircle className="w-3 h-3 text-green-500 shrink-0" />{f}
                                    </li>
                                ))}
                            </ul>
                        </button>
                    )
                })}
            </div>

            {offre && offre.id !== planActuel && (
                <p className="text-xs text-gray-500">
                    Changer de plan ouvre une nouvelle période qui commence aujourd&apos;hui ; les jours restants du plan actuel ne sont pas reportés.
                </p>
            )}
            {offre && offre.id === planActuel && (
                <p className="text-xs text-gray-500">
                    Le renouvellement s&apos;ajoute à la date d&apos;échéance actuelle : aucun jour n&apos;est perdu.
                </p>
            )}

            {message && (
                <div className={`flex items-start gap-2 p-3 rounded-xl text-sm ${
                    message.ton === 'succes' ? 'bg-green-50 text-green-700 border border-green-200'
                        : message.ton === 'erreur' ? 'bg-red-50 text-red-700 border border-red-200'
                            : 'bg-amber-50 text-amber-700 border border-amber-200'}`}>
                    {message.ton === 'succes' ? <CheckCircle className="w-4 h-4 shrink-0 mt-0.5" />
                        : message.ton === 'erreur' ? <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
                            : <Clock className="w-4 h-4 shrink-0 mt-0.5" />}
                    <span>{message.texte}</span>
                </div>
            )}

            <button type="button" onClick={payer} disabled={!pret || enCours || !offre}
                    className="w-full py-3 rounded-xl bg-[#15335a] text-white font-bold text-sm disabled:opacity-50 flex items-center justify-center gap-2">
                {enCours ? <Loader2 className="w-4 h-4 animate-spin" /> : <CreditCard className="w-4 h-4" />}
                {!pret ? 'Chargement du paiement…' : offre ? `Payer ${formatMontant(offre.prix[duree])}` : 'Choisissez un plan'}
            </button>
            <p className="text-[11px] text-gray-400 text-center">
                Mobile Money (MTN, Moov) ou carte bancaire, via KkiaPay. Le prix est recalculé et le paiement revérifié par nos serveurs.
            </p>
        </div>
    )
}
