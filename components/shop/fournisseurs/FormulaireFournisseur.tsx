'use client'

import { useActionState } from 'react'
import { creerFournisseur } from '@/actions/fournisseurs'
import { Button } from '@/components/ui/button'
import { Loader2, AlertCircle } from 'lucide-react'

const etatInitial = { erreur: undefined as string | undefined }

export default function FormulaireFournisseur() {
    const [etat, action, enAttente] = useActionState(
        async (_prev: typeof etatInitial, formData: FormData) => {
            const res = await creerFournisseur(formData)
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
                <h2 className="text-sm font-semibold text-foreground">Informations</h2>

                <div className="space-y-1.5">
                    <label className="text-sm font-medium text-foreground">
                        Nom <span className="text-destructive">*</span>
                    </label>
                    <input name="nom" type="text" required placeholder="Nom du fournisseur"
                           disabled={enAttente}
                           className="w-full px-3 py-2.5 bg-background border border-input rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-ring disabled:opacity-50" />
                </div>

                <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-1.5">
                        <label className="text-sm font-medium text-foreground">Nom contact</label>
                        <input name="nomContact" type="text" placeholder="Personne à contacter"
                               disabled={enAttente}
                               className="w-full px-3 py-2.5 bg-background border border-input rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-ring disabled:opacity-50" />
                    </div>
                    <div className="space-y-1.5">
                        <label className="text-sm font-medium text-foreground">Téléphone</label>
                        <input name="telephone" type="tel" placeholder="+229 97 00 00 00"
                               disabled={enAttente}
                               className="w-full px-3 py-2.5 bg-background border border-input rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-ring disabled:opacity-50" />
                    </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-1.5">
                        <label className="text-sm font-medium text-foreground">Email</label>
                        <input name="email" type="email" placeholder="email@fournisseur.com"
                               disabled={enAttente}
                               className="w-full px-3 py-2.5 bg-background border border-input rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-ring disabled:opacity-50" />
                    </div>
                    <div className="space-y-1.5">
                        <label className="text-sm font-medium text-foreground">Ville</label>
                        <input name="ville" type="text" placeholder="Ville"
                               disabled={enAttente}
                               className="w-full px-3 py-2.5 bg-background border border-input rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-ring disabled:opacity-50" />
                    </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-1.5">
                        <label className="text-sm font-medium text-foreground">IFU</label>
                        <input name="ifu" type="text" placeholder="IFU"
                               disabled={enAttente}
                               className="w-full px-3 py-2.5 bg-background border border-input rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-ring disabled:opacity-50" />
                    </div>
                    <div className="space-y-1.5">
                        <label className="text-sm font-medium text-foreground">RCCM</label>
                        <input name="rccm" type="text" placeholder="RCCM"
                               disabled={enAttente}
                               className="w-full px-3 py-2.5 bg-background border border-input rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-ring disabled:opacity-50" />
                    </div>
                </div>
            </div>

            <Button type="submit" disabled={enAttente} className="w-full">
                {enAttente
                    ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Création...</>
                    : 'Créer le fournisseur'
                }
            </Button>
        </form>
    )
}