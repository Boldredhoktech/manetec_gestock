import Link from 'next/link'
import { Warehouse, CheckCircle, Star, ChevronRight, AlertTriangle } from 'lucide-react'

interface Entrepot {
    id: string; public_id: string; nom: string
    description: string | null; adresse: string | null
    est_actif: boolean; est_defaut: boolean
}

interface Props { entrepots: Entrepot[] }

export default function TableauEntrepots({ entrepots }: Props) {
    if (entrepots.length === 0) {
        return (
            <div className="text-center py-16 space-y-3">
                <div className="w-16 h-16 bg-[var(--primary-soft)] rounded-2xl flex items-center justify-center mx-auto">
                    <Warehouse className="w-8 h-8 text-[var(--primary-strong)]/50" />
                </div>
                <p className="text-sm text-muted-foreground/80">Aucun entrepôt. Créez-en un pour commencer.</p>
            </div>
        )
    }

    return (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {entrepots.map(e => (
                <Link
                    key={e.id}
                    href={`/stock/entrepots/${e.id}`}
                    className="group bg-card border border-border rounded-2xl p-5 hover:border-primary/40 hover:shadow-lg hover:shadow-black/10 transition-all duration-200 space-y-4 block"
                >
                    {/* En-tête carte */}
                    <div className="flex items-start justify-between">
                        <div className={`p-2.5 rounded-xl transition-colors ${
                            e.est_actif
                                ? 'bg-[var(--primary-soft)] group-hover:bg-[var(--primary-soft)]'
                                : 'bg-muted'
                        }`}>
                            <Warehouse className={`w-6 h-6 ${e.est_actif ? 'text-[var(--primary-strong)]' : 'text-muted-foreground/80'}`} />
                        </div>
                        <div className="flex items-center gap-1.5">
                            {e.est_defaut && (
                                <span className="flex items-center gap-1 text-xs text-amber-600 bg-amber-50 border border-amber-200 px-2 py-0.5 rounded-full font-bold">
                  <Star className="w-3 h-3" />
                  Défaut
                </span>
                            )}
                            {e.est_actif ? (
                                <span className="flex items-center gap-1 text-xs text-green-600 font-semibold">
                  <CheckCircle className="w-3.5 h-3.5" />
                  Actif
                </span>
                            ) : (
                                <span className="text-xs text-muted-foreground/80">Inactif</span>
                            )}
                        </div>
                    </div>

                    {/* Nom et ID */}
                    <div>
                        <p className="font-bold text-foreground group-hover:text-primary transition-colors">
                            {e.nom}
                        </p>
                        <p className="text-xs font-mono text-muted-foreground/80 mt-0.5">{e.public_id}</p>
                    </div>

                    {/* Description / Adresse */}
                    {(e.description || e.adresse) && (
                        <div className="space-y-1">
                            {e.description && (
                                <p className="text-xs text-muted-foreground line-clamp-1">{e.description}</p>
                            )}
                            {e.adresse && (
                                <p className="text-xs text-muted-foreground/80 line-clamp-1">{e.adresse}</p>
                            )}
                        </div>
                    )}

                    {/* Footer carte */}
                    <div className="flex items-center justify-between pt-2 border-t border-border">
                        <span className="text-xs text-muted-foreground/80">Voir les détails</span>
                        <ChevronRight className="w-4 h-4 text-[var(--primary-strong)] group-hover:translate-x-1 transition-transform" />
                    </div>
                </Link>
            ))}
        </div>
    )
}