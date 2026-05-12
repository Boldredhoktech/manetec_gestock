// components/shop/rapports/CentreRapports.tsx

'use client'

import { useState } from 'react'
import {
    FileText, Download, Loader2, BarChart3, Users,
    ShoppingCart, Package, Truck, TrendingUp, AlertCircle,
} from 'lucide-react'
//import type { ArrowLeftRight } from 'lucide-react'
import { ArrowLeftRight } from 'lucide-react'
import { Button } from '@/components/ui/button'

interface Rapport {
    id:          string
    titre:       string
    description: string
    icone:       React.ElementType
    couleur:     string
    fond:        string
    getUrl:      (params: Record<string, string>) => string
    params?:     { key: string; label: string; type: string }[]
}

const RAPPORTS: Rapport[] = [
    // ── BLOC 1A ──────────────────────────────────────
    {
        id:          'rapport-ventes',
        titre:       'Rapport de ventes',
        description: 'CA, top produits, par vendeur, par moyen de paiement',
        icone:       ShoppingCart,
        couleur:     'text-blue-600',
        fond:        'bg-blue-50 border-blue-200',
        getUrl:      (p) => `/api/v1/pdf/rapport-ventes?debut=${p.debut}&fin=${p.fin}`,
        params: [
            { key: 'debut', label: 'Date début', type: 'date' },
            { key: 'fin',   label: 'Date fin',   type: 'date' },
        ],
    },
    {
        id:          'rapport-clients',
        titre:       'Rapport clients',
        description: 'Soldes crédit/avance, historique achats',
        icone:       Users,
        couleur:     'text-purple-600',
        fond:        'bg-purple-50 border-purple-200',
        getUrl:      () => `/api/v1/pdf/rapport-clients`,
    },
    // ── BLOC 1B ──────────────────────────────────────
    {
        id:          'rapport-stock',
        titre:       'État du stock',
        description: 'Stock par entrepôt, alertes, valeur totale',
        icone:       Package,
        couleur:     'text-teal-600',
        fond:        'bg-teal-50 border-teal-200',
        getUrl:      () => `/api/v1/pdf/rapport-stock`,
    },
    {
        id:          'rapport-mouvements',
        titre:       'Mouvements de stock',
        description: 'Entrées, sorties, transferts par période',
        icone:       ArrowLeftRight,
        couleur:     'text-orange-600',
        fond:        'bg-orange-50 border-orange-200',
        getUrl:      (p) => `/api/v1/pdf/rapport-mouvements?debut=${p.debut}&fin=${p.fin}`,
        params: [
            { key: 'debut', label: 'Date début', type: 'date' },
            { key: 'fin',   label: 'Date fin',   type: 'date' },
        ],
    },
    {
        id:          'rapport-fournisseurs',
        titre:       'Rapport fournisseurs',
        description: 'Dettes fournisseurs, bons de commande',
        icone:       Truck,
        couleur:     'text-amber-600',
        fond:        'bg-amber-50 border-amber-200',
        getUrl:      () => `/api/v1/pdf/rapport-fournisseurs`,
    },

    // ── BLOC 1C ──────────────────────────────────────
    {
        id:          'rapport-pp',
        titre:       'Profits & Pertes',
        description: 'Compte de résultat mensuel avec évolution sur 6 mois',
        icone:       TrendingUp,
        couleur:     'text-green-600',
        fond:        'bg-green-50 border-green-200',
        getUrl:      (p) => `/api/v1/pdf/rapport-pp?mois=${p.mois}&annee=${p.annee}`,
        params: [
            { key: 'mois',  label: 'Mois (1-12)', type: 'number' },
            { key: 'annee', label: 'Année',        type: 'number' },
        ],
    },
    {
        id:          'rapport-salaires',
        titre:       'Rapport de paie',
        description: 'Détail des salaires versés par période',
        icone:       Users,
        couleur:     'text-indigo-600',
        fond:        'bg-indigo-50 border-indigo-200',
        getUrl:      (p) => `/api/v1/pdf/rapport-salaires?mois=${p.mois}&annee=${p.annee}`,
        params: [
            { key: 'mois',  label: 'Mois (1-12)', type: 'number' },
            { key: 'annee', label: 'Année',        type: 'number' },
        ],
    },
    {
        id:          'factures-impayees',
        titre:       'Factures impayées',
        description: 'Factures en retard et non encore échues',
        icone:       AlertCircle,
        couleur:     'text-red-600',
        fond:        'bg-red-50 border-red-200',
        getUrl:      () => `/api/v1/pdf/factures-impayees`,
    },
]

export default function CentreRapports() {
    const [enAttente, setEnAttente] = useState<string | null>(null)
    const [params, setParams]       = useState<Record<string, Record<string, string>>>({})

    const today = new Date().toISOString().split('T')[0]

    function getParam(rapportId: string, key: string): string {
        if (params[rapportId]?.[key]) return params[rapportId][key]
        if (key === 'mois')  return String(new Date().getMonth() + 1)
        if (key === 'annee') return String(new Date().getFullYear())
        return today
    }

    function setParam(rapportId: string, key: string, value: string) {
        setParams(prev => ({
            ...prev,
            [rapportId]: { ...(prev[rapportId] ?? {}), [key]: value },
        }))
    }

    async function handleTelecharger(rapport: Rapport) {
        setEnAttente(rapport.id)
        try {
            const paramValues = Object.fromEntries(
                (rapport.params ?? []).map(p => [p.key, getParam(rapport.id, p.key)])
            )
            const url  = rapport.getUrl(paramValues)
            const resp = await fetch(url)
            if (!resp.ok) throw new Error('Erreur génération PDF')
            const blob = await resp.blob()
            const link = document.createElement('a')
            link.href  = URL.createObjectURL(blob)
            link.download = `${rapport.id}-${today}.pdf`
            link.click()
        } catch (e) {
            console.error(e)
        } finally {
            setEnAttente(null)
        }
    }

    return (
        <div className="space-y-4 max-w-3xl">
            <p className="text-sm text-muted-foreground">
                Sélectionnez les paramètres puis cliquez sur Télécharger pour générer le rapport PDF.
            </p>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {RAPPORTS.map(rapport => {
                    const Icone = rapport.icone
                    const loading = enAttente === rapport.id
                    return (
                        <div key={rapport.id}
                             className={`border rounded-xl p-5 space-y-4 ${rapport.fond}`}>
                            <div className="flex items-start gap-3">
                                <div className="bg-white border rounded-lg p-2 shrink-0">
                                    <Icone className={`w-5 h-5 ${rapport.couleur}`} />
                                </div>
                                <div>
                                    <p className={`text-sm font-semibold ${rapport.couleur}`}>
                                        {rapport.titre}
                                    </p>
                                    <p className="text-xs text-muted-foreground mt-0.5">
                                        {rapport.description}
                                    </p>
                                </div>
                            </div>

                            {rapport.params && rapport.params.length > 0 && (
                                <div className="grid grid-cols-2 gap-2">
                                    {rapport.params.map(param => (
                                        <div key={param.key} className="space-y-1">
                                            <label className="text-xs font-medium text-foreground">
                                                {param.label}
                                            </label>
                                            <input
                                                type={param.type}
                                                value={getParam(rapport.id, param.key)}
                                                onChange={e => setParam(rapport.id, param.key, e.target.value)}
                                                className="w-full px-2 py-1.5 bg-white border border-input rounded text-xs focus:outline-none focus:ring-2 focus:ring-ring"
                                            />
                                        </div>
                                    ))}
                                </div>
                            )}

                            <Button
                                size="sm"
                                onClick={() => handleTelecharger(rapport)}
                                disabled={loading}
                                className="w-full"
                            >
                                {loading ? (
                                    <><Loader2 className="w-3.5 h-3.5 mr-2 animate-spin" />Génération...</>
                                ) : (
                                    <><Download className="w-3.5 h-3.5 mr-2" />Télécharger PDF</>
                                )}
                            </Button>
                        </div>
                    )
                })}
            </div>

            {/* Lien rapide depuis une facture */}
            <div className="bg-card border border-border rounded-xl p-5 space-y-2">
                <div className="flex items-center gap-2">
                    <FileText className="w-4 h-4 text-teal-600" />
                    <p className="text-sm font-semibold text-foreground">
                        Factures PDF individuelles
                    </p>
                </div>
                <p className="text-xs text-muted-foreground">
                    Chaque facture dispose d'un bouton de téléchargement PDF directement depuis sa fiche.
                    Allez dans <strong>Facturation → Factures → [fiche facture]</strong> pour télécharger.
                </p>
            </div>
        </div>
    )
}