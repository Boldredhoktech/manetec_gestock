'use client'

import { useState } from 'react'
import Link from 'next/link'
import { Search, ChevronRight, AlertCircle, UserSquare } from 'lucide-react'
import { formatMontant } from '@/lib/utils'

interface Client {
    id: string; public_id: string; nom: string
    telephone: string | null; email: string | null
    credit_balance: number; advance_balance: number
    change_balance: number; est_actif: boolean
}

interface Props { clients: Client[] }

export default function TableauClients({ clients }: Props) {
    const [recherche, setRecherche] = useState('')

    const filtres = clients.filter(c =>
        c.nom.toLowerCase().includes(recherche.toLowerCase()) ||
        (c.telephone ?? '').includes(recherche) ||
        c.public_id.toLowerCase().includes(recherche.toLowerCase())
    )

    return (
        <div className="space-y-4">

            {/* Barre recherche */}
            <div className="relative">
                <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                <input
                    type="text"
                    placeholder="Rechercher par nom, téléphone, ID..."
                    value={recherche}
                    onChange={e => setRecherche(e.target.value)}
                    className="w-full pl-10 pr-4 py-2.5 bg-white border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[#15335a]/30 focus:border-[#15335a]/40 shadow-sm"
                />
            </div>

            {filtres.length === 0 ? (
                <div className="text-center py-16 space-y-3">
                    <div className="w-16 h-16 bg-[#15335a]/10 rounded-2xl flex items-center justify-center mx-auto">
                        <UserSquare className="w-8 h-8 text-[#15335a]/40" />
                    </div>
                    <p className="text-sm text-gray-400">Aucun client trouvé.</p>
                </div>
            ) : (
                <div className="bg-white border border-gray-200 rounded-2xl shadow-sm overflow-hidden">
                  <div className="overflow-x-auto">
                   <div className="min-w-[720px]">

                    {/* En-tête tableau */}
                    <div
                        className="grid grid-cols-12 gap-3 px-5 py-3 text-xs font-bold text-white"
                        style={{ background: 'linear-gradient(135deg, #15335a 0%, #0f2742 100%)' }}
                    >
                        <div className="col-span-4">Client</div>
                        <div className="col-span-2">Téléphone</div>
                        <div className="col-span-2 text-right">Crédit dû</div>
                        <div className="col-span-2 text-right">Avance</div>
                        <div className="col-span-1 text-right">Monnaie</div>
                        <div className="col-span-1" />
                    </div>

                    {/* Lignes */}
                    <div className="divide-y divide-gray-50">
                        {filtres.map((c, i) => (
                            <Link
                                key={c.id}
                                href={`/admin/clients/${c.id}`}
                                className={`grid grid-cols-12 gap-3 items-center px-5 py-3.5 hover:bg-[#15335a]/5 transition-colors group ${
                                    i % 2 === 0 ? '' : 'bg-gray-50/50'
                                }`}
                            >
                                {/* Nom + ID */}
                                <div className="col-span-4 flex items-center gap-2.5 min-w-0">
                                    <div className="shrink-0 w-8 h-8 bg-[#15335a]/10 rounded-full flex items-center justify-center group-hover:bg-[#15335a]/20 transition-colors">
                    <span className="text-xs font-black text-[#15335a]">
                      {c.nom.charAt(0).toUpperCase()}
                    </span>
                                    </div>
                                    <div className="min-w-0">
                                        <p className="text-sm font-semibold text-gray-900 truncate group-hover:text-[#15335a] transition-colors">
                                            {c.nom}
                                        </p>
                                        <p className="text-xs font-mono text-gray-400 mt-0.5">{c.public_id}</p>
                                    </div>
                                </div>

                                {/* Téléphone */}
                                <div className="col-span-2">
                                    <p className="text-xs text-gray-500">{c.telephone ?? '—'}</p>
                                </div>

                                {/* Crédit dû */}
                                <div className="col-span-2 text-right">
                                    {c.credit_balance > 0 ? (
                                        <span className="inline-flex items-center gap-1 text-xs font-bold text-red-600 bg-red-50 px-2 py-0.5 rounded-full">
                      <AlertCircle className="w-3 h-3" />
                                            {formatMontant(c.credit_balance)}
                    </span>
                                    ) : (
                                        <span className="text-xs text-gray-300">—</span>
                                    )}
                                </div>

                                {/* Avance */}
                                <div className="col-span-2 text-right">
                                    {c.advance_balance > 0 ? (
                                        <span className="text-xs font-bold text-green-600">
                      {formatMontant(c.advance_balance)}
                    </span>
                                    ) : (
                                        <span className="text-xs text-gray-300">—</span>
                                    )}
                                </div>

                                {/* Monnaie */}
                                <div className="col-span-1 text-right">
                                    {c.change_balance > 0 ? (
                                        <span className="text-xs font-bold text-blue-600">
                      {formatMontant(c.change_balance)}
                    </span>
                                    ) : (
                                        <span className="text-xs text-gray-300">—</span>
                                    )}
                                </div>

                                {/* Flèche */}
                                <div className="col-span-1 flex justify-end">
                                    <ChevronRight className="w-4 h-4 text-[#15335a] opacity-0 group-hover:opacity-100 group-hover:translate-x-0.5 transition-all" />
                                </div>
                            </Link>
                        ))}
                    </div>
                   </div>
                  </div>
                </div>
            )}
        </div>
    )
}