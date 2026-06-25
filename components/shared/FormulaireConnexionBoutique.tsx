'use client'

import { useActionState, useEffect, useState } from 'react'
import { connexionBoutique } from '@/actions/auth'
import { Button } from '@/components/ui/button'
import { Store, User, Lock, Hash, Loader2, AlertCircle } from 'lucide-react'

const etatInitial = { erreur: undefined as string | undefined }

// Clés de stockage local (jamais le mot de passe — géré par le navigateur)
const CLE_SHOP  = 'manetec.shopId'
const CLE_USER  = 'manetec.identifiant'
const CLE_GARDE = 'manetec.souvenir'

export default function FormulaireConnexionBoutique() {
    const [shopId, setShopId]           = useState('')
    const [identifiant, setIdentifiant] = useState('')
    const [souvenir, setSouvenir]       = useState(false)

    // Pré-remplissage depuis le navigateur (après montage → pas de mismatch SSR)
    useEffect(() => {
        try {
            if (localStorage.getItem(CLE_GARDE) === '1') {
                setShopId(localStorage.getItem(CLE_SHOP) ?? '')
                setIdentifiant(localStorage.getItem(CLE_USER) ?? '')
                setSouvenir(true)
            }
        } catch { /* localStorage indisponible */ }
    }, [])

    const [etat, action, enAttente] = useActionState(
        async (_etatPrecedent: typeof etatInitial, formData: FormData) => {
            // Persister (ou effacer) les identifiants selon le choix — depuis l'état React
            try {
                if (souvenir) {
                    localStorage.setItem(CLE_GARDE, '1')
                    localStorage.setItem(CLE_SHOP, shopId.trim().toUpperCase())
                    localStorage.setItem(CLE_USER, identifiant.trim())
                } else {
                    localStorage.removeItem(CLE_GARDE)
                    localStorage.removeItem(CLE_SHOP)
                    localStorage.removeItem(CLE_USER)
                }
            } catch { /* ignore */ }

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
                            value={shopId}
                            onChange={e => setShopId(e.target.value)}
                            className="w-full pl-10 pr-4 py-2.5 bg-background border border-input rounded-lg text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring focus:border-transparent disabled:opacity-50 disabled:cursor-not-allowed uppercase transition"
                        />
                    </div>
                    <p className="text-xs text-muted-foreground">
                        Fourni par Manetec Gestock lors de la création de votre boutique
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
                            value={identifiant}
                            onChange={e => setIdentifiant(e.target.value)}
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

                {/* Se souvenir de moi */}
                <label className="flex items-start gap-2.5 cursor-pointer select-none">
                    <input
                        type="checkbox"
                        name="souvenir"
                        checked={souvenir}
                        onChange={e => setSouvenir(e.target.checked)}
                        disabled={enAttente}
                        className="mt-0.5 h-4 w-4 rounded border-input accent-primary cursor-pointer"
                    />
                    <span className="text-sm text-muted-foreground leading-snug">
                        Se souvenir de mon identifiant boutique sur cet appareil
                        <span className="block text-xs text-muted-foreground/70 mt-0.5">
                            Le mot de passe n'est jamais enregistré par l'application. À éviter sur un appareil partagé.
                        </span>
                    </span>
                </label>

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
                Manetec Gestock · Propulsé par Manetec Inter BJ
            </p>

        </div>
    )
}
