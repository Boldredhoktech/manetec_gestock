'use client'

import { useActionState } from 'react'
import { creerCategorie } from '@/actions/produits'
import { Button } from '@/components/ui/button'
import { Loader2, AlertCircle, Tags } from 'lucide-react'

interface Categorie {
    id: string
    public_id: string
    nom: string
    parent_id: string | null
    est_actif: boolean
}

interface Props { categories: Categorie[] }

const etatInitial = { erreur: undefined as string | undefined, succes: undefined as boolean | undefined }

export default function GestionCategories({ categories }: Props) {
    const racines    = categories.filter(c => !c.parent_id)
    const sousCategs = categories.filter(c => c.parent_id)

    const [etat, action, enAttente] = useActionState(
        async (_prev: typeof etatInitial, formData: FormData) => {
            const res = await creerCategorie(formData)
            if (res?.erreur) return { erreur: res.erreur, succes: undefined }
            return { succes: true, erreur: undefined }
        },
        etatInitial
    )

    return (
        <div className="space-y-5">

            {/* Formulaire ajout */}
            <form action={action} className="bg-card border border-border rounded-xl p-5 space-y-4">
                <h2 className="text-sm font-semibold text-foreground">Nouvelle catégorie</h2>

                {etat.erreur && (
                    <div className="flex items-center gap-2 bg-destructive/10 border border-destructive/30 text-destructive rounded-lg px-3 py-2 text-xs">
                        <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                        {etat.erreur}
                    </div>
                )}
                {etat.succes && (
                    <div className="text-xs text-green-600 bg-green-50 border border-green-200 rounded-lg px-3 py-2">
                        Catégorie créée avec succès.
                    </div>
                )}

                <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1.5">
                        <label className="text-xs font-medium text-foreground">
                            Nom <span className="text-destructive">*</span>
                        </label>
                        <input name="nom" type="text" required placeholder="Ex: Électronique"
                               disabled={enAttente}
                               className="w-full px-3 py-2 bg-background border border-input rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-ring disabled:opacity-50" />
                    </div>
                    <div className="space-y-1.5">
                        <label className="text-xs font-medium text-foreground">Catégorie parente</label>
                        <select name="parentId" disabled={enAttente}
                                className="w-full px-3 py-2 bg-background border border-input rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-ring disabled:opacity-50">
                            <option value="">— Aucune (racine) —</option>
                            {racines.map(c => <option key={c.id} value={c.id}>{c.nom}</option>)}
                        </select>
                    </div>
                </div>

                <Button type="submit" size="sm" disabled={enAttente}>
                    {enAttente
                        ? <Loader2 className="w-3.5 h-3.5 animate-spin" />
                        : 'Ajouter'
                    }
                </Button>
            </form>

            {/* Liste */}
            <div className="bg-card border border-border rounded-xl overflow-hidden">
                {categories.length === 0 ? (
                    <div className="text-center py-10 text-muted-foreground text-sm">
                        Aucune catégorie.
                    </div>
                ) : (
                    <div className="divide-y divide-border">
                        {racines.map(c => (
                            <div key={c.id}>
                                <div className="flex items-center gap-2.5 px-4 py-3">
                                    <Tags className="w-4 h-4 text-primary shrink-0" />
                                    <span className="text-sm font-medium text-foreground">{c.nom}</span>
                                    <span className="text-xs font-mono text-muted-foreground ml-auto">{c.public_id}</span>
                                </div>
                                {sousCategs.filter(s => s.parent_id === c.id).map(s => (
                                    <div key={s.id} className="flex items-center gap-2.5 px-4 py-2.5 bg-muted/20 pl-10">
                                        <Tags className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
                                        <span className="text-sm text-foreground">{s.nom}</span>
                                        <span className="text-xs font-mono text-muted-foreground ml-auto">{s.public_id}</span>
                                    </div>
                                ))}
                            </div>
                        ))}
                    </div>
                )}
            </div>
        </div>
    )
}