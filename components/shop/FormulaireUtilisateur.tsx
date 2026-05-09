'use client'

import { useActionState, useState } from 'react'
import { creerUtilisateur } from '@/actions/users'
import { Button } from '@/components/ui/button'
import { Loader2, AlertCircle } from 'lucide-react'
import { EXTENSIONS_VENDEUR, PERMISSIONS } from '@/lib/constants/permissions'

const etatInitial = { erreur: undefined as string | undefined }

const EXTENSIONS_LABELS: Record<string, string> = {
    [PERMISSIONS.FOURNISSEURS_CREER]:    'Créer des fournisseurs',
    [PERMISSIONS.RAPPORTS_GENERER]:      'Générer des rapports',
    [PERMISSIONS.CLIENTS_ACCES_COMPLET]: 'Accès complet clients (crédit, avances)',
}

export default function FormulaireUtilisateur() {
    const [role, setRole] = useState('vendeur')

    const [etat, action, enAttente] = useActionState(
        async (_prev: typeof etatInitial, formData: FormData) => {
            const res = await creerUtilisateur(formData)
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
                <h2 className="text-sm font-semibold text-foreground">
                    Informations du compte
                </h2>

                <div className="space-y-1.5">
                    <label className="text-sm font-medium text-foreground">
                        Nom complet <span className="text-destructive">*</span>
                    </label>
                    <input
                        name="nomComplet"
                        type="text"
                        required
                        placeholder="Ex: Marie Dupont"
                        disabled={enAttente}
                        className="w-full px-3 py-2.5 bg-background border border-input rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-ring disabled:opacity-50"
                    />
                </div>

                <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-1.5">
                        <label className="text-sm font-medium text-foreground">
                            Identifiant <span className="text-destructive">*</span>
                        </label>
                        <input
                            name="identifiant"
                            type="text"
                            required
                            placeholder="marie.dupont"
                            disabled={enAttente}
                            className="w-full px-3 py-2.5 bg-background border border-input rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-ring disabled:opacity-50"
                        />
                        <p className="text-xs text-muted-foreground">
                            Utilisé pour la connexion
                        </p>
                    </div>
                    <div className="space-y-1.5">
                        <label className="text-sm font-medium text-foreground">
                            Mot de passe <span className="text-destructive">*</span>
                        </label>
                        <input
                            name="motDePasse"
                            type="password"
                            required
                            minLength={6}
                            placeholder="Min. 6 caractères"
                            disabled={enAttente}
                            className="w-full px-3 py-2.5 bg-background border border-input rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-ring disabled:opacity-50"
                        />
                    </div>
                </div>

                <div className="space-y-1.5">
                    <label className="text-sm font-medium text-foreground">
                        Rôle <span className="text-destructive">*</span>
                    </label>
                    <select
                        name="role"
                        value={role}
                        onChange={e => setRole(e.target.value)}
                        disabled={enAttente}
                        className="w-full px-3 py-2.5 bg-background border border-input rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-ring disabled:opacity-50"
                    >
                        <option value="vendeur">Vendeur</option>
                        <option value="stock_manager">Gestionnaire de stock</option>
                        <option value="comptable">Comptable</option>
                    </select>
                </div>
            </div>

            {/* Extensions vendeur */}
            {role === 'vendeur' && (
                <div className="bg-card border border-border rounded-xl p-5 space-y-3">
                    <h2 className="text-sm font-semibold text-foreground">
                        Permissions étendues (optionnel)
                    </h2>
                    <p className="text-xs text-muted-foreground">
                        Ces permissions s'ajoutent aux permissions de base du vendeur.
                    </p>
                    <div className="space-y-2">
                        {EXTENSIONS_VENDEUR.map(permission => (
                            <label
                                key={permission}
                                className="flex items-center gap-2.5 cursor-pointer"
                            >
                                <input
                                    type="checkbox"
                                    name="permissions"
                                    value={permission}
                                    disabled={enAttente}
                                    className="rounded"
                                />
                                <span className="text-sm text-foreground">
                  {EXTENSIONS_LABELS[permission] ?? permission}
                </span>
                            </label>
                        ))}
                    </div>
                </div>
            )}

            <Button type="submit" disabled={enAttente} className="w-full">
                {enAttente ? (
                    <>
                        <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                        Création en cours...
                    </>
                ) : (
                    'Créer l\'utilisateur'
                )}
            </Button>

        </form>
    )
}