'use client'

import { useActionState } from 'react'
import { creerCategorieDepense } from '@/actions/comptabilite'
import { Button } from '@/components/ui/button'
import { Loader2, Tags } from 'lucide-react'

interface Categorie { id: string; nom: string }
interface Props { categories: Categorie[] }
interface EtatAction { erreur?: string; succes?: boolean }

export default function GestionCategoriesDepense({ categories }: Props) {
    const [etat, action, enAttente] = useActionState(
        async (_prev: EtatAction, formData: FormData): Promise<EtatAction> => {
            const res = await creerCategorieDepense(formData)
            if (res?.erreur) return { erreur: res.erreur }
            return { succes: true }
        },
        {}
    )

    return (
        <div className="bg-card border border-border rounded-xl p-5 space-y-3">
            <h2 className="text-sm font-semibold text-foreground">Catégories de dépenses</h2>

            <div className="flex flex-wrap gap-2">
                {categories.map(c => (
                    <span key={c.id}
                          className="inline-flex items-center gap-1 px-2.5 py-1 bg-muted rounded-full text-xs font-medium text-foreground">
            <Tags className="w-3 h-3" />
                        {c.nom}
          </span>
                ))}
            </div>

            <form action={action} className="flex gap-2">
                <input name="nom" type="text" placeholder="Nouvelle catégorie"
                       disabled={enAttente} required
                       className="flex-1 px-3 py-2 bg-background border border-input rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-ring disabled:opacity-50" />
                <Button type="submit" size="sm" disabled={enAttente}>
                    {enAttente ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : 'Ajouter'}
                </Button>
            </form>

            {etat.erreur && (
                <p className="text-xs text-destructive">{etat.erreur}</p>
            )}
        </div>
    )
}