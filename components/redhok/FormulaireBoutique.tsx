'use client'

import { useActionState } from 'react'
import { creerBoutique } from '@/actions/shops'
import { Button } from '@/components/ui/button'
import { Loader2, AlertCircle } from 'lucide-react'

const etatInitial = { erreur: undefined as string | undefined }

const DEVISES = ['FCFA', 'EUR', 'USD', 'GHS', 'NGN', 'XOF']
const PAYS = ['Bénin', 'Togo', 'Côte d\'Ivoire', 'Sénégal', 'Mali', 'Burkina Faso', 'Niger', 'Ghana', 'Nigeria', 'Cameroun', 'France']

export default function FormulaireBoutique() {
    const [etat, action, enAttente] = useActionState(
        async (_prev: typeof etatInitial, formData: FormData) => {
            const res = await creerBoutique(formData)
            return res ?? etatInitial
        },
        etatInitial
    )

    return (
        <form action={action} className="space-y-6">

            {etat.erreur && (
                <div className="flex items-start gap-3 bg-destructive/10 border border-destructive/30 text-destructive rounded-lg px-4 py-3 text-sm">
                    <AlertCircle className="w-4 h-4 mt-0.5 shrink-0" />
                    <span>{etat.erreur}</span>
                </div>
            )}

            {/* Informations principales */}
            <div className="bg-card border border-border rounded-xl p-5 space-y-4">
                <h2 className="text-sm font-semibold text-foreground">
                    Informations de la boutique
                </h2>

                <div className="space-y-1.5">
                    <label className="text-sm font-medium text-foreground">
                        Nom de la boutique <span className="text-destructive">*</span>
                    </label>
                    <input
                        name="nom"
                        type="text"
                        required
                        placeholder="Ex: Pharmacie Centrale"
                        disabled={enAttente}
                        className="w-full px-3 py-2.5 bg-background border border-input rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-ring disabled:opacity-50"
                    />
                </div>

                <div className="space-y-1.5">
                    <label className="text-sm font-medium text-foreground">
                        Nom du propriétaire / SuperAdmin <span className="text-destructive">*</span>
                    </label>
                    <input
                        name="nomProprietaire"
                        type="text"
                        required
                        placeholder="Ex: Kofi Mensah"
                        disabled={enAttente}
                        className="w-full px-3 py-2.5 bg-background border border-input rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-ring disabled:opacity-50"
                    />
                </div>

                <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-1.5">
                        <label className="text-sm font-medium text-foreground">Pays</label>
                        <select
                            name="pays"
                            disabled={enAttente}
                            className="w-full px-3 py-2.5 bg-background border border-input rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-ring disabled:opacity-50"
                        >
                            {PAYS.map(p => (
                                <option key={p} value={p}>{p}</option>
                            ))}
                        </select>
                    </div>
                    <div className="space-y-1.5">
                        <label className="text-sm font-medium text-foreground">Ville</label>
                        <input
                            name="ville"
                            type="text"
                            placeholder="Ex: Cotonou"
                            disabled={enAttente}
                            className="w-full px-3 py-2.5 bg-background border border-input rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-ring disabled:opacity-50"
                        />
                    </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-1.5">
                        <label className="text-sm font-medium text-foreground">
                            Téléphone <span className="text-destructive">*</span>
                        </label>
                        <input
                            name="telephone1"
                            type="tel"
                            required
                            placeholder="+229 97 00 00 00"
                            disabled={enAttente}
                            className="w-full px-3 py-2.5 bg-background border border-input rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-ring disabled:opacity-50"
                        />
                    </div>
                    <div className="space-y-1.5">
                        <label className="text-sm font-medium text-foreground">Email</label>
                        <input
                            name="email"
                            type="email"
                            placeholder="boutique@email.com"
                            disabled={enAttente}
                            className="w-full px-3 py-2.5 bg-background border border-input rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-ring disabled:opacity-50"
                        />
                    </div>
                </div>

                <div className="space-y-1.5">
                    <label className="text-sm font-medium text-foreground">Devise</label>
                    <select
                        name="devise"
                        disabled={enAttente}
                        className="w-full px-3 py-2.5 bg-background border border-input rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-ring disabled:opacity-50"
                    >
                        {DEVISES.map(d => (
                            <option key={d} value={d}>{d}</option>
                        ))}
                    </select>
                </div>
            </div>

            {/* Abonnement */}
            <div className="bg-card border border-border rounded-xl p-5 space-y-4">
                <h2 className="text-sm font-semibold text-foreground">
                    Plan d'abonnement
                </h2>

                <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-1.5">
                        <label className="text-sm font-medium text-foreground">Plan</label>
                        <select
                            name="plan"
                            disabled={enAttente}
                            className="w-full px-3 py-2.5 bg-background border border-input rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-ring disabled:opacity-50"
                        >
                            <option value="starter">Starter</option>
                            <option value="pro">Pro</option>
                            <option value="enterprise">Enterprise</option>
                        </select>
                    </div>
                    <div className="space-y-1.5">
                        <label className="text-sm font-medium text-foreground">
                            Durée (jours)
                        </label>
                        <input
                            name="joursExpiration"
                            type="number"
                            defaultValue={30}
                            min={1}
                            max={365}
                            disabled={enAttente}
                            className="w-full px-3 py-2.5 bg-background border border-input rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-ring disabled:opacity-50"
                        />
                    </div>
                </div>
            </div>

            <Button type="submit" disabled={enAttente} className="w-full">
                {enAttente ? (
                    <>
                        <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                        Création en cours...
                    </>
                ) : (
                    'Créer la boutique'
                )}
            </Button>

        </form>
    )
}