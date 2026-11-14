'use client'

import { useState, useEffect } from 'react'
import {
    ArrowLeft, Plus, Trash2, Loader2,
    AlertCircle, CreditCard, Banknote,
    CheckCircle, Smartphone,
} from 'lucide-react'
import { formatMontant } from '@/lib/utils'
import type { PaiementVente } from '@/actions/ventes'
import { listerComptesChoix } from '@/actions/tresorerie'
import {
    LIBELLES_TYPE, TYPES_COMPTE, moyenDuCompte, referenceRequise,
    type CompteChoix, type TypeCompte,
} from '@/lib/tresorerie/comptes'
import ChampNombre from '@/components/ui/ChampNombre'

interface Client {
    id: string; nom: string
    advance_balance: number; change_balance: number; credit_balance: number
}

interface Props {
    montantTotal:  number
    /** Entrepôt de la vente : les espèces vont dans SA caisse (mig 041). */
    warehouseId:   string
    devise:        string
    client:        Client | null
    enAttente:     boolean
    erreur?:       string
    onValider:     (
        paiements:      PaiementVente[],
        creditAccorde:  number,
        advanceUtilise: number,
        changeUtilise:  number,
        creditUtilise:  number,
        garderMonnaie:  boolean,
        montantRecu:    number,
        montantRendu:   number,
    ) => void
    onRetour: () => void
}

export default function PaiementPOS({
                                        montantTotal, warehouseId, devise, client,
                                        enAttente, erreur, onValider, onRetour,
                                    }: Props) {
    // Comptes de trésorerie de la boutique. Espèces = la caisse de
    // l'entrepôt, sans choix ; les autres types : le compte exact.
    const [comptes, setComptes] = useState<CompteChoix[]>([])
    const [erreurComptes, setErreurComptes] = useState<string | null>(null)
    const caisse = comptes.find(c => c.type === 'caisse' && c.warehouse_id === warehouseId)

    const [paiements, setPaiements]         = useState<PaiementVente[]>([
        { compte_id: '', moyen_paiement: 'cash', montant: montantTotal, reference: '' },
    ])

    useEffect(() => {
        let actif = true
        listerComptesChoix().then(res => {
            if (!actif) return
            if ('erreur' in res) { setErreurComptes(res.erreur); return }
            setComptes(res.comptes)
            const c = res.comptes.find(x => x.type === 'caisse' && x.warehouse_id === warehouseId)
            if (!c) setErreurComptes('La caisse de cet entrepôt est introuvable.')
            else setPaiements(prev => prev.map(p => p.compte_id ? p : { ...p, compte_id: c.id }))
        })
        return () => { actif = false }
    }, [warehouseId])

    const typesDisponibles = TYPES_COMPTE.filter(t =>
        t === 'caisse' ? !!caisse : comptes.some(c => c.type === t))
    const compteDe = (p: PaiementVente) => comptes.find(c => c.id === p.compte_id)
    const [creditAccorde, setCreditAccorde]   = useState(0)
    const [advanceUtilise, setAdvanceUtilise] = useState(0)
    const [changeUtilise, setChangeUtilise]   = useState(0)
    // Remboursement d'ardoise encaissé avec la vente. `credit_utilise`
    // traversait toute la chaîne en valant zéro : le composant le
    // passait en dur, et la base ne l'appliquait à aucun solde.
    const [creditRembourse, setCreditRembourse] = useState(0)
    const [garderMonnaie, setGarderMonnaie]   = useState(false)

    const totalPaiements = paiements.reduce((a, p) => a + p.montant, 0)

    // Ce que la vente doit couvrir après les soldes utilisés, puis ce
    // qui reste une fois le crédit accordé retiré.
    const aCouvrir     = Math.max(0, montantTotal - advanceUtilise - changeUtilise)
    const aEncaisser   = Math.max(0, aCouvrir - creditAccorde) + creditRembourse
    const resteAPayer  = aEncaisser - totalPaiements
    const montantRendu = Math.max(0, totalPaiements - aEncaisser)

    // La ligne pré-remplie suit ce qu'il reste à encaisser tant que le
    // caissier n'a pas saisi lui-même un montant. Elle restait au total :
    // saisir 500 000 F de crédit sur 1 300 000 F laissait 1 300 000 F en
    // espèces, et le POS annonçait 500 000 F de monnaie à rendre
    // (FAVEUR INFORMATIQUE, VENTE-00001).
    const [montantSaisi, setMontantSaisi] = useState(false)
    useEffect(() => {
        if (montantSaisi) return
        setPaiements(prev => prev.length === 1 && prev[0].montant !== aEncaisser
            ? [{ ...prev[0], montant: aEncaisser }]
            : prev)
    }, [aEncaisser, montantSaisi])

    // Le crédit accordé ne peut pas dépasser ce qui reste à payer :
    // rien n'empêchait d'en saisir un sur une vente déjà réglée, et la
    // base comptait alors comme encaissé de l'argent jamais reçu.
    const creditMax = aCouvrir

    // La référence est obligatoire pour six moyens sur huit ; la règle
    // vivait dans MOYENS_PAIEMENT sans être appliquée au comptoir.
    const referenceManquante = paiements.some(p => {
        const c = compteDe(p)
        return p.montant > 0 && !!c && referenceRequise(c.type) && !p.reference?.trim()
    })
    const compteManquant = paiements.some(p => p.montant > 0 && !compteDe(p))

    const creditDepasse = creditAccorde > creditMax + 0.001
    const peutValider   = resteAPayer <= 0.001 && !referenceManquante && !creditDepasse && !compteManquant

    function ajouterPaiement() {
        setMontantSaisi(true)
        setPaiements(prev => [...prev, { compte_id: caisse?.id ?? '', moyen_paiement: 'cash', montant: 0, reference: '' }])
    }

    function choisirCompte(i: number, c: CompteChoix | undefined) {
        setPaiements(prev => prev.map((p, idx) => idx === i
            ? { ...p, compte_id: c?.id ?? '', moyen_paiement: c ? moyenDuCompte(c.type, c.operateur) : p.moyen_paiement }
            : p))
    }

    function choisirType(i: number, t: TypeCompte) {
        choisirCompte(i, t === 'caisse' ? caisse : comptes.find(c => c.type === t))
    }

    function modifierPaiement(i: number, champ: keyof PaiementVente, val: string | number) {
        if (champ === 'montant') setMontantSaisi(true)
        setPaiements(prev => prev.map((p, idx) => idx === i ? { ...p, [champ]: val } : p))
    }

    function handleValider() {
        onValider(
            paiements.filter(p => p.montant > 0),
            creditAccorde,
            advanceUtilise,
            changeUtilise,
            creditRembourse,
            garderMonnaie,
            totalPaiements,
            montantRendu,
        )
    }

    const MOYEN_ICONS: Record<string, React.ReactNode> = {
        cash:          <Banknote className="w-4 h-4" />,
        wave:          <Smartphone className="w-4 h-4" />,
        mtn_momo:      <Smartphone className="w-4 h-4" />,
        bank_card:     <CreditCard className="w-4 h-4" />,
        bank_transfer: <CreditCard className="w-4 h-4" />,
    }

    return (
        <div className="flex-1 flex flex-col bg-background overflow-auto">
            <div className="max-w-lg mx-auto w-full px-4 py-6 space-y-4">

                {/* Retour */}
                <button type="button" onClick={onRetour}
                        className="flex items-center gap-2 text-sm font-medium text-[var(--primary-strong)] hover:text-primary transition-colors">
                    <ArrowLeft className="w-4 h-4" />
                    Retour au panier
                </button>

                {/* Carte total */}
                <div
                    className="rounded-2xl p-5 text-white shadow-xl"
                    style={{ background: 'var(--nav)' }}
                >
                    <p className="text-sm font-medium text-white/75 mb-1">Total à régler</p>
                    <p className="text-4xl font-black tracking-tight">
                        {formatMontant(montantTotal, devise)}
                    </p>
                    {client && (
                        <p className="text-sm text-white/70 mt-2 font-medium">Client : {client.nom}</p>
                    )}
                </div>

                {/* Modes de paiement */}
                <div className="bg-card rounded-2xl p-5 shadow-sm border border-border space-y-3">
                    <h3 className="text-sm font-bold text-foreground flex items-center gap-2">
                        <CreditCard className="w-4 h-4 text-[var(--primary-strong)]" />
                        Modes de paiement
                    </h3>

                    {erreurComptes && (
                        <p className="text-sm text-red-600">{erreurComptes}</p>
                    )}

                    {paiements.map((p, i) => {
                        const c = compteDe(p)
                        const autresDuType = c && c.type !== 'caisse' ? comptes.filter(x => x.type === c.type) : []
                        return (
                        <div key={i} className="flex gap-2 items-start">
                            <div className="flex-1 space-y-2">
                                <div role="group" aria-label="Type de compte" className="flex flex-wrap gap-1.5">
                                    {typesDisponibles.map(t => (
                                        <button key={t} type="button"
                                                aria-pressed={c?.type === t}
                                                onClick={() => choisirType(i, t)}
                                                className={`px-2.5 py-1.5 rounded-lg text-xs font-bold border transition-colors ${
                                                    c?.type === t
                                                        ? 'bg-primary text-white border-primary'
                                                        : 'bg-[var(--surface2)] text-foreground border-border hover:bg-muted'
                                                }`}>
                                            {t === 'caisse' ? 'Espèces' : LIBELLES_TYPE[t]}
                                        </button>
                                    ))}
                                </div>
                                {autresDuType.length > 1 && (
                                    <select
                                        value={p.compte_id}
                                        aria-label="Compte qui reçoit l'argent"
                                        onChange={e => choisirCompte(i, comptes.find(x => x.id === e.target.value))}
                                        className="w-full px-3 py-2 bg-[var(--surface2)] border border-border rounded-xl text-sm font-medium focus:outline-none focus:ring-2 focus:ring-ring/30"
                                    >
                                        {autresDuType.map(x => <option key={x.id} value={x.id}>{x.nom}</option>)}
                                    </select>
                                )}
                                {c && (autresDuType.length <= 1) && (
                                    <p className="text-xs text-muted-foreground">→ {c.nom}</p>
                                )}
                                {c && referenceRequise(c.type) && (
                                    <input type="text" placeholder="Référence de transaction *"
                                           value={p.reference}
                                           onChange={e => modifierPaiement(i, 'reference', e.target.value)}
                                           className={`w-full px-3 py-2 bg-[var(--surface2)] border rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-ring/30 font-mono ${
                                               p.montant > 0 && !p.reference?.trim()
                                                   ? 'border-red-300'
                                                   : 'border-border'
                                           }`}
                                    />
                                )}
                            </div>
                            <div className="flex items-center gap-2">
                                <ChampNombre
                                    value={p.montant}
                                    onChange={v => modifierPaiement(i, 'montant', v)}
                                    aria-label="Montant de ce règlement"
                                    className="w-28 px-2 py-2.5 bg-[var(--surface2)] border border-border rounded-xl text-sm font-bold text-right focus:outline-none focus:ring-2 focus:ring-ring/30"
                                />
                                {paiements.length > 1 && (
                                    <button type="button" onClick={() => setPaiements(prev => prev.filter((_, idx) => idx !== i))}
                                            className="p-2 text-muted-foreground/80 hover:text-red-500 transition-colors">
                                        <Trash2 className="w-4 h-4" />
                                    </button>
                                )}
                            </div>
                        </div>
                        )
                    })}

                    <button type="button" onClick={ajouterPaiement}
                            className="flex items-center gap-2 text-xs font-bold text-[var(--primary-strong)] hover:text-primary transition-colors">
                        <Plus className="w-3.5 h-3.5" />
                        Ajouter un mode de paiement
                    </button>
                </div>

                {/* Soldes client */}
                {client && (client.advance_balance > 0 || client.change_balance > 0 || true) && (
                    <div className="bg-card rounded-2xl p-5 shadow-sm border border-border space-y-3">
                        <h3 className="text-sm font-bold text-foreground">
                            Soldes de {client.nom}
                        </h3>

                        {client.advance_balance > 0 && (
                            <div className="flex items-center gap-3 p-3 bg-green-50 border border-green-200 rounded-xl">
                                <div className="flex-1">
                                    <p className="text-xs font-bold text-green-700">Avance disponible</p>
                                    <p className="text-lg font-black text-green-600">
                                        {formatMontant(client.advance_balance, devise)}
                                    </p>
                                </div>
                                <ChampNombre
                                    value={advanceUtilise} onChange={setAdvanceUtilise}
                                    aria-label="Avance utilisée"
                                    className="w-28 px-2 py-2 bg-card border border-green-200 rounded-lg text-sm font-bold text-right focus:outline-none focus:ring-2 focus:ring-green-400"
                                />
                            </div>
                        )}

                        {client.change_balance > 0 && (
                            <div className="flex items-center gap-3 p-3 bg-blue-50 border border-blue-200 rounded-xl">
                                <div className="flex-1">
                                    <p className="text-xs font-bold text-blue-700">Monnaie en attente</p>
                                    <p className="text-lg font-black text-blue-600">
                                        {formatMontant(client.change_balance, devise)}
                                    </p>
                                </div>
                                <ChampNombre
                                    value={changeUtilise} onChange={setChangeUtilise}
                                    aria-label="Monnaie utilisée"
                                    className="w-28 px-2 py-2 bg-card border border-blue-200 rounded-lg text-sm font-bold text-right focus:outline-none focus:ring-2 focus:ring-blue-400"
                                />
                            </div>
                        )}

                        {/* Rembourser l'ardoise au comptoir : le client
                            paie ses achats ET une part de ce qu'il doit. */}
                        {client.credit_balance > 0 && (
                            <div className="flex items-center gap-3 p-3 bg-red-50 border border-red-200 rounded-xl">
                                <div className="flex-1">
                                    <p className="text-xs font-bold text-red-700">Ardoise à régler</p>
                                    <p className="text-lg font-black text-red-600">
                                        {formatMontant(client.credit_balance, devise)}
                                    </p>
                                    <p className="text-xs text-red-400">
                                        S&apos;ajoute au total à encaisser
                                    </p>
                                </div>
                                <ChampNombre
                                    value={creditRembourse} onChange={setCreditRembourse}
                                    aria-label="Ardoise remboursée"
                                    className="w-28 px-2 py-2 bg-card border border-red-200 rounded-lg text-sm font-bold text-right focus:outline-none focus:ring-2 focus:ring-red-400"
                                />
                            </div>
                        )}

                        <div className={`flex items-center gap-3 p-3 rounded-xl border ${
                            creditDepasse ? 'bg-red-50 border-red-300' : 'bg-amber-50 border-amber-200'
                        }`}>
                            <div className="flex-1">
                                <p className="text-xs font-bold text-amber-700">Accorder un crédit</p>
                                <p className="text-xs text-amber-500">
                                    Montant que le client paiera plus tard
                                    {creditMax > 0 && ` · maximum ${formatMontant(creditMax, devise)}`}
                                </p>
                                {creditDepasse && (
                                    <p className="text-xs font-bold text-red-600 mt-0.5">
                                        Un crédit ne peut pas dépasser ce qui reste à payer.
                                    </p>
                                )}
                            </div>
                            <ChampNombre
                                value={creditAccorde} onChange={setCreditAccorde}
                                aria-label="Crédit accordé"
                                className="w-28 px-2 py-2 bg-card border border-amber-200 rounded-lg text-sm font-bold text-right focus:outline-none focus:ring-2 focus:ring-amber-400"
                            />
                        </div>
                    </div>
                )}

                {/* Résumé */}
                <div className="bg-card rounded-2xl p-5 shadow-sm border border-border space-y-2">
                    <h3 className="text-sm font-bold text-foreground">Résumé</h3>

                    <div className="space-y-1.5">
                        {[
                            { label: 'Total des articles', val: formatMontant(montantTotal, devise),  couleur: 'text-foreground' },
                            advanceUtilise > 0 && { label: 'Avance utilisée', val: formatMontant(advanceUtilise, devise), couleur: 'text-green-600' },
                            changeUtilise > 0  && { label: 'Monnaie utilisée', val: formatMontant(changeUtilise, devise), couleur: 'text-blue-600'  },
                            creditAccorde > 0  && { label: 'Accordé à crédit', val: formatMontant(creditAccorde, devise), couleur: 'text-amber-600' },
                            creditRembourse > 0 && { label: 'Ardoise réglée',  val: formatMontant(creditRembourse, devise), couleur: 'text-red-600' },
                            { label: 'À encaisser',       val: formatMontant(aEncaisser, devise),     couleur: 'text-foreground font-black' },
                            { label: 'Reçu du client',    val: formatMontant(totalPaiements, devise), couleur: 'text-muted-foreground' },
                        ].filter(Boolean).map((item: any, i) => (
                            <div key={i} className="flex justify-between text-sm">
                                <span className="text-muted-foreground">{item.label}</span>
                                <span className={`font-semibold ${item.couleur}`}>{item.val}</span>
                            </div>
                        ))}

                        <div className="border-t border-border pt-2 mt-2">
                            {resteAPayer > 0.001 ? (
                                <div className="flex justify-between text-sm">
                                    <span className="font-bold text-red-600">Reste à payer</span>
                                    <span className="font-black text-red-600">{formatMontant(resteAPayer, devise)}</span>
                                </div>
                            ) : montantRendu > 0.001 ? (
                                <div className="flex justify-between text-sm">
                                    <span className="font-bold text-green-600">Monnaie à rendre</span>
                                    <span className="font-black text-green-600">{formatMontant(montantRendu, devise)}</span>
                                </div>
                            ) : (
                                <div className="flex items-center gap-2 text-green-600">
                                    <CheckCircle className="w-4 h-4" />
                                    <span className="text-sm font-bold">Compte exact</span>
                                </div>
                            )}
                        </div>
                    </div>

                    {/* Garder monnaie */}
                    {montantRendu > 0.001 && client && (
                        <label className="flex items-center gap-2.5 p-3 bg-[var(--surface2)] rounded-xl cursor-pointer hover:bg-muted transition-colors">
                            <input type="checkbox" checked={garderMonnaie}
                                   onChange={e => setGarderMonnaie(e.target.checked)}
                                   className="rounded accent-[var(--primary)] w-4 h-4" />
                            <span className="text-xs font-medium text-muted-foreground">
                Conserver {formatMontant(montantRendu, devise)} en attente pour {client.nom}
              </span>
                        </label>
                    )}
                </div>

                {/* Erreur */}
                {erreur && (
                    <div className="flex items-start gap-3 p-4 bg-red-50 border border-red-200 rounded-2xl text-sm text-red-700">
                        <AlertCircle className="w-5 h-5 shrink-0 mt-0.5" />
                        {erreur}
                    </div>
                )}

                {/* Pourquoi le bouton refuse : un bouton grisé sans
                    explication laisse le caissier chercher devant le client. */}
                {!peutValider && !enAttente && (
                    <p className="text-xs font-medium text-amber-700 bg-amber-50 border border-amber-200 rounded-xl px-4 py-2.5">
                        {compteManquant
                            ? 'Choisissez le compte qui reçoit chaque règlement.'
                            : referenceManquante
                            ? 'Saisissez la référence de transaction du règlement.'
                            : creditDepasse
                                ? 'Le crédit accordé dépasse ce qui reste à payer.'
                                : `Il manque ${formatMontant(resteAPayer, devise)} pour atteindre le montant à encaisser.`}
                    </p>
                )}

                {/* Bouton confirmer */}
                <button
                    onClick={handleValider}
                    disabled={!peutValider || enAttente}
                    className="w-full py-4 font-black text-base rounded-2xl text-white transition-all disabled:opacity-40 disabled:cursor-not-allowed"
                    style={{
                        background: peutValider && !enAttente
                            ? 'var(--primary)'
                            : '#d1d5db',
                        boxShadow: peutValider && !enAttente
                            ? '0 4px 16px rgba(22,163,74,0.35)'
                            : 'none',
                    }}
                >
                    {enAttente
                        ? <span className="flex items-center justify-center gap-2">
                <Loader2 className="w-5 h-5 animate-spin" />
                Enregistrement...
              </span>
                        : '✓ Confirmer la vente'
                    }
                </button>

            </div>
        </div>
    )
}