'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { toggleActivationFournisseur } from '@/actions/fournisseurs'
import { Power, Loader2, AlertCircle } from 'lucide-react'

interface Props {
    supplierId: string
    estActif:   boolean
}

export default function StatutFournisseur({ supplierId, estActif }: Props) {
    const router = useRouter()
    const [enAttente, setEnAttente] = useState(false)
    const [erreur, setErreur]       = useState<string>()

    async function basculer() {
        setEnAttente(true)
        setErreur(undefined)
        const res = await toggleActivationFournisseur(supplierId, !estActif)
        setEnAttente(false)
        if (res?.erreur) { setErreur(res.erreur); return }
        router.refresh()
    }

    return (
        <div className="bg-white border border-gray-200 rounded-2xl p-5 space-y-3">
            <div className="flex items-center justify-between gap-3">
                <div>
                    <p className="text-sm font-bold text-gray-900">
                        {estActif ? 'Fournisseur actif' : 'Fournisseur désactivé'}
                    </p>
                    <p className="text-xs text-gray-500 mt-0.5">
                        {estActif
                            ? 'Proposé dans les commandes, réceptions et factures'
                            : 'Masqué des écrans de saisie ; son historique reste consultable'}
                    </p>
                </div>
                <button
                    onClick={basculer}
                    disabled={enAttente}
                    className={`flex items-center gap-2 px-4 py-2 text-xs font-bold rounded-lg border disabled:opacity-50 shrink-0 transition-colors ${
                        estActif
                            ? 'text-red-600 border-red-200 hover:bg-red-50'
                            : 'text-green-700 border-green-200 hover:bg-green-50'
                    }`}
                >
                    {enAttente
                        ? <><Loader2 className="w-3.5 h-3.5 animate-spin" />…</>
                        : <><Power className="w-3.5 h-3.5" />{estActif ? 'Désactiver' : 'Réactiver'}</>
                    }
                </button>
            </div>

            {erreur && (
                <div className="flex items-start gap-2.5 p-3 bg-red-50 border border-red-200 rounded-xl text-xs text-red-700">
                    <AlertCircle className="w-4 h-4 mt-0.5 shrink-0" />
                    {erreur}
                </div>
            )}
        </div>
    )
}
