// app/(shop)/stock/receptions/[id]/page.tsx

import type { Metadata } from 'next'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { redirect, notFound } from 'next/navigation'
import Link from 'next/link'
import { ArrowLeft, PackageCheck, Package, Warehouse, Calendar, User } from 'lucide-react'
import { formatDate, formatMontant } from '@/lib/utils'
import { aPermission } from '@/lib/auth/permissions-serveur'
import { PERMISSIONS } from '@/lib/constants/permissions'

export const metadata: Metadata = { title: 'Détail réception' }

interface Props { params: Promise<{ id: string }> }

export default async function PageDetailReception({ params }: Props) {
    const { id } = await params

    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user || user.user_metadata?.type_acteur !== 'shop') redirect('/login')
    if (!aPermission(user, PERMISSIONS.FOURNISSEURS_VOIR)) redirect('/admin/dashboard')

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
        <div className="flex flex-col min-h-screen">

            <header className="px-4 sm:px-6 lg:px-8 pt-5 pb-4">
                <div className="flex items-center gap-4">
                    <Link href="/stock/receptions"
                          className="flex items-center justify-center w-9 h-9 rounded-xl bg-muted hover:bg-border transition-colors">
                        <ArrowLeft className="w-5 h-5 text-foreground" />
                    </Link>
                    <div>
                        <h1 className="text-2xl sm:text-3xl font-bold text-foreground">{reception.public_id}</h1>
                        <p className="text-sm text-muted-foreground mt-0.5">
                            {fourn?.nom ?? '—'} · {formatDate(reception.date_reception)}
                        </p>
                    </div>
                    <div className="ml-auto hidden sm:flex items-center gap-3">
                        <div className="text-center px-4 py-2 bg-muted rounded-xl">
                            <p className="text-xs text-muted-foreground">Articles</p>
                            <p className="text-lg font-black text-foreground">{items.length}</p>
                        </div>
                        <div className="text-center px-4 py-2 bg-muted rounded-xl">
                            <p className="text-xs text-muted-foreground">Montant</p>
                            <p className="text-lg font-black text-foreground">{formatMontant(reception.montant_total, devise)}</p>
                        </div>
                    </div>
                </div>
            </header>

            <main className="flex-1 px-4 sm:px-6 lg:px-8 pb-8 max-w-5xl w-full space-y-5">

                {/* Infos générales */}
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                    <div className="bg-card border border-border rounded-2xl p-4 shadow-sm space-y-2">
                        <p className="text-xs font-bold text-muted-foreground/80 uppercase tracking-wider">Fournisseur</p>
                        <p className="text-sm font-bold text-foreground">{fourn?.nom ?? '—'}</p>
                        {fourn?.public_id && <p className="text-xs font-mono text-muted-foreground/80">{fourn.public_id}</p>}
                        {fourn?.telephone && <p className="text-xs text-muted-foreground">{fourn.telephone}</p>}
                    </div>
                    <div className="bg-card border border-border rounded-2xl p-4 shadow-sm space-y-2">
                        <p className="text-xs font-bold text-muted-foreground/80 uppercase tracking-wider">Entrepôt</p>
                        <div className="flex items-center gap-2">
                            <Warehouse className="w-4 h-4 text-[var(--primary-strong)]" />
                            <p className="text-sm font-bold text-foreground">{entrepot?.nom ?? '—'}</p>
                        </div>
                        <div className="flex items-center gap-2">
                            <Calendar className="w-3.5 h-3.5 text-muted-foreground/80" />
                            <p className="text-xs text-muted-foreground">{formatDate(reception.date_reception)}</p>
                        </div>
                    </div>
                    <div className="bg-card border border-border rounded-2xl p-4 shadow-sm space-y-2">
                        <p className="text-xs font-bold text-muted-foreground/80 uppercase tracking-wider">Montant total</p>
                        <p className="text-2xl font-black text-[var(--primary-strong)]">
                            {formatMontant(reception.montant_total, devise)}
                        </p>
                        {reception.notes && (
                            <p className="text-xs text-muted-foreground italic">{reception.notes}</p>
                        )}
                    </div>
                </div>

                {/* Articles reçus */}
                <div className="bg-card border border-border rounded-2xl shadow-sm overflow-hidden">
                    <div className="flex items-center gap-2 p-5 border-b border-border">
                        <Package className="w-5 h-5 text-[var(--primary-strong)]" />
                        <h2 className="text-sm font-bold text-foreground">
                            Articles réceptionnés ({items.length})
                        </h2>
                    </div>

                    {items.length === 0 ? (
                        <div className="text-center py-10 text-muted-foreground/80">
                            <p className="text-sm">Aucun article enregistré.</p>
                        </div>
                    ) : (
                        <div className="overflow-x-auto">
                          <div className="min-w-[640px]">
                            <div
                                className="grid grid-cols-12 gap-2 px-5 py-3 text-xs font-bold text-white"
                                style={{ background: 'var(--nav)' }}
                            >
                                <div className="col-span-5">Désignation</div>
                                <div className="col-span-2 text-center">Qté reçue</div>
                                <div className="col-span-2 text-right">Prix unitaire</div>
                                <div className="col-span-3 text-right">Montant</div>
                            </div>
                            <div className="divide-y divide-gray-50">
                                {items.map((item: any, i: number) => (
                                    <div key={item.id}
                                         className={`grid grid-cols-12 gap-2 items-center px-5 py-3.5 ${i % 2 === 0 ? '' : 'bg-[var(--surface2)]/50'}`}>
                                        <div className="col-span-5 min-w-0">
                                            <p className="text-sm font-medium text-foreground truncate">
                                                {item.designation}
                                            </p>
                                            {item.products && (
                                                <p className="text-xs font-mono text-muted-foreground/80 mt-0.5">
                                                    {item.products.public_id}
                                                </p>
                                            )}
                                        </div>
                                        <div className="col-span-2 text-center">
                                            <span className="text-sm font-bold text-green-600">
                                                {item.quantite_recue}
                                                {item.products?.unite && (
                                                    <span className="text-xs text-muted-foreground/80 ml-1">
                                                        {item.products.unite}
                                                    </span>
                                                )}
                                            </span>
                                        </div>
                                        <div className="col-span-2 text-right">
                                            <p className="text-sm text-muted-foreground">
                                                {formatMontant(item.prix_unitaire, devise)}
                                            </p>
                                        </div>
                                        <div className="col-span-3 text-right">
                                            <p className="text-sm font-bold text-foreground">
                                                {formatMontant(item.quantite_recue * item.prix_unitaire, devise)}
                                            </p>
                                        </div>
                                    </div>
                                ))}
                            </div>
                            <div className="px-5 py-4 border-t border-border bg-[var(--surface2)]/50 flex justify-end">
                                <div className="flex items-center gap-4">
                                    <span className="text-sm font-bold text-foreground">Total réception</span>
                                    <span className="text-xl font-black text-[var(--primary-strong)]">
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