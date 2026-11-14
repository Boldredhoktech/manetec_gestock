'use client'

import { useEffect, useMemo, useState } from 'react'
import { listerComptesChoix } from '@/actions/tresorerie'
import {
    LIBELLES_TYPE, TYPES_COMPTE, decouvertInterdit, referenceRequise, formatF,
    type CompteChoix, type TypeCompte,
} from '@/lib/tresorerie/comptes'

// ══════════════════════════════════════════════════════════════
// Compte de trésorerie + référence (mig 041).
//
// Avant, on choisissait un « moyen de paiement » ; désormais on choisit
// le TYPE (Caisse, Mobile Money, Banque, TPE) puis le COMPTE exact qui
// reçoit ou paie l'argent. Le moyen de paiement en est déduit par la
// base. Seuls les types qui ont au moins un compte actif sont proposés.
//
// Champs envoyés : `compteId` et, quand le type l'exige, `reference`.
// ══════════════════════════════════════════════════════════════

export default function ChampsReglement({
    compteParDefaut,
    entrepotParDefaut,
    referenceParDefaut = '',
    disabled,
    compact,
}: {
    compteParDefaut?:    string | null
    /** Sans compte imposé : proposer la caisse de cet entrepôt. */
    entrepotParDefaut?:  string | null
    referenceParDefaut?: string
    disabled?:           boolean
    compact?:            boolean
}) {
    const [comptes, setComptes]   = useState<CompteChoix[] | null>(null)
    const [erreur, setErreur]     = useState<string | null>(null)
    const [type, setType]         = useState<TypeCompte | null>(null)
    const [compteId, setCompteId] = useState<string>('')

    useEffect(() => {
        let actif = true
        listerComptesChoix().then(res => {
            if (!actif) return
            if ('erreur' in res) { setErreur(res.erreur); return }
            setComptes(res.comptes)
            const initial = res.comptes.find(c => c.id === compteParDefaut)
                ?? res.comptes.find(c => c.type === 'caisse' && !!entrepotParDefaut && c.warehouse_id === entrepotParDefaut)
                ?? res.comptes.find(c => c.type === 'caisse')
                ?? res.comptes[0]
            if (initial) { setType(initial.type); setCompteId(initial.id) }
        })
        return () => { actif = false }
    }, [compteParDefaut, entrepotParDefaut])

    const typesDisponibles = useMemo(
        () => TYPES_COMPTE.filter(t => comptes?.some(c => c.type === t)),
        [comptes],
    )
    const comptesDuType = comptes?.filter(c => c.type === type) ?? []
    const compte = comptes?.find(c => c.id === compteId)

    function choisirType(t: TypeCompte) {
        setType(t)
        setCompteId(comptes?.find(c => c.type === t)?.id ?? '')
    }

    const classeChamp = compact
        ? 'w-full px-2 py-1.5 bg-background border border-input rounded text-xs focus:outline-none focus:ring-1 focus:ring-ring disabled:opacity-50'
        : 'w-full px-3 py-2.5 bg-background border border-input rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-ring disabled:opacity-50'
    const classeLabel = compact ? 'text-xs text-muted-foreground' : 'text-sm font-medium text-foreground'

    if (erreur) return <p className="text-sm text-destructive">{erreur}</p>
    if (!comptes) return <p className="text-sm text-muted-foreground">Chargement des comptes…</p>
    if (comptes.length === 0) {
        return <p className="text-sm text-destructive">Aucun compte de trésorerie actif : créez-en un dans Comptabilité › Trésorerie.</p>
    }

    return (
        <>
            <input type="hidden" name="compteId" value={compteId} />

            <div className={compact ? '' : 'space-y-1.5'}>
                <span className={classeLabel}>Type de compte</span>
                <div role="group" aria-label="Type de compte" className={`flex flex-wrap gap-1.5 ${compact ? 'mt-0.5' : ''}`}>
                    {typesDisponibles.map(t => (
                        <button
                            key={t}
                            type="button"
                            aria-pressed={type === t}
                            disabled={disabled}
                            onClick={() => choisirType(t)}
                            className={`rounded-lg border font-medium transition-colors disabled:opacity-50 ${compact ? 'px-2 py-1 text-xs' : 'px-3 py-2 text-sm'} ${
                                type === t
                                    ? 'bg-primary text-primary-foreground border-primary'
                                    : 'bg-background text-foreground border-input hover:bg-muted'
                            }`}
                        >
                            {LIBELLES_TYPE[t]}
                        </button>
                    ))}
                </div>
            </div>

            <div className={compact ? '' : 'space-y-1.5'}>
                <label className={classeLabel} htmlFor="champ-compte">Compte</label>
                <select
                    id="champ-compte"
                    value={compteId}
                    onChange={e => setCompteId(e.target.value)}
                    disabled={disabled}
                    required
                    className={classeChamp + (compact ? ' mt-0.5' : '')}
                >
                    {comptesDuType.map(c => (
                        <option key={c.id} value={c.id}>
                            {c.nom}{c.solde !== undefined ? ` — ${formatF(c.solde)}` : ''}
                        </option>
                    ))}
                </select>
                {compte?.solde !== undefined && compte.solde < 0 && !decouvertInterdit(compte.type) && (
                    <p className="text-xs text-amber-700">Attention : ce compte est à découvert ({formatF(compte.solde)}).</p>
                )}
            </div>

            {compte && referenceRequise(compte.type) && (
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
