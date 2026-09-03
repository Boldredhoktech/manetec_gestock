'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { creerRetourClient, creerRetourFournisseur } from '@/actions/stock'
import ChampNombre from '@/components/ui/ChampNombre'
import { Button } from '@/components/ui/button'
import { formatMontant } from '@/lib/utils'
import {
    Undo2, Plus, Trash2, Loader2, AlertCircle, CheckCircle,
} from 'lucide-react'

interface Entrepot    { id: string; nom: string; est_defaut: boolean }
interface Produit     { id: string; nom: string; unite: string; prix_vente: number; prix_achat: number | null }
interface Client      { id: string; nom: string }
interface Fournisseur { id: string; nom: string }

interface Props {
    entrepots:    Entrepot[]
    produits:     Produit[]
    clients:      Client[]
    fournisseurs: Fournisseur[]
    devise:       string
    peutRetourClient:      boolean
    peutRetourFournisseur: boolean
}

interface Ligne { product_id: string; quantite: number; prix_unitaire: number }

const REGLEMENTS = [
    { code: 'a_traiter',  label: 'À traiter — décision de remboursement à prendre' },
    { code: 'avoir',      label: 'Avoir à établir pour le client' },
    { code: 'rembourse',  label: 'Client remboursé en caisse' },
    { code: 'sans_suite', label: 'Aucun remboursement (geste refusé, produit repris seul)' },
] as const

export default function FormulaireRetour({
    entrepots, produits, clients, fournisseurs, devise,
    peutRetourClient, peutRetourFournisseur,
}: Props) {
    const router = useRouter()
    const defaut = entrepots.find(e => e.est_defaut) ?? entrepots[0]

    const [sens, setSens]           = useState<'client' | 'fournisseur'>(
        peutRetourClient ? 'client' : 'fournisseur'
    )
    const [warehouseId, setWarehouseId] = useState(defaut?.id ?? '')
    const [tiersId, setTiersId]     = useState('')
    const [motif, setMotif]         = useState('')
    const [reglement, setReglement] = useState<typeof REGLEMENTS[number]['code']>('a_traiter')
    const [note, setNote]           = useState('')
    const [lignes, setLignes]       = useState<Ligne[]>([{ product_id: '', quantite: 1, prix_unitaire: 0 }])
    const [enAttente, setEnAttente] = useState(false)
    const [erreur, setErreur]       = useState<string>()
    const [succes, setSucces]       = useState<string>()

    const total = lignes.reduce((a, l) => a + l.quantite * l.prix_unitaire, 0)

    function modifier(i: number, champ: keyof Ligne, valeur: string | number) {
        setLignes(prev => prev.map((l, idx) => {
            if (idx !== i) return l
            const maj = { ...l, [champ]: valeur }
            if (champ === 'product_id' && valeur) {
                const p = produits.find(x => x.id === valeur)
                // Retour client : on repart du prix de vente. Retour
                // fournisseur : du prix d'achat.
                maj.prix_unitaire = sens === 'client'
                    ? (p?.prix_vente ?? 0)
                    : (p?.prix_achat ?? 0)
            }
            return maj
        }))
    }

    function changerSens(nouveau: 'client' | 'fournisseur') {
        setSens(nouveau)
        setTiersId('')
        setLignes([{ product_id: '', quantite: 1, prix_unitaire: 0 }])
        setErreur(undefined)
        setSucces(undefined)
    }

    async function handleSoumettre() {
        setErreur(undefined)
        setSucces(undefined)

        const valides = lignes.filter(l => l.product_id && l.quantite > 0)
        if (valides.length === 0) { setErreur('Ajoutez au moins un article.'); return }
        if (!motif.trim())        { setErreur('Le motif du retour est obligatoire.'); return }

        setEnAttente(true)
        const res = sens === 'client'
            ? await creerRetourClient({
                warehouseId, clientId: tiersId || null, motif, reglement, note, lignes: valides,
            })
            : await creerRetourFournisseur({
                warehouseId, supplierId: tiersId, motif, note, lignes: valides,
            })
        setEnAttente(false)

        if (res?.erreur) { setErreur(res.erreur); return }
        setSucces(`${res.public_id} — ${formatMontant(res.montant ?? 0, devise)}`)
        setLignes([{ product_id: '', quantite: 1, prix_unitaire: 0 }])
        setMotif('')
        setNote('')
        router.refresh()
    }

    const tiers = sens === 'client' ? clients : fournisseurs

    return (
        <div className="bg-white border border-gray-200 rounded-2xl p-5 shadow-sm space-y-4">

            <div className="flex items-center gap-2">
                <div className="bg-[#15335a]/10 p-2 rounded-lg">
                    <Undo2 className="w-5 h-5 text-[#15335a]" />
                </div>
                <h2 className="text-sm font-bold text-gray-900">Nouveau retour</h2>
            </div>

            {erreur && (
                <div className="flex items-start gap-3 p-3 bg-red-50 border border-red-200 rounded-xl text-sm text-red-700">
                    <AlertCircle className="w-4 h-4 mt-0.5 shrink-0" />
                    {erreur}
                </div>
            )}
            {succes && (
                <div className="flex items-center gap-3 p-3 bg-green-50 border border-green-200 rounded-xl text-sm text-green-700">
                    <CheckCircle className="w-4 h-4 shrink-0" />
                    Retour {succes} enregistré.
                </div>
            )}

            {/* Sens du retour */}
            <div className="flex gap-2">
                {peutRetourClient && (
                    <button
                        onClick={() => changerSens('client')}
                        className={`flex-1 px-3 py-2.5 text-xs font-bold rounded-xl border transition-colors ${
                            sens === 'client'
                                ? 'bg-[#15335a] text-white border-[#15335a]'
                                : 'bg-white text-gray-600 border-gray-200 hover:bg-gray-50'
                        }`}
                    >
                        Retour d&apos;un client
                        <span className="block font-normal opacity-80 mt-0.5">La marchandise revient en stock</span>
                    </button>
                )}
                {peutRetourFournisseur && (
                    <button
                        onClick={() => changerSens('fournisseur')}
                        className={`flex-1 px-3 py-2.5 text-xs font-bold rounded-xl border transition-colors ${
                            sens === 'fournisseur'
                                ? 'bg-[#15335a] text-white border-[#15335a]'
                                : 'bg-white text-gray-600 border-gray-200 hover:bg-gray-50'
                        }`}
                    >
                        Retour à un fournisseur
                        <span className="block font-normal opacity-80 mt-0.5">La marchandise quitte le stock</span>
                    </button>
                )}
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                    <label className="text-xs font-medium text-gray-600 mb-1.5 block">Entrepôt concerné</label>
                    <select
                        value={warehouseId}
                        onChange={e => setWarehouseId(e.target.value)}
                        className="w-full px-3 py-2 bg-white border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#15335a]/30"
                    >
                        {entrepots.map(e => (
                            <option key={e.id} value={e.id}>{e.nom}{e.est_defaut ? ' (défaut)' : ''}</option>
                        ))}
                    </select>
                </div>
                <div>
                    <label className="text-xs font-medium text-gray-600 mb-1.5 block">
                        {sens === 'client' ? 'Client (optionnel)' : 'Fournisseur'}
                    </label>
                    <select
                        value={tiersId}
                        onChange={e => setTiersId(e.target.value)}
                        className="w-full px-3 py-2 bg-white border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#15335a]/30"
                    >
                        <option value="">
                            {sens === 'client' ? 'Client de passage' : 'Choisir un fournisseur…'}
                        </option>
                        {tiers.map(t => <option key={t.id} value={t.id}>{t.nom}</option>)}
                    </select>
                </div>
            </div>

            <div>
                <label className="text-xs font-medium text-gray-600 mb-1.5 block">Motif du retour</label>
                <input
                    type="text"
                    value={motif}
                    onChange={e => setMotif(e.target.value)}
                    placeholder={sens === 'client'
                        ? 'Produit défectueux, erreur de référence, non conforme…'
                        : 'Marchandise non conforme, invendue, défectueuse…'}
                    className="w-full px-3 py-2 bg-white border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#15335a]/30"
                />
            </div>

            <div className="space-y-2">
                <label className="text-xs font-medium text-gray-600 block">Articles retournés</label>
                {lignes.map((ligne, i) => (
                    <div key={i} className="flex flex-wrap items-end gap-2 p-3 bg-gray-50 rounded-xl">
                        <div className="flex-1 min-w-[180px]">
                            <select
                                value={ligne.product_id}
                                onChange={e => modifier(i, 'product_id', e.target.value)}
                                className="w-full px-3 py-2 bg-white border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#15335a]/30"
                            >
                                <option value="">Choisir un produit…</option>
                                {produits.map(p => <option key={p.id} value={p.id}>{p.nom}</option>)}
                            </select>
                        </div>
                        <div className="w-24">
                            <p className="text-[11px] text-gray-500 mb-1">Quantité</p>
                            <ChampNombre
                                value={ligne.quantite}
                                onChange={v => modifier(i, 'quantite', v)}
                                videVaut={0}
                                placeholder="0"
                                className="w-full px-3 py-2 bg-white border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#15335a]/30"
                                aria-label="Quantité retournée"
                            />
                        </div>
                        <div className="w-32">
                            <p className="text-[11px] text-gray-500 mb-1">Prix unitaire</p>
                            <ChampNombre
                                value={ligne.prix_unitaire}
                                onChange={v => modifier(i, 'prix_unitaire', v)}
                                videVaut={0}
                                placeholder="0"
                                className="w-full px-3 py-2 bg-white border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#15335a]/30"
                                aria-label="Prix unitaire du retour"
                            />
                        </div>
                        <button
                            onClick={() => setLignes(prev => prev.filter((_, idx) => idx !== i))}
                            className="p-2 text-red-500 hover:bg-red-50 rounded-lg transition-colors"
                            aria-label="Supprimer la ligne"
                        >
                            <Trash2 className="w-4 h-4" />
                        </button>
                    </div>
                ))}
                <div className="flex items-center justify-between">
                    <button
                        onClick={() => setLignes(prev => [...prev, { product_id: '', quantite: 1, prix_unitaire: 0 }])}
                        className="flex items-center gap-1.5 text-xs font-bold text-[#15335a] hover:underline"
                    >
                        <Plus className="w-3.5 h-3.5" />
                        Ajouter un article
                    </button>
                    <p className="text-sm font-black text-[#15335a]">
                        Total : {formatMontant(total, devise)}
                    </p>
                </div>
            </div>

            {sens === 'client' && (
                <div>
                    <label className="text-xs font-medium text-gray-600 mb-1.5 block">Suite à donner</label>
                    <select
                        value={reglement}
                        onChange={e => setReglement(e.target.value as typeof reglement)}
                        className="w-full px-3 py-2 bg-white border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#15335a]/30"
                    >
                        {REGLEMENTS.map(r => <option key={r.code} value={r.code}>{r.label}</option>)}
                    </select>
                </div>
            )}

            <div>
                <label className="text-xs font-medium text-gray-600 mb-1.5 block">Note (optionnel)</label>
                <input
                    type="text"
                    value={note}
                    onChange={e => setNote(e.target.value)}
                    className="w-full px-3 py-2 bg-white border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#15335a]/30"
                />
            </div>

            <Button onClick={handleSoumettre} disabled={enAttente} className="w-full">
                {enAttente
                    ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Enregistrement…</>
                    : <><Undo2 className="w-4 h-4 mr-2" />Enregistrer le retour</>
                }
            </Button>

            <p className="text-xs text-gray-400">
                Ce retour agit sur le stock uniquement.
                {sens === 'client'
                    ? ' L\'avoir ou le remboursement du client se traite dans Facturation ; la suite à donner est enregistrée ici comme intention.'
                    : ' La dette envers le fournisseur n\'est pas modifiée : elle se traite dans le module Fournisseurs.'}
            </p>
        </div>
    )
}
