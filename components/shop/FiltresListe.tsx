'use client'

import { useRouter, usePathname, useSearchParams } from 'next/navigation'
import { useState, useEffect } from 'react'
import { Search, X } from 'lucide-react'
import { Button } from '@/components/ui/button'

// Barre de recherche et de filtres, partagée par les listes de clients
// et de factures. L'état vit dans l'URL : une sélection se partage, se
// met en favori et survit au rafraîchissement.
export interface Filtre {
    cle:     string
    label:   string
    options: { valeur: string; label: string }[]
}

export default function FiltresListe({
    placeholder, filtres = [],
}: {
    placeholder: string
    filtres?:    Filtre[]
}) {
    const router       = useRouter()
    const pathname     = usePathname()
    const searchParams = useSearchParams()

    const rechercheUrl = searchParams.get('q') ?? ''
    const [recherche, setRecherche] = useState(rechercheUrl)

    // La recherche part après une pause de frappe : une requête par
    // lettre saisie serait du gaspillage, et l'écran sauterait.
    useEffect(() => {
        if (recherche === rechercheUrl) return

        const minuteur = setTimeout(() => {
            const params = new URLSearchParams(searchParams.toString())
            if (recherche.trim()) params.set('q', recherche.trim())
            else params.delete('q')
            params.delete('page')
            router.push(`${pathname}?${params.toString()}`)
        }, 350)

        return () => clearTimeout(minuteur)
    }, [recherche, rechercheUrl, pathname, router, searchParams])

    function poser(cle: string, valeur: string) {
        const params = new URLSearchParams(searchParams.toString())
        if (valeur) params.set(cle, valeur)
        else params.delete(cle)
        // Un filtre qui change remet à la première page.
        params.delete('page')
        router.push(`${pathname}?${params.toString()}`)
    }

    const actif = recherche.trim() !== ''
        || filtres.some(f => searchParams.get(f.cle))

    return (
        <div className="bg-card border border-border rounded-xl p-4 flex flex-wrap items-end gap-3">
            <div className="flex-1 min-w-[200px] space-y-1">
                <label htmlFor="recherche" className="text-xs font-medium text-muted-foreground block">
                    Rechercher
                </label>
                <div className="relative">
                    <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
                    <input
                        id="recherche"
                        type="search"
                        value={recherche}
                        onChange={e => setRecherche(e.target.value)}
                        placeholder={placeholder}
                        className="w-full pl-9 pr-3 py-2 bg-background border border-input rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                    />
                </div>
            </div>

            {filtres.map(f => (
                <div key={f.cle} className="space-y-1">
                    <label htmlFor={`f-${f.cle}`} className="text-xs font-medium text-muted-foreground block">
                        {f.label}
                    </label>
                    <select
                        id={`f-${f.cle}`}
                        value={searchParams.get(f.cle) ?? ''}
                        onChange={e => poser(f.cle, e.target.value)}
                        className="px-3 py-2 bg-background border border-input rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                    >
                        <option value="">Tous</option>
                        {f.options.map(o => (
                            <option key={o.valeur} value={o.valeur}>{o.label}</option>
                        ))}
                    </select>
                </div>
            ))}

            {actif && (
                <Button type="button" variant="ghost" size="sm"
                        onClick={() => { setRecherche(''); router.push(pathname) }}>
                    <X className="w-3.5 h-3.5 mr-1.5" />
                    Tout effacer
                </Button>
            )}
        </div>
    )
}
