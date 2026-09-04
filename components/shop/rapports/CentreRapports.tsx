// components/shop/rapports/CentreRapports.tsx

'use client'

// ══════════════════════════════════════════════════════════════
// Le centre de rapports.
//
// Quatre reproches lui étaient faits, et ils tenaient tous au même
// défaut : le document sortait du logiciel sans qu'on ait jamais pu
// le regarder.
//
//  · La période proposée par défaut était « aujourd'hui au jour
//    même » : un rapport de ventes généré sans y penser couvrait
//    quelques heures. C'est le mois en cours, maintenant.
//  · Aucun aperçu : il fallait télécharger, ouvrir le dossier des
//    téléchargements, constater l'erreur, régénérer — en accumulant
//    les fichiers. Le document s'affiche ici, et on le garde ensuite
//    si on le veut.
//  · L'état du stock accepte un entrepôt en paramètre depuis
//    toujours, et l'écran ne le proposait pas.
//  · Tout sortait en PDF. Les rapports qui SONT des listes ont un
//    export CSV (décision D3) ; un compte de résultat n'en a pas,
//    parce que ce n'est pas un tableau.
// ══════════════════════════════════════════════════════════════

import { useState, useEffect } from 'react'
import {
    FileText, Download, Loader2, Users, Eye, X,
    ShoppingCart, Package, Truck, TrendingUp, AlertCircle,
    ArrowLeftRight, Wallet, Undo2, Table2,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { usePermission } from '@/hooks/usePermission'
import { PERMISSIONS } from '@/lib/constants/permissions'
import { jourBoutique } from '@/lib/dates/periode'

interface Rapport {
    id:          string
    titre:       string
    description: string
    icone:       React.ElementType
    couleur:     string
    fond:        string
    getUrl:      (params: Record<string, string>) => string
    params?:     { key: string; label: string; type: string }[]
    /** Identifiant côté /api/v1/csv, pour les rapports qui sont des listes. */
    csv?:        string
    /** Le rapport se restreint à un entrepôt. */
    entrepot?:   boolean
    // Permission exigee par la route en plus de reports.generate.
    // Sans elle, le bouton ouvrait un onglet qui repond 403.
    permission:  string
}

const RAPPORTS: Rapport[] = [
    // ── BLOC 1A ──────────────────────────────────────
    {
        id:          'rapport-ventes',
        titre:       'Rapport de ventes',
        description: 'Facturé et encaissé, top produits, par vendeur, par moyen de paiement',
        icone:       ShoppingCart,
        couleur:     'text-blue-600',
        fond:        'bg-blue-50 border-blue-200',
        permission:  PERMISSIONS.VENTES_VOIR,
        csv:         'ventes',
        getUrl:      (p) => `/api/v1/pdf/rapport-ventes?debut=${p.debut}&fin=${p.fin}`,
        params: [
            { key: 'debut', label: 'Date début', type: 'date' },
            { key: 'fin',   label: 'Date fin',   type: 'date' },
        ],
    },
    {
        id:          'rapport-caisse',
        titre:       'Rapport de caisse',
        description: 'Journées, écarts constatés, et le détail de chacune par moyen de paiement',
        icone:       Wallet,
        couleur:     'text-cyan-700',
        fond:        'bg-cyan-50 border-cyan-200',
        permission:  PERMISSIONS.COMPTABILITE_VOIR,
        getUrl:      (p) => `/api/v1/pdf/rapport-caisse?debut=${p.debut}&fin=${p.fin}`,
        params: [
            { key: 'debut', label: 'Date début', type: 'date' },
            { key: 'fin',   label: 'Date fin',   type: 'date' },
        ],
    },
    {
        id:          'rapport-retours',
        titre:       'Retours et avoirs',
        description: 'Retours de marchandise, avoirs émis et ventes annulées avec leur motif',
        icone:       Undo2,
        couleur:     'text-rose-600',
        fond:        'bg-rose-50 border-rose-200',
        permission:  PERMISSIONS.VENTES_VOIR,
        csv:         'retours',
        getUrl:      (p) => `/api/v1/pdf/rapport-retours?debut=${p.debut}&fin=${p.fin}`,
        params: [
            { key: 'debut', label: 'Date début', type: 'date' },
            { key: 'fin',   label: 'Date fin',   type: 'date' },
        ],
    },
    {
        id:          'rapport-clients',
        titre:       'Rapport clients',
        description: 'Crédit dû face au plafond, avances, historique des achats',
        icone:       Users,
        couleur:     'text-purple-600',
        fond:        'bg-purple-50 border-purple-200',
        permission:  PERMISSIONS.CLIENTS_VOIR,
        csv:         'clients',
        getUrl:      () => `/api/v1/pdf/rapport-clients`,
    },
    // ── BLOC 1B ──────────────────────────────────────
    {
        id:          'rapport-stock',
        titre:       'État du stock',
        description: 'Stock et alertes, valorisés au dernier prix réellement payé',
        icone:       Package,
        couleur:     'text-teal-600',
        fond:        'bg-teal-50 border-teal-200',
        permission:  PERMISSIONS.STOCK_VOIR,
        entrepot:    true,
        getUrl:      (p) => p.warehouse
            ? `/api/v1/pdf/rapport-stock?warehouse=${p.warehouse}`
            : `/api/v1/pdf/rapport-stock`,
    },
    {
        id:          'rapport-mouvements',
        titre:       'Mouvements de stock',
        description: 'Entrées, sorties, transferts par période',
        icone:       ArrowLeftRight,
        couleur:     'text-orange-600',
        fond:        'bg-orange-50 border-orange-200',
        permission:  PERMISSIONS.STOCK_VOIR,
        csv:         'mouvements',
        getUrl:      (p) => `/api/v1/pdf/rapport-mouvements?debut=${p.debut}&fin=${p.fin}`,
        params: [
            { key: 'debut', label: 'Date début', type: 'date' },
            { key: 'fin',   label: 'Date fin',   type: 'date' },
        ],
    },
    {
        id:          'rapport-fournisseurs',
        titre:       'Rapport fournisseurs',
        description: 'Achats, règlements et dette par fournisseur sur une période',
        icone:       Truck,
        couleur:     'text-amber-600',
        fond:        'bg-amber-50 border-amber-200',
        permission:  PERMISSIONS.FOURNISSEURS_VOIR,
        getUrl:      (p) => `/api/v1/pdf/rapport-fournisseurs?debut=${p.debut}&fin=${p.fin}`,
        params: [
            { key: 'debut', label: 'Date début', type: 'date' },
            { key: 'fin',   label: 'Date fin',   type: 'date' },
        ],
    },

    // ── BLOC 1C ──────────────────────────────────────
    {
        id:          'rapport-pp',
        titre:       'Compte de résultat',
        description: 'Entrées, sorties et résultat du mois, avec l’évolution sur 6 mois',
        icone:       TrendingUp,
        couleur:     'text-green-600',
        fond:        'bg-green-50 border-green-200',
        permission:  PERMISSIONS.COMPTABILITE_VOIR,
        getUrl:      (p) => `/api/v1/pdf/rapport-pp?mois=${p.mois}&annee=${p.annee}`,
        params: [
            { key: 'mois',  label: 'Mois (1-12)', type: 'number' },
            { key: 'annee', label: 'Année',        type: 'number' },
        ],
    },
    {
        id:          'rapport-salaires',
        titre:       'Rapport de paie',
        description: 'Détail des salaires versés sur la période',
        icone:       Users,
        couleur:     'text-indigo-600',
        fond:        'bg-indigo-50 border-indigo-200',
        permission:  PERMISSIONS.SALAIRES_GERER,
        getUrl:      (p) => `/api/v1/pdf/rapport-salaires?mois=${p.mois}&annee=${p.annee}`,
        params: [
            { key: 'mois',  label: 'Mois (1-12)', type: 'number' },
            { key: 'annee', label: 'Année',        type: 'number' },
        ],
    },
    {
        id:          'factures-impayees',
        titre:       'Factures impayées',
        description: 'Factures en retard et non échues, avoirs déduits',
        icone:       AlertCircle,
        couleur:     'text-red-600',
        fond:        'bg-red-50 border-red-200',
        permission:  PERMISSIONS.FACTURES_VOIR,
        csv:         'impayees',
        getUrl:      () => `/api/v1/pdf/factures-impayees`,
    },
]

interface Props {
    entrepots?: { id: string; nom: string }[]
}

export default function CentreRapports({ entrepots = [] }: Props) {
    const { peutFaire } = usePermission()
    const rapports      = RAPPORTS.filter(r => peutFaire(r.permission))

    const [enAttente, setEnAttente] = useState<string | null>(null)
    const [erreur, setErreur]       = useState<{ rapport: string; message: string } | null>(null)
    const [params, setParams]       = useState<Record<string, Record<string, string>>>({})
    const [apercu, setApercu]       = useState<{ titre: string; url: string; fichier: string } | null>(null)

    const aujourdhui = jourBoutique()
    // La période par défaut est le MOIS EN COURS. « Aujourd'hui au jour
    // même » donnait un rapport de quelques heures à qui cliquait sans
    // toucher aux dates.
    const debutDuMois = `${aujourdhui.slice(0, 7)}-01`

    // Un aperçu vit dans un blob : il faut le révoquer, sinon chaque
    // génération laisse un document en mémoire jusqu'au rechargement.
    useEffect(() => {
        return () => { if (apercu) URL.revokeObjectURL(apercu.url) }
    }, [apercu])

    function getParam(rapportId: string, key: string): string {
        if (params[rapportId]?.[key]) return params[rapportId][key]
        if (key === 'mois')      return String(Number(aujourdhui.slice(5, 7)))
        if (key === 'annee')     return aujourdhui.slice(0, 4)
        if (key === 'debut')     return debutDuMois
        if (key === 'warehouse') return ''
        return aujourdhui
    }

    function setParam(rapportId: string, key: string, value: string) {
        setParams(prev => ({
            ...prev,
            [rapportId]: { ...(prev[rapportId] ?? {}), [key]: value },
        }))
    }

    function valeursDe(rapport: Rapport): Record<string, string> {
        const cles = (rapport.params ?? []).map(p => p.key)
        if (rapport.entrepot) cles.push('warehouse')
        return Object.fromEntries(cles.map(k => [k, getParam(rapport.id, k)]))
    }

    // La route refuse en texte clair : permission manquante, plan
    // insuffisant, période invalide. Le message était écrit dans la
    // console du navigateur et le bouton reprenait son état normal —
    // on cliquait, rien ne se passait, et rien ne disait pourquoi.
    async function messageDErreur(resp: Response): Promise<string> {
        if (resp.status === 401) return 'Votre session a expiré. Reconnectez-vous.'
        try {
            const texte = (await resp.text()).trim()
            // Une erreur serveur renvoie une page HTML : illisible ici.
            if (texte && texte.length <= 300 && !texte.startsWith('<')) return texte
        } catch { /* corps illisible : on retombe sur le message générique */ }
        return `Le rapport n'a pas pu être généré (erreur ${resp.status}).`
    }

    async function recuperer(
        rapport: Rapport,
        url: string,
        suite: (blob: Blob) => void,
    ) {
        setEnAttente(rapport.id)
        setErreur(null)
        try {
            const resp = await fetch(url)
            if (!resp.ok) {
                setErreur({ rapport: rapport.id, message: await messageDErreur(resp) })
                return
            }
            suite(await resp.blob())
        } catch {
            setErreur({
                rapport: rapport.id,
                message: 'Connexion interrompue : le document n’a pas pu être récupéré.',
            })
        } finally {
            setEnAttente(null)
        }
    }

    function telecharger(blob: Blob, nom: string) {
        const lien = document.createElement('a')
        lien.href  = URL.createObjectURL(blob)
        lien.download = nom
        lien.click()
        URL.revokeObjectURL(lien.href)
    }

    function handleApercu(rapport: Rapport) {
        const url = rapport.getUrl(valeursDe(rapport))
        recuperer(rapport, url, blob => {
            if (apercu) URL.revokeObjectURL(apercu.url)
            setApercu({
                titre:   rapport.titre,
                url:     URL.createObjectURL(blob),
                fichier: `${rapport.id}-${aujourdhui}.pdf`,
            })
        })
    }

    function handleTelecharger(rapport: Rapport) {
        const url = rapport.getUrl(valeursDe(rapport))
        recuperer(rapport, url, blob => telecharger(blob, `${rapport.id}-${aujourdhui}.pdf`))
    }

    function handleCSV(rapport: Rapport) {
        const v = valeursDe(rapport)
        const url = `/api/v1/csv?rapport=${rapport.csv}`
            + `&debut=${v.debut ?? debutDuMois}&fin=${v.fin ?? aujourdhui}`
        recuperer(rapport, url, blob => telecharger(blob, `${rapport.id}-${aujourdhui}.csv`))
    }

    return (
        <div className="space-y-4 max-w-3xl">
            <p className="text-sm text-muted-foreground">
                Choisissez la période, puis affichez le rapport pour le vérifier avant
                de le garder. Les rapports qui sont des listes s’exportent aussi en CSV.
            </p>

            {rapports.length === 0 && (
                <div className="text-center py-12 text-sm text-muted-foreground bg-card border border-border rounded-xl">
                    Aucun rapport n&apos;est ouvert à votre rôle. Demandez à un administrateur
                    de la boutique d&apos;étendre vos permissions.
                </div>
            )}

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {rapports.map(rapport => {
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

                            {(rapport.params?.length || rapport.entrepot) && (
                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                                    {rapport.params?.map(param => (
                                        <div key={param.key} className="space-y-1">
                                            <label htmlFor={`${rapport.id}-${param.key}`}
                                                   className="text-xs font-medium text-foreground">
                                                {param.label}
                                            </label>
                                            <input
                                                id={`${rapport.id}-${param.key}`}
                                                type={param.type}
                                                value={getParam(rapport.id, param.key)}
                                                onChange={e => setParam(rapport.id, param.key, e.target.value)}
                                                className="w-full px-2 py-1.5 bg-white border border-input rounded text-xs focus:outline-none focus:ring-2 focus:ring-ring"
                                            />
                                        </div>
                                    ))}

                                    {/* La route sait filtrer par entrepôt depuis
                                        toujours ; seul l'écran ne le proposait pas. */}
                                    {rapport.entrepot && entrepots.length > 1 && (
                                        <div className="space-y-1 sm:col-span-2">
                                            <label htmlFor={`${rapport.id}-warehouse`}
                                                   className="text-xs font-medium text-foreground">
                                                Entrepôt
                                            </label>
                                            <select
                                                id={`${rapport.id}-warehouse`}
                                                value={getParam(rapport.id, 'warehouse')}
                                                onChange={e => setParam(rapport.id, 'warehouse', e.target.value)}
                                                className="w-full px-2 py-1.5 bg-white border border-input rounded text-xs focus:outline-none focus:ring-2 focus:ring-ring"
                                            >
                                                <option value="">Tous les entrepôts</option>
                                                {entrepots.map(e => (
                                                    <option key={e.id} value={e.id}>{e.nom}</option>
                                                ))}
                                            </select>
                                        </div>
                                    )}
                                </div>
                            )}

                            <div className="flex flex-wrap gap-2">
                                <Button
                                    size="sm"
                                    onClick={() => handleApercu(rapport)}
                                    disabled={loading}
                                    className="flex-1 min-w-[7rem]"
                                >
                                    {loading ? (
                                        <><Loader2 className="w-3.5 h-3.5 mr-2 animate-spin" />Génération...</>
                                    ) : (
                                        <><Eye className="w-3.5 h-3.5 mr-2" />Afficher</>
                                    )}
                                </Button>
                                <Button
                                    size="sm" variant="outline"
                                    onClick={() => handleTelecharger(rapport)}
                                    disabled={loading}
                                    title="Télécharger le PDF"
                                >
                                    <Download className="w-3.5 h-3.5" />
                                </Button>
                                {rapport.csv && (
                                    <Button
                                        size="sm" variant="outline"
                                        onClick={() => handleCSV(rapport)}
                                        disabled={loading}
                                        title="Exporter en CSV, pour un tableur"
                                    >
                                        <Table2 className="w-3.5 h-3.5 mr-1.5" />CSV
                                    </Button>
                                )}
                            </div>

                            {erreur?.rapport === rapport.id && (
                                <p role="alert"
                                   className="flex items-start gap-2 text-xs text-red-700 bg-red-50 border border-red-200 rounded-lg px-3 py-2">
                                    <AlertCircle className="w-3.5 h-3.5 shrink-0 mt-px" />
                                    <span>{erreur.message}</span>
                                </p>
                            )}
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
                    Chaque facture dispose d&apos;un bouton de téléchargement PDF directement
                    depuis sa fiche. Allez dans <strong>Factures → [fiche facture]</strong>.
                </p>
            </div>

            {/* ── L'aperçu ─────────────────────────────────── */}
            {apercu && (
                <div className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4"
                     role="dialog" aria-modal="true" aria-label={`Aperçu — ${apercu.titre}`}>
                    <div className="bg-card rounded-xl w-full max-w-5xl h-[90vh] flex flex-col overflow-hidden">
                        <div className="flex items-center justify-between px-4 py-3 border-b border-border">
                            <p className="text-sm font-semibold text-foreground">{apercu.titre}</p>
                            <div className="flex items-center gap-2">
                                <Button size="sm" variant="outline"
                                        onClick={() => {
                                            const lien = document.createElement('a')
                                            lien.href = apercu.url
                                            lien.download = apercu.fichier
                                            lien.click()
                                        }}>
                                    <Download className="w-3.5 h-3.5 mr-2" />Télécharger
                                </Button>
                                <button type="button" aria-label="Fermer l’aperçu"
                                        onClick={() => setApercu(null)}
                                        className="p-1.5 rounded-lg hover:bg-muted transition-colors">
                                    <X className="w-4 h-4" />
                                </button>
                            </div>
                        </div>
                        <iframe src={apercu.url} title={`Aperçu — ${apercu.titre}`}
                                className="flex-1 w-full bg-muted" />
                    </div>
                </div>
            )}
        </div>
    )
}
