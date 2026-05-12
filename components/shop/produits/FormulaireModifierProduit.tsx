'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { modifierProduit } from '@/actions/produits'
import { Button } from '@/components/ui/button'
import { Loader2, AlertCircle, CheckCircle } from 'lucide-react'

interface Produit {
    id:              string
    nom:             string
    description:     string | null
    type_produit:    string
    sku:             string | null
    code_barres:     string | null
    unite:           string
    category_id:     string | null
    brand_id:        string | null
    prix_achat:      number
    prix_vente:      number
    prix_gros:       number | null
    prix_minimum:    number | null
    tva_pct:         number
    seuil_alerte:    number
    necessite_imei:  boolean
    necessite_serie: boolean
    est_retournable: boolean
    garantie_mois:   number | null
}

interface Props {
    produit:    Produit
    categories: { id: string; nom: string }[]
    marques:    { id: string; nom: string }[]
}

const UNITES = ['unité', 'kg', 'g', 'litre', 'ml', 'mètre', 'cm', 'boîte', 'carton', 'paire', 'lot']
const TYPES  = [
    { val: 'simple',   label: 'Simple — article standard' },
    { val: 'ponderal', label: 'Pondéral — vendu au poids' },
    { val: 'kit',      label: 'Kit — assemblage de produits' },
]

export default function FormulaireModifierProduit({ produit, categories, marques }: Props) {
    const router = useRouter()

    const [nom,           setNom]           = useState(produit.nom)
    const [description,   setDescription]   = useState(produit.description ?? '')
    const [typeProduit,   setTypeProduit]   = useState(produit.type_produit)
    const [sku,           setSku]           = useState(produit.sku ?? '')
    const [codeBarres,    setCodeBarres]    = useState(produit.code_barres ?? '')
    const [unite,         setUnite]         = useState(produit.unite)
    const [categoryId,    setCategoryId]    = useState(produit.category_id ?? '')
    const [brandId,       setBrandId]       = useState(produit.brand_id ?? '')
    const [prixAchat,     setPrixAchat]     = useState(produit.prix_achat)
    const [prixVente,     setPrixVente]     = useState(produit.prix_vente)
    const [prixGros,      setPrixGros]      = useState(produit.prix_gros ?? 0)
    const [prixMinimum,   setPrixMinimum]   = useState(produit.prix_minimum ?? 0)
    const [tvaPct,        setTvaPct]        = useState(produit.tva_pct)
    const [seuilAlerte,   setSeuilAlerte]   = useState(produit.seuil_alerte)
    const [necessiteImei, setNecessiteImei] = useState(produit.necessite_imei)
    const [necessiteSerie, setNecessiteSerie] = useState(produit.necessite_serie)
    const [estRetournable, setEstRetournable] = useState(produit.est_retournable)
    const [garantieMois,  setGarantieMois]  = useState(produit.garantie_mois ?? 0)

    const [enAttente, setEnAttente] = useState(false)
    const [erreur,    setErreur]    = useState<string>()
    const [succes,    setSucces]    = useState(false)

    async function handleSoumettre() {
        if (!nom.trim()) { setErreur('Le nom est obligatoire.'); return }
        if (prixVente <= 0) { setErreur('Le prix de vente doit être supérieur à 0.'); return }

        setEnAttente(true)
        setErreur(undefined)

        const formData = new FormData()
        formData.set('productId',      produit.id)
        formData.set('nom',            nom.trim())
        formData.set('description',    description.trim())
        formData.set('type_produit',   typeProduit)
        formData.set('sku',            sku.trim())
        formData.set('code_barres',    codeBarres.trim())
        formData.set('unite',          unite)
        formData.set('category_id',    categoryId)
        formData.set('brand_id',       brandId)
        formData.set('prix_achat',     String(prixAchat))
        formData.set('prix_vente',     String(prixVente))
        formData.set('prix_gros',      String(prixGros))
        formData.set('prix_minimum',   String(prixMinimum))
        formData.set('tva_pct',        String(tvaPct))
        formData.set('seuil_alerte',   String(seuilAlerte))
        formData.set('garantie_mois',  String(garantieMois))
        if (necessiteImei)  formData.set('necessite_imei',  'true')
        if (necessiteSerie) formData.set('necessite_serie', 'true')
        if (estRetournable) formData.set('est_retournable', 'true')

        const res = await modifierProduit(formData)
        setEnAttente(false)

        if (res?.erreur) { setErreur(res.erreur); return }

        setSucces(true)
        setTimeout(() => router.push(`/stock/produits/${produit.id}`), 1200)
    }

    const inputClass = 'w-full px-3 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[#1a56db]/30 focus:border-[#1a56db]/40 transition-colors'

    return (
        <div className="space-y-5 py-4">

            {erreur && (
                <div className="flex items-start gap-3 bg-red-50 border border-red-200 text-red-700 rounded-xl px-4 py-3 text-sm">
                    <AlertCircle className="w-4 h-4 mt-0.5 shrink-0" />
                    {erreur}
                </div>
            )}
            {succes && (
                <div className="flex items-center gap-3 bg-green-50 border border-green-200 text-green-700 rounded-xl px-4 py-3 text-sm">
                    <CheckCircle className="w-4 h-4 shrink-0" />
                    Produit modifié avec succès. Redirection...
                </div>
            )}

            {/* Informations générales */}
            <div className="bg-white border border-gray-200 rounded-2xl p-5 shadow-sm space-y-4">
                <h2 className="text-sm font-bold text-[#1a56db]">Informations générales</h2>

                <div className="space-y-1.5">
                    <label className="text-sm font-medium text-gray-700">
                        Nom <span className="text-red-500">*</span>
                    </label>
                    <input type="text" value={nom} onChange={e => setNom(e.target.value)}
                           placeholder="Nom du produit" className={inputClass} />
                </div>

                <div className="space-y-1.5">
                    <label className="text-sm font-medium text-gray-700">Description</label>
                    <textarea value={description} onChange={e => setDescription(e.target.value)}
                              rows={2} placeholder="Description optionnelle"
                              className={inputClass + ' resize-none'} />
                </div>

                <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-1.5">
                        <label className="text-sm font-medium text-gray-700">Type de produit</label>
                        <select value={typeProduit} onChange={e => setTypeProduit(e.target.value)}
                                className={inputClass}>
                            {TYPES.map(t => (
                                <option key={t.val} value={t.val}>{t.label}</option>
                            ))}
                        </select>
                    </div>
                    <div className="space-y-1.5">
                        <label className="text-sm font-medium text-gray-700">Unité de vente</label>
                        <select value={unite} onChange={e => setUnite(e.target.value)}
                                className={inputClass}>
                            {UNITES.map(u => (
                                <option key={u} value={u}>{u}</option>
                            ))}
                        </select>
                    </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-1.5">
                        <label className="text-sm font-medium text-gray-700">SKU</label>
                        <input type="text" value={sku} onChange={e => setSku(e.target.value)}
                               placeholder="Référence interne" className={inputClass} />
                    </div>
                    <div className="space-y-1.5">
                        <label className="text-sm font-medium text-gray-700">Code-barres</label>
                        <input type="text" value={codeBarres} onChange={e => setCodeBarres(e.target.value)}
                               placeholder="EAN-13, QR code..." className={inputClass} />
                    </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-1.5">
                        <label className="text-sm font-medium text-gray-700">Catégorie</label>
                        <select value={categoryId} onChange={e => setCategoryId(e.target.value)}
                                className={inputClass}>
                            <option value="">— Aucune —</option>
                            {categories.map(c => (
                                <option key={c.id} value={c.id}>{c.nom}</option>
                            ))}
                        </select>
                    </div>
                    <div className="space-y-1.5">
                        <label className="text-sm font-medium text-gray-700">Marque</label>
                        <select value={brandId} onChange={e => setBrandId(e.target.value)}
                                className={inputClass}>
                            <option value="">— Aucune —</option>
                            {marques.map(m => (
                                <option key={m.id} value={m.id}>{m.nom}</option>
                            ))}
                        </select>
                    </div>
                </div>
            </div>

            {/* Grille tarifaire */}
            <div className="bg-white border border-gray-200 rounded-2xl p-5 shadow-sm space-y-4">
                <h2 className="text-sm font-bold text-[#1a56db]">Grille tarifaire</h2>

                <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-1.5">
                        <label className="text-sm font-medium text-gray-700">
                            Prix d'achat <span className="text-red-500">*</span>
                        </label>
                        <input type="number" min="0" step="0.01" value={prixAchat}
                               onChange={e => setPrixAchat(parseFloat(e.target.value) || 0)}
                               className={inputClass} />
                    </div>
                    <div className="space-y-1.5">
                        <label className="text-sm font-medium text-gray-700">
                            Prix de vente <span className="text-red-500">*</span>
                        </label>
                        <input type="number" min="0" step="0.01" value={prixVente}
                               onChange={e => setPrixVente(parseFloat(e.target.value) || 0)}
                               className={inputClass} />
                    </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-1.5">
                        <label className="text-sm font-medium text-gray-700">Prix de gros</label>
                        <input type="number" min="0" step="0.01" value={prixGros}
                               onChange={e => setPrixGros(parseFloat(e.target.value) || 0)}
                               className={inputClass} />
                    </div>
                    <div className="space-y-1.5">
                        <label className="text-sm font-medium text-gray-700">Prix minimum</label>
                        <input type="number" min="0" step="0.01" value={prixMinimum}
                               onChange={e => setPrixMinimum(parseFloat(e.target.value) || 0)}
                               className={inputClass} />
                    </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-1.5">
                        <label className="text-sm font-medium text-gray-700">TVA (%)</label>
                        <input type="number" min="0" max="100" step="0.5" value={tvaPct}
                               onChange={e => setTvaPct(parseFloat(e.target.value) || 0)}
                               className={inputClass} />
                    </div>
                    <div className="space-y-1.5">
                        <label className="text-sm font-medium text-gray-700">Seuil d'alerte stock</label>
                        <input type="number" min="0" step="1" value={seuilAlerte}
                               onChange={e => setSeuilAlerte(parseInt(e.target.value) || 0)}
                               className={inputClass} />
                    </div>
                </div>

                {/* Marge indicative */}
                {prixAchat > 0 && prixVente > 0 && (
                    <div className="p-3 bg-[#1a56db]/5 border border-[#1a56db]/20 rounded-xl flex justify-between items-center">
                        <span className="text-xs font-bold text-[#1a56db]">Marge brute estimée</span>
                        <span className="text-sm font-black text-[#1a56db]">
                            {(((prixVente - prixAchat) / prixAchat) * 100).toFixed(1)}%
                        </span>
                    </div>
                )}
            </div>

            {/* Options avancées */}
            <div className="bg-white border border-gray-200 rounded-2xl p-5 shadow-sm space-y-4">
                <h2 className="text-sm font-bold text-[#1a56db]">Options avancées</h2>

                <div className="grid grid-cols-2 gap-3">
                    <label className={`flex items-center gap-2.5 cursor-pointer p-3 rounded-xl border-2 transition-all ${
                        necessiteImei ? 'bg-blue-50 border-blue-300' : 'bg-gray-50 border-gray-200 hover:border-gray-300'
                    }`}>
                        <input type="checkbox" checked={necessiteImei}
                               onChange={e => setNecessiteImei(e.target.checked)}
                               className="rounded accent-[#1a56db]" />
                        <div>
                            <p className="text-sm font-bold text-blue-700">IMEI requis</p>
                            <p className="text-xs text-blue-500">Téléphones, tablettes</p>
                        </div>
                    </label>

                    <label className={`flex items-center gap-2.5 cursor-pointer p-3 rounded-xl border-2 transition-all ${
                        necessiteSerie ? 'bg-purple-50 border-purple-300' : 'bg-gray-50 border-gray-200 hover:border-gray-300'
                    }`}>
                        <input type="checkbox" checked={necessiteSerie}
                               onChange={e => setNecessiteSerie(e.target.checked)}
                               className="rounded accent-purple-600" />
                        <div>
                            <p className="text-sm font-bold text-purple-700">N° de série requis</p>
                            <p className="text-xs text-purple-500">Électronique, machines</p>
                        </div>
                    </label>

                    <label className={`flex items-center gap-2.5 cursor-pointer p-3 rounded-xl border-2 transition-all ${
                        estRetournable ? 'bg-amber-50 border-amber-300' : 'bg-gray-50 border-gray-200 hover:border-gray-300'
                    }`}>
                        <input type="checkbox" checked={estRetournable}
                               onChange={e => setEstRetournable(e.target.checked)}
                               className="rounded accent-amber-500" />
                        <div>
                            <p className="text-sm font-bold text-amber-700">Retournable</p>
                            <p className="text-xs text-amber-500">Retour client autorisé</p>
                        </div>
                    </label>

                    <div className="p-3 bg-green-50 border-2 border-green-200 rounded-xl">
                        <p className="text-xs font-bold text-green-700 mb-1.5">Garantie (mois)</p>
                        <input type="number" min="0" value={garantieMois}
                               onChange={e => setGarantieMois(parseInt(e.target.value) || 0)}
                               placeholder="0 = aucune"
                               className="w-full px-2 py-1.5 bg-white border border-green-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-green-400" />
                    </div>
                </div>
            </div>

            <Button
                onClick={handleSoumettre}
                disabled={enAttente}
                className="w-full py-3 font-bold text-base rounded-xl"
                style={{ background: 'linear-gradient(135deg, #1a56db 0%, #1648c0 100%)' }}
            >
                {enAttente
                    ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Enregistrement...</>
                    : 'Enregistrer les modifications'
                }
            </Button>
        </div>
    )
}