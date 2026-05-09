import { Store, CheckCircle, Zap, Star, AlertTriangle } from 'lucide-react'

interface Stats {
    totalBoutiques:            number
    boutiquesActives:          number
    boutiquesPro:              number
    boutiquesEnterprise:       number
    boutiquesExpirantBientot:  number
}

interface Props { stats: Stats }

export default function CarteStatsRedhok({ stats }: Props) {
    const cartes = [
        {
            label:   'Total boutiques',
            valeur:  stats.totalBoutiques,
            icone:   Store,
            couleur: 'text-blue-500',
            fond:    'bg-blue-500/10',
        },
        {
            label:   'Boutiques actives',
            valeur:  stats.boutiquesActives,
            icone:   CheckCircle,
            couleur: 'text-green-500',
            fond:    'bg-green-500/10',
        },
        {
            label:   'Plan Pro',
            valeur:  stats.boutiquesPro,
            icone:   Zap,
            couleur: 'text-amber-500',
            fond:    'bg-amber-500/10',
        },
        {
            label:   'Plan Enterprise',
            valeur:  stats.boutiquesEnterprise,
            icone:   Star,
            couleur: 'text-purple-500',
            fond:    'bg-purple-500/10',
        },
        {
            label:   'Expirent bientôt',
            valeur:  stats.boutiquesExpirantBientot,
            icone:   AlertTriangle,
            couleur: stats.boutiquesExpirantBientot > 0 ? 'text-destructive' : 'text-muted-foreground',
            fond:    stats.boutiquesExpirantBientot > 0 ? 'bg-destructive/10' : 'bg-muted/40',
        },
    ]

    return (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4">
            {cartes.map(carte => {
                const Icone = carte.icone
                return (
                    <div key={carte.label}
                         className="bg-card border border-border rounded-xl p-4 space-y-3">
                        <div className="flex items-center justify-between">
                            <p className="text-xs text-muted-foreground">{carte.label}</p>
                            <div className={`${carte.fond} p-1.5 rounded-lg`}>
                                <Icone className={`w-3.5 h-3.5 ${carte.couleur}`} />
                            </div>
                        </div>
                        <p className="text-2xl font-bold text-foreground">{carte.valeur}</p>
                    </div>
                )
            })}
        </div>
    )
}