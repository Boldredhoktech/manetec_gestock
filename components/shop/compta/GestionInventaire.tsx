'use client'

import { useState, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import {
    creerInventaire, saisirQuantiteReelle, validerInventaire,
} from '@/actions/comptabilite'
import {
    ClipboardCheck, Plus, Search, CheckCircle, AlertTriangle,
    TrendingDown, TrendingUp, Loader2, AlertCircle, BarChart3,
    Filter, Package, ChevronDown, ChevronUp, History,
} from 'lucide-react'
import { formatMontant, formatDate } from '@/lib/utils'

interface Entrepot { id: string; nom: string; est_defaut: boolean }

interface InvItem {
    id: string
    quantite_theorique: number
    quantite_reelle:    number | null
    ecart:              number | null
    products: {
        id: string; nom: string; unite: string; prix_achat: number
        categories: { nom: string } | null
    } | null
}

interface Inventaire {
    id: string; public_id: string; nom: string | null
    statut: string; created_at: string
    valeur_pertes: number; valeur_gains: number
    nb_ecarts_negatifs: number; nb_ecarts_positifs: number
    warehouses:      { nom: string } | null
    inventory_items: InvItem[]
}

interface Props {
    entrepots:   Entrepot[]
    inventaires: Inventaire[]
    devise:      string
}

export default function GestionInventaire({ entrepots, inventaires, devise }: Props) {
    const router = useRouter()

    // ── États création ─────────────────────────────────────────
    const [warehouseId, setWarehouseId]   = useState(
        entrepots.find(e => e.est_defaut)?.id ?? entrepots[0]?.id ?? ''
    )
    const [nomPerso, setNomPerso]         = useState('')
    const [enAttente, setEnAttente]       = useState(false)
    const [erreur, setErreur]             = useState<string>()

    // ── États saisie ───────────────────────────────────────────
    const [quantites, setQuantites]       = useState<Record<string, string>>({})
    const [saisieEnCours, setSaisieEnCours] = useState<string | null>(null)
    const [filtre, setFiltre]             = useState<'tous'|'non_comptes'|'ecart'|'ok'>('tous')
    const [recherche, setRecherche]       = useState('')
    const [valEnAttente, setValEnAttente] = useState(false)
    const [resultatVal, setResultatVal]   = useState<{
        valeurPertes: number; valeurGains: number; nbNegatifs: number
    } | null>(null)

    const inventaireEnCours = inventaires.find(i => i.statut === 'en_cours')
    const historique        = inventaires.filter(i => i.statut !== 'en_cours')

    // ── Nom auto ───────────────────────────────────────────────
    const MOIS_FR = ['Janvier','Février','Mars','Avril','Mai','Juin',
        'Juillet','Août','Septembre','Octobre','Novembre','Décembre']
    const now = new Date()
    const entrepotChoisi = entrepots.find(e => e.id === warehouseId)
    const nomAuto = `Inventaire ${MOIS_FR[now.getMonth()]} ${now.getFullYear()} — ${entrepotChoisi?.nom ?? ''}`

    // ── Stats inventaire en cours ──────────────────────────────
    const stats = useMemo(() => {
        if (!inventaireEnCours) return null
        const items       = inventaireEnCours.inventory_items
        const total       = items.length
        const comptes     = items.filter(i => i.quantite_reelle !== null).length
        const avecEcart   = items.filter(i => i.ecart !== null && i.ecart !== 0).length
        const pertes      = items.filter(i => (i.ecart ?? 0) < 0)
        const gains       = items.filter(i => (i.ecart ?? 0) > 0)
        const valPertes   = pertes.reduce((acc, i) =>
            acc + Math.abs(i.ecart ?? 0) * (i.products?.prix_achat ?? 0), 0)
        const valGains    = gains.reduce((acc, i) =>
            acc + Math.abs(i.ecart ?? 0) * (i.products?.prix_achat ?? 0), 0)
        return { total, comptes, avecEcart, pertes: pertes.length, gains: gains.length, valPertes, valGains }
    }, [inventaireEnCours, quantites])

    // ── Filtrer et rechercher les articles ─────────────────────
    const articlesFiltres = useMemo(() => {
        if (!inventaireEnCours) return []
        return inventaireEnCours.inventory_items
            .filter(item => {
                if (!item.products) return false
                const matchRecherche = item.products.nom
                        .toLowerCase().includes(recherche.toLowerCase()) ||
                    (item.products.categories?.nom ?? '')
                        .toLowerCase().includes(recherche.toLowerCase())

                const qteReelle = item.quantite_reelle !== null
                    ? item.quantite_reelle
                    : quantites[item.id] !== undefined
                        ? parseFloat(quantites[item.id]) || null
                        : null

                const ecartCalc = qteReelle !== null
                    ? qteReelle - item.quantite_theorique
                    : null

                if (filtre === 'non_comptes') return matchRecherche && item.quantite_reelle === null && !quantites[item.id]
                if (filtre === 'ecart')       return matchRecherche && ecartCalc !== null && ecartCalc !== 0
                if (filtre === 'ok')          return matchRecherche && ecartCalc === 0
                return matchRecherche
            })
            .sort((a, b) => {
                // Non comptés en premier
                const aCompte = a.quantite_reelle !== null || quantites[a.id] !== undefined
                const bCompte = b.quantite_reelle !== null || quantites[b.id] !== undefined
                if (!aCompte && bCompte) return -1
                if (aCompte && !bCompte) return 1
                return a.products!.nom.localeCompare(b.products!.nom)
            })
    }, [inventaireEnCours, filtre, recherche, quantites])

    // ── Créer un inventaire ────────────────────────────────────
    async function handleCreer() {
        if (!warehouseId) { setErreur('Sélectionnez un entrepôt.'); return }
        setEnAttente(true)
        setErreur(undefined)
        const res = await creerInventaire(warehouseId, nomPerso)
        setEnAttente(false)
        if (res?.erreur) setErreur(res.erreur)
        else router.refresh()
    }

    // ── Saisir une quantité ────────────────────────────────────
    async function handleSaisir(itemId: string) {
        const valeur = quantites[itemId]
        if (valeur === undefined || valeur === '') return
        const qte = parseFloat(valeur)
        if (isNaN(qte) || qte < 0) return

        setSaisieEnCours(itemId)
        await saisirQuantiteReelle(itemId, qte)
        setSaisieEnCours(null)
        router.refresh()
    }

    // ── Valider l'inventaire ───────────────────────────────────
    async function handleValider() {
        if (!inventaireEnCours) return
        setValEnAttente(true)
        setErreur(undefined)
        const res = await validerInventaire(inventaireEnCours.id)
        setValEnAttente(false)
        if (res?.erreur) { setErreur(res.erreur); return }
        setResultatVal({
            valeurPertes: res.valeurPertes ?? 0,
            valeurGains:  res.valeurGains  ?? 0,
            nbNegatifs:   res.nbNegatifs   ?? 0,
        })
        router.refresh()
    }

    return (
        <div className="space-y-6">

            {/* ── ERREUR GLOBALE ──────────────────────────────────── */}
            {erreur && (
                <div className="flex items-start gap-3 p-4 bg-red-50 border border-red-200 rounded-2xl text-sm text-red-700">
                    <AlertCircle className="w-5 h-5 shrink-0 mt-0.5" />
                    {erreur}
                </div>
            )}

            {/* ── RÉSULTAT VALIDATION ────────────────────────────── */}
            {resultatVal && (
                <div className="p-5 bg-green-50 border-2 border-green-200 rounded-2xl space-y-3">
                    <div className="flex items-center gap-2">
                        <CheckCircle className="w-5 h-5 text-green-600" />
                        <h3 className="text-sm font-bold text-green-800">Inventaire validé avec succès !</h3>
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                        {resultatVal.valeurPertes > 0 && (
                            <div className="p-3 bg-red-50 border border-red-200 rounded-xl">
                                <p className="text-xs text-red-500 mb-1">Pertes constatées (règle C5)</p>
                                <p className="text-lg font-black text-red-600">
                                    -{formatMontant(resultatVal.valeurPertes, devise)}
                                </p>
                                <p className="text-xs text-red-400 mt-1">
                                    Dépense automatique créée dans "Pertes inventaire"
                                </p>
                            </div>
                        )}
                        {resultatVal.valeurGains > 0 && (
                            <div className="p-3 bg-green-50 border border-green-200 rounded-xl">
                                <p className="text-xs text-green-600 mb-1">Gains constatés (règle C6)</p>
                                <p className="text-lg font-black text-green-700">
                                    +{formatMontant(resultatVal.valeurGains, devise)}
                                </p>
                                <p className="text-xs text-green-500 mt-1">
                                    Stock ajusté à la hausse sans impact caisse
                                </p>
                            </div>
                        )}
                        {resultatVal.valeurPertes === 0 && resultatVal.valeurGains === 0 && (
                            <div className="p-3 bg-green-50 border border-green-200 rounded-xl col-span-2">
                                <p className="text-sm font-bold text-green-700">✓ Aucun écart — stock parfait !</p>
                            </div>
                        )}
                    </div>
                </div>
            )}

            {/* ── CRÉER UN INVENTAIRE ─────────────────────────────── */}
            {!inventaireEnCours && (
                <div className="bg-white border border-gray-200 rounded-2xl p-5 shadow-sm space-y-4">
                    <div className="flex items-center gap-2">
                        <div className="bg-[#1a56db]/10 p-2 rounded-lg">
                            <ClipboardCheck className="w-5 h-5 text-[#1a56db]" />
                        </div>
                        <h2 className="text-sm font-bold text-gray-900">Démarrer un inventaire</h2>
                    </div>

                    <div className="space-y-3">
                        <div>
                            <label className="text-xs font-medium text-gray-600 mb-1.5 block">
                                Entrepôt à inventorier
                            </label>
                            <select value={warehouseId}
                                    onChange={e => {
                                        setWarehouseId(e.target.value)
                                        setNomPerso('') // reset nom perso quand entrepôt change
                                    }}
                                    className="w-full px-3 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[#1a56db]/30">
                                {entrepots.map(e => (
                                    <option key={e.id} value={e.id}>
                                        {e.nom}{e.est_defaut ? ' (défaut)' : ''}
                                    </option>
                                ))}
                            </select>
                        </div>

                        <div>
                            <label className="text-xs font-medium text-gray-600 mb-1.5 block">
                                Nom de l'inventaire
                            </label>
                            <input
                                type="text"
                                value={nomPerso}
                                onChange={e => setNomPerso(e.target.value)}
                                placeholder={nomAuto}
                                className="w-full px-3 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[#1a56db]/30"
                            />
                            <p className="text-xs text-gray-400 mt-1.5">
                                Si vide, le nom automatique sera utilisé : <em>{nomAuto}</em>
                            </p>
                        </div>
                    </div>

                    <button
                        onClick={handleCreer}
                        disabled={enAttente || !warehouseId}
                        className="w-full flex items-center justify-center gap-2.5 py-3.5 bg-[#1a56db] text-white font-bold rounded-xl hover:bg-[#1648c0] disabled:opacity-50 transition-all hover:shadow-lg hover:shadow-[#1a56db]/30"
                    >
                        {enAttente
                            ? <><Loader2 className="w-4 h-4 animate-spin" />Création en cours...</>
                            : <><Plus className="w-4 h-4" />Démarrer l'inventaire</>
                        }
                    </button>
                </div>
            )}

            {/* ── INVENTAIRE EN COURS ─────────────────────────────── */}
            {inventaireEnCours && (
                <div className="space-y-4">

                    {/* En-tête inventaire */}
                    <div className="bg-white border border-gray-200 rounded-2xl p-5 shadow-sm space-y-4">
                        <div className="flex items-start justify-between gap-3">
                            <div>
                                <div className="flex items-center gap-2 mb-1">
                                    <div className="w-2.5 h-2.5 bg-amber-400 rounded-full animate-pulse" />
                                    <h2 className="text-sm font-bold text-gray-900">
                                        {inventaireEnCours.nom ?? inventaireEnCours.public_id}
                                    </h2>
                                </div>
                                <p className="text-xs font-mono text-gray-400">
                                    {inventaireEnCours.public_id} · {inventaireEnCours.warehouses?.nom}
                                    · Démarré le {formatDate(inventaireEnCours.created_at)}
                                </p>
                            </div>
                            <span className="shrink-0 px-3 py-1 bg-amber-100 text-amber-700 text-xs font-bold rounded-full border border-amber-200">
                En cours
              </span>
                        </div>

                        {/* Barre de progression */}
                        {stats && (
                            <div className="space-y-2">
                                <div className="flex items-center justify-between text-xs">
                                    <span className="font-medium text-gray-600">Progression du comptage</span>
                                    <span className="font-black text-[#1a56db]">
                    {stats.comptes}/{stats.total} articles
                  </span>
                                </div>
                                <div className="w-full h-3 bg-gray-100 rounded-full overflow-hidden">
                                    <div
                                        className="h-full rounded-full transition-all duration-500"
                                        style={{
                                            width:      `${stats.total > 0 ? (stats.comptes / stats.total) * 100 : 0}%`,
                                            background: 'linear-gradient(90deg, #1a56db 0%, #1648c0 100%)',
                                            boxShadow:  '0 0 8px rgba(26,86,219,0.4)',
                                        }}
                                    />
                                </div>
                                <p className="text-xs text-gray-400">
                                    {stats.total - stats.comptes} article(s) restant(s) à compter
                                </p>
                            </div>
                        )}

                        {/* Stats temps réel */}
                        {stats && stats.comptes > 0 && (
                            <div className="grid grid-cols-4 gap-2">
                                {[
                                    {
                                        label: 'Comptés',
                                        val:   stats.comptes,
                                        couleur: 'text-[#1a56db]',
                                        bg:    'bg-blue-50',
                                        icone: CheckCircle,
                                    },
                                    {
                                        label: 'Avec écart',
                                        val:   stats.avecEcart,
                                        couleur: stats.avecEcart > 0 ? 'text-amber-600' : 'text-gray-400',
                                        bg:    stats.avecEcart > 0 ? 'bg-amber-50' : 'bg-gray-50',
                                        icone: AlertTriangle,
                                    },
                                    {
                                        label: 'Pertes',
                                        val:   `−${formatMontant(stats.valPertes, devise)}`,
                                        couleur: stats.valPertes > 0 ? 'text-red-600' : 'text-gray-400',
                                        bg:    stats.valPertes > 0 ? 'bg-red-50' : 'bg-gray-50',
                                        icone: TrendingDown,
                                    },
                                    {
                                        label: 'Gains',
                                        val:   `+${formatMontant(stats.valGains, devise)}`,
                                        couleur: stats.valGains > 0 ? 'text-green-600' : 'text-gray-400',
                                        bg:    stats.valGains > 0 ? 'bg-green-50' : 'bg-gray-50',
                                        icone: TrendingUp,
                                    },
                                ].map(stat => {
                                    const Icone = stat.icone
                                    return (
                                        <div key={stat.label} className={`${stat.bg} rounded-xl p-3 text-center`}>
                                            <Icone className={`w-4 h-4 mx-auto mb-1 ${stat.couleur}`} />
                                            <p className={`text-xs font-black ${stat.couleur}`}>{stat.val}</p>
                                            <p className="text-xs text-gray-400 mt-0.5">{stat.label}</p>
                                        </div>
                                    )
                                })}
                            </div>
                        )}
                    </div>

                    {/* Filtres et recherche */}
                    <div className="bg-white border border-gray-200 rounded-2xl p-4 shadow-sm space-y-3">
                        <div className="flex flex-wrap gap-2">
                            {[
                                { key: 'tous',        label: 'Tous',        count: inventaireEnCours.inventory_items.length },
                                { key: 'non_comptes', label: 'Non comptés', count: inventaireEnCours.inventory_items.filter(i => i.quantite_reelle === null && !quantites[i.id]).length },
                                { key: 'ecart',       label: 'Avec écart',  count: inventaireEnCours.inventory_items.filter(i => i.ecart !== null && i.ecart !== 0).length },
                                { key: 'ok',          label: 'Sans écart',  count: inventaireEnCours.inventory_items.filter(i => i.ecart === 0).length },
                            ].map(f => (
                                <button key={f.key}
                                        onClick={() => setFiltre(f.key as any)}
                                        className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-bold transition-all ${
                                            filtre === f.key
                                                ? 'bg-[#1a56db] text-white shadow-md shadow-[#1a56db]/30'
                                                : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                                        }`}>
                                    {f.label}
                                    <span className={`px-1.5 py-0.5 rounded-full text-[10px] font-black ${
                                        filtre === f.key ? 'bg-white/20' : 'bg-gray-200'
                                    }`}>
                    {f.count}
                  </span>
                                </button>
                            ))}
                        </div>

                        <div className="relative">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                            <input type="text" placeholder="Rechercher un produit ou catégorie..."
                                   value={recherche} onChange={e => setRecherche(e.target.value)}
                                   className="w-full pl-9 pr-4 py-2 bg-gray-50 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[#1a56db]/30" />
                        </div>
                    </div>

                    {/* Tableau des articles */}
                    <div className="bg-white border border-gray-200 rounded-2xl shadow-sm overflow-hidden">

                        {/* En-tête tableau */}
                        <div
                            className="grid grid-cols-12 gap-2 px-4 py-3 text-xs font-bold text-white"
                            style={{ background: 'linear-gradient(135deg, #1a56db 0%, #1648c0 100%)' }}
                        >
                            <div className="col-span-4">Produit</div>
                            <div className="col-span-2">Catégorie</div>
                            <div className="col-span-2 text-center">Théorique</div>
                            <div className="col-span-2 text-center">Réel</div>
                            <div className="col-span-2 text-center">Écart</div>
                        </div>

                        {/* Lignes */}
                        {articlesFiltres.length === 0 ? (
                            <div className="text-center py-12 text-gray-400">
                                <Package className="w-8 h-8 mx-auto mb-2 opacity-30" />
                                <p className="text-sm">Aucun article dans ce filtre.</p>
                            </div>
                        ) : (
                            <div className="divide-y divide-gray-50">
                                {articlesFiltres.map((item, i) => {
                                    const p             = item.products!
                                    const valeurSaisie  = quantites[item.id]
                                    const qteSaisie     = valeurSaisie !== undefined ? parseFloat(valeurSaisie) : null
                                    const qteReelle     = item.quantite_reelle ?? qteSaisie
                                    const ecartAffiche  = qteReelle !== null
                                        ? qteReelle - item.quantite_theorique
                                        : null
                                    const estCompte     = item.quantite_reelle !== null

                                    return (
                                        <div key={item.id}
                                             className={`grid grid-cols-12 gap-2 items-center px-4 py-3 transition-colors ${
                                                 estCompte
                                                     ? ecartAffiche !== 0
                                                         ? (ecartAffiche ?? 0) < 0
                                                             ? 'bg-red-50/40 hover:bg-red-50/70'
                                                             : 'bg-green-50/40 hover:bg-green-50/70'
                                                         : 'bg-gray-50/30 hover:bg-gray-50/60'
                                                     : 'hover:bg-blue-50/30'
                                             }`}
                                        >
                                            {/* Produit */}
                                            <div className="col-span-4 min-w-0">
                                                <p className="text-sm font-semibold text-gray-800 truncate">{p.nom}</p>
                                                <p className="text-xs text-gray-400">
                                                    {p.prix_achat > 0 && formatMontant(p.prix_achat, '')} /unité
                                                </p>
                                            </div>

                                            {/* Catégorie */}
                                            <div className="col-span-2">
                        <span className="text-xs text-gray-500">
                          {p.categories?.nom ?? '—'}
                        </span>
                                            </div>

                                            {/* Théorique */}
                                            <div className="col-span-2 text-center">
                                                <p className="text-sm font-bold text-gray-700">
                                                    {item.quantite_theorique} <span className="text-xs font-normal">{p.unite}</span>
                                                </p>
                                            </div>

                                            {/* Réel — saisie ou valeur */}
                                            <div className="col-span-2 text-center">
                                                {estCompte ? (
                                                    <p className="text-sm font-bold text-[#1a56db]">
                                                        {item.quantite_reelle} <span className="text-xs font-normal">{p.unite}</span>
                                                    </p>
                                                ) : (
                                                    <div className="flex items-center gap-1">
                                                        <input
                                                            type="number"
                                                            min="0"
                                                            step="0.001"
                                                            value={quantites[item.id] ?? ''}
                                                            onChange={e => setQuantites(prev => ({
                                                                ...prev, [item.id]: e.target.value,
                                                            }))}
                                                            onBlur={() => {
                                                                if (quantites[item.id] !== undefined && quantites[item.id] !== '') {
                                                                    handleSaisir(item.id)
                                                                }
                                                            }}
                                                            onKeyDown={e => {
                                                                if (e.key === 'Enter') handleSaisir(item.id)
                                                            }}
                                                            placeholder="0"
                                                            className="w-16 px-2 py-1.5 text-center bg-white border-2 border-[#1a56db]/30 rounded-lg text-xs font-bold focus:outline-none focus:border-[#1a56db] focus:ring-2 focus:ring-[#1a56db]/20"
                                                        />
                                                        {saisieEnCours === item.id && (
                                                            <Loader2 className="w-3.5 h-3.5 animate-spin text-[#1a56db] shrink-0" />
                                                        )}
                                                    </div>
                                                )}
                                            </div>

                                            {/* Écart */}
                                            <div className="col-span-2 text-center">
                                                {ecartAffiche !== null ? (
                                                    <div>
                                                        <p className={`text-sm font-black ${
                                                            ecartAffiche === 0
                                                                ? 'text-green-600'
                                                                : ecartAffiche < 0
                                                                    ? 'text-red-600'
                                                                    : 'text-green-600'
                                                        }`}>
                                                            {ecartAffiche > 0 ? '+' : ''}{ecartAffiche}
                                                        </p>
                                                        {ecartAffiche !== 0 && (
                                                            <p className={`text-xs ${
                                                                ecartAffiche < 0 ? 'text-red-400' : 'text-green-400'
                                                            }`}>
                                                                {ecartAffiche < 0
                                                                    ? `−${formatMontant(Math.abs(ecartAffiche) * p.prix_achat, '')}`
                                                                    : `+${formatMontant(Math.abs(ecartAffiche) * p.prix_achat, '')}`
                                                                }
                                                            </p>
                                                        )}
                                                    </div>
                                                ) : (
                                                    <span className="text-xs text-gray-300 italic">—</span>
                                                )}
                                            </div>
                                        </div>
                                    )
                                })}
                            </div>
                        )}
                    </div>

                    {/* Résumé avant validation */}
                    {stats && stats.comptes === stats.total && (
                        <div className="bg-white border-2 border-[#1a56db]/30 rounded-2xl p-5 shadow-sm space-y-4">
                            <div className="flex items-center gap-2">
                                <BarChart3 className="w-5 h-5 text-[#1a56db]" />
                                <h3 className="text-sm font-bold text-[#1a56db]">
                                    Résumé avant validation
                                </h3>
                            </div>

                            <div className="grid grid-cols-2 gap-3">
                                <div className="p-4 bg-gray-50 rounded-xl">
                                    <p className="text-xs text-gray-500 mb-2">Articles comptés</p>
                                    <p className="text-2xl font-black text-gray-800">{stats.comptes}</p>
                                    <p className="text-xs text-gray-400">sur {stats.total} produits</p>
                                </div>
                                <div className={`p-4 rounded-xl ${
                                    stats.avecEcart > 0 ? 'bg-amber-50' : 'bg-green-50'
                                }`}>
                                    <p className={`text-xs mb-2 ${
                                        stats.avecEcart > 0 ? 'text-amber-600' : 'text-green-600'
                                    }`}>
                                        Écarts détectés
                                    </p>
                                    <p className={`text-2xl font-black ${
                                        stats.avecEcart > 0 ? 'text-amber-700' : 'text-green-700'
                                    }`}>
                                        {stats.avecEcart}
                                    </p>
                                    <p className={`text-xs ${
                                        stats.avecEcart > 0 ? 'text-amber-500' : 'text-green-500'
                                    }`}>
                                        {stats.avecEcart === 0
                                            ? 'Aucun écart — stock parfait !'
                                            : 'articles avec différence'
                                        }
                                    </p>
                                </div>
                            </div>

                            {(stats.valPertes > 0 || stats.valGains > 0) && (
                                <div className="grid grid-cols-2 gap-3">
                                    <div className="p-4 bg-red-50 border border-red-200 rounded-xl">
                                        <div className="flex items-center gap-2 mb-2">
                                            <TrendingDown className="w-4 h-4 text-red-500" />
                                            <p className="text-xs font-bold text-red-600">Pertes à constater</p>
                                        </div>
                                        <p className="text-xl font-black text-red-700">
                                            −{formatMontant(stats.valPertes, devise)}
                                        </p>
                                        <p className="text-xs text-red-400 mt-1">
                                            Règle C5 : dépense auto créée
                                        </p>
                                    </div>
                                    <div className="p-4 bg-green-50 border border-green-200 rounded-xl">
                                        <div className="flex items-center gap-2 mb-2">
                                            <TrendingUp className="w-4 h-4 text-green-500" />
                                            <p className="text-xs font-bold text-green-600">Gains à enregistrer</p>
                                        </div>
                                        <p className="text-xl font-black text-green-700">
                                            +{formatMontant(stats.valGains, devise)}
                                        </p>
                                        <p className="text-xs text-green-400 mt-1">
                                            Règle C6 : gain sans impact caisse
                                        </p>
                                    </div>
                                </div>
                            )}

                            <button
                                onClick={handleValider}
                                disabled={valEnAttente}
                                className="w-full flex items-center justify-center gap-2.5 py-4 bg-green-600 text-white font-bold text-base rounded-xl hover:bg-green-700 disabled:opacity-50 transition-all hover:shadow-lg hover:shadow-green-500/30"
                            >
                                {valEnAttente
                                    ? <><Loader2 className="w-5 h-5 animate-spin" />Validation en cours...</>
                                    : <><CheckCircle className="w-5 h-5" />Valider et appliquer l'inventaire</>
                                }
                            </button>
                        </div>
                    )}

                    {/* Bouton valider si pas tous comptés */}
                    {stats && stats.comptes < stats.total && (
                        <div className="p-4 bg-amber-50 border border-amber-200 rounded-2xl flex items-center gap-3">
                            <AlertTriangle className="w-5 h-5 text-amber-500 shrink-0" />
                            <div>
                                <p className="text-sm font-bold text-amber-700">
                                    Comptage incomplet
                                </p>
                                <p className="text-xs text-amber-600">
                                    Il reste <strong>{stats.total - stats.comptes}</strong> article(s) à compter avant de pouvoir valider.
                                    Saisissez les quantités réelles dans le tableau ci-dessus.
                                </p>
                            </div>
                        </div>
                    )}

                </div>
            )}

            {/* ── HISTORIQUE DES INVENTAIRES ──────────────────────── */}
            {historique.length > 0 && (
                <div className="bg-white border border-gray-200 rounded-2xl shadow-sm overflow-hidden">
                    <div className="flex items-center gap-2 p-5 border-b border-gray-100">
                        <div className="bg-gray-100 p-2 rounded-lg">
                            <History className="w-5 h-5 text-gray-500" />
                        </div>
                        <h2 className="text-sm font-bold text-gray-900">
                            Historique ({historique.length})
                        </h2>
                    </div>
                    <div className="divide-y divide-gray-50">
                        {historique.map(inv => (
                            <div key={inv.id}
                                 className="flex items-center justify-between px-5 py-3.5 hover:bg-gray-50 transition-colors">
                                <div className="min-w-0">
                                    <p className="text-sm font-semibold text-gray-800 truncate">
                                        {inv.nom ?? inv.public_id}
                                    </p>
                                    <div className="flex items-center gap-2 mt-0.5">
                                        <p className="text-xs font-mono text-gray-400">{inv.public_id}</p>
                                        <span className="text-gray-300">·</span>
                                        <p className="text-xs text-gray-400">{inv.warehouses?.nom}</p>
                                        <span className="text-gray-300">·</span>
                                        <p className="text-xs text-gray-400">{formatDate(inv.created_at)}</p>
                                    </div>
                                </div>
                                <div className="flex items-center gap-3 shrink-0 ml-3">
                                    {inv.nb_ecarts_negatifs > 0 && (
                                        <span className="text-xs text-red-600 font-bold bg-red-50 px-2 py-0.5 rounded-full">
                      -{formatMontant(inv.valeur_pertes, devise)}
                    </span>
                                    )}
                                    {inv.nb_ecarts_positifs > 0 && (
                                        <span className="text-xs text-green-600 font-bold bg-green-50 px-2 py-0.5 rounded-full">
                      +{formatMontant(inv.valeur_gains, devise)}
                    </span>
                                    )}
                                    <span className={`px-2.5 py-0.5 rounded-full text-xs font-bold border ${
                                        inv.statut === 'valide'
                                            ? 'bg-green-50 text-green-700 border-green-200'
                                            : 'bg-gray-50 text-gray-500 border-gray-200'
                                    }`}>
                    {inv.statut === 'valide' ? 'Validé' : 'Annulé'}
                  </span>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            )}

        </div>
    )
}