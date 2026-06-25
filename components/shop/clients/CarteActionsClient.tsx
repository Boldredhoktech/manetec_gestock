'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import {
    FileText, RotateCcw, Power, Loader2,
    ShoppingCart, AlertCircle, Zap,
} from 'lucide-react'
import { toggleActivationClient } from '@/actions/clients'

interface Props {
    clientId:  string
    clientNom: string
    estActif:  boolean
}

export default function CarteActionsClient({ clientId, clientNom, estActif }: Props) {
    const router      = useRouter()
    const [enAttente, setEnAttente] = useState(false)
    const [erreur, setErreur]       = useState<string>()

    async function handleToggle() {
        setEnAttente(true)
        setErreur(undefined)
        const res = await toggleActivationClient(clientId, !estActif)
        if (res?.erreur) setErreur(res.erreur)
        else router.refresh()
        setEnAttente(false)
    }

    return (
        <div className="space-y-4">

            {/* Actions principales */}
            <div className="bg-white border border-gray-200 rounded-2xl p-5 shadow-sm space-y-3">

                <div className="flex items-center gap-2 pb-3 border-b border-gray-100">
                    <div className="bg-[#f59e0b]/10 p-2 rounded-lg">
                        <Zap className="w-5 h-5 text-[#f59e0b]" />
                    </div>
                    <h2 className="text-sm font-bold text-gray-900">Actions rapides</h2>
                </div>

                {/* Créer une facture */}
                <Link
                    href={`/admin/factures/nouvelle?clientId=${clientId}`}
                    className="flex items-center gap-3 w-full p-3.5 bg-[#15335a] hover:bg-[#0f2742] text-white rounded-xl transition-all duration-200 hover:shadow-lg hover:shadow-[#15335a]/30 group"
                >
                    <div className="bg-white/20 p-2 rounded-lg group-hover:bg-white/30 transition-colors">
                        <FileText className="w-4 h-4 text-white" />
                    </div>
                    <div className="flex-1">
                        <p className="text-sm font-bold">Créer une facture</p>
                        <p className="text-xs text-white/70">Client pré-sélectionné</p>
                    </div>
                </Link>

                {/* Créer un devis */}
                <Link
                    href={`/admin/factures/devis/nouveau?clientId=${clientId}`}
                    className="flex items-center gap-3 w-full p-3.5 bg-purple-600 hover:bg-purple-700 text-white rounded-xl transition-all duration-200 hover:shadow-lg hover:shadow-purple-500/30 group"
                >
                    <div className="bg-white/20 p-2 rounded-lg group-hover:bg-white/30 transition-colors">
                        <ShoppingCart className="w-4 h-4 text-white" />
                    </div>
                    <div className="flex-1">
                        <p className="text-sm font-bold">Créer une proforma</p>
                        <p className="text-xs text-white/70">Client pré-sélectionné</p>
                    </div>
                </Link>

                {/* Créer un avoir */}
                <Link
                    href={`/admin/factures?nouveauAvoir=true&clientId=${clientId}&clientNom=${encodeURIComponent(clientNom)}`}
                    className="flex items-center gap-3 w-full p-3.5 bg-amber-500 hover:bg-amber-600 text-white rounded-xl transition-all duration-200 hover:shadow-lg hover:shadow-amber-500/30 group"
                >
                    <div className="bg-white/20 p-2 rounded-lg group-hover:bg-white/30 transition-colors">
                        <RotateCcw className="w-4 h-4 text-white" />
                    </div>
                    <div className="flex-1">
                        <p className="text-sm font-bold">Émettre un avoir</p>
                        <p className="text-xs text-white/70">Sur une facture existante</p>
                    </div>
                </Link>

            </div>

            {/* Zone danger */}
            <div className="bg-white border border-gray-200 rounded-2xl p-5 shadow-sm space-y-3">

                <p className="text-xs font-bold text-gray-400 uppercase tracking-wider">
                    Zone de gestion
                </p>

                {erreur && (
                    <div className="flex items-center gap-2 p-2.5 bg-red-50 border border-red-200 rounded-lg text-xs text-red-600">
                        <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                        {erreur}
                    </div>
                )}

                <button
                    type="button"
                    onClick={handleToggle}
                    disabled={enAttente}
                    className={`flex items-center gap-3 w-full p-3.5 rounded-xl border-2 transition-all duration-200 ${
                        estActif
                            ? 'border-red-200 text-red-600 hover:bg-red-50 hover:border-red-300'
                            : 'border-green-200 text-green-600 hover:bg-green-50 hover:border-green-300'
                    } disabled:opacity-50`}
                >
                    {enAttente
                        ? <Loader2 className="w-4 h-4 animate-spin" />
                        : <Power className="w-4 h-4" />
                    }
                    <div className="text-left">
                        <p className="text-sm font-bold">
                            {estActif ? 'Désactiver le client' : 'Réactiver le client'}
                        </p>
                        <p className="text-xs opacity-70">
                            {estActif
                                ? 'Le client n\'apparaîtra plus dans les listes'
                                : 'Le client redeviendra actif'
                            }
                        </p>
                    </div>
                </button>

            </div>

        </div>
    )
}