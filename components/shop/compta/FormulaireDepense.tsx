'use client'

import { useActionState } from 'react'
import { creerDepense } from '@/actions/comptabilite'
import { Button } from '@/components/ui/button'
import { Loader2, AlertCircle } from 'lucide-react'
import { MOYENS_PAIEMENT } from '@/lib/constants/moyens-paiement'

interface Props { categories: { id: string; nom: string }[] }
const etatInitial = { erreur: undefined as string | undefined }

export default function FormulaireDepense({ categories }: Props) {
    const [etat, action, enAttente] = useActionState(
        async (_prev: typeof etatInitial, formData: FormData) => {
            const res = await creerDepense(formData)
            return res ?? etatInitial
        },
        etatInitial
    )

    return (
        <form action={action} className="space-y-5">
            {etat.erreur && (
                <div className="flex items-start gap-3 bg-destructive/10 border border-destructive/30 text-destructive rounded-lg px-4 py-3 text-sm">
                    <AlertCircle className="w-4 h-4 mt-0.5 shrink-0" />
                    <span>{etat.erreur}</span>
                </div>
            )}

            <div className="bg-card border border-border rounded-xl p-5 space-y-4">
                <h2 className="text-sm font-semibold text-foreground">Détails de la dépense</h2>

                <div className="space-y-1.5">
                    <label className="text-sm font-medium text-foreground">
                        Libellé <span className="text-destructive">*</span>
                    </label>
                    <input name="libelle" type="text" required
                           placeholder="Ex: Achat fournitures de bureau"
                           disabled={enAttente}
                           className="w-full px-3 py-2.5 bg-background border border-input rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-ring disabled:opacity-50" />
                </div>

                <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-1.5">
                        <label className="text-sm font-medium text-foreground">
                            Montant <span className="text-destructive">*</span>
                        </label>
                        <input name="montant" type="number" min="0.01" step="0.01"
                               required disabled={enAttente}
                               className="w-full px-3 py-2.5 bg-background border border-input rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-ring disabled:opacity-50" />
                    </div>
                    <div className="space-y-1.5">
                        <label className="text-sm font-medium text-foreground">Date</label>
                        <input name="dateDepense" type="date"
                               defaultValue={new Date().toISOString().split('T')[0]}
                               disabled={enAttente}
                               className="w-full px-3 py-2.5 bg-background border border-input rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-ring disabled:opacity-50" />
                    </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-1.5">
                        <label className="text-sm font-medium text-foreground">Catégorie</label>
                        <select name="categoryId" disabled={enAttente}
                                className="w-full px-3 py-2.5 bg-background border border-input rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-ring disabled:opacity-50">
                            <option value="">— Aucune —</option>
                            {categories.map(c => (
                                <option key={c.id} value={c.id}>{c.nom}</option>
                            ))}
                        </select>
                    </div>
                    <div className="space-y-1.5">
                        <label className="text-sm font-medium text-foreground">Moyen de paiement</label>
                        <select name="moyen" disabled={enAttente}
                                className="w-full px-3 py-2.5 bg-background border border-input rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-ring disabled:opacity-50">
                            {MOYENS_PAIEMENT.map(m => (
                                <option key={m.code} value={m.code}>{m.label}</option>
                            ))}
                        </select>
                    </div>
                </div>

                <div className="space-y-1.5">
                    <label className="text-sm font-medium text-foreground">Note</label>
                    <input name="note" type="text" placeholder="Note optionnelle"
                           disabled={enAttente}
                           className="w-full px-3 py-2.5 bg-background border border-input rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-ring disabled:opacity-50" />
                </div>
            </div>

            <Button type="submit" disabled={enAttente} className="w-full">
                {enAttente
                    ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Enregistrement...</>
                    : 'Enregistrer la dépense'
                }
            </Button>
        </form>
    )
}