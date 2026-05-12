// app/(shop)/stock/factures-fournisseurs/page.tsx

import type { Metadata } from 'next'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import { FileInput, Plus, AlertCircle, CheckCircle, Clock } from 'lucide-react'
import { formatDate, formatMontant } from '@/lib/utils'

export const metadata: Metadata = { title: 'Factures fournisseurs' }

const STATUT: Record<string, { label: string; bg: string; couleur: string; icone: React.ElementType }> = {
    non_payee:           { label: 'Non payée',   bg: 'bg-red-100',   couleur: 'text-red-700',   icone: AlertCircle },
    partiellement_payee: { label: 'Part. payée', bg: 'bg-amber-100', couleur: 'text-amber-700', icone: Clock       },
    payee:               { label: 'Payée',        bg: 'bg-green-100', couleur: 'text-green-700', icone: CheckCircle },
    annulee:             { label: 'Annulée',      bg: 'bg-gray-100',  couleur: 'text-gray-500',  icone: FileInput   },
}

export default async function PageFacturesFournisseurs() {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user || user.user_metadata?.type_acteur !== 'shop') redirect('/login')

    const shopId      = user.user_metadata.shop_id as string
    const adminClient = createAdminClient()

    const [{ data: factures }, { data: boutique }] = await Promise.all([
        adminClient
            .from('factures_fournisseurs')
            .select(`
                id, public_id, statut, date_facture, date_echeance,
                reference_fourn, montant_ttc, montant_paye, montant_restant,
                supplier_id,
                suppliers(nom)
            `)
            .eq('shop_id', shopId)
            .order('created_at', { ascending: false })
            .limit(10),
        adminClient.from('shops').select('devise').eq('id', shopId).single(),
    ])

    const devise     = boutique?.devise ?? 'FCFA'
    const totalDu    = factures?.filter(f => f.statut !== 'annulee')
        .reduce((a, f) => a + f.montant_restant, 0) ?? 0
    const nbImpayees = factures?.filter(f =>
        ['non_payee','partiellement_payee'].includes(f.statut)).length ?? 0

    return (
        <div className="flex flex-col min-h-screen bg-[#f8fafc]">

            <header
                style={{ background: 'linear-gradient(135deg, #1a56db 0%, #1648c0 100%)' }}
                className="px-6 py-5 shadow-lg"
            >
                <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                        <div className="bg-white/20 p-2 rounded-xl">
                            <FileInput className="w-5 h-5 text-white" />
                        </div>
                        <div>
                            <h1 className="text-xl font-bold text-white">Factures fournisseurs</h1>
                            <p className="text-sm text-white/70 mt-0.5">
                                {nbImpayees > 0
                                    ? `${nbImpayees} impayée(s) · Total dû : ${formatMontant(totalDu, devise)}`
                                    : '10 dernières factures'
                                }
                            </p>
                        </div>
                    </div>
                    <Link
                        href="/stock/factures-fournisseurs/nouvelle"
                        className="flex items-center gap-2 px-4 py-2 bg-white text-[#1a56db] font-bold text-sm rounded-xl hover:bg-white/90 transition-colors shadow-sm"
                    >
                        <Plus className="w-4 h-4" />
                        Nouvelle facture
                    </Link>
                </div>
            </header>

            <main className="flex-1 p-6 max-w-4xl mx-auto w-full space-y-4">

                {nbImpayees > 0 && (
                    <div className="p-4 bg-amber-50 border border-amber-200 rounded-2xl flex items-center gap-3">
                        <AlertCircle className="w-5 h-5 text-amber-500 shrink-0" />
                        <p className="text-sm text-amber-700">
                            <strong>{nbImpayees} facture(s)</strong> en attente de paiement —
                            Restant total : <strong>{formatMontant(totalDu, devise)}</strong>
                        </p>
                    </div>
                )}

                {!factures || factures.length === 0 ? (
                    <div className="bg-white border border-gray-200 rounded-2xl p-16 shadow-sm text-center space-y-4">
                        <FileInput className="w-10 h-10 mx-auto text-gray-300" />
                        <div>
                            <p className="text-sm font-semibold text-gray-700">Aucune facture fournisseur</p>
                            <p className="text-sm text-gray-400 mt-1">
                                Enregistrez vos achats fournisseurs sous forme de factures.
                            </p>
                        </div>
                        <Link href="/stock/factures-fournisseurs/nouvelle"
                              className="inline-flex items-center gap-2 px-5 py-2.5 bg-[#1a56db] text-white font-bold text-sm rounded-xl hover:bg-[#1648c0] transition-colors">
                            <Plus className="w-4 h-4" />
                            Créer une facture fournisseur
                        </Link>
                    </div>
                ) : (
                    <div className="bg-white border border-gray-200 rounded-2xl shadow-sm overflow-hidden">

                        <div className="flex items-center justify-between px-5 py-3.5 border-b border-gray-100">
                            <p className="text-sm font-bold text-gray-700">10 dernières factures</p>
                        </div>

                        <div className="grid grid-cols-12 gap-2 px-5 py-3 text-xs font-bold text-white"
                             style={{ background: 'linear-gradient(135deg, #1a56db 0%, #1648c0 100%)' }}>
                            <div className="col-span-2">Référence</div>
                            <div className="col-span-2">Date</div>
                            <div className="col-span-3">Fournisseur</div>
                            <div className="col-span-2 text-right">Montant TTC</div>
                            <div className="col-span-1 text-right">Restant</div>
                            <div className="col-span-2 text-center">Statut</div>
                        </div>

                        <div className="divide-y divide-gray-50">
                            {factures.map((f, i) => {
                                const cfg   = STATUT[f.statut] ?? STATUT.non_payee
                                const Icone = cfg.icone
                                const enRetard = ['non_payee','partiellement_payee'].includes(f.statut) &&
                                    f.date_echeance && new Date(f.date_echeance) < new Date()
                                return (
                                    <Link key={f.id}
                                          href={`/stock/factures-fournisseurs/${f.id}`}
                                          className={`grid grid-cols-12 gap-2 items-center px-5 py-3.5 hover:bg-[#1a56db]/5 transition-colors group ${i % 2 === 0 ? '' : 'bg-gray-50/50'}`}>
                                        <div className="col-span-2">
                                            <p className="text-xs font-bold font-mono text-gray-800 group-hover:text-[#1a56db]">
                                                {f.public_id}
                                            </p>
                                            {f.reference_fourn && (
                                                <p className="text-xs text-gray-400 mt-0.5 truncate">{f.reference_fourn}</p>
                                            )}
                                        </div>
                                        <div className="col-span-2">
                                            <p className="text-xs text-gray-500">{formatDate(f.date_facture)}</p>
                                            {f.date_echeance && (
                                                <p className={`text-xs mt-0.5 ${enRetard ? 'text-red-500 font-bold' : 'text-gray-400'}`}>
                                                    Éch. {formatDate(f.date_echeance)}
                                                </p>
                                            )}
                                        </div>
                                        <div className="col-span-3">
                                            <p className="text-xs font-medium text-gray-700 truncate">
                                                {(f.suppliers as any)?.nom ?? '—'}
                                            </p>
                                        </div>
                                        <div className="col-span-2 text-right">
                                            <p className="text-xs font-bold text-gray-800">
                                                {formatMontant(f.montant_ttc, devise)}
                                            </p>
                                        </div>
                                        <div className="col-span-1 text-right">
                                            <p className={`text-xs font-bold ${f.montant_restant > 0 ? 'text-red-600' : 'text-green-600'}`}>
                                                {f.montant_restant > 0 ? formatMontant(f.montant_restant, devise) : '✓'}
                                            </p>
                                        </div>
                                        <div className="col-span-2 flex justify-center">
                                            <span className={`flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-bold ${cfg.bg} ${cfg.couleur}`}>
                                                <Icone className="w-3 h-3" />
                                                {cfg.label}
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