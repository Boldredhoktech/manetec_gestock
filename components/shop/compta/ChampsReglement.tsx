'use client'

import { useState } from 'react'
import { MOYENS_PAIEMENT } from '@/lib/constants/moyens-paiement'

// ══════════════════════════════════════════════════════════════
// Moyen de paiement + référence.
//
// `MOYENS_PAIEMENT` déclare `reference_requise: true` pour six moyens
// sur huit, mais seule la caisse appliquait la règle : un virement de
// salaire ou une dépense par Mobile Money s'enregistrait sans numéro.
// Pire, `creerDepense` et `payerSalaire` LISAIENT déjà un champ
// `reference` qu'aucun formulaire n'affichait — il valait toujours NULL.
//
// Le champ de référence n'apparaît que lorsqu'il sert, et devient
// obligatoire exactement quand la table le dit.
// ══════════════════════════════════════════════════════════════

export default function ChampsReglement({
    moyenParDefaut = 'cash',
    referenceParDefaut = '',
    disabled,
    compact,
}: {
    moyenParDefaut?:     string
    referenceParDefaut?: string
    disabled?:           boolean
    compact?:            boolean
}) {
    const [moyen, setMoyen] = useState(moyenParDefaut)

    const exigeReference = MOYENS_PAIEMENT
        .find(m => m.code === moyen)?.reference_requise ?? false

    const classeChamp = compact
        ? 'w-full px-2 py-1.5 bg-background border border-input rounded text-xs focus:outline-none focus:ring-1 focus:ring-ring disabled:opacity-50'
        : 'w-full px-3 py-2.5 bg-background border border-input rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-ring disabled:opacity-50'

    const classeLabel = compact
        ? 'text-xs text-muted-foreground'
        : 'text-sm font-medium text-foreground'

    return (
        <>
            <div className={compact ? '' : 'space-y-1.5'}>
                <label className={classeLabel}>Moyen de paiement</label>
                <select
                    name="moyen"
                    value={moyen}
                    onChange={e => setMoyen(e.target.value)}
                    disabled={disabled}
                    className={classeChamp + (compact ? ' mt-0.5' : '')}
                >
                    {MOYENS_PAIEMENT.map(m => (
                        <option key={m.code} value={m.code}>{m.label}</option>
                    ))}
                </select>
            </div>

            {exigeReference && (
                <div className={compact ? '' : 'space-y-1.5'}>
                    <label className={classeLabel}>
                        Référence de la transaction <span className="text-destructive">*</span>
                    </label>
                    <input
                        name="reference"
                        type="text"
                        required
                        defaultValue={referenceParDefaut}
                        placeholder="Numéro de transaction ou de bordereau"
                        disabled={disabled}
                        className={classeChamp + (compact ? ' mt-0.5' : '')}
                    />
                    {!compact && (
                        <p className="text-xs text-muted-foreground">
                            Elle permet de retrouver l&apos;opération auprès de l&apos;opérateur
                            ou de la banque en cas de contestation.
                        </p>
                    )}
                </div>
            )}
        </>
    )
}
