'use client'

// Encaisser un règlement sur une facture — nouveau design (lot 3) :
// le formulaire s'ouvre en modale depuis le bouton « Encaisser » de la
// fiche (BoutonEncaisserFacture) et se ferme dès que c'est enregistré.

import { useActionState, useState } from 'react'
import { useRouter } from 'next/navigation'
import { payerFacture } from '@/actions/facturation'
import { Button } from '@/components/ui/button'
import ChampNombre from '@/components/ui/ChampNombre'
import ChampsReglement from '@/components/shop/compta/ChampsReglement'
import { BoutonModale, PiedFormulaire } from '@/components/ui/ModalesPartagees'
import { Loader2, AlertCircle, Wallet } from 'lucide-react'
import { formatMontant } from '@/lib/utils'

interface Props {
    facture: { id: string; montant_restant: number; montant_ttc: number }
}

interface EtatAction { erreur?: string }

const champ = 'w-full px-3 py-2.5 bg-background border border-input rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-ring disabled:opacity-50'

function FormulairePaiementFacture({ facture, onSucces }: Props & { onSucces: () => void }) {
    const router = useRouter()
    const [montant, setMontant] = useState(facture.montant_restant)
    const aujourdhui = new Date().toISOString().split('T')[0]

    const [etat, action, enAttente] = useActionState(
        async (_prev: EtatAction, formData: FormData): Promise<EtatAction> => {
            const res = await payerFacture(formData)
            if (res?.erreur) return { erreur: res.erreur }
            router.refresh()
            onSucces()
            return {}
        },
        {}
    )

    return (
        <form action={action} className="space-y-4">
            <input type="hidden" name="factureId" value={facture.id} />

            <p className="text-sm text-muted-foreground">
                Reste à payer : <strong className="text-[var(--rouge-texte)]">{formatMontant(facture.montant_restant)}</strong>
            </p>

            {etat.erreur && (
                <div role="alert" className="flex items-start gap-2 bg-[var(--rouge-doux)] border border-[var(--rouge-texte)]/30 text-[var(--rouge-texte)] rounded-xl px-3 py-2.5 text-sm">
                    <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                    {etat.erreur}
                </div>
            )}

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="space-y-1.5">
                    <label className="text-sm font-medium text-foreground">Montant</label>
                    <ChampNombre name="montant" value={montant} onChange={setMontant}
                                 required disabled={enAttente} className={champ} />
                </div>
                <div className="space-y-1.5">
                    <label className="text-sm font-medium text-foreground">Date du règlement</label>
                    <input name="datePaiement" type="date" required
                           defaultValue={aujourdhui} max={aujourdhui}
                           disabled={enAttente} className={champ} />
                    <p className="text-xs text-muted-foreground">
                        La date où l&apos;argent a été reçu, pas celle de la saisie.
                    </p>
                </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <ChampsReglement disabled={enAttente} />
            </div>

            {/* La référence est portée par ChampsReglement, qui ne
                l'affiche que pour les moyens qui l'exigent. */}
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

/** Bouton « Encaisser » de la fiche facture : ouvre le règlement en modale. */
export default function CartePaiementFacture({ facture }: Props) {
    return (
        <BoutonModale libelle="Encaisser" icone={Wallet} variante="accent"
                      titre="Enregistrer un paiement"
                      description="L'argent entre sur le compte choisi (caisse, banque, Mobile Money…).">
            {fermer => <FormulairePaiementFacture facture={facture} onSucces={fermer} />}
        </BoutonModale>
    )
}
