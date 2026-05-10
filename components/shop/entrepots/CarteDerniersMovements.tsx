import { ArrowDown, ArrowUp, ArrowLeftRight, Activity } from 'lucide-react'
import { formatDateHeure } from '@/lib/utils'

interface Mouvement {
    id: string; public_id: string; type_mouvement: string
    quantite: number; quantite_avant: number; quantite_apres: number
    created_at: string
    products:   { nom: string; unite: string } | null
    shop_users: { nom_complet: string } | null
}

interface Props { mouvements: Mouvement[] }

const TYPE_CONFIG: Record<string, { label: string; couleur: string; bg: string; sens: 'in'|'out'|'trans' }> = {
    entree_initiale:    { label: 'Entrée initiale',  couleur: 'text-green-600',  bg: 'bg-green-100',  sens: 'in'    },
    vente:              { label: 'Vente',             couleur: 'text-red-500',    bg: 'bg-red-100',    sens: 'out'   },
    retour_vente:       { label: 'Retour vente',      couleur: 'text-green-600',  bg: 'bg-green-100',  sens: 'in'    },
    reception:          { label: 'Réception',         couleur: 'text-green-600',  bg: 'bg-green-100',  sens: 'in'    },
    retour_fournisseur: { label: 'Retour fourn.',     couleur: 'text-orange-500', bg: 'bg-orange-100', sens: 'out'   },
    transfert_sortie:   { label: 'Transfert sortant', couleur: 'text-purple-600', bg: 'bg-purple-100', sens: 'out'   },
    transfert_entree:   { label: 'Transfert entrant', couleur: 'text-purple-600', bg: 'bg-purple-100', sens: 'in'    },
    ajustement_positif: { label: 'Ajustement +',      couleur: 'text-green-600',  bg: 'bg-green-100',  sens: 'in'    },
    ajustement_negatif: { label: 'Ajustement -',      couleur: 'text-red-500',    bg: 'bg-red-100',    sens: 'out'   },
    inventaire:         { label: 'Inventaire',        couleur: 'text-gray-500',   bg: 'bg-gray-100',   sens: 'trans' },
}

export default function CarteDerniersMovements({ mouvements }: Props) {
    return (
        <div className="bg-white border border-gray-200 rounded-2xl p-5 shadow-sm space-y-4">

            <div className="flex items-center gap-2">
                <div className="bg-purple-100 p-2 rounded-lg">
                    <Activity className="w-5 h-5 text-purple-600" />
                </div>
                <h2 className="text-sm font-bold text-gray-900">
                    10 derniers mouvements
                </h2>
            </div>

            {mouvements.length === 0 ? (
                <div className="text-center py-8 text-gray-400">
                    <Activity className="w-8 h-8 mx-auto mb-2 opacity-30" />
                    <p className="text-sm">Aucun mouvement enregistré.</p>
                </div>
            ) : (
                <div className="space-y-2">
                    {mouvements.map(m => {
                        const config = TYPE_CONFIG[m.type_mouvement] ?? TYPE_CONFIG.inventaire
                        return (
                            <div key={m.id}
                                 className="flex items-center gap-3 p-3 bg-gray-50 rounded-xl hover:bg-gray-100 transition-colors">

                                {/* Icône sens */}
                                <div className={`shrink-0 p-2 rounded-lg ${config.bg}`}>
                                    {config.sens === 'in'
                                        ? <ArrowDown      className={`w-3.5 h-3.5 ${config.couleur}`} />
                                        : config.sens === 'out'
                                            ? <ArrowUp        className={`w-3.5 h-3.5 ${config.couleur}`} />
                                            : <ArrowLeftRight className={`w-3.5 h-3.5 ${config.couleur}`} />
                                    }
                                </div>

                                {/* Infos */}
                                <div className="flex-1 min-w-0">
                                    <div className="flex items-center justify-between">
                                        <p className="text-xs font-bold text-gray-700 truncate">
                                            {m.products?.nom ?? 'Produit inconnu'}
                                        </p>
                                        <span className={`text-sm font-black ml-2 shrink-0 ${config.couleur}`}>
                      {config.sens === 'in' ? '+' : config.sens === 'out' ? '-' : '±'}
                                            {m.quantite} {m.products?.unite ?? ''}
                    </span>
                                    </div>
                                    <div className="flex items-center justify-between mt-0.5">
                                        <div className="flex items-center gap-2">
                      <span className={`text-xs font-semibold ${config.couleur}`}>
                        {config.label}
                      </span>
                                            {m.shop_users && (
                                                <span className="text-xs text-gray-400">
                          · {m.shop_users.nom_complet}
                        </span>
                                            )}
                                        </div>
                                        <span className="text-xs text-gray-400 shrink-0 ml-2">
                      {m.quantite_avant} → <strong className="text-gray-600">{m.quantite_apres}</strong>
                    </span>
                                    </div>
                                    <p className="text-xs text-gray-400 mt-0.5">
                                        {formatDateHeure(m.created_at)}
                                    </p>
                                </div>
                            </div>
                        )
                    })}
                </div>
            )}
        </div>
    )
}