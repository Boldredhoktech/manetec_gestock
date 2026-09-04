'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { changerStatutBonCommande } from '@/actions/fournisseurs'
import { Send, XCircle, Loader2, AlertCircle } from 'lucide-react'

interface Props {
    poId:      string
    statut:    string
    dejaRecu:  boolean
}

// Un bon en brouillon se soumet au fournisseur ; tant que rien n'a été
// reçu, il peut être annulé. Les statuts de réception sont posés par la
// réception elle-même : ils n'apparaissent pas ici.
export default function ActionsBonCommande({ poId, statut, dejaRecu }: Props) {
    const router = useRouter()
    const [enAttente, setEnAttente] = useState<'soumis' | 'annule' | null>(null)
    const [erreur, setErreur]       = useState<string>()
    const [confirmation, setConfirmation] = useState(false)

    async function agir(cible: 'soumis' | 'annule', motif?: string) {
        setEnAttente(cible)
        setErreur(undefined)
        const res = await changerStatutBonCommande(poId, cible, motif)
        setEnAttente(null)
        if (res?.erreur) { setErreur(res.erreur); return }
        setConfirmation(false)
        router.refresh()
    }

    const peutSoumettre = statut === 'brouillon'
    const peutAnnuler   = !dejaRecu && !['annule', 'recu_total'].includes(statut)

    if (!peutSoumettre && !peutAnnuler) return null

    return (
        <div className="space-y-3">
            {erreur && (
                <div className="flex items-start gap-2.5 p-3 bg-red-50 border border-red-200 rounded-xl text-xs text-red-700">
                    <AlertCircle className="w-4 h-4 mt-0.5 shrink-0" />
                    {erreur}
                </div>
            )}

            <div className="flex flex-wrap gap-2">
                {peutSoumettre && (
                    <button
                        onClick={() => agir('soumis')}
                        disabled={enAttente !== null}
                        className="flex items-center gap-2 px-4 py-2 text-xs font-bold text-white bg-[#15335a] rounded-lg hover:bg-[#0f2742] disabled:opacity-50 transition-colors"
                    >
                        {enAttente === 'soumis'
                            ? <><Loader2 className="w-3.5 h-3.5 animate-spin" />Envoi…</>
                            : <><Send className="w-3.5 h-3.5" />Marquer comme envoyé au fournisseur</>
                        }
                    </button>
                )}

                {peutAnnuler && !confirmation && (
                    <button
                        onClick={() => setConfirmation(true)}
                        disabled={enAttente !== null}
                        className="flex items-center gap-2 px-4 py-2 text-xs font-bold text-red-600 border border-red-200 rounded-lg hover:bg-red-50 disabled:opacity-50 transition-colors"
                    >
                        <XCircle className="w-3.5 h-3.5" />
                        Annuler ce bon
                    </button>
                )}
            </div>

            {confirmation && (
                <div className="p-3 bg-red-50 border border-red-200 rounded-xl space-y-2">
                    <p className="text-xs text-red-800">
                        Annuler ce bon de commande ? Il restera consultable, marqué annulé.
                    </p>
                    <div className="flex gap-2">
                        <button
                            onClick={() => agir('annule')}
                            disabled={enAttente !== null}
                            className="px-3 py-1.5 text-xs font-bold text-white bg-red-600 rounded-lg hover:bg-red-700 disabled:opacity-50"
                        >
                            {enAttente === 'annule' ? 'Annulation…' : 'Oui, annuler'}
                        </button>
                        <button
                            onClick={() => setConfirmation(false)}
                            className="px-3 py-1.5 text-xs font-bold text-gray-600 border border-gray-200 rounded-lg hover:bg-white"
                        >
                            Revenir
                        </button>
                    </div>
                </div>
            )}
        </div>
    )
}
