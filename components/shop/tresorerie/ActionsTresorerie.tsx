'use client'

// Boutons d'action de la trésorerie (nouveau design, lot 2) : chacun ouvre
// son formulaire en MODALE. Le formulaire n'est monté que modale ouverte :
// il repart vierge à chaque ouverture.

import { useState } from 'react'
import { ArrowLeftRight, ArrowUpDown, Plus, Scale, Pencil } from 'lucide-react'
import {
    FormulaireNouveauCompte, FormulaireVirement, FormulaireOperationProprietaire,
    FormulaireRapprochement, FormulaireModifierCompte, BoutonEtatCompte,
} from '@/components/shop/tresorerie/FormulairesTresorerie'
import type { CompteChoix } from '@/lib/tresorerie/comptes'

type Ouverte = null | 'virement' | 'operation' | 'compte' | 'rappro' | 'modifier'

const bouton = 'h-11 px-4 rounded-xl text-sm font-semibold flex items-center gap-2 transition-colors'
const secondaire = `${bouton} border border-input bg-card text-foreground hover:bg-muted`

export function ActionsListeTresorerie({ comptes }: { comptes: CompteChoix[] }) {
    const [ouverte, setOuverte] = useState<Ouverte>(null)
    const fermer = { onFermer: () => setOuverte(null) }
    return (
        <>
            <button type="button" onClick={() => setOuverte('operation')} className={secondaire}>
                <ArrowUpDown className="w-4 h-4" aria-hidden="true" />Retrait / apport
            </button>
            <button type="button" onClick={() => setOuverte('virement')} disabled={comptes.length < 2}
                    title={comptes.length < 2 ? 'Il faut au moins deux comptes actifs.' : undefined}
                    className={`${bouton} bg-[#FACC15] text-[#1A1400] hover:brightness-95 disabled:opacity-50`}>
                <ArrowLeftRight className="w-4 h-4" aria-hidden="true" />Virement entre comptes
            </button>
            <button type="button" onClick={() => setOuverte('compte')} className={`${bouton} bg-primary text-primary-foreground hover:opacity-90`}>
                <Plus className="w-4 h-4" aria-hidden="true" />Nouveau compte
            </button>

            {ouverte === 'operation' && <FormulaireOperationProprietaire comptes={comptes} modale={fermer} />}
            {ouverte === 'virement' && <FormulaireVirement comptes={comptes} modale={fermer} />}
            {ouverte === 'compte' && <FormulaireNouveauCompte banques={comptes.filter(c => c.type === 'banque')} modale={fermer} />}
        </>
    )
}

export function ActionsCompteTresorerie({ compte, comptes }: {
    compte: { id: string; type: string; nom: string; operateur: string | null; banque: string | null; numero: string | null
              solde_ouverture: number; date_ouverture: string; note: string | null; est_actif: boolean }
    comptes: CompteChoix[]
}) {
    const [ouverte, setOuverte] = useState<Ouverte>(null)
    const fermer = { onFermer: () => setOuverte(null) }
    return (
        <>
            {compte.est_actif && (
                <>
                    <button type="button" onClick={() => setOuverte('modifier')} className={secondaire}>
                        <Pencil className="w-4 h-4" aria-hidden="true" />Modifier
                    </button>
                    <button type="button" onClick={() => setOuverte('operation')} className={secondaire}>
                        <ArrowUpDown className="w-4 h-4" aria-hidden="true" />Retrait / apport
                    </button>
                    {comptes.length >= 2 && (
                        <button type="button" onClick={() => setOuverte('virement')} className={`${bouton} bg-[#FACC15] text-[#1A1400] hover:brightness-95`}>
                            <ArrowLeftRight className="w-4 h-4" aria-hidden="true" />Virement
                        </button>
                    )}
                    <button type="button" onClick={() => setOuverte('rappro')} className={`${bouton} bg-primary text-primary-foreground hover:opacity-90`}>
                        <Scale className="w-4 h-4" aria-hidden="true" />Rapprocher
                    </button>
                </>
            )}
            {!compte.est_actif && compte.type !== 'caisse' && <BoutonEtatCompte id={compte.id} actif={false} />}

            {ouverte === 'modifier' && (
                <FormulaireModifierCompte compte={compte} modale={fermer} />
            )}
            {ouverte === 'operation' && <FormulaireOperationProprietaire comptes={comptes} compteParDefaut={compte.id} modale={fermer} />}
            {ouverte === 'virement' && <FormulaireVirement comptes={comptes} sourceParDefaut={compte.id} modale={fermer} />}
            {ouverte === 'rappro' && <FormulaireRapprochement compteId={compte.id} nature={compte.type} modale={fermer} />}
        </>
    )
}
