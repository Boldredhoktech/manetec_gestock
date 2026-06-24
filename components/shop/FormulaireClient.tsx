'use client'

import { useActionState } from 'react'
import { creerClient } from '@/actions/clients'
import { Button } from '@/components/ui/button'
import { Loader2, AlertCircle } from 'lucide-react'

const etatInitial = { erreur: undefined as string | undefined }

const PAYS = [
    'Bénin', 'Togo', 'Côte d\'Ivoire', 'Sénégal', 'Mali',
    'Burkina Faso', 'Niger', 'Ghana', 'Nigeria', 'Cameroun', 'France', 'Autre',
]

export default function FormulaireClient() {
    const [etat, action, enAttente] = useActionState(
        async (_prev: typeof etatInitial, formData: FormData) => {
            const res = await creerClient(formData)
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

            {/* Informations principales */}
            <div className="bg-card border border-border rounded-xl p-5 space-y-4">
                <h2 className="text-sm font-semibold text-foreground">Informations personnelles</h2>

                <div className="space-y-1.5">
                    <label className="text-sm font-medium text-foreground">
                        Nom complet <span className="text-destructive">*</span>
                    </label>
                    <input name="nom" type="text" required
                           placeholder="Ex: Jean Kofi" disabled={enAttente}
                           className="w-full px-3 py-2.5 bg-background border border-input rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-ring disabled:opacity-50" />
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div className="space-y-1.5">
                        <label className="text-sm font-medium text-foreground">Téléphone</label>
                        <input name="telephone" type="tel"
                               placeholder="+229 97 00 00 00" disabled={enAttente}
                               className="w-full px-3 py-2.5 bg-background border border-input rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-ring disabled:opacity-50" />
                    </div>
                    <div className="space-y-1.5">
                        <label className="text-sm font-medium text-foreground">Email</label>
                        <input name="email" type="email"
                               placeholder="client@email.com" disabled={enAttente}
                               className="w-full px-3 py-2.5 bg-background border border-input rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-ring disabled:opacity-50" />
                    </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div className="space-y-1.5">
                        <label className="text-sm font-medium text-foreground">Ville</label>
                        <input name="ville" type="text"
                               placeholder="Ex: Cotonou" disabled={enAttente}
                               className="w-full px-3 py-2.5 bg-background border border-input rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-ring disabled:opacity-50" />
                    </div>
                    <div className="space-y-1.5">
                        <label className="text-sm font-medium text-foreground">Pays</label>
                        <select name="pays" disabled={enAttente}
                                className="w-full px-3 py-2.5 bg-background border border-input rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-ring disabled:opacity-50">
                            <option value="">— Sélectionner —</option>
                            {PAYS.map(p => <option key={p} value={p}>{p}</option>)}
                        </select>
                    </div>
                </div>

                <div className="space-y-1.5">
                    <label className="text-sm font-medium text-foreground">Adresse</label>
                    <input name="adresse" type="text"
                           placeholder="Adresse complète" disabled={enAttente}
                           className="w-full px-3 py-2.5 bg-background border border-input rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-ring disabled:opacity-50" />
                </div>

                <div className="space-y-1.5">
                    <label className="text-sm font-medium text-foreground">Site web</label>
                    <input name="site_web" type="url"
                           placeholder="https://..." disabled={enAttente}
                           className="w-full px-3 py-2.5 bg-background border border-input rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-ring disabled:opacity-50" />
                </div>
            </div>

            {/* Informations légales */}
            <div className="bg-card border border-border rounded-xl p-5 space-y-4">
                <h2 className="text-sm font-semibold text-foreground">
                    Informations légales (optionnel)
                </h2>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div className="space-y-1.5">
                        <label className="text-sm font-medium text-foreground">IFU</label>
                        <input name="ifu" type="text"
                               placeholder="Numéro IFU" disabled={enAttente}
                               className="w-full px-3 py-2.5 bg-background border border-input rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-ring disabled:opacity-50" />
                    </div>
                    <div className="space-y-1.5">
                        <label className="text-sm font-medium text-foreground">RCCM</label>
                        <input name="rccm" type="text"
                               placeholder="Numéro RCCM" disabled={enAttente}
                               className="w-full px-3 py-2.5 bg-background border border-input rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-ring disabled:opacity-50" />
                    </div>
                </div>
            </div>

            {/* Notes */}
            <div className="bg-card border border-border rounded-xl p-5 space-y-4">
                <h2 className="text-sm font-semibold text-foreground">Notes internes</h2>
                <textarea name="notes" rows={3}
                          placeholder="Informations supplémentaires (non visibles par le client)..."
                          disabled={enAttente}
                          className="w-full px-3 py-2.5 bg-background border border-input rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-ring disabled:opacity-50 resize-none" />
            </div>

            <Button type="submit" disabled={enAttente} className="w-full">
                {enAttente
                    ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Création...</>
                    : 'Créer le client'
                }
            </Button>

        </form>
    )
}