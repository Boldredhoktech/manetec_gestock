// app/(shop)/stock/fournisseurs/[id]/factures/page.tsx

import type { Metadata } from 'next'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { redirect, notFound } from 'next/navigation'
import Link from 'next/link'
import { ArrowLeft, Plus, FileText, AlertCircle, CheckCircle, Clock } from 'lucide-react'
import { formatDate, formatMontant } from '@/lib/utils'

export const metadata: Metadata = { title: 'Factures fournisseur' }

interface Props { params: Promise<{ id: string }> }

const STATUT: Record<string, { label: string; bg: string; couleur: string; icone: React.ElementType }> = {
    non_payee:          { label: 'Non payée',         bg: 'bg-red-100',   couleur: 'text-red-700',   icone: AlertCircle   },
    partiellement_payee:{ label: 'Partiel. payée',    bg: 'bg-amber-100', couleur: 'text-amber-700', icone: Clock         },
    payee:              { label: 'Payée',              bg: 'bg-green-100', couleur: 'text-green-700', icone: CheckCircle   },
    annulee:            { label: 'Annulée',            bg: 'bg-gray-100',  couleur: 'text-gray-600',  icone: FileText      },
}

export default async function PageFacturesFournisseur({ params }: Props) {
    const { id } = await params

    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user || user.user_metadata?.type_acteur !== 'shop') redirect('/login')

    const shopId      = user.user_metadata.shop_id as string
    const adminClient = createAdminClient()

    const [{ data: fournisseur }, { data: factures }, { data: boutique }] = await Promise.all([
        adminClient.from('suppliers')
            .select('id, nom, public_id, solde_dû')
            .eq('id', id).eq('shop_id', shopId).single(),
        adminClient.from('factures_fournisseurs')
            .select('id, public_id, statut, date_facture, date_echeance, reference_fourn, montant_ttc, montant_paye, montant_restant')
            .eq('supplier_id', id).eq('shop_id', shopId)
            .order('created_at', { ascending: false }),
        adminClient.from('shops').select('devise').eq('id', shopId).single(),
    ])

    if (!fournisseur) notFound()

    const devise        = boutique?.devise ?? 'FCFA'
    const totalDu       = factures?.filter(f => f.statut !== 'annulee').reduce((a, f) => a + f.montant_restant, 0) ?? 0
    const nbImpayees    = factures?.filter(f => ['non_payee','partiellement_payee'].includes(f.statut)).length ?? 0

    return (
        <div className="flex flex-col min-h-screen bg-[#f8fafc]">
            <header style={{ background: 'linear-gradient(135deg, #1a56db 0%, #1648c0 100%)' }}
                    className="px-6 py-5 shadow-lg">
                <div className="flex items-center justify-between">
                    <div className="flex items-center gap-4">
                        <Link href={`/stock/fournisseurs/${id}`}
                              className="flex items-center justify-center w-9 h-9 rounded-xl bg-white/20 hover:bg-white/30 transition-colors">
                            <ArrowLeft className="w-5 h-5 text-white" />
                        </Link>
                        <div>
                            <h1 className="text-xl font-bold text-white">Factures fournisseur</h1>
                            <p className="text-sm text-white/70 mt-0.5">{fournisseur.nom}</p>
                        </div>
                    </div>
                    <div className="flex items-center gap-3">
                        <div className="text-right px-4 py-2 bg-white/15 rounded-xl">
                            <p className="text-xs text-white/70">Solde dû</p>
                            <p className="text-base font-black text-white">
                                {formatMontant((fournisseur as any)['solde_du'] ?? 0, devise)}
                            </p>
                        </div>
                        <Link href={`/stock/fournisseurs/${id}/factures/nouvelle`}
                              className="flex items-center gap-2 px-4 py-2 bg-white text-[#1a56db] font-bold text-sm rounded-xl hover:bg-white/90 transition-colors">
                            <Plus className="w-4 h-4" />
                            Nouvelle facture
                        </Link>
                    </div>
                </div>
            </header>

            <main className="flex-1 p-6 max-w-4xl mx-auto w-full">

                {/* Résumé */}
                {nbImpayees > 0 && (
                    <div className="mb-5 p-4 bg-amber-50 border border-amber-200 rounded-2xl flex items-center gap-3">
                        <AlertCircle className="w-5 h-5 text-amber-500 shrink-0" />
                        <p className="text-sm text-amber-700">
                            <strong>{nbImpayees} facture(s)</strong> impayée(s) —
                            Restant dû total : <strong>{formatMontant(totalDu, devise)}</strong>
                        </p>
                    </div>
                )}

                {!factures || factures.length === 0 ? (
                    <div className="bg-white border border-gray-200 rounded-2xl p-16 shadow-sm text-center space-y-4">
                        <FileText className="w-10 h-10 mx-auto text-gray-300" />
                        <p className="text-sm text-gray-500">Aucune facture fournisseur.</p>
                        <Link href={`/stock/fournisseurs/${id}/factures/nouvelle`}
                              className="inline-flex items-center gap-2 px-5 py-2.5 bg-[#1a56db] text-white font-bold text-sm rounded-xl hover:bg-[#1648c0] transition-colors">
                            <Plus className="w-4 h-4" />
                            Créer une facture
                        </Link>
                    </div>
                ) : (
                    <div className="bg-white border border-gray-200 rounded-2xl shadow-sm overflow-hidden">
                        <div className="grid grid-cols-12 gap-2 px-5 py-3 text-xs font-bold text-white"
                             style={{ background: 'linear-gradient(135deg, #1a56db 0%, #1648c0 100%)' }}>
                            <div className="col-span-2">Référence</div>
                            <div className="col-span-2">Date</div>
                            <div className="col-span-2">Réf. fourn.</div>
                            <div className="col-span-2 text-right">Montant</div>
                            <div className="col-span-2 text-right">Restant dû</div>
                            <div className="col-span-2 text-center">Statut</div>
                        </div>
                        <div className="divide-y divide-gray-50">
                            {factures.map((f, i) => {
                                const cfg = STATUT[f.statut] ?? STATUT.non_payee
                                const Icone = cfg.icone
                                const enRetard = ['non_payee','partiellement_payee'].includes(f.statut) &&
                                    f.date_echeance && new Date(f.date_echeance) < new Date()
                                return (
                                    <Link key={f.id}
                                          href={`/stock/fournisseurs/${id}/factures/${f.id}`}
                                          className={`grid grid-cols-12 gap-2 items-center px-5 py-3.5 hover:bg-[#1a56db]/5 transition-colors group ${i % 2 === 0 ? '' : 'bg-gray-50/50'}`}>
                                        <div className="col-span-2">
                                            <p className="text-xs font-bold font-mono text-gray-800 group-hover:text-[#1a56db]">
                                                {f.public_id}
                                            </p>
                                        </div>
                                        <div className="col-span-2">
                                            <p className="text-xs text-gray-500">{formatDate(f.date_facture)}</p>
                                            {f.date_echeance && (
                                                <p className={`text-xs mt-0.5 ${enRetard ? 'text-red-500 font-bold' : 'text-gray-400'}`}>
                                                    Éch. {formatDate(f.date_echeance)}
                                                </p>
                                            )}
                                        </div>
                                        <div className="col-span-2">
                                            <p className="text-xs text-gray-500 truncate">{f.reference_fourn ?? '—'}</p>
                                        </div>
                                        <div className="col-span-2 text-right">
                                            <p className="text-xs font-bold text-gray-800">{formatMontant(f.montant_ttc, devise)}</p>
                                        </div>
                                        <div className="col-span-2 text-right">
                                            <p className={`text-xs font-bold ${f.montant_restant > 0 ? 'text-red-600' : 'text-green-600'}`}>
                                                {f.montant_restant > 0 ? formatMontant(f.montant_restant, devise) : 'Soldée'}
                                            </p>
                                        </div>
                                        <div className="col-span-2 flex justify-center">
                                            <span className={`flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold ${cfg.bg} ${cfg.couleur}`}>
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