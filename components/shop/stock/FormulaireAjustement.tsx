'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { creerAjustement } from '@/actions/stock'
import ChampNombre from '@/components/ui/ChampNombre'
import { Button } from '@/components/ui/button'
import {
    SlidersHorizontal, Plus, Trash2, Loader2, AlertCircle, CheckCircle,
} from 'lucide-react'

interface Entrepot { id: string; nom: string; est_defaut: boolean }
interface Produit  { id: string; nom: string; unite: string; stocks: Record<string, number> }

interface Props { entrepots: Entrepot[]; produits: Produit[] }

interface Ligne { product_id: string; quantite_apres: number }

// Motifs courants : l'ajustement doit toujours dire POURQUOI le stock
// théorique était faux, sinon le journal devient inexploitable.
const MOTIFS = [
    'Casse ou produit abîmé',
    'Produit périmé',
    'Vol ou disparition',
    'Erreur de saisie',
    'Échantillon ou usage interne',
    'Don ou geste commercial',
    'Autre',
]

export default function FormulaireAjustement({ entrepots, produits }: Props) {
    const router = useRouter()
    const defaut = entrepots.find(e => e.est_defaut) ?? entrepots[0]

    const [warehouseId, setWarehouseId] = useState(defaut?.id ?? '')
    const [motif, setMotif]             = useState(MOTIFS[0])
    const [note, setNote]               = useState('')
    const [lignes, setLignes]           = useState<Ligne[]>([{ product_id: '', quantite_apres: 0 }])
    const [enAttente, setEnAttente]     = useState(false)
    const [erreur, setErreur]           = useState<string>()
    const [succes, setSucces]           = useState<string>()

    const stockActuel = (productId: string) =>
        produits.find(p => p.id === productId)?.stocks[warehouseId] ?? 0

    function modifier(i: number, champ: keyof Ligne, valeur: string | number) {
        setLignes(prev => prev.map((l, idx) => {
            if (idx !== i) return l
            const maj = { ...l, [champ]: valeur }
            // À la sélection du produit, on pré-remplit avec le stock
            // actuel : l'utilisateur corrige, il ne repart pas de zéro.
            if (champ === 'product_id' && valeur) {
                maj.quantite_apres = produits.find(p => p.id === valeur)?.stocks[warehouseId] ?? 0
            }
            return maj
        }))
    }

    async function handleSoumettre() {
        setErreur(undefined)
        setSucces(undefined)

        const valides = lignes.filter(l => l.product_id)
        if (valides.length === 0) { setErreur('Ajoutez au moins un produit à ajuster.'); return }
        if (!motif)               { setErreur('Le motif est obligatoire.'); return }

        setEnAttente(true)
        const res = await creerAjustement(warehouseId, motif, note, valides)
        setEnAttente(false)

        if (res?.erreur) { setErreur(res.erreur); return }
        if (res.nb_lignes === 0) {
            setErreur('Aucun écart à appliquer : les quantités saisies sont identiques au stock actuel.')
            return
        }
        setSucces(`${res.public_id} — ${res.nb_lignes} ligne(s) ajustée(s)`)
        setLignes([{ product_id: '', quantite_apres: 0 }])
        setNote('')
        router.refresh()
    }

    return (
        <div className="bg-white border border-gray-200 rounded-2xl p-5 shadow-sm space-y-4">

            <div className="flex items-center gap-2">
                <div className="bg-[#15335a]/10 p-2 rounded-lg">
                    <SlidersHorizontal className="w-5 h-5 text-[#15335a]" />
                </div>
                <h2 className="text-sm font-bold text-gray-900">Nouvel ajustement</h2>
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
                    Ajustement {succes}
                </div>
            )}

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                    <label className="text-xs font-medium text-gray-600 mb-1.5 block">Entrepôt</label>
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
                    <label className="text-xs font-medium text-gray-600 mb-1.5 block">Motif</label>
                    <select
                        value={motif}
                        onChange={e => setMotif(e.target.value)}
                        className="w-full px-3 py-2 bg-white border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#15335a]/30"
                    >
                        {MOTIFS.map(m => <option key={m} value={m}>{m}</option>)}
                    </select>
                </div>
            </div>

            <div className="space-y-2">
                <label className="text-xs font-medium text-gray-600 block">Quantités corrigées</label>
                {lignes.map((ligne, i) => {
                    const actuel = ligne.product_id ? stockActuel(ligne.product_id) : 0
                    const ecart  = ligne.product_id ? ligne.quantite_apres - actuel : 0
                    return (
                        <div key={i} className="flex flex-wrap items-end gap-2 p-3 bg-gray-50 rounded-xl">
                            <div className="flex-1 min-w-[180px]">
                                <select
                                    value={ligne.product_id}
                                    onChange={e => modifier(i, 'product_id', e.target.value)}
                                    className="w-full px-3 py-2 bg-white border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#15335a]/30"
                                >
                                    <option value="">Choisir un produit…</option>
                                    {produits.map(p => (
                                        <option key={p.id} value={p.id}>{p.nom}</option>
                                    ))}
                                </select>
                            </div>
                            <div className="w-32">
                                <p className="text-[11px] text-gray-500 mb-1">Stock réel constaté</p>
                                <ChampNombre
                                    value={ligne.quantite_apres}
                                    onChange={v => modifier(i, 'quantite_apres', v)}
                                    videVaut={0}
                                    placeholder="0"
                                    className="w-full px-3 py-2 bg-white border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#15335a]/30"
                                    aria-label="Quantité après ajustement"
                                />
                            </div>
                            <p className="text-xs pb-2.5 min-w-[140px]">
                                {ligne.product_id ? (
                                    <>
                                        <span className="text-gray-500">Actuel : {actuel} · </span>
                                        <span className={
                                            ecart === 0 ? 'text-gray-400'
                                                : ecart > 0 ? 'text-green-600 font-bold'
                                                    : 'text-red-600 font-bold'
                                        }>
                                            {ecart > 0 ? `+${ecart}` : ecart}
                                        </span>
                                    </>
                                ) : '—'}
                            </p>
                            <button
                                onClick={() => setLignes(prev => prev.filter((_, idx) => idx !== i))}
                                className="p-2 text-red-500 hover:bg-red-50 rounded-lg transition-colors"
                                aria-label="Supprimer la ligne"
                            >
                                <Trash2 className="w-4 h-4" />
                            </button>
                        </div>
                    )
                })}
                <button
                    onClick={() => setLignes(prev => [...prev, { product_id: '', quantite_apres: 0 }])}
                    className="flex items-center gap-1.5 text-xs font-bold text-[#15335a] hover:underline"
                >
                    <Plus className="w-3.5 h-3.5" />
                    Ajouter un produit
                </button>
            </div>

            <div>
                <label className="text-xs font-medium text-gray-600 mb-1.5 block">Précision (optionnel)</label>
                <input
                    type="text"
                    value={note}
                    onChange={e => setNote(e.target.value)}
                    placeholder="Détail utile pour retrouver l'origine de l'écart"
                    className="w-full px-3 py-2 bg-white border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#15335a]/30"
                />
            </div>

            <Button onClick={handleSoumettre} disabled={enAttente} className="w-full">
                {enAttente
                    ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Ajustement en cours…</>
                    : <><SlidersHorizontal className="w-4 h-4 mr-2" />Appliquer l&apos;ajustement</>
                }
            </Button>

            <p className="text-xs text-gray-400">
                Pour corriger tout un entrepôt d&apos;un coup, passez plutôt par un inventaire :
                il fournit une feuille de comptage et un rapport valorisé.
            </p>
        </div>
    )
}
