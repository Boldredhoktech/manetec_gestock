// app/(shop)/stock/receptions/page.tsx

import type { Metadata } from 'next'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import { PackageCheck, ChevronRight, Calendar, Warehouse } from 'lucide-react'
import { formatDate, formatMontant } from '@/lib/utils'
import { aPermission } from '@/lib/auth/permissions-serveur'
import { PERMISSIONS } from '@/lib/constants/permissions'

export const metadata: Metadata = { title: 'Réceptions' }

export default async function PageReceptions() {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user || user.user_metadata?.type_acteur !== 'shop') redirect('/login')
    if (!aPermission(user, PERMISSIONS.FOURNISSEURS_VOIR)) redirect('/admin/dashboard')

    const shopId      = user.user_metadata.shop_id as string
    const adminClient = createAdminClient()

    const [{ data: receptions }, { data: boutique }] = await Promise.all([
        adminClient
            .from('receptions')
            .select(`
                id, public_id, date_reception, montant_total, notes,
                suppliers(nom),
                warehouses(nom),
                reception_items(id)
            `)
            .eq('shop_id', shopId)
            .order('created_at', { ascending: false })
            .limit(100),
        adminClient.from('shops').select('devise').eq('id', shopId).single(),
    ])

    const devise = boutique?.devise ?? 'FCFA'

    return (
        <div className="flex flex-col min-h-screen">
            <header className="px-4 sm:px-6 lg:px-8 pt-5 pb-4">
                <div className="flex items-center gap-3">
                    <div className="bg-muted p-2 rounded-xl">
                        <PackageCheck className="w-5 h-5 text-foreground" />
                    </div>
                    <div>
                        <h1 className="text-2xl sm:text-3xl font-bold text-foreground">Réceptions</h1>
                        <p className="text-sm text-muted-foreground mt-0.5">
                            {receptions?.length ?? 0} réception(s) enregistrée(s)
                        </p>
                    </div>
                </div>
            </header>

            <main className="flex-1 px-4 sm:px-6 lg:px-8 pb-8 max-w-5xl w-full">

                {!receptions || receptions.length === 0 ? (
                    <div className="bg-card border border-border rounded-2xl p-16 shadow-sm text-center space-y-3">
                        <PackageCheck className="w-10 h-10 mx-auto text-muted-foreground/80" />
                        <p className="text-sm text-muted-foreground">
                            Aucune réception. Les réceptions se créent depuis la fiche d'un fournisseur.
                        </p>
                        <Link href="/stock/fournisseurs"
                              className="inline-block text-sm text-[var(--primary-strong)] font-bold hover:underline">
                            Aller aux fournisseurs →
                        </Link>
                    </div>
                ) : (
                    <div className="bg-card border border-border rounded-2xl shadow-sm overflow-hidden">
                      <div className="overflow-x-auto">
                       <div className="min-w-[720px]">
                        <div
                            className="grid grid-cols-12 gap-2 px-5 py-3 text-xs font-bold text-white"
                            style={{ background: 'var(--nav)' }}
                        >
                            <div className="col-span-2">Référence</div>
                            <div className="col-span-2">Date</div>
                            <div className="col-span-3">Fournisseur</div>
                            <div className="col-span-2">Entrepôt</div>
                            <div className="col-span-2 text-right">Montant</div>
                            <div className="col-span-1 text-center">Art.</div>
                        </div>

                        <div className="divide-y divide-gray-50">
                            {receptions.map((r, i) => {
                                const nbItems = (r.reception_items as any[])?.length ?? 0
                                return (
                                    <Link
                                        key={r.id}
                                        href={`/stock/receptions/${r.id}`}
                                        className={`grid grid-cols-12 gap-2 items-center px-5 py-3.5 hover:bg-[var(--primary-soft)] transition-colors group ${i % 2 === 0 ? '' : 'bg-[var(--surface2)]/50'}`}
                                    >
                                        <div className="col-span-2">
                                            <p className="text-xs font-bold font-mono text-foreground group-hover:text-primary">
                                                {r.public_id}
                                            </p>
                                        </div>
                                        <div className="col-span-2 flex items-center gap-1 text-xs text-muted-foreground">
                                            <Calendar className="w-3 h-3" />
                                            {formatDate(r.date_reception)}
                                        </div>
                                        <div className="col-span-3">
                                            <p className="text-xs font-medium text-foreground truncate">
                                                {(r.suppliers as any)?.nom ?? '—'}
                                            </p>
                                        </div>
                                        <div className="col-span-2 flex items-center gap-1 text-xs text-muted-foreground">
                                            <Warehouse className="w-3 h-3" />
                                            <span className="truncate">{(r.warehouses as any)?.nom ?? '—'}</span>
                                        </div>
                                        <div className="col-span-2 text-right">
                                            <p className="text-xs font-bold text-foreground">
                                                {formatMontant(r.montant_total, devise)}
                                            </p>
                                        </div>
                                        <div className="col-span-1 text-center">
                                            <span className="text-xs font-bold text-[var(--primary-strong)]">{nbItems}</span>
                                        </div>
                                    </Link>
                                )
                            })}
                        </div>
                       </div>
                      </div>
                    </div>
                )}
            </main>
        </div>
    )
}