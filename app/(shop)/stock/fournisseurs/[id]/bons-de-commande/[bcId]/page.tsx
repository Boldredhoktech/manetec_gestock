// app/(shop)/stock/fournisseurs/[id]/bons-de-commande/[bcId]/page.tsx

import type { Metadata } from 'next'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { redirect, notFound } from 'next/navigation'
import Link from 'next/link'
import {
    ArrowLeft, Package, Calendar,
    CheckCircle, Clock, XCircle, Truck,
} from 'lucide-react'
import { formatDate, formatMontant } from '@/lib/utils'

export const metadata: Metadata = { title: 'Bon de commande' }

interface Props {
    params: Promise<{ id: string; bcId: string }>
}

const STATUT_CONFIG: Record<string, {
    label:   string
    couleur: string
    bg:      string
    icone:   React.ElementType
}> = {
    brouillon:          { label: 'Brouillon',           couleur: 'text-gray-600',  bg: 'bg-gray-100',  icone: Clock         },
    envoye:             { label: 'Envoyé',               couleur: 'text-blue-700',  bg: 'bg-blue-100',  icone: Truck         },
    partiellement_recu: { label: 'Partiellement reçu',   couleur: 'text-amber-700', bg: 'bg-amber-100', icone: Package       },
    recu:               { label: 'Reçu',                 couleur: 'text-green-700', bg: 'bg-green-100', icone: CheckCircle   },
    annule:             { label: 'Annulé',               couleur: 'text-red-700',   bg: 'bg-red-100',   icone: XCircle       },
}

export default async function PageDetailBonCommande({ params }: Props) {
    const { id: supplierId, bcId } = await params

    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user || user.user_metadata?.type_acteur !== 'shop') redirect('/login')

    const shopId      = user.user_metadata.shop_id as string
    const adminClient = createAdminClient()

    const [{ data: bon }, { data: fournisseur }, { data: boutique }] = await Promise.all([
        adminClient
            .from('purchase_orders')
            .select(`
                id, public_id, statut, date_commande, date_livraison,
                montant_total, notes, created_at,
                warehouses(nom),
                purchase_order_items(
                    id, designation, quantite_cmd,
                    quantite_recue, prix_unitaire, montant_ligne,
                    products(nom, unite, public_id)
                )
            `)
            .eq('id', bcId)
            .eq('shop_id', shopId)
            .single(),
        adminClient
            .from('suppliers')
            .select('id, nom, public_id, telephone, email, adresse, ville, pays')
            .eq('id', supplierId)
            .eq('shop_id', shopId)
            .single(),
        adminClient
            .from('shops')
            .select('devise')
            .eq('id', shopId)
            .single(),
    ])

    if (!bon || !fournisseur) notFound()

    const devise       = boutique?.devise ?? 'FCFA'
    const config       = STATUT_CONFIG[bon.statut] ?? STATUT_CONFIG.brouillon
    const StatutIcone  = config.icone
    const items        = (bon.purchase_order_items as any[]) ?? []
    const totalQteCmd  = items.reduce((a, i) => a + i.quantite_cmd, 0)
    const totalQteRecu = items.reduce((a, i) => a + i.quantite_recue, 0)
    const progression  = totalQteCmd > 0
        ? Math.round((totalQteRecu / totalQteCmd) * 100)
        : 0

    return (
        <div className="flex flex-col min-h-screen bg-[#f8fafc]">

            {/* Header */}
            <header
                style={{ background: 'linear-gradient(135deg, #1a56db 0%, #1648c0 100%)' }}
                className="px-6 py-5 shadow-lg"
            >
                <div className="flex items-center justify-between">
                    <div className="flex items-center gap-4">
                        <Link
                            href={`/stock/fournisseurs/${supplierId}/bons-de-commande`}
                            className="flex items-center justify-center w-9 h-9 rounded-xl bg-white/20 hover:bg-white/30 transition-colors"
                        >
                            <ArrowLeft className="w-5 h-5 text-white" />
                        </Link>
                        <div>
                            <h1 className="text-xl font-bold text-white">{bon.public_id}</h1>
                            <p className="text-sm text-white/70 mt-0.5">
                                {fournisseur.nom} · Créé le {formatDate(bon.created_at)}
                            </p>
                        </div>
                    </div>

                    <div className="flex items-center gap-3">
                        {/* Progression */}
                        {bon.statut !== 'brouillon' && bon.statut !== 'annule' && (
                            <div className="text-center px-4 py-2 bg-white/15 rounded-xl">
                                <p className="text-xs text-white/70">Réception</p>
                                <p className="text-lg font-black text-white">{progression}%</p>
                            </div>
                        )}
                        {/* Statut */}
                        <span className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-bold ${config.bg} ${config.couleur}`}>
                            <StatutIcone className="w-3.5 h-3.5" />
                            {config.label}
                        </span>
                    </div>
                </div>
            </header>

            <main className="flex-1 p-6 max-w-5xl mx-auto w-full space-y-5">

                {/* Informations générales */}
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">

                    {/* Fournisseur */}
                    <div className="bg-white border border-gray-200 rounded-2xl p-5 shadow-sm space-y-3">
                        <h2 className="text-xs font-bold text-[#1a56db] uppercase tracking-wider">
                            Fournisseur
                        </h2>
                        <div>
                            <p className="text-sm font-bold text-gray-900">{fournisseur.nom}</p>
                            <p className="text-xs font-mono text-gray-400 mt-0.5">{fournisseur.public_id}</p>
                        </div>
                        {fournisseur.telephone && (
                            <p className="text-xs text-gray-500">{fournisseur.telephone}</p>
                        )}
                        {fournisseur.email && (
                            <p className="text-xs text-gray-500">{fournisseur.email}</p>
                        )}
                        {(fournisseur.ville || fournisseur.pays) && (
                            <p className="text-xs text-gray-500">
                                {[fournisseur.ville, fournisseur.pays].filter(Boolean).join(', ')}
                            </p>
                        )}
                    </div>

                    {/* Détails de la commande */}
                    <div className="bg-white border border-gray-200 rounded-2xl p-5 shadow-sm space-y-3">
                        <h2 className="text-xs font-bold text-[#1a56db] uppercase tracking-wider">
                            Commande
                        </h2>
                        {[
                            { label: 'Référence',        val: bon.public_id                                           },
                            { label: 'Date commande',    val: formatDate(bon.date_commande)                           },
                            { label: 'Date livraison',   val: bon.date_livraison ? formatDate(bon.date_livraison) : '—' },
                            { label: 'Entrepôt',         val: (bon.warehouses as any)?.nom ?? '—'                     },
                        ].map(item => (
                            <div key={item.label} className="flex justify-between text-xs">
                                <span className="text-gray-400">{item.label}</span>
                                <span className="font-medium text-gray-700">{item.val}</span>
                            </div>
                        ))}
                    </div>

                    {/* Montants */}
                    <div className="bg-white border border-gray-200 rounded-2xl p-5 shadow-sm space-y-3">
                        <h2 className="text-xs font-bold text-[#1a56db] uppercase tracking-wider">
                            Montant
                        </h2>
                        <div className="text-center py-2">
                            <p className="text-3xl font-black text-[#1a56db]">
                                {formatMontant(bon.montant_total, devise)}
                            </p>
                        </div>
                        {bon.statut !== 'brouillon' && bon.statut !== 'annule' && (
                            <div className="space-y-1.5">
                                <div className="flex justify-between text-xs">
                                    <span className="text-gray-400">Articles commandés</span>
                                    <span className="font-medium text-gray-700">{totalQteCmd}</span>
                                </div>
                                <div className="flex justify-between text-xs">
                                    <span className="text-gray-400">Articles reçus</span>
                                    <span className="font-medium text-green-600">{totalQteRecu}</span>
                                </div>
                                {/* Barre de progression */}
                                <div className="w-full h-2 bg-gray-100 rounded-full overflow-hidden mt-2">
                                    <div
                                        className="h-full rounded-full transition-all duration-500"
                                        style={{
                                            width:      `${progression}%`,
                                            background: 'linear-gradient(90deg, #1a56db 0%, #1648c0 100%)',
                                        }}
                                    />
                                </div>
                            </div>
                        )}
                    </div>
                </div>

                {/* Lignes de commande */}
                <div className="bg-white border border-gray-200 rounded-2xl shadow-sm overflow-hidden">

                    {/* En-tête */}
                    <div
                        className="grid grid-cols-12 gap-2 px-5 py-3 text-xs font-bold text-white"
                        style={{ background: 'linear-gradient(135deg, #1a56db 0%, #1648c0 100%)' }}
                    >
                        <div className="col-span-5">Désignation</div>
                        <div className="col-span-2 text-right">Prix unitaire</div>
                        <div className="col-span-2 text-right">Qté commandée</div>
                        <div className="col-span-2 text-right">Qté reçue</div>
                        <div className="col-span-1 text-right">Total</div>
                    </div>

                    {items.length === 0 ? (
                        <div className="text-center py-12 text-gray-400">
                            <Package className="w-8 h-8 mx-auto mb-2 opacity-30" />
                            <p className="text-sm">Aucun article dans ce bon de commande.</p>
                        </div>
                    ) : (
                        <div className="divide-y divide-gray-50">
                            {items.map((item: any, i: number) => {
                                const receptionComplete = item.quantite_recue >= item.quantite_cmd
                                const enCours           = item.quantite_recue > 0 && !receptionComplete
                                return (
                                    <div
                                        key={item.id}
                                        className={`grid grid-cols-12 gap-2 items-center px-5 py-3.5 ${
                                            i % 2 === 0 ? '' : 'bg-gray-50/50'
                                        } ${receptionComplete ? 'bg-green-50/30' : ''}`}
                                    >
                                        <div className="col-span-5 min-w-0">
                                            <p className="text-sm font-semibold text-gray-800 truncate">
                                                {item.designation}
                                            </p>
                                            {item.products && (
                                                <p className="text-xs font-mono text-gray-400 mt-0.5">
                                                    {item.products.public_id}
                                                </p>
                                            )}
                                        </div>
                                        <div className="col-span-2 text-right">
                                            <p className="text-sm text-gray-700">
                                                {formatMontant(item.prix_unitaire, devise)}
                                            </p>
                                        </div>
                                        <div className="col-span-2 text-right">
                                            <p className="text-sm font-medium text-gray-800">
                                                {item.quantite_cmd}
                                                {item.products?.unite && (
                                                    <span className="text-xs text-gray-400 ml-1">
                                                        {item.products.unite}
                                                    </span>
                                                )}
                                            </p>
                                        </div>
                                        <div className="col-span-2 text-right">
                                            <span className={`text-sm font-bold ${
                                                receptionComplete ? 'text-green-600'
                                                    : enCours         ? 'text-amber-600'
                                                        : 'text-gray-400'
                                            }`}>
                                                {item.quantite_recue}
                                                {receptionComplete && (
                                                    <CheckCircle className="w-3.5 h-3.5 inline ml-1 text-green-500" />
                                                )}
                                            </span>
                                        </div>
                                        <div className="col-span-1 text-right">
                                            <p className="text-sm font-bold text-gray-800">
                                                {formatMontant(item.montant_ligne, devise)}
                                            </p>
                                        </div>
                                    </div>
                                )
                            })}
                        </div>
                    )}

                    {/* Total */}
                    <div className="px-5 py-4 border-t border-gray-100 bg-gray-50/50 flex justify-end">
                        <div className="flex items-center gap-4">
                            <span className="text-sm font-bold text-gray-700">Total commande</span>
                            <span className="text-xl font-black text-[#1a56db]">
                                {formatMontant(bon.montant_total, devise)}
                            </span>
                        </div>
                    </div>
                </div>

                {/* Notes */}
                {bon.notes && (
                    <div className="bg-amber-50 border border-amber-200 rounded-2xl p-5">
                        <p className="text-xs font-bold text-amber-700 mb-2 uppercase tracking-wider">
                            Notes
                        </p>
                        <p className="text-sm text-amber-800">{bon.notes}</p>
                    </div>
                )}

            </main>
        </div>
    )
}