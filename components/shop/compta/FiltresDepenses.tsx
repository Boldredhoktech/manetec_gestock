'use client'

import { useRouter, usePathname, useSearchParams } from 'next/navigation'
import { MOYENS_PAIEMENT } from '@/lib/constants/moyens-paiement'
import { Button } from '@/components/ui/button'
import { X } from 'lucide-react'
import { bornesDuMois } from '@/lib/dates/periode'

// Les filtres vivent dans l'URL : un état filtré se partage, se met en
// favori et survit au rafraîchissement.
export default function FiltresDepenses({
    categories,
}: {
    categories: { id: string; nom: string; est_actif: boolean }[]
}) {
    const router       = useRouter()
    const pathname     = usePathname()
    const searchParams = useSearchParams()

    const valeur = (cle: string) => searchParams.get(cle) ?? ''
    const actif  = ['debut', 'fin', 'categorie', 'moyen', 'annulees']
        .some(cle => searchParams.get(cle))

    function poser(modifs: Record<string, string>) {
        const params = new URLSearchParams(searchParams.toString())
        for (const [cle, val] of Object.entries(modifs)) {
            if (val) params.set(cle, val)
            else params.delete(cle)
        }
        // Un filtre qui change remet à la première page : rester page 3
        // d'une sélection qui n'en compte plus qu'une afficherait du vide.
        params.delete('page')
        router.push(`${pathname}?${params.toString()}`)
    }

    function moisEnCours() {
        const m = new Date()
        const { debut, fin } = bornesDuMois(m.getMonth() + 1, m.getFullYear())
        poser({ debut, fin })
    }

    const classe = 'px-3 py-2 bg-background border border-input rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-ring'

    return (
        <div className="bg-card border border-border rounded-xl p-4 sm:p-5 space-y-3">
            <div className="flex flex-wrap items-end gap-3">
                <div className="space-y-1">
                    <label htmlFor="f-debut" className="text-xs font-medium text-muted-foreground block">
                        Du
                    </label>
                    <input id="f-debut" type="date" value={valeur('debut')}
                           onChange={e => poser({ debut: e.target.value })}
                           className={classe} />
                </div>

                <div className="space-y-1">
                    <label htmlFor="f-fin" className="text-xs font-medium text-muted-foreground block">
                        Au
                    </label>
                    <input id="f-fin" type="date" value={valeur('fin')}
                           onChange={e => poser({ fin: e.target.value })}
                           className={classe} />
                </div>

                <div className="space-y-1">
                    <label htmlFor="f-cat" className="text-xs font-medium text-muted-foreground block">
                        Catégorie
                    </label>
                    <select id="f-cat" value={valeur('categorie')}
                            onChange={e => poser({ categorie: e.target.value })}
                            className={classe}>
                        <option value="">Toutes</option>
                        {categories.map(c => (
                            <option key={c.id} value={c.id}>
                                {c.nom}{c.est_actif ? '' : ' (retirée)'}
                            </option>
                        ))}
                    </select>
                </div>

                <div className="space-y-1">
                    <label htmlFor="f-moyen" className="text-xs font-medium text-muted-foreground block">
                        Moyen
                    </label>
                    <select id="f-moyen" value={valeur('moyen')}
                            onChange={e => poser({ moyen: e.target.value })}
                            className={classe}>
                        <option value="">Tous</option>
                        {MOYENS_PAIEMENT.map(m => (
                            <option key={m.code} value={m.code}>{m.label}</option>
                        ))}
                    </select>
                </div>

                <Button type="button" variant="outline" size="sm" onClick={moisEnCours}>
                    Ce mois-ci
                </Button>

                {actif && (
                    <Button type="button" variant="ghost" size="sm"
                            onClick={() => router.push(pathname)}>
                        <X className="w-3.5 h-3.5 mr-1.5" />
                        Tout effacer
                    </Button>
                )}
            </div>

            <label className="flex items-center gap-2 text-xs text-muted-foreground cursor-pointer w-fit">
                <input type="checkbox"
                       checked={searchParams.get('annulees') === '1'}
                       onChange={e => poser({ annulees: e.target.checked ? '1' : '' })}
                       className="rounded border-input" />
                Afficher aussi les dépenses annulées
            </label>
        </div>
    )
}
