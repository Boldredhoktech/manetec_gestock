import { ArrowDown, ArrowUp, ArrowLeftRight, History } from 'lucide-react'
import { formatDate } from '@/lib/utils'

interface Mouvement {
    id: string; public_id: string; type_mouvement: string
    quantite: number; quantite_avant: number; quantite_apres: number
    note: string | null; created_at: string
    warehouses: { nom: string } | null
    shop_users: { nom_complet: string } | null
}

interface Props { mouvements: Mouvement[] }

const TYPE_CONFIG: Record<string, { label: string; couleur: string; bg: string; icone: 'in'|'out'|'trans' }> = {
    entree_initiale:    { label: 'Entrée initiale',   couleur: 'text-green-600',  bg: 'bg-green-50',  icone: 'in'    },
    vente:              { label: 'Vente',              couleur: 'text-red-500',    bg: 'bg-red-50',    icone: 'out'   },
    retour_vente:       { label: 'Retour vente',       couleur: 'text-green-600',  bg: 'bg-green-50',  icone: 'in'    },
    reception:          { label: 'Réception',          couleur: 'text-green-600',  bg: 'bg-green-50',  icone: 'in'    },
    retour_fournisseur: { label: 'Retour fourn.',      couleur: 'text-orange-500', bg: 'bg-orange-50', icone: 'out'   },
    transfert_sortie:   { label: 'Transfert sortant',  couleur: 'text-purple-600', bg: 'bg-purple-50', icone: 'trans' },
    transfert_entree:   { label: 'Transfert entrant',  couleur: 'text-purple-600', bg: 'bg-purple-50', icone: 'trans' },
    ajustement_positif: { label: 'Ajustement +',       couleur: 'text-green-600',  bg: 'bg-green-50',  icone: 'in'    },
    ajustement_negatif: { label: 'Ajustement -',       couleur: 'text-red-500',    bg: 'bg-red-50',    icone: 'out'   },
    inventaire:         { label: 'Inventaire',         couleur: 'text-muted-foreground',   bg: 'bg-[var(--surface2)]',   icone: 'trans' },
}

export default function CarteMouvementsProduit({ mouvements }: Props) {
    return (
        <div className="bg-card border border-border rounded-2xl p-5 shadow-sm space-y-4">

            <div className="flex items-center gap-2">
                <div className="bg-[var(--primary-soft)] p-2 rounded-lg">
                    <History className="w-5 h-5 text-[var(--primary-strong)]" />
                </div>
                <h2 className="text-sm font-bold text-foreground">5 derniers mouvements</h2>
            </div>

            {mouvements.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground/80 text-sm">
                    Aucun mouvement enregistré.
                </div>
            ) : (
                <div className="space-y-2.5">
                    {mouvements.map(m => {
                        const config  = TYPE_CONFIG[m.type_mouvement] ?? TYPE_CONFIG.inventaire
                        const estEntree = config.icone === 'in'
                        return (
                            <div key={m.id}
                                 className={`flex items-start gap-3 p-3 ${config.bg} rounded-xl`}>
                                <div className={`mt-0.5 p-1.5 rounded-lg bg-card border ${
                                    estEntree ? 'border-green-200' :
                                        config.icone === 'out' ? 'border-red-200' : 'border-purple-200'
                                }`}>
                                    {config.icone === 'in'
                                        ? <ArrowDown className="w-3.5 h-3.5 text-green-600" />
                                        : config.icone === 'out'
                                            ? <ArrowUp className="w-3.5 h-3.5 text-red-500" />
                                            : <ArrowLeftRight className="w-3.5 h-3.5 text-purple-600" />
                                    }
                                </div>
                                <div className="flex-1 min-w-0">
                                    <div className="flex items-center justify-between">
                                        <p className={`text-xs font-bold ${config.couleur}`}>{config.label}</p>
                                        <p className={`text-sm font-black ${config.couleur}`}>
                                            {estEntree ? '+' : config.icone === 'out' ? '-' : '±'}{m.quantite}
                                        </p>
                                    </div>
                                    <div className="flex items-center gap-2 mt-0.5">
                                        <p className="text-xs text-muted-foreground/80 font-mono">{m.public_id}</p>
                                        {m.warehouses && (
                                            <p className="text-xs text-muted-foreground/80">· {m.warehouses.nom}</p>
                                        )}
                                    </div>
                                    <div className="flex items-center justify-between mt-1">
                                        <p className="text-xs text-muted-foreground">
                                            {m.shop_users?.nom_complet ?? 'Système'}
                                        </p>
                                        <p className="text-xs text-muted-foreground/80">
                                            {m.quantite_avant} → <span className="font-bold text-muted-foreground">{m.quantite_apres}</span>
                                        </p>
                                    </div>
                                    {m.note && (
                                        <p className="text-xs text-muted-foreground mt-1 italic">{m.note}</p>
                                    )}
                                    <p className="text-xs text-muted-foreground/80 mt-0.5">{formatDate(m.created_at)}</p>
                                </div>
                            </div>
                        )
                    })}
                </div>
            )}
        </div>
    )
}