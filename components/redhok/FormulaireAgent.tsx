'use client'

import { useActionState } from 'react'
import { creerAgent } from '@/actions/agents'
import { Button } from '@/components/ui/button'
import { Loader2, AlertCircle } from 'lucide-react'

const etatInitial = { erreur: undefined as string | undefined }

export default function FormulaireAgent() {
    const [etat, action, enAttente] = useActionState(
        async (_prev: typeof etatInitial, formData: FormData) => {
            const res = await creerAgent(formData)
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
                    <input
                        name="nomComplet"
                        type="text"
                        required
                        placeholder="Ex: Jean Dupont"
                        disabled={enAttente}
                        className="w-full px-3 py-2.5 bg-background border border-input rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-ring disabled:opacity-50"
                    />
                </div>

                <div className="space-y-1.5">
                    <label className="text-sm font-medium text-foreground">
                        Email <span className="text-destructive">*</span>
                    </label>
                    <input
                        name="email"
                        type="email"
                        required
                        placeholder="agent@boldredhok.com"
                        disabled={enAttente}
                        className="w-full px-3 py-2.5 bg-background border border-input rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-ring disabled:opacity-50"
                    />
                </div>

                <div className="space-y-1.5">
                    <label className="text-sm font-medium text-foreground">
                        Mot de passe <span className="text-destructive">*</span>
                    </label>
                    <input
                        name="motDePasse"
                        type="password"
                        required
                        minLength={8}
                        placeholder="Minimum 8 caractères"
                        disabled={enAttente}
                        className="w-full px-3 py-2.5 bg-background border border-input rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-ring disabled:opacity-50"
                    />
                    <p className="text-xs text-muted-foreground">
                        L'agent devra changer ce mot de passe à sa première connexion.
                    </p>
                </div>

            </div>

            <Button type="submit" disabled={enAttente} className="w-full">
                {enAttente ? (
                    <>
                        <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                        Création en cours...
                    </>
                ) : (
                    'Créer l\'agent'
                )}
            </Button>

        </form>
    )
}