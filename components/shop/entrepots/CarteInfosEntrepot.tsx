'use client'

import { useState } from 'react'
import { Warehouse, MapPin, FileText, TrendingUp,
    AlertTriangle, Package, Lock, Unlock, CheckCircle } from 'lucide-react'
import { formatMontant } from '@/lib/utils'
import { modifierEntrepot } from '@/actions/produits'

interface Entrepot {
    id:          string
    public_id:   string
    nom:         string
    description: string | null
    adresse:     string | null
    est_actif:   boolean
    est_defaut:  boolean
}

interface Props {
    entrepot:      Entrepot
    totalProduits: number
    enAlerte:      number
    enRupture:     number
    valeurStock:   number
    shopId:        string
}

export default function CarteInfosEntrepot({
                                               entrepot, totalProduits, enAlerte, enRupture, valeurStock,
                                           }: Props) {
    const [editable, setEditable]   = useState(false)
    const [nom, setNom]             = useState(entrepot.nom)
    const [description, setDesc]    = useState(entrepot.description ?? '')
    const [adresse, setAdresse]     = useState(entrepot.adresse ?? '')
    const [enAttente, setEnAttente] = useState(false)
    const [succes, setSucces]       = useState(false)

    async function handleSauvegarder() {
        setEnAttente(true)
        const formData = new FormData()
        formData.set('entrepotId',  entrepot.id)
        formData.set('nom',         nom)
        formData.set('description', description)
        formData.set('adresse',     adresse)
        await modifierEntrepot(formData)
        setEnAttente(false)
        setEditable(false)
        setSucces(true)
        setTimeout(() => setSucces(false), 3000)
    }

    return (
        <div className="space-y-4">

            {/* Carte infos */}
            <div className="bg-white border border-gray-200 rounded-2xl p-5 shadow-sm space-y-4">

                <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                        <div className="bg-[#15335a]/10 p-2 rounded-lg">
                            <Warehouse className="w-5 h-5 text-[#15335a]" />
                        </div>
                        <h2 className="text-sm font-bold text-gray-900">Informations</h2>
                    </div>
                    <button
                        onClick={() => setEditable(!editable)}
                        className="text-xs text-[#15335a] font-bold hover:underline"
                    >
                        {editable ? 'Annuler' : 'Modifier'}
                    </button>
                </div>

                {succes && (
                    <div className="flex items-center gap-2 p-2.5 bg-green-50 border border-green-200 rounded-lg text-xs text-green-700 font-medium">
                        <CheckCircle className="w-3.5 h-3.5 shrink-0" />
                        Entrepôt mis à jour avec succès
                    </div>
                )}

                <div className="space-y-3">
                    {editable ? (
                        <>
                            <div>
                                <label className="text-xs font-medium text-gray-500 mb-1 block">Nom</label>
                                <input type="text" value={nom} onChange={e => setNom(e.target.value)}
                                       className="w-full px-3 py-2 text-sm border border-[#15335a]/30 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#15335a]/30 bg-white" />
                            </div>
                            <div>
                                <label className="text-xs font-medium text-gray-500 mb-1 block">Description</label>
                                <textarea value={description} onChange={e => setDesc(e.target.value)}
                                          rows={2}
                                          className="w-full px-3 py-2 text-sm border border-[#15335a]/30 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#15335a]/30 bg-white resize-none" />
                            </div>
                            <div>
                                <label className="text-xs font-medium text-gray-500 mb-1 block">Adresse</label>
                                <input type="text" value={adresse} onChange={e => setAdresse(e.target.value)}
                                       className="w-full px-3 py-2 text-sm border border-[#15335a]/30 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#15335a]/30 bg-white" />
                            </div>
                            <button
                                onClick={handleSauvegarder}
                                disabled={enAttente || !nom.trim()}
                                className="w-full py-2 bg-[#15335a] text-white text-sm font-bold rounded-lg hover:bg-[#0f2742] disabled:opacity-50 transition-colors"
                            >
                                {enAttente ? 'Sauvegarde...' : 'Enregistrer'}
                            </button>
                        </>
                    ) : (
                        <>
                            {entrepot.description && (
                                <div className="flex items-start gap-2 text-sm">
                                    <FileText className="w-4 h-4 text-gray-400 mt-0.5 shrink-0" />
                                    <span className="text-gray-600">{entrepot.description}</span>
                                </div>
                            )}
                            {entrepot.adresse && (
                                <div className="flex items-center gap-2 text-sm">
                                    <MapPin className="w-4 h-4 text-gray-400 shrink-0" />
                                    <span className="text-gray-600">{entrepot.adresse}</span>
                                </div>
                            )}
                            {!entrepot.description && !entrepot.adresse && (
                                <p className="text-sm text-gray-400 italic">Aucune description ni adresse renseignée.</p>
                            )}
                        </>
                    )}
                </div>
            </div>

            {/* Carte stats */}
            <div className="bg-white border border-gray-200 rounded-2xl p-5 shadow-sm space-y-3">
                <div className="flex items-center gap-2 mb-1">
                    <div className="bg-green-100 p-2 rounded-lg">
                        <TrendingUp className="w-5 h-5 text-green-600" />
                    </div>
                    <h2 className="text-sm font-bold text-gray-900">Valeur du stock</h2>
                </div>

                <div className="p-4 bg-gradient-to-br from-[#15335a]/5 to-[#15335a]/10 rounded-xl border border-[#15335a]/20">
                    <p className="text-xs text-[#15335a]/70 mb-1">Valeur totale (prix achat)</p>
                    <p className="text-2xl font-black text-[#15335a]">
                        {formatMontant(valeurStock)}
                    </p>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                    {[
                        { label: 'Produits', val: totalProduits, couleur: 'text-[#15335a]',  bg: 'bg-blue-50'  },
                        { label: 'En alerte', val: enAlerte,     couleur: 'text-yellow-600', bg: 'bg-yellow-50' },
                        { label: 'Rupture',   val: enRupture,    couleur: 'text-red-600',    bg: 'bg-red-50'   },
                    ].map(stat => (
                        <div key={stat.label} className={`${stat.bg} rounded-xl p-3 text-center`}>
                            <p className={`text-xl font-black ${stat.couleur}`}>{stat.val}</p>
                            <p className="text-xs text-gray-500 mt-0.5">{stat.label}</p>
                        </div>
                    ))}
                </div>
            </div>

        </div>
    )
}