import { Warehouse, CheckCircle, Star } from 'lucide-react'

interface Entrepot {
    id: string
    public_id: string
    nom: string
    description: string | null
    adresse: string | null
    est_actif: boolean
    est_defaut: boolean
}

interface Props { entrepots: Entrepot[] }

export default function TableauEntrepots({ entrepots }: Props) {
    if (entrepots.length === 0) {
        return (
            <div className="text-center py-16 text-muted-foreground text-sm">
                Aucun entrepôt. Créez-en un pour commencer.
            </div>
        )
    }

    return (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {entrepots.map(e => (
                <div
                    key={e.id}
                    className="bg-card border border-border rounded-xl p-5 space-y-3"
                >
                    <div className="flex items-start justify-between">
                        <div className="bg-primary/10 p-2 rounded-lg">
                            <Warehouse className="w-5 h-5 text-primary" />
                        </div>
                        <div className="flex items-center gap-1.5">
                            {e.est_defaut && (
                                <span className="flex items-center gap-1 text-xs text-amber-600 bg-amber-50 border border-amber-200 px-2 py-0.5 rounded-full font-medium">
                  <Star className="w-3 h-3" />
                  Défaut
                </span>
                            )}
                            {e.est_actif ? (
                                <span className="flex items-center gap-1 text-xs text-green-600 font-medium">
                  <CheckCircle className="w-3.5 h-3.5" />
                  Actif
                </span>
                            ) : (
                                <span className="text-xs text-muted-foreground">Inactif</span>
                            )}
                        </div>
                    </div>
                    <div>
                        <p className="font-semibold text-foreground">{e.nom}</p>
                        <p className="text-xs font-mono text-muted-foreground mt-0.5">
                            {e.public_id}
                        </p>
                    </div>
                    {e.description && (
                        <p className="text-xs text-muted-foreground">{e.description}</p>
                    )}
                    {e.adresse && (
                        <p className="text-xs text-muted-foreground">{e.adresse}</p>
                    )}
                </div>
            ))}
        </div>
    )
}