// app/(shop)/stock/receptions/[id]/page.tsx

import type { Metadata } from 'next'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { redirect, notFound } from 'next/navigation'
import Link from 'next/link'
import { ArrowLeft, PackageCheck, Package, Warehouse, Calendar, User } from 'lucide-react'
import { formatDate, formatMontant } from '@/lib/utils'

export const metadata: Metadata = { title: 'Détail réception' }

interface Props { params: Promise<{ id: string }> }

export default async function PageDetailReception({ params }: Props) {
    const { id } = await params

    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user || user.user_metadata?.type_acteur !== 'shop') redirect('/login')

    const shopId      = user.user_metadata.shop_id as string
    const adminClient = createAdminClient()

    const [{ data: reception }, { data: boutique }] = await Promise.all([
        adminClient
            .from('receptions')
            .select(`
                id, public_id, date_reception, montant_total, notes, created_at,
                suppliers(id, nom, public_id, telephone),
                warehouses(nom),
                reception_items(
                    id, designation, quantite_recue, prix_unitaire, poi_id,
                    products(nom, unite, public_id)
                )
            `)
            .eq('id', id)
            .eq('shop_id', shopId)
            .single(),
        adminClient.from('shops').select('devise').eq('id', shopId).single(),
    ])

    if (!reception) notFound()

    const devise  = boutique?.devise ?? 'FCFA'
    const items   = (reception.reception_items as any[]) ?? []
    const fourn   = reception.suppliers as any
    const entrepot = reception.warehouses as any

    return (
        <div className="flex flex-col min-h-screen bg-[#f8fafc]">

            <header
                style={{ background: 'linear-gradient(135deg, #15335a 0%, #0f2742 100%)' }}
                className="px-6 py-5 shadow-lg"
            >
                <div className="flex items-center gap-4">
                    <Link href="/stock/receptions"
                          className="flex items-center justify-center w-9 h-9 rounded-xl bg-white/20 hover:bg-white/30 transition-colors">
                        <ArrowLeft className="w-5 h-5 text-white" />
                    </Link>
                    <div>
                        <h1 className="text-xl font-bold text-white">{reception.public_id}</h1>
                        <p className="text-sm text-white/70 mt-0.5">
                            {fourn?.nom ?? '—'} · {formatDate(reception.date_reception)}
                        </p>
                    </div>
                    <div className="ml-auto hidden sm:flex items-center gap-3">
                        <div className="text-center px-4 py-2 bg-white/15 rounded-xl">
                            <p className="text-xs text-white/70">Articles</p>
                            <p className="text-lg font-black text-white">{items.length}</p>
                        </div>
                        <div className="text-center px-4 py-2 bg-white/15 rounded-xl">
                            <p className="text-xs text-white/70">Montant</p>
                            <p className="text-lg font-black text-white">{formatMontant(reception.montant_total, devise)}</p>
                        </div>
                    </div>
                </div>
            </header>

            <main className="flex-1 p-4 sm:p-6 max-w-4xl mx-auto w-full space-y-5">

                {/* Infos générales */}
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                    <div className="bg-white border border-gray-200 rounded-2xl p-4 shadow-sm space-y-2">
                        <p className="text-xs font-bold text-gray-400 uppercase tracking-wider">Fournisseur</p>
                        <p className="text-sm font-bold text-gray-800">{fourn?.nom ?? '—'}</p>
                        {fourn?.public_id && <p className="text-xs font-mono text-gray-400">{fourn.public_id}</p>}
                        {fourn?.telephone && <p className="text-xs text-gray-500">{fourn.telephone}</p>}
                    </div>
                    <div className="bg-white border border-gray-200 rounded-2xl p-4 shadow-sm space-y-2">
                        <p className="text-xs font-bold text-gray-400 uppercase tracking-wider">Entrepôt</p>
                        <div className="flex items-center gap-2">
                            <Warehouse className="w-4 h-4 text-[#15335a]" />
                            <p className="text-sm font-bold text-gray-800">{entrepot?.nom ?? '—'}</p>
                        </div>
                        <div className="flex items-center gap-2">
                            <Calendar className="w-3.5 h-3.5 text-gray-400" />
                            <p className="text-xs text-gray-500">{formatDate(reception.date_reception)}</p>
                        </div>
                    </div>
                    <div className="bg-white border border-gray-200 rounded-2xl p-4 shadow-sm space-y-2">
                        <p className="text-xs font-bold text-gray-400 uppercase tracking-wider">Montant total</p>
                        <p className="text-2xl font-black text-[#15335a]">
                            {formatMontant(reception.montant_total, devise)}
                        </p>
                        {reception.notes && (
                            <p className="text-xs text-gray-500 italic">{reception.notes}</p>
                        )}
                    </div>
                </div>

                {/* Articles reçus */}
                <div className="bg-white border border-gray-200 rounded-2xl shadow-sm overflow-hidden">
                    <div className="flex items-center gap-2 p-5 border-b border-gray-100">
                        <Package className="w-5 h-5 text-[#15335a]" />
                        <h2 className="text-sm font-bold text-gray-900">
                            Articles réceptionnés ({items.length})
                        </h2>
                    </div>

                    {items.length === 0 ? (
                        <div className="text-center py-10 text-gray-400">
                            <p className="text-sm">Aucun article enregistré.</p>
                        </div>
                    ) : (
                        <div className="overflow-x-auto">
                          <div className="min-w-[640px]">
                            <div
                                className="grid grid-cols-12 gap-2 px-5 py-3 text-xs font-bold text-white"
                                style={{ background: 'linear-gradient(135deg, #15335a 0%, #0f2742 100%)' }}
                            >
                                <div className="col-span-5">Désignation</div>
                                <div className="col-span-2 text-center">Qté reçue</div>
                                <div className="col-span-2 text-right">Prix unitaire</div>
                                <div className="col-span-3 text-right">Montant</div>
                            </div>
                            <div className="divide-y divide-gray-50">
                                {items.map((item: any, i: number) => (
                                    <div key={item.id}
                                         className={`grid grid-cols-12 gap-2 items-center px-5 py-3.5 ${i % 2 === 0 ? '' : 'bg-gray-50/50'}`}>
                                        <div className="col-span-5 min-w-0">
                                            <p className="text-sm font-medium text-gray-800 truncate">
                                                {item.designation}
                                            </p>
                                            {item.products && (
                                                <p className="text-xs font-mono text-gray-400 mt-0.5">
                                                    {item.products.public_id}
                                                </p>
                                            )}
                                        </div>
                                        <div className="col-span-2 text-center">
                                            <span className="text-sm font-bold text-green-600">
                                                {item.quantite_recue}
                                                {item.products?.unite && (
                                                    <span className="text-xs text-gray-400 ml-1">
                                                        {item.products.unite}
                                                    </span>
                                                )}
                                            </span>
                                        </div>
                                        <div className="col-span-2 text-right">
                                            <p className="text-sm text-gray-600">
                                                {formatMontant(item.prix_unitaire, devise)}
                                            </p>
                                        </div>
                                        <div className="col-span-3 text-right">
                                            <p className="text-sm font-bold text-gray-800">
                                                {formatMontant(item.quantite_recue * item.prix_unitaire, devise)}
                                            </p>
                                        </div>
                                    </div>
                                ))}
                            </div>
                            <div className="px-5 py-4 border-t border-gray-100 bg-gray-50/50 flex justify-end">
                                <div className="flex items-center gap-4">
                                    <span className="text-sm font-bold text-gray-700">Total réception</span>
                                    <span className="text-xl font-black text-[#15335a]">
                                        {formatMontant(reception.montant_total, devise)}
                                    </span>
                                </div>
                            </div>
                          </div>
                        </div>
                    )}
                </div>

            </main>
        </div>
    )
}