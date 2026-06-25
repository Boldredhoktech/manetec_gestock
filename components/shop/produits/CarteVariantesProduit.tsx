'use client'

import { useState } from 'react'
import { creerVarianteProduit } from '@/actions/produits'
import { Plus, Palette, Loader2 } from 'lucide-react'

interface Variante {
    id: string; nom: string; attribute_type: string
    color_hex: string | null; est_actif: boolean
}

interface Props {
    variantes:  Variante[]
    productId:  string
    shopId:     string
}

const TYPE_LABELS: Record<string, string> = {
    color:   'Couleur',
    size:    'Taille',
    storage: 'Stockage',
    other:   'Autre',
}

export default function CarteVariantesProduit({ variantes, productId, shopId }: Props) {
    const [ajout, setAjout]       = useState(false)
    const [nom, setNom]           = useState('')
    const [type, setType]         = useState('color')
    const [couleur, setCouleur]   = useState('#15335a')
    const [enAttente, setEnAttente] = useState(false)

    async function handleAjouter() {
        if (!nom.trim()) return
        setEnAttente(true)
        const formData = new FormData()
        formData.set('productId',      productId)
        formData.set('shopId',         shopId)
        formData.set('nom',            nom)
        formData.set('attributeType',  type)
        formData.set('colorHex',       type === 'color' ? couleur : '')
        await creerVarianteProduit(formData)
        setNom('')
        setAjout(false)
        setEnAttente(false)
    }

    return (
        <div className="bg-white border border-gray-200 rounded-2xl p-5 shadow-sm space-y-4">

            <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                    <div className="bg-purple-100 p-2 rounded-lg">
                        <Palette className="w-5 h-5 text-purple-600" />
                    </div>
                    <h2 className="text-sm font-bold text-gray-900">
                        Variantes ({variantes.length})
                    </h2>
                </div>
                <button onClick={() => setAjout(!ajout)}
                        className="flex items-center gap-1.5 text-xs text-[#15335a] font-bold hover:underline">
                    <Plus className="w-3.5 h-3.5" />
                    Ajouter
                </button>
            </div>

            {/* Formulaire ajout */}
            {ajout && (
                <div className="p-3 bg-purple-50 border border-purple-200 rounded-xl space-y-3">
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                        <div>
                            <label className="text-xs font-medium text-gray-600 mb-1 block">Nom</label>
                            <input type="text" value={nom} onChange={e => setNom(e.target.value)}
                                   placeholder="Ex: Rouge 128Go"
                                   className="w-full px-2.5 py-2 text-sm border border-purple-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-400 bg-white" />
                        </div>
                        <div>
                            <label className="text-xs font-medium text-gray-600 mb-1 block">Type</label>
                            <select value={type} onChange={e => setType(e.target.value)}
                                    className="w-full px-2.5 py-2 text-sm border border-purple-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-400 bg-white">
                                {Object.entries(TYPE_LABELS).map(([k, v]) => (
                                    <option key={k} value={k}>{v}</option>
                                ))}
                            </select>
                        </div>
                    </div>
                    {type === 'color' && (
                        <div className="flex items-center gap-3">
                            <label className="text-xs font-medium text-gray-600">Couleur</label>
                            <input type="color" value={couleur} onChange={e => setCouleur(e.target.value)}
                                   className="w-8 h-8 rounded cursor-pointer border-0" />
                            <span className="text-xs font-mono text-gray-500">{couleur}</span>
                        </div>
                    )}
                    <div className="flex gap-2">
                        <button onClick={handleAjouter} disabled={enAttente || !nom.trim()}
                                className="flex items-center gap-1.5 px-3 py-1.5 bg-purple-600 text-white text-xs font-bold rounded-lg hover:bg-purple-700 disabled:opacity-50">
                            {enAttente ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Plus className="w-3.5 h-3.5" />}
                            Ajouter
                        </button>
                        <button onClick={() => setAjout(false)}
                                className="px-3 py-1.5 text-xs text-gray-500 hover:text-gray-700">
                            Annuler
                        </button>
                    </div>
                </div>
            )}

            {/* Liste variantes */}
            <div className="flex flex-wrap gap-2">
                {variantes.map(v => (
                    <div key={v.id} className="flex items-center gap-2 px-3 py-1.5 bg-gray-100 rounded-full">
                        {v.color_hex && (
                            <div className="w-3.5 h-3.5 rounded-full border border-gray-300 shrink-0"
                                 style={{ backgroundColor: v.color_hex }} />
                        )}
                        <span className="text-xs font-semibold text-gray-700">{v.nom}</span>
                        <span className="text-xs text-gray-400">({TYPE_LABELS[v.attribute_type] ?? v.attribute_type})</span>
                    </div>
                ))}
            </div>
        </div>
    )
}