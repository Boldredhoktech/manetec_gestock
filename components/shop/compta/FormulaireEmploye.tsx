'use client'

import { useActionState, useState } from 'react'
import { creerEmploye } from '@/actions/comptabilite'
import { Button } from '@/components/ui/button'
import ChampNombre from '@/components/ui/ChampNombre'
import { Loader2, AlertCircle } from 'lucide-react'

const etatInitial = { erreur: undefined as string | undefined }

export interface CompteBoutique {
    id:          string
    nom_complet: string
    identifiant: string
}

export default function FormulaireEmploye({
    comptes = [],
}: {
    comptes?: CompteBoutique[]
}) {
    const [salaire, setSalaire] = useState(0)
    const aujourdhui = new Date().toISOString().split('T')[0]

    const [etat, action, enAttente] = useActionState(
        async (_prev: typeof etatInitial, formData: FormData) => {
            const res = await creerEmploye(formData)
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
                <div className="space-y-1.5">
                    <label className="text-sm font-medium text-foreground">
                        Nom complet <span className="text-destructive">*</span>
                    </label>
                    <input name="nomComplet" type="text" required
                           placeholder="Ex: Kofi Mensah" disabled={enAttente}
                           className="w-full px-3 py-2.5 bg-background border border-input rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-ring disabled:opacity-50" />
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div className="space-y-1.5">
                        <label className="text-sm font-medium text-foreground">Poste</label>
                        <input name="poste" type="text" placeholder="Ex: Caissier"
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

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div className="space-y-1.5">
                        <label className="text-sm font-medium text-foreground">Salaire de base</label>
                        <ChampNombre
                            name="salaireBase" value={salaire} onChange={setSalaire}
                            disabled={enAttente}
                            className="w-full px-3 py-2.5 bg-background border border-input rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-ring disabled:opacity-50" />
                    </div>
                    <div className="space-y-1.5">
                        <label className="text-sm font-medium text-foreground">Date d'embauche</label>
                        <input name="dateEmbauche" type="date" max={aujourdhui} disabled={enAttente}
                               className="w-full px-3 py-2.5 bg-background border border-input rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-ring disabled:opacity-50" />
                    </div>
                </div>

                <div className="space-y-1.5">
                    <label className="text-sm font-medium text-foreground">
                        Compte utilisateur
                    </label>
                    <select name="userId" defaultValue="" disabled={enAttente}
                            className="w-full px-3 py-2.5 bg-background border border-input rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-ring disabled:opacity-50">
                        <option value="">— Aucun —</option>
                        {comptes.map(c => (
                            <option key={c.id} value={c.id}>
                                {c.nom_complet} · {c.identifiant}
                            </option>
                        ))}
                    </select>
                    <p className="text-xs text-muted-foreground">
                        Relie cette fiche de paie au compte avec lequel la personne se connecte.
                        Facultatif, mais c&apos;est ce lien qui permettra plus tard de rapprocher
                        ce qu&apos;un vendeur encaisse de ce qu&apos;il coûte.
                    </p>
                </div>
            </div>

            <Button type="submit" disabled={enAttente} className="w-full">
                {enAttente
                    ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Création...</>
                    : 'Créer l\'employé'
                }
            </Button>
        </form>
    )
}