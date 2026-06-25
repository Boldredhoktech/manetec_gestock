// app/(shop)/stock/receptions/page.tsx

import type { Metadata } from 'next'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import { PackageCheck, ChevronRight, Calendar, Warehouse } from 'lucide-react'
import { formatDate, formatMontant } from '@/lib/utils'

export const metadata: Metadata = { title: 'Réceptions' }

export default async function PageReceptions() {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user || user.user_metadata?.type_acteur !== 'shop') redirect('/login')

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
        <div className="flex flex-col min-h-screen bg-[#f8fafc]">
            <header
                style={{ background: 'linear-gradient(135deg, #15335a 0%, #0f2742 100%)' }}
                className="px-6 py-5 shadow-lg"
            >
                <div className="flex items-center gap-3">
                    <div className="bg-white/20 p-2 rounded-xl">
                        <PackageCheck className="w-5 h-5 text-white" />
                    </div>
                    <div>
                        <h1 className="text-xl font-bold text-white">Réceptions</h1>
                        <p className="text-sm text-white/70 mt-0.5">
                            {receptions?.length ?? 0} réception(s) enregistrée(s)
                        </p>
                    </div>
                </div>
            </header>

            <main className="flex-1 p-4 sm:p-6 max-w-4xl mx-auto w-full">

                {!receptions || receptions.length === 0 ? (
                    <div className="bg-white border border-gray-200 rounded-2xl p-16 shadow-sm text-center space-y-3">
                        <PackageCheck className="w-10 h-10 mx-auto text-gray-300" />
                        <p className="text-sm text-gray-500">
                            Aucune réception. Les réceptions se créent depuis la fiche d'un fournisseur.
                        </p>
                        <Link href="/stock/fournisseurs"
                              className="inline-block text-sm text-[#15335a] font-bold hover:underline">
                            Aller aux fournisseurs →
                        </Link>
                    </div>
                ) : (
                    <div className="bg-white border border-gray-200 rounded-2xl shadow-sm overflow-hidden">
                      <div className="overflow-x-auto">
                       <div className="min-w-[720px]">
                        <div
                            className="grid grid-cols-12 gap-2 px-5 py-3 text-xs font-bold text-white"
                            style={{ background: 'linear-gradient(135deg, #15335a 0%, #0f2742 100%)' }}
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
                                        className={`grid grid-cols-12 gap-2 items-center px-5 py-3.5 hover:bg-[#15335a]/5 transition-colors group ${i % 2 === 0 ? '' : 'bg-gray-50/50'}`}
                                    >
                                        <div className="col-span-2">
                                            <p className="text-xs font-bold font-mono text-gray-800 group-hover:text-[#15335a]">
                                                {r.public_id}
                                            </p>
                                        </div>
                                        <div className="col-span-2 flex items-center gap-1 text-xs text-gray-500">
                                            <Calendar className="w-3 h-3" />
                                            {formatDate(r.date_reception)}
                                        </div>
                                        <div className="col-span-3">
                                            <p className="text-xs font-medium text-gray-700 truncate">
                                                {(r.suppliers as any)?.nom ?? '—'}
                                            </p>
                                        </div>
                                        <div className="col-span-2 flex items-center gap-1 text-xs text-gray-500">
                                            <Warehouse className="w-3 h-3" />
                                            <span className="truncate">{(r.warehouses as any)?.nom ?? '—'}</span>
                                        </div>
                                        <div className="col-span-2 text-right">
                                            <p className="text-xs font-bold text-gray-800">
                                                {formatMontant(r.montant_total, devise)}
                                            </p>
                                        </div>
                                        <div className="col-span-1 text-center">
                                            <span className="text-xs font-bold text-[#15335a]">{nbItems}</span>
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