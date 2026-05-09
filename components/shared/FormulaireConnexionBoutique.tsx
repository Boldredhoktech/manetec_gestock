'use client'

import { useActionState } from 'react'
import { connexionBoutique } from '@/actions/auth'
import { Button } from '@/components/ui/button'
import { Store, User, Lock, Hash, Loader2, AlertCircle } from 'lucide-react'

const etatInitial = { erreur: undefined as string | undefined }

export default function FormulaireConnexionBoutique() {
    const [etat, action, enAttente] = useActionState(
        async (_etatPrecedent: typeof etatInitial, formData: FormData) => {
            const resultat = await connexionBoutique(formData)
            return resultat ?? etatInitial
        },
        etatInitial
    )

    return (
        <div className="bg-card border border-border rounded-2xl shadow-lg p-8 space-y-6">

            {/* En-tête */}
            <div className="text-center space-y-2">
                <div className="flex justify-center">
                    <div className="bg-primary/10 p-3 rounded-full">
                        <Store className="w-8 h-8 text-primary" />
                    </div>
                </div>
                <h1 className="text-2xl font-bold text-foreground">
                    Manetec Gestock
                </h1>
                <p className="text-sm text-muted-foreground">
                    Connectez-vous à votre boutique
                </p>
            </div>

            {/* Message d'erreur */}
            {etat.erreur && (
                <div className="flex items-start gap-3 bg-destructive/10 border border-destructive/30 text-destructive rounded-lg px-4 py-3 text-sm">
                    <AlertCircle className="w-4 h-4 mt-0.5 shrink-0" />
                    <span>{etat.erreur}</span>
                </div>
            )}

            {/* Formulaire */}
            <form action={action} className="space-y-4">

                {/* ID Boutique */}
                <div className="space-y-1.5">
                    <label
                        htmlFor="shopPublicId"
                        className="text-sm font-medium text-foreground"
                    >
                        Identifiant boutique
                    </label>
                    <div className="relative">
                        <Hash className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                        <input
                            id="shopPublicId"
                            name="shopPublicId"
                            type="text"
                            required
                            autoComplete="off"
                            placeholder="SHOP-00001"
                            disabled={enAttente}
                            className="w-full pl-10 pr-4 py-2.5 bg-background border border-input rounded-lg text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring focus:border-transparent disabled:opacity-50 disabled:cursor-not-allowed uppercase transition"
                        />
                    </div>
                    <p className="text-xs text-muted-foreground">
                        Fourni par Bold Redhok Tech lors de la création de votre boutique
                    </p>
                </div>

                {/* Identifiant utilisateur */}
                <div className="space-y-1.5">
                    <label
                        htmlFor="identifiant"
                        className="text-sm font-medium text-foreground"
                    >
                        Identifiant utilisateur
                    </label>
                    <div className="relative">
                        <User className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                        <input
                            id="identifiant"
                            name="identifiant"
                            type="text"
                            required
                            autoComplete="username"
                            placeholder="votre.identifiant"
                            disabled={enAttente}
                            className="w-full pl-10 pr-4 py-2.5 bg-background border border-input rounded-lg text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring focus:border-transparent disabled:opacity-50 disabled:cursor-not-allowed transition"
                        />
                    </div>
                </div>

                {/* Mot de passe */}
                <div className="space-y-1.5">
                    <label
                        htmlFor="motDePasse"
                        className="text-sm font-medium text-foreground"
                    >
                        Mot de passe
                    </label>
                    <div className="relative">
                        <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                        <input
                            id="motDePasse"
                            name="motDePasse"
                            type="password"
                            required
                            autoComplete="current-password"
                            placeholder="••••••••••"
                            disabled={enAttente}
                            className="w-full pl-10 pr-4 py-2.5 bg-background border border-input rounded-lg text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring focus:border-transparent disabled:opacity-50 disabled:cursor-not-allowed transition"
                        />
                    </div>
                </div>

                {/* Bouton */}
                <Button
                    type="submit"
                    disabled={enAttente}
                    className="w-full"
                >
                    {enAttente ? (
                        <>
                            <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                            Connexion en cours...
                        </>
                    ) : (
                        'Se connecter'
                    )}
                </Button>

            </form>

            {/* Pied */}
            <p className="text-center text-xs text-muted-foreground">
                Manetec Gestock · Propulsé par Bold Redhok Tech
            </p>

        </div>
    )
}