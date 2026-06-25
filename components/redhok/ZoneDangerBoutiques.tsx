'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { AlertTriangle, Trash2, Loader2, X, ShieldAlert, CheckCircle } from 'lucide-react'
import { supprimerToutesBoutiques } from '@/actions/shops'

// Doit correspondre exactement à la phrase attendue côté serveur
const PHRASE_SUPPRESSION_BOUTIQUES = 'SUPPRIMER TOUTES LES BOUTIQUES'

export default function ZoneDangerBoutiques() {
    const router = useRouter()
    const [ouvert, setOuvert]       = useState(false)
    const [motDePasse, setMotDePasse] = useState('')
    const [phrase, setPhrase]       = useState('')
    const [enAttente, setEnAttente] = useState(false)
    const [erreur, setErreur]       = useState<string>()
    const [succes, setSucces]       = useState(false)

    const phraseOk = phrase.trim() === PHRASE_SUPPRESSION_BOUTIQUES
    const peutValider = motDePasse.length > 0 && phraseOk && !enAttente

    function fermer() {
        if (enAttente) return
        setOuvert(false); setMotDePasse(''); setPhrase(''); setErreur(undefined)
    }

    async function handleSupprimer() {
        setEnAttente(true); setErreur(undefined)
        const fd = new FormData()
        fd.set('motDePasse', motDePasse)
        fd.set('phrase', phrase.trim())
        const res = await supprimerToutesBoutiques(fd)
        setEnAttente(false)
        if (res?.erreur) { setErreur(res.erreur); return }
        setSucces(true)
        setTimeout(() => { router.refresh() }, 2500)
    }

    return (
        <>
            {/* Carte zone de danger */}
            <div className="mt-8 rounded-xl border-2 border-destructive/30 bg-destructive/5 p-5">
                <div className="flex items-start gap-3">
                    <div className="shrink-0 bg-destructive/10 p-2 rounded-lg">
                        <ShieldAlert className="w-5 h-5 text-destructive" />
                    </div>
                    <div className="flex-1 min-w-0">
                        <h3 className="text-sm font-bold text-destructive">Zone de danger</h3>
                        <p className="text-sm text-muted-foreground mt-1">
                            Supprimer définitivement <strong>toutes les boutiques</strong> et l'intégralité de
                            leurs données (produits, ventes, factures, stock, clients, utilisateurs…).
                            Le système repart à neuf. Cette action est <strong>irréversible</strong>.
                        </p>
                        <button
                            type="button"
                            onClick={() => setOuvert(true)}
                            className="mt-3 inline-flex items-center gap-2 px-4 py-2 bg-destructive text-white text-sm font-bold rounded-lg hover:bg-destructive/90 transition-colors"
                        >
                            <Trash2 className="w-4 h-4" />
                            Supprimer toutes les boutiques
                        </button>
                    </div>
                </div>
            </div>

            {/* Modal de double confirmation */}
            {ouvert && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50"
                     onClick={fermer}>
                    <div className="w-full max-w-md bg-card rounded-2xl shadow-xl border border-border p-6 space-y-4"
                         onClick={e => e.stopPropagation()}>

                        {succes ? (
                            <div className="text-center space-y-3 py-4">
                                <CheckCircle className="w-12 h-12 text-green-600 mx-auto" />
                                <h3 className="text-lg font-bold text-foreground">Toutes les boutiques ont été supprimées</h3>
                                <p className="text-sm text-muted-foreground">Le système est réinitialisé. Actualisation…</p>
                            </div>
                        ) : (
                            <>
                                <div className="flex items-start justify-between">
                                    <div className="flex items-center gap-2">
                                        <AlertTriangle className="w-5 h-5 text-destructive" />
                                        <h3 className="text-base font-bold text-foreground">Confirmation requise</h3>
                                    </div>
                                    <button type="button" onClick={fermer} className="text-muted-foreground hover:text-foreground">
                                        <X className="w-5 h-5" />
                                    </button>
                                </div>

                                <div className="bg-destructive/10 border border-destructive/30 rounded-lg px-3 py-2.5 text-xs text-destructive">
                                    Vous allez supprimer <strong>toutes les boutiques</strong> et leurs données.
                                    Cette opération ne peut pas être annulée.
                                </div>

                                {/* Mot de passe (facteur 1) */}
                                <div className="space-y-1.5">
                                    <label className="text-sm font-medium text-foreground">
                                        1. Votre mot de passe
                                    </label>
                                    <input
                                        type="password"
                                        value={motDePasse}
                                        onChange={e => setMotDePasse(e.target.value)}
                                        autoComplete="current-password"
                                        disabled={enAttente}
                                        className="w-full px-3 py-2.5 bg-background border border-input rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-destructive/40"
                                    />
                                </div>

                                {/* Phrase (facteur 2) */}
                                <div className="space-y-1.5">
                                    <label className="text-sm font-medium text-foreground">
                                        2. Tapez exactement : <span className="font-mono text-destructive">{PHRASE_SUPPRESSION_BOUTIQUES}</span>
                                    </label>
                                    <input
                                        type="text"
                                        value={phrase}
                                        onChange={e => setPhrase(e.target.value)}
                                        disabled={enAttente}
                                        autoComplete="off"
                                        className={`w-full px-3 py-2.5 bg-background border rounded-lg text-sm focus:outline-none focus:ring-2 ${
                                            phrase.length === 0 ? 'border-input focus:ring-destructive/40'
                                                : phraseOk ? 'border-green-400 focus:ring-green-400' : 'border-destructive focus:ring-destructive/40'
                                        }`}
                                    />
                                </div>

                                {erreur && (
                                    <p className="flex items-start gap-1.5 text-xs text-destructive">
                                        <AlertTriangle className="w-3.5 h-3.5 mt-0.5 shrink-0" />{erreur}
                                    </p>
                                )}

                                <div className="flex gap-2 pt-1">
                                    <button type="button" onClick={fermer} disabled={enAttente}
                                            className="flex-1 py-2.5 border border-input rounded-lg text-sm font-medium hover:bg-muted transition-colors disabled:opacity-50">
                                        Annuler
                                    </button>
                                    <button type="button" onClick={handleSupprimer} disabled={!peutValider}
                                            className="flex-1 flex items-center justify-center gap-2 py-2.5 bg-destructive text-white rounded-lg text-sm font-bold hover:bg-destructive/90 transition-colors disabled:opacity-40 disabled:cursor-not-allowed">
                                        {enAttente
                                            ? <><Loader2 className="w-4 h-4 animate-spin" />Suppression…</>
                                            : <><Trash2 className="w-4 h-4" />Supprimer définitivement</>}
                                    </button>
                                </div>
                            </>
                        )}
                    </div>
                </div>
            )}
        </>
    )
}
