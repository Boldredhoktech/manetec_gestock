'use client'

import { useRouter } from 'next/navigation'
import { useState } from 'react'
import { Filter, X } from 'lucide-react'

interface Option { id: string; nom: string }

interface Props {
    produits:   Option[]
    entrepots:  Option[]
    typeLabels: Record<string, string>
    valeurs: {
        type: string; produit: string; entrepot: string
        debut: string; fin: string
    }
}

// Les filtres passent par l'URL : la sélection reste partageable et
// survit à un rafraîchissement, et le filtrage est fait en base plutôt
// que sur 100 lignes chargées au hasard.
export default function FiltresMouvements({ produits, entrepots, typeLabels, valeurs }: Props) {
    const router = useRouter()
    const [etat, setEtat] = useState(valeurs)

    const actif = Object.values(valeurs).some(Boolean)

    function appliquer(champs = etat) {
        const params = new URLSearchParams()
        Object.entries(champs).forEach(([cle, val]) => { if (val) params.set(cle, val) })
        router.push(`/stock/mouvements?${params.toString()}`)
    }

    function modifier(champ: keyof typeof etat, valeur: string) {
        const suivant = { ...etat, [champ]: valeur }
        setEtat(suivant)
        appliquer(suivant)
    }

    const classeChamp =
        'px-3 py-2 bg-background border border-input rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-ring'

    return (
        <div className="bg-card border border-border rounded-xl p-4 space-y-3">
            <div className="flex items-center justify-between">
                <span className="flex items-center gap-1.5 text-xs font-bold text-muted-foreground uppercase tracking-wide">
                    <Filter className="w-3.5 h-3.5" />
                    Filtrer le journal
                </span>
                {actif && (
                    <button
                        onClick={() => {
                            const vide = { type: '', produit: '', entrepot: '', debut: '', fin: '' }
                            setEtat(vide)
                            router.push('/stock/mouvements')
                        }}
                        className="flex items-center gap-1 text-xs font-medium text-destructive hover:underline"
                    >
                        <X className="w-3.5 h-3.5" />
                        Tout effacer
                    </button>
                )}
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-2">
                <select value={etat.type} onChange={e => modifier('type', e.target.value)} className={classeChamp}>
                    <option value="">Tous les types</option>
                    {Object.entries(typeLabels).map(([code, label]) => (
                        <option key={code} value={code}>{label}</option>
                    ))}
                </select>

                <select value={etat.produit} onChange={e => modifier('produit', e.target.value)} className={classeChamp}>
                    <option value="">Tous les produits</option>
                    {produits.map(p => <option key={p.id} value={p.id}>{p.nom}</option>)}
                </select>

                <select value={etat.entrepot} onChange={e => modifier('entrepot', e.target.value)} className={classeChamp}>
                    <option value="">Tous les entrepôts</option>
                    {entrepots.map(e => <option key={e.id} value={e.id}>{e.nom}</option>)}
                </select>

                <input
                    type="date" value={etat.debut}
                    onChange={e => modifier('debut', e.target.value)}
                    className={classeChamp} aria-label="Date de début"
                />
                <input
                    type="date" value={etat.fin}
                    onChange={e => modifier('fin', e.target.value)}
                    className={classeChamp} aria-label="Date de fin"
                />
            </div>
        </div>
    )
}
