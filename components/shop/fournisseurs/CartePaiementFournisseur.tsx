'use client'

// Régler le solde d'un fournisseur — nouveau design (lot 4) : bouton
// « Payer » sur la carte du solde, formulaire en modale fermée dès que
// le paiement est enregistré.

import { useActionState } from 'react'
import { useRouter } from 'next/navigation'
import { payerFournisseur } from '@/actions/fournisseurs'
import { Button } from '@/components/ui/button'
import { Loader2, AlertCircle, Banknote } from 'lucide-react'
import { formatMontant } from '@/lib/utils'
import ChampsReglement from '@/components/shop/compta/ChampsReglement'
import { BoutonModale, PiedFormulaire } from '@/components/ui/ModalesPartagees'

interface Props {
    fournisseur: { id: string; solde_dû: number }
}

interface EtatAction { erreur?: string }

const champ = 'w-full px-3 py-2.5 bg-background border border-input rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-ring disabled:opacity-50'

function FormulairePaiementFournisseur({ fournisseur, onSucces }: Props & { onSucces: () => void }) {
    const router = useRouter()
    const [etat, action, enAttente] = useActionState(
        async (_prev: EtatAction, formData: FormData): Promise<EtatAction> => {
            const res = await payerFournisseur(formData)
            if (res?.erreur) return { erreur: res.erreur }
            router.refresh()
            onSucces()
            return {}
        },
        {}
    )

    return (
        <form action={action} className="space-y-4">
            <input type="hidden" name="supplierId" value={fournisseur.id} />

            <p className="text-sm text-muted-foreground">
                Solde dû : <strong className="text-[var(--rouge-texte)]">{formatMontant(fournisseur.solde_dû)}</strong>
            </p>

            {etat.erreur && (
                <div role="alert" className="flex items-start gap-2 bg-[var(--rouge-doux)] border border-[var(--rouge-texte)]/30 text-[var(--rouge-texte)] rounded-xl px-3 py-2.5 text-sm">
                    <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                    {etat.erreur}
                </div>
            )}

            <div className="space-y-1.5">
                <label className="text-sm font-medium text-foreground">Montant</label>
                <input name="montant" type="number" min="0.01" step="0.01"
                       defaultValue={fournisseur.solde_dû}
                       required disabled={enAttente} className={champ} />
            </div>

            <div className="space-y-3">
                <ChampsReglement compact disabled={enAttente} />
            </div>

            <input name="note" type="text" placeholder="Note (facultative)"
                   disabled={enAttente} className={champ} />

            <PiedFormulaire>
                <Button type="submit" disabled={enAttente} className="h-11 px-5 rounded-xl font-semibold">
                    {enAttente
                        ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Enregistrement...</>
                        : 'Confirmer le paiement'
                    }
                </Button>
            </PiedFormulaire>
        </form>
    )
}

export default function CartePaiementFournisseur({ fournisseur }: Props) {
    return (
        <BoutonModale libelle="Payer le fournisseur" icone={Banknote} variante="accent"
                      titre="Payer le fournisseur"
                      description="L'argent sort du compte choisi (caisse, banque, Mobile Money…).">
            {fermer => <FormulairePaiementFournisseur fournisseur={fournisseur} onSucces={fermer} />}
        </BoutonModale>
    )
}
