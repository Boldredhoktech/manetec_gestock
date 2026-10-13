'use client'

import { useActionState, useState } from 'react'
import { enregistrerPaiementManuel } from '@/actions/shops'
import { Button } from '@/components/ui/button'
import ChampNombre from '@/components/ui/ChampNombre'
import BadgePlan from '@/components/redhok/BadgePlan'
import { Loader2, AlertCircle, CheckCircle, CreditCard } from 'lucide-react'
import { formatDate } from '@/lib/utils'
import {
    PLANS_ORDONNES, DUREES, labelPlan, prixPeriode, formatMontant, estPlanVendu,
    type Duree, type PlanVendu,
} from '@/lib/abonnement/catalogue'

interface Props {
    boutique: {
        id: string
        plan: string
        plan_expire_le: string | null
        activation_manuelle: boolean
        note_activation: string | null
    }
}

type EtatAction = { erreur?: string; succes?: boolean; expiration?: string; publicId?: string }

const etatInitial: EtatAction = {}

const CHAMP = 'w-full px-3 py-2 bg-background border border-input rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-ring disabled:opacity-50'

// Activation manuelle (D7) : la plateforme enregistre un paiement reçu
// hors ligne (agence, virement, Enterprise sur devis). La prolongation
// suit les mêmes règles que le paiement en ligne : même plan → à la
// suite de l'échéance ; essai en cours → à la suite de l'essai ; autre
// plan → nouvelle période dès aujourd'hui.
export default function CarteAbonnement({ boutique }: Props) {
    const [plan,    setPlan]    = useState<PlanVendu>(estPlanVendu(boutique.plan) ? boutique.plan : 'starter')
    const [duree,   setDuree]   = useState<Duree>('mensuel')
    const tarif                 = prixPeriode(plan, duree)
    const [montant, setMontant] = useState<number>(tarif ?? 0)

    const [etat, action, enAttente] = useActionState(
        async (_prev: EtatAction, formData: FormData): Promise<EtatAction> => enregistrerPaiementManuel(formData),
        etatInitial
    )

    const choisir = (p: PlanVendu, d: Duree) => {
        setPlan(p); setDuree(d)
        setMontant(prixPeriode(p, d) ?? 0)
    }

    const expireOuBientot = boutique.plan_expire_le
        ? new Date(boutique.plan_expire_le) < new Date(Date.now() + 7 * 86400000)
        : false
    const memePlanEnCours = (plan === boutique.plan || boutique.plan === 'essai') && !!boutique.plan_expire_le
        && new Date(boutique.plan_expire_le) > new Date()

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
                        {boutique.plan_expire_le ? formatDate(boutique.plan_expire_le) : 'Illimité'}
                    </p>
                </div>
            </div>

            {boutique.activation_manuelle && boutique.note_activation && (
                <div className="flex items-start gap-2 text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">
                    <CheckCircle className="w-3.5 h-3.5 mt-0.5 shrink-0" />
                    <span>Activation manuelle — {boutique.note_activation}</span>
                </div>
            )}

            {etat.erreur && (
                <div className="flex items-start gap-2 bg-destructive/10 border border-destructive/30 text-destructive rounded-lg px-3 py-2 text-xs">
                    <AlertCircle className="w-3.5 h-3.5 mt-0.5 shrink-0" />
                    {etat.erreur}
                </div>
            )}
            {etat.succes && (
                <div className="flex items-center gap-2 bg-green-50 border border-green-200 text-green-700 rounded-lg px-3 py-2 text-xs">
                    <CheckCircle className="w-3.5 h-3.5 shrink-0" />
                    Paiement {etat.publicId} enregistré. Boutique active jusqu&apos;au {etat.expiration ? formatDate(etat.expiration) : '—'}.
                </div>
            )}

            <form action={action} className="space-y-3">
                <input type="hidden" name="shopId" value={boutique.id} />
                <p className="text-xs font-semibold text-foreground">Enregistrer un paiement reçu hors ligne</p>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div className="space-y-1.5">
                        <label className="text-xs font-medium text-foreground">Plan</label>
                        <select name="plan" value={plan} disabled={enAttente} className={CHAMP}
                                onChange={e => choisir(e.target.value as PlanVendu, duree)}>
                            {PLANS_ORDONNES.map(p => <option key={p} value={p}>{labelPlan(p)}</option>)}
                        </select>
                    </div>
                    <div className="space-y-1.5">
                        <label className="text-xs font-medium text-foreground">Durée</label>
                        <select name="duree" value={duree} disabled={enAttente} className={CHAMP}
                                onChange={e => choisir(plan, e.target.value as Duree)}>
                            {(Object.keys(DUREES) as Duree[]).map(d => <option key={d} value={d}>{DUREES[d].label}</option>)}
                        </select>
                    </div>
                </div>

                <div className="space-y-1.5">
                    <label className="text-xs font-medium text-foreground">
                        Montant reçu (FCFA){tarif !== null && <span className="text-muted-foreground font-normal"> — tarif public : {formatMontant(tarif)}</span>}
                    </label>
                    <ChampNombre name="montant" value={montant} onChange={setMontant} entier disabled={enAttente} className={CHAMP} />
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div className="space-y-1.5">
                        <label className="text-xs font-medium text-foreground">Référence (reçu, virement…)</label>
                        <input name="reference" type="text" disabled={enAttente} className={CHAMP} />
                    </div>
                    <div className="space-y-1.5">
                        <label className="text-xs font-medium text-foreground">
                            Note {tarif !== null && montant !== tarif ? '(obligatoire : montant hors tarif)' : '(optionnelle)'}
                        </label>
                        <input name="note" type="text" placeholder="Ex : payé en agence le…" disabled={enAttente} className={CHAMP} />
                    </div>
                </div>

                <p className="text-xs text-muted-foreground">
                    {memePlanEnCours
                        ? `${boutique.plan === 'essai' ? 'Essai en cours' : 'Même plan'} : ${DUREES[duree].label} s'ajoutent à l'échéance actuelle.`
                        : `Nouveau plan ou boutique expirée : ${DUREES[duree].label} à partir d'aujourd'hui, sans report des jours restants.`}
                </p>

                <Button type="submit" variant="outline" size="sm" disabled={enAttente} className="w-full">
                    {enAttente ? (<><Loader2 className="w-3.5 h-3.5 mr-2 animate-spin" />Enregistrement…</>) : 'Enregistrer le paiement'}
                </Button>
            </form>
        </div>
    )
}
