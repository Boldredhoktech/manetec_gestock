'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { creerTransfert } from '@/actions/stock'
import ChampNombre from '@/components/ui/ChampNombre'
import { Button } from '@/components/ui/button'
import {
    ArrowLeftRight, Plus, Trash2, Loader2, AlertCircle, CheckCircle,
} from 'lucide-react'

interface Entrepot { id: string; nom: string; est_defaut: boolean }
interface Produit  { id: string; nom: string; unite: string; stocks: Record<string, number> }

interface Props { entrepots: Entrepot[]; produits: Produit[] }

interface Ligne { product_id: string; quantite: number }

export default function FormulaireTransfert({ entrepots, produits }: Props) {
    const router = useRouter()
    const defaut = entrepots.find(e => e.est_defaut) ?? entrepots[0]

    const [source, setSource]       = useState(defaut?.id ?? '')
    const [dest, setDest]           = useState(entrepots.find(e => e.id !== defaut?.id)?.id ?? '')
    const [note, setNote]           = useState('')
    const [lignes, setLignes]       = useState<Ligne[]>([{ product_id: '', quantite: 1 }])
    const [enAttente, setEnAttente] = useState(false)
    const [erreur, setErreur]       = useState<string>()
    const [succes, setSucces]       = useState<string>()

    const stockSource = (productId: string) =>
        produits.find(p => p.id === productId)?.stocks[source] ?? 0

    function modifier(i: number, champ: keyof Ligne, valeur: string | number) {
        setLignes(prev => prev.map((l, idx) => idx === i ? { ...l, [champ]: valeur } : l))
    }

    async function handleSoumettre() {
        setErreur(undefined)
        setSucces(undefined)

        const valides = lignes.filter(l => l.product_id && l.quantite > 0)
        if (valides.length === 0) { setErreur('Ajoutez au moins une ligne avec un produit et une quantité.'); return }
        if (source === dest)      { setErreur('Les entrepôts source et destination doivent être différents.'); return }

        const insuffisant = valides.find(l => l.quantite > stockSource(l.product_id))
        if (insuffisant) {
            const nom = produits.find(p => p.id === insuffisant.product_id)?.nom
            setErreur(`Stock insuffisant pour ${nom} : ${stockSource(insuffisant.product_id)} disponible dans l'entrepôt source.`)
            return
        }

        setEnAttente(true)
        const res = await creerTransfert(source, dest, note, valides)
        setEnAttente(false)

        if (res?.erreur) { setErreur(res.erreur); return }
        setSucces(res.public_id)
        setLignes([{ product_id: '', quantite: 1 }])
        setNote('')
        router.refresh()
    }

    if (entrepots.length < 2) {
        return (
            <div className="p-5 bg-amber-50 border border-amber-200 rounded-2xl text-sm text-amber-800">
                Un transfert suppose au moins deux entrepôts. Créez un second entrepôt pour déplacer du stock.
            </div>
        )
    }

    return (
        <div className="bg-white border border-gray-200 rounded-2xl p-5 shadow-sm space-y-4">

            <div className="flex items-center gap-2">
                <div className="bg-[#15335a]/10 p-2 rounded-lg">
                    <ArrowLeftRight className="w-5 h-5 text-[#15335a]" />
                </div>
                <h2 className="text-sm font-bold text-gray-900">Nouveau transfert</h2>
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
                    Transfert {succes} enregistré.
                </div>
            )}

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                    <label className="text-xs font-medium text-gray-600 mb-1.5 block">Entrepôt source</label>
                    <select
                        value={source}
                        onChange={e => setSource(e.target.value)}
                        className="w-full px-3 py-2 bg-white border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#15335a]/30"
                    >
                        {entrepots.map(e => (
                            <option key={e.id} value={e.id}>{e.nom}{e.est_defaut ? ' (défaut)' : ''}</option>
                        ))}
                    </select>
                </div>
                <div>
                    <label className="text-xs font-medium text-gray-600 mb-1.5 block">Entrepôt destination</label>
                    <select
                        value={dest}
                        onChange={e => setDest(e.target.value)}
                        className="w-full px-3 py-2 bg-white border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#15335a]/30"
                    >
                        {entrepots.filter(e => e.id !== source).map(e => (
                            <option key={e.id} value={e.id}>{e.nom}</option>
                        ))}
                    </select>
                </div>
            </div>

            <div className="space-y-2">
                <label className="text-xs font-medium text-gray-600 block">Articles à déplacer</label>
                {lignes.map((ligne, i) => (
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
                        <div className="w-28">
                            <ChampNombre
                                value={ligne.quantite}
                                onChange={v => modifier(i, 'quantite', v)}
                                videVaut={0}
                                placeholder="Qté"
                                className="w-full px-3 py-2 bg-white border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#15335a]/30"
                                aria-label="Quantité à transférer"
                            />
                        </div>
                        <p className="text-xs text-gray-500 pb-2.5 min-w-[110px]">
                            {ligne.product_id
                                ? `Disponible : ${stockSource(ligne.product_id)}`
                                : '—'}
                        </p>
                        <button
                            onClick={() => setLignes(prev => prev.filter((_, idx) => idx !== i))}
                            className="p-2 text-red-500 hover:bg-red-50 rounded-lg transition-colors"
                            aria-label="Supprimer la ligne"
                        >
                            <Trash2 className="w-4 h-4" />
                        </button>
                    </div>
                ))}
                <button
                    onClick={() => setLignes(prev => [...prev, { product_id: '', quantite: 1 }])}
                    className="flex items-center gap-1.5 text-xs font-bold text-[#15335a] hover:underline"
                >
                    <Plus className="w-3.5 h-3.5" />
                    Ajouter un article
                </button>
            </div>

            <div>
                <label className="text-xs font-medium text-gray-600 mb-1.5 block">Note (optionnel)</label>
                <input
                    type="text"
                    value={note}
                    onChange={e => setNote(e.target.value)}
                    placeholder="Motif du transfert, transporteur…"
                    className="w-full px-3 py-2 bg-white border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#15335a]/30"
                />
            </div>

            <Button onClick={handleSoumettre} disabled={enAttente} className="w-full">
                {enAttente
                    ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Transfert en cours…</>
                    : <><ArrowLeftRight className="w-4 h-4 mr-2" />Effectuer le transfert</>
                }
            </Button>

            <p className="text-xs text-gray-400">
                Le transfert est appliqué en une seule fois : si une ligne échoue, aucune n&apos;est appliquée.
            </p>
        </div>
    )
}
