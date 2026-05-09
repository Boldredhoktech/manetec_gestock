import { Store, CheckCircle, Zap, Star } from 'lucide-react'

interface Stats {
    totalBoutiques: number
    boutiquesActives: number
    boutiquesPro: number
    boutiquesEnterprise: number
}

interface Props {
    stats: Stats
}

export default function CarteStatsBoutiques({ stats }: Props) {
    const cartes = [
        {
            label: 'Total boutiques',
            valeur: stats.totalBoutiques,
            icone: Store,
            couleur: 'text-blue-500',
            fond: 'bg-blue-500/10',
        },
        {
            label: 'Boutiques actives',
            valeur: stats.boutiquesActives,
            icone: CheckCircle,
            couleur: 'text-green-500',
            fond: 'bg-green-500/10',
        },
        {
            label: 'Plan Pro',
            valeur: stats.boutiquesPro,
            icone: Zap,
            couleur: 'text-amber-500',
            fond: 'bg-amber-500/10',
        },
        {
            label: 'Plan Enterprise',
            valeur: stats.boutiquesEnterprise,
            icone: Star,
            couleur: 'text-purple-500',
            fond: 'bg-purple-500/10',
        },
    ]

    return (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {cartes.map((carte) => {
                const Icone = carte.icone
                return (
                    <div
                        key={carte.label}
                        className="bg-card border border-border rounded-xl p-5 space-y-3"
                    >
                        <div className="flex items-center justify-between">
                            <p className="text-sm text-muted-foreground">{carte.label}</p>
                            <div className={`${carte.fond} p-2 rounded-lg`}>
                                <Icone className={`w-4 h-4 ${carte.couleur}`} />
                            </div>
                        </div>
                        <p className="text-3xl font-bold text-foreground">
                            {carte.valeur}
                        </p>
                    </div>
                )
            })}
        </div>
    )
}