// app/(shop)/stock/fournisseurs/[id]/bons-de-commande/page.tsx

import type { Metadata } from 'next'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { redirect, notFound } from 'next/navigation'
import Link from 'next/link'
import { ArrowLeft, Plus, Package, Calendar, FileText } from 'lucide-react'
import { formatMontant, formatDate } from '@/lib/utils'

export const metadata: Metadata = { title: 'Bons de commande' }

interface Props { params: Promise<{ id: string }> }

const STATUT_CONFIG: Record<string, { label: string; couleur: string; bg: string }> = {
    brouillon:         { label: 'Brouillon',          couleur: 'text-gray-600',  bg: 'bg-gray-100'  },
    envoye:            { label: 'Envoyé',              couleur: 'text-blue-600',  bg: 'bg-blue-100'  },
    partiellement_recu:{ label: 'Partiel. reçu',       couleur: 'text-amber-600', bg: 'bg-amber-100' },
    recu:              { label: 'Reçu',                couleur: 'text-green-600', bg: 'bg-green-100' },
    annule:            { label: 'Annulé',              couleur: 'text-red-600',   bg: 'bg-red-100'   },
}

export default async function PageBonsDeCommande({ params }: Props) {
    const { id } = await params

    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user || user.user_metadata?.type_acteur !== 'shop') redirect('/login')

    const shopId      = user.user_metadata.shop_id as string
    const adminClient = createAdminClient()

    const { data: fournisseur } = await adminClient
        .from('suppliers')
        .select('id, nom, public_id')
        .eq('id', id)
        .eq('shop_id', shopId)
        .single()

    if (!fournisseur) notFound()

    const { data: bons } = await adminClient
        .from('purchase_orders')
        .select(`
            id, public_id, statut, date_commande, date_livraison,
            montant_total, notes,
            warehouses(nom),
            purchase_order_items(id)
        `)
        .eq('supplier_id', id)
        .eq('shop_id', shopId)
        .order('created_at', { ascending: false })

    const { data: boutique } = await adminClient
        .from('shops').select('devise').eq('id', shopId).single()

    const devise = boutique?.devise ?? 'FCFA'

    return (
        <div className="flex flex-col min-h-screen bg-[#f8fafc]">

            <header
                style={{ background: 'linear-gradient(135deg, #1a56db 0%, #1648c0 100%)' }}
                className="px-6 py-5 shadow-lg"
            >
                <div className="flex items-center justify-between">
                    <div className="flex items-center gap-4">
                        <Link
                            href={`/stock/fournisseurs/${id}`}
                            className="flex items-center justify-center w-9 h-9 rounded-xl bg-white/20 hover:bg-white/30 transition-colors"
                        >
                            <ArrowLeft className="w-5 h-5 text-white" />
                        </Link>
                        <div>
                            <h1 className="text-xl font-bold text-white">Bons de commande</h1>
                            <p className="text-sm text-white/70 mt-0.5">{fournisseur.nom}</p>
                        </div>
                    </div>
                    <Link
                        href={`/stock/fournisseurs/${id}/bons-de-commande/nouveau`}
                        className="flex items-center gap-2 px-4 py-2 bg-white text-[#1a56db] font-bold text-sm rounded-xl hover:bg-white/90 transition-colors"
                    >
                        <Plus className="w-4 h-4" />
                        Nouveau BC
                    </Link>
                </div>
            </header>

            <main className="flex-1 p-6 max-w-4xl mx-auto w-full">

                {!bons || bons.length === 0 ? (
                    <div className="bg-white border border-gray-200 rounded-2xl p-16 shadow-sm text-center space-y-4">
                        <div className="w-16 h-16 bg-[#1a56db]/10 rounded-2xl flex items-center justify-center mx-auto">
                            <FileText className="w-8 h-8 text-[#1a56db]/40" />
                        </div>
                        <div>
                            <p className="text-base font-semibold text-gray-700">Aucun bon de commande</p>
                            <p className="text-sm text-gray-400 mt-1">
                                Créez votre premier bon de commande pour ce fournisseur.
                            </p>
                        </div>
                        <Link
                            href={`/stock/fournisseurs/${id}/bons-de-commande/nouveau`}
                            className="inline-flex items-center gap-2 px-5 py-2.5 bg-[#1a56db] text-white font-bold text-sm rounded-xl hover:bg-[#1648c0] transition-colors"
                        >
                            <Plus className="w-4 h-4" />
                            Créer un bon de commande
                        </Link>
                    </div>
                ) : (
                    <div className="bg-white border border-gray-200 rounded-2xl shadow-sm overflow-hidden">

                        {/* En-tête tableau */}
                        <div
                            className="grid grid-cols-12 gap-2 px-5 py-3 text-xs font-bold text-white"
                            style={{ background: 'linear-gradient(135deg, #1a56db 0%, #1648c0 100%)' }}
                        >
                            <div className="col-span-2">Référence</div>
                            <div className="col-span-2">Date</div>
                            <div className="col-span-2">Entrepôt</div>
                            <div className="col-span-2">Articles</div>
                            <div className="col-span-2 text-right">Montant</div>
                            <div className="col-span-2 text-center">Statut</div>
                        </div>

                        <div className="divide-y divide-gray-50">
                            {bons.map((bon, i) => {
                                const config = STATUT_CONFIG[bon.statut] ?? STATUT_CONFIG.brouillon
                                const nbItems = (bon.purchase_order_items as any[])?.length ?? 0

                                return (
                                    <Link
                                        key={bon.id}
                                        href={`/stock/fournisseurs/${id}/bons-de-commande/${bon.id}`}
                                        className={`grid grid-cols-12 gap-2 items-center px-5 py-3.5 hover:bg-[#1a56db]/5 transition-colors group ${
                                            i % 2 === 0 ? '' : 'bg-gray-50/50'
                                        }`}
                                    >
                                        <div className="col-span-2">
                                            <p className="text-sm font-bold text-gray-800 font-mono group-hover:text-[#1a56db] transition-colors">
                                                {bon.public_id}
                                            </p>
                                        </div>
                                        <div className="col-span-2">
                                            <div className="flex items-center gap-1 text-xs text-gray-500">
                                                <Calendar className="w-3 h-3" />
                                                {formatDate(bon.date_commande)}
                                            </div>
                                            {bon.date_livraison && (
                                                <p className="text-xs text-gray-400 mt-0.5">
                                                    Livr. {formatDate(bon.date_livraison)}
                                                </p>
                                            )}
                                        </div>
                                        <div className="col-span-2">
                                            <p className="text-xs text-gray-600 truncate">
                                                {(bon.warehouses as any)?.nom ?? '—'}
                                            </p>
                                        </div>
                                        <div className="col-span-2">
                                            <div className="flex items-center gap-1 text-xs text-gray-500">
                                                <Package className="w-3 h-3" />
                                                {nbItems} article{nbItems > 1 ? 's' : ''}
                                            </div>
                                        </div>
                                        <div className="col-span-2 text-right">
                                            <p className="text-sm font-bold text-gray-800">
                                                {formatMontant(bon.montant_total, devise)}
                                            </p>
                                        </div>
                                        <div className="col-span-2 flex justify-center">
                                            <span className={`px-2.5 py-1 rounded-full text-xs font-bold ${config.bg} ${config.couleur}`}>
                                                {config.label}
                                            </span>
                                        </div>
                                    </Link>
                                )
                            })}
                        </div>
                    </div>
                )}
            </main>
        </div>
    )
}