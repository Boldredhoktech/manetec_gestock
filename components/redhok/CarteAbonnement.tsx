'use client'

import { useActionState } from 'react'
import { changerPlanAbonnement } from '@/actions/shops'
import { Button } from '@/components/ui/button'
import BadgePlan from '@/components/redhok/BadgePlan'
import { Loader2, AlertCircle, CheckCircle, CreditCard } from 'lucide-react'
import { formatDate } from '@/lib/utils'

interface Props {
    boutique: {
        id: string
        plan: string
        plan_expire_le: string | null
        activation_manuelle: boolean
        note_activation: string | null
    }
}

interface EtatAction {
    erreur?: string
    succes?: boolean
}

const etatInitial: EtatAction = {}

export default function CarteAbonnement({ boutique }: Props) {
    const [etat, action, enAttente] = useActionState(
        async (_prev: EtatAction, formData: FormData): Promise<EtatAction> => {
            const res = await changerPlanAbonnement(formData)
            if (res?.erreur) return { erreur: res.erreur }
            return { succes: true }
        },
        etatInitial
    )

    const expireOuBientot = boutique.plan_expire_le
        ? new Date(boutique.plan_expire_le) < new Date(Date.now() + 7 * 86400000)
        : false

    return (
        <div className="bg-card border border-border rounded-xl p-5 space-y-4">
            <h2 className="text-sm font-semibold text-foreground flex items-center gap-2">
                <CreditCard className="w-4 h-4" />
                Abonnement
            </h2>

            {/* Statut actuel */}
            <div className="flex items-center justify-between p-3 bg-muted/40 rounded-lg">
                <div className="space-y-1">
                    <p className="text-xs text-muted-foreground">Plan actuel</p>
                    <BadgePlan plan={boutique.plan} />
                </div>
                <div className="text-right space-y-1">
                    <p className="text-xs text-muted-foreground">Expiration</p>
                    <p className={`text-sm font-medium ${expireOuBientot ? 'text-destructive' : 'text-foreground'}`}>
                        {boutique.plan_expire_le
                            ? formatDate(boutique.plan_expire_le)
                            : 'Illimité'}
                    </p>
                </div>
            </div>

            {boutique.activation_manuelle && (
                <div className="flex items-start gap-2 text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">
                    <CheckCircle className="w-3.5 h-3.5 mt-0.5 shrink-0" />
                    <span>
            Activation manuelle — {boutique.note_activation ?? 'Aucune note'}
          </span>
                </div>
            )}

            {/* Messages retour */}
            {etat.erreur && (
                <div className="flex items-start gap-2 bg-destructive/10 border border-destructive/30 text-destructive rounded-lg px-3 py-2 text-xs">
                    <AlertCircle className="w-3.5 h-3.5 mt-0.5 shrink-0" />
                    {etat.erreur}
                </div>
            )}
            {etat.succes && (
                <div className="flex items-center gap-2 bg-green-50 border border-green-200 text-green-700 rounded-lg px-3 py-2 text-xs">
                    <CheckCircle className="w-3.5 h-3.5 shrink-0" />
                    Plan mis à jour avec succès.
                </div>
            )}

            {/* Formulaire changement plan */}
            <form action={action} className="space-y-3">
                <input type="hidden" name="shopId" value={boutique.id} />

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div className="space-y-1.5">
                        <label className="text-xs font-medium text-foreground">
                            Nouveau plan
                        </label>
                        <select
                            name="plan"
                            defaultValue={boutique.plan}
                            disabled={enAttente}
                            className="w-full px-3 py-2 bg-background border border-input rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-ring disabled:opacity-50"
                        >
                            <option value="starter">Starter</option>
                            <option value="pro">Pro</option>
                            <option value="enterprise">Enterprise</option>
                        </select>
                    </div>
                    <div className="space-y-1.5">
                        <label className="text-xs font-medium text-foreground">
                            Durée (jours)
                        </label>
                        <input
                            name="joursExpiration"
                            type="number"
                            defaultValue={30}
                            min={1}
                            max={365}
                            disabled={enAttente}
                            className="w-full px-3 py-2 bg-background border border-input rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-ring disabled:opacity-50"
                        />
                    </div>
                </div>

                <div className="space-y-1.5">
                    <label className="text-xs font-medium text-foreground">
                        Note d'activation (optionnelle)
                    </label>
                    <input
                        name="noteActivation"
                        type="text"
                        placeholder="Ex: Paiement reçu en agence le..."
                        disabled={enAttente}
                        className="w-full px-3 py-2 bg-background border border-input rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-ring disabled:opacity-50"
                    />
                </div>

                <div className="flex items-center gap-2">
                    <input
                        type="checkbox"
                        id="activationManuelle"
                        name="activationManuelle"
                        value="true"
                        className="rounded"
                    />
                    <label
                        htmlFor="activationManuelle"
                        className="text-xs text-muted-foreground cursor-pointer"
                    >
                        Marquer comme activation manuelle (paiement en agence)
                    </label>
                </div>

                <Button
                    type="submit"
                    variant="outline"
                    size="sm"
                    disabled={enAttente}
                    className="w-full"
                >
                    {enAttente ? (
                        <>
                            <Loader2 className="w-3.5 h-3.5 mr-2 animate-spin" />
                            Mise à jour...
                        </>
                    ) : (
                        'Mettre à jour le plan'
                    )}
                </Button>
            </form>
        </div>
    )
}