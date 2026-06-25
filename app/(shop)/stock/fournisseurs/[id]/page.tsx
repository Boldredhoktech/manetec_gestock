// app/(shop)/stock/fournisseurs/[id]/page.tsx

import type { Metadata } from 'next'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { redirect, notFound } from 'next/navigation'
import Link from 'next/link'
import { ArrowLeft, Plus, FileInput, PackageCheck, Phone, Mail, MapPin, Building2 } from 'lucide-react'
import { formatDate, formatMontant } from '@/lib/utils'

export const metadata: Metadata = { title: 'Fiche fournisseur' }

interface Props { params: Promise<{ id: string }> }

export default async function PageDetailFournisseur({ params }: Props) {
    const { id } = await params

    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user || user.user_metadata?.type_acteur !== 'shop') redirect('/login')

    const shopId      = user.user_metadata.shop_id as string
    const adminClient = createAdminClient()

    const { data: fournisseur } = await adminClient
        .from('suppliers')
        .select('*')
        .eq('id', id)
        .eq('shop_id', shopId)
        .single()

    if (!fournisseur) notFound()

    const [
        { data: factures },
        { data: receptions },
        { data: boutique },
    ] = await Promise.all([
        adminClient.from('factures_fournisseurs')
            .select('id, public_id, statut, date_facture, montant_ttc, montant_restant')
            .eq('supplier_id', id)
            .eq('shop_id', shopId)
            .order('created_at', { ascending: false })
            .limit(5),
        adminClient.from('receptions')
            .select('id, public_id, date_reception, montant_total')
            .eq('supplier_id', id)
            .eq('shop_id', shopId)
            .order('created_at', { ascending: false })
            .limit(5),
        adminClient.from('shops').select('devise').eq('id', shopId).single(),
    ])

    const devise   = boutique?.devise ?? 'FCFA'
    const soldeDu  = (fournisseur as any)['solde_dû'] ?? 0

    const STATUT_FF: Record<string, { label: string; bg: string; couleur: string }> = {
        non_payee:           { label: 'Non payée',   bg: 'bg-red-100',   couleur: 'text-red-700'   },
        partiellement_payee: { label: 'Part. payée', bg: 'bg-amber-100', couleur: 'text-amber-700' },
        payee:               { label: 'Payée',        bg: 'bg-green-100', couleur: 'text-green-700' },
        annulee:             { label: 'Annulée',      bg: 'bg-gray-100',  couleur: 'text-gray-500'  },
    }

    return (
        <div className="flex flex-col min-h-screen bg-[#f8fafc]">

            {/* ── Header ─────────────────────────────────── */}
            <header
                style={{ background: 'linear-gradient(135deg, #15335a 0%, #0f2742 100%)' }}
                className="px-6 py-5 shadow-lg"
            >
                <div className="flex items-center justify-between">
                    <div className="flex items-center gap-4">
                        <Link href="/stock/fournisseurs"
                              className="flex items-center justify-center w-9 h-9 rounded-xl bg-white/20 hover:bg-white/30 transition-colors">
                            <ArrowLeft className="w-5 h-5 text-white" />
                        </Link>
                        <div>
                            <h1 className="text-xl font-bold text-white">{fournisseur.nom}</h1>
                            <p className="text-sm text-white/70 mt-0.5 font-mono">{fournisseur.public_id}</p>
                        </div>
                    </div>

                    {/* Boutons d'action */}
                    <div className="flex items-center gap-2">
                        <Link href={`/stock/fournisseurs/${id}/reception`}
                              className="flex items-center gap-2 px-4 py-2 bg-white/15 hover:bg-white/25 text-white font-bold text-sm rounded-xl transition-colors border border-white/20">
                            <PackageCheck className="w-4 h-4" />
                            Réception
                        </Link>
                        <Link href={`/stock/fournisseurs/${id}/factures/nouvelle`}
                              className="flex items-center gap-2 px-4 py-2 bg-white text-[#15335a] font-bold text-sm rounded-xl hover:bg-white/90 transition-colors shadow-sm">
                            <FileInput className="w-4 h-4" />
                            Facture fourn.
                        </Link>
                    </div>
                </div>
            </header>

            <main className="flex-1 p-4 sm:p-6 max-w-5xl mx-auto w-full space-y-5">

                {/* ── Infos fournisseur ──────────────────── */}
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">

                    {/* Carte contact */}
                    <div className="lg:col-span-2 bg-white border border-gray-200 rounded-2xl p-5 shadow-sm space-y-4">
                        <div className="flex items-center gap-2 pb-3 border-b border-gray-100">
                            <Building2 className="w-5 h-5 text-[#15335a]" />
                            <h2 className="text-sm font-bold text-gray-900">Informations</h2>
                        </div>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-sm">
                            {fournisseur.telephone && (
                                <div className="flex items-center gap-2 text-gray-600">
                                    <Phone className="w-4 h-4 text-gray-400 shrink-0" />
                                    {fournisseur.telephone}
                                </div>
                            )}
                            {fournisseur.email && (
                                <div className="flex items-center gap-2 text-gray-600">
                                    <Mail className="w-4 h-4 text-gray-400 shrink-0" />
                                    {fournisseur.email}
                                </div>
                            )}
                            {(fournisseur.ville || fournisseur.pays) && (
                                <div className="flex items-center gap-2 text-gray-600">
                                    <MapPin className="w-4 h-4 text-gray-400 shrink-0" />
                                    {[fournisseur.adresse, fournisseur.ville, fournisseur.pays].filter(Boolean).join(', ')}
                                </div>
                            )}
                            {fournisseur.nom_contact && (
                                <div className="text-gray-600">
                                    <span className="text-gray-400 text-xs">Contact : </span>
                                    {fournisseur.nom_contact}
                                    {fournisseur.poste_contact && (
                                        <span className="text-gray-400 text-xs ml-1">({fournisseur.poste_contact})</span>
                                    )}
                                </div>
                            )}
                            {fournisseur.ifu && (
                                <div className="text-gray-600 text-xs">IFU : {fournisseur.ifu}</div>
                            )}
                            {fournisseur.rccm && (
                                <div className="text-gray-600 text-xs">RCCM : {fournisseur.rccm}</div>
                            )}
                        </div>
                        {fournisseur.notes && (
                            <p className="text-xs text-gray-400 italic border-t border-gray-100 pt-3">
                                {fournisseur.notes}
                            </p>
                        )}
                    </div>

                    {/* Carte solde */}
                    <div className={`bg-white border-2 rounded-2xl p-5 shadow-sm flex flex-col items-center justify-center gap-3 ${
                        soldeDu > 0 ? 'border-red-200' : 'border-gray-200'
                    }`}>
                        <p className="text-xs font-bold text-gray-400 uppercase tracking-wider">Solde dû</p>
                        <p className={`text-3xl font-black ${soldeDu > 0 ? 'text-red-600' : 'text-green-600'}`}>
                            {formatMontant(soldeDu, devise)}
                        </p>
                        {soldeDu > 0 && (
                            <Link href={`/stock/fournisseurs/${id}/factures`}
                                  className="text-xs text-[#15335a] font-bold hover:underline">
                                Voir les factures →
                            </Link>
                        )}
                    </div>
                </div>

                {/* ── Dernières factures fournisseur ──────── */}
                <div className="bg-white border border-gray-200 rounded-2xl shadow-sm overflow-hidden">
                    <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
                        <div className="flex items-center gap-2">
                            <FileInput className="w-4 h-4 text-[#15335a]" />
                            <h2 className="text-sm font-bold text-gray-900">
                                Dernières factures fournisseur
                            </h2>
                        </div>
                        <Link href={`/stock/fournisseurs/${id}/factures`}
                              className="text-xs text-[#15335a] font-bold hover:underline">
                            Voir tout →
                        </Link>
                    </div>

                    {!factures || factures.length === 0 ? (
                        <div className="text-center py-8 text-gray-400">
                            <p className="text-sm">Aucune facture.</p>
                            <Link href={`/stock/fournisseurs/${id}/factures/nouvelle`}
                                  className="text-xs text-[#15335a] font-bold hover:underline mt-1 inline-block">
                                Créer une facture →
                            </Link>
                        </div>
                    ) : (
                        <div className="divide-y divide-gray-50">
                            {factures.map((f, i) => {
                                const cfg = STATUT_FF[f.statut] ?? STATUT_FF.non_payee
                                return (
                                    <Link key={f.id}
                                          href={`/stock/factures-fournisseurs/${f.id}`}
                                          className={`flex items-center gap-4 px-5 py-3.5 hover:bg-[#15335a]/5 transition-colors group ${i % 2 === 0 ? '' : 'bg-gray-50/50'}`}>
                                        <div className="flex-1 min-w-0">
                                            <p className="text-sm font-bold font-mono text-gray-800 group-hover:text-[#15335a]">
                                                {f.public_id}
                                            </p>
                                            <p className="text-xs text-gray-400">{formatDate(f.date_facture)}</p>
                                        </div>
                                        <span className={`px-2 py-0.5 rounded-full text-xs font-bold ${cfg.bg} ${cfg.couleur}`}>
                                            {cfg.label}
                                        </span>
                                        <div className="text-right shrink-0">
                                            <p className="text-sm font-bold text-gray-800">{formatMontant(f.montant_ttc, devise)}</p>
                                            {f.montant_restant > 0 && (
                                                <p className="text-xs text-red-500 font-bold">
                                                    Restant : {formatMontant(f.montant_restant, devise)}
                                                </p>
                                            )}
                                        </div>
                                    </Link>
                                )
                            })}
                        </div>
                    )}
                </div>

                {/* ── Dernières réceptions ────────────────── */}
                <div className="bg-white border border-gray-200 rounded-2xl shadow-sm overflow-hidden">
                    <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
                        <div className="flex items-center gap-2">
                            <PackageCheck className="w-4 h-4 text-[#15335a]" />
                            <h2 className="text-sm font-bold text-gray-900">
                                Dernières réceptions
                            </h2>
                        </div>
                        <Link href="/stock/receptions"
                              className="text-xs text-[#15335a] font-bold hover:underline">
                            Voir tout →
                        </Link>
                    </div>

                    {!receptions || receptions.length === 0 ? (
                        <div className="text-center py-8 text-gray-400">
                            <p className="text-sm">Aucune réception.</p>
                            <Link href={`/stock/fournisseurs/${id}/reception`}
                                  className="text-xs text-[#15335a] font-bold hover:underline mt-1 inline-block">
                                Enregistrer une réception →
                            </Link>
                        </div>
                    ) : (
                        <div className="divide-y divide-gray-50">
                            {receptions.map((r, i) => (
                                <Link key={r.id}
                                      href={`/stock/receptions/${r.id}`}
                                      className={`flex items-center justify-between px-5 py-3.5 hover:bg-[#15335a]/5 transition-colors group ${i % 2 === 0 ? '' : 'bg-gray-50/50'}`}>
                                    <div>
                                        <p className="text-sm font-bold font-mono text-gray-800 group-hover:text-[#15335a]">
                                            {r.public_id}
                                        </p>
                                        <p className="text-xs text-gray-400">{formatDate(r.date_reception)}</p>
                                    </div>
                                    <p className="text-sm font-bold text-gray-800">
                                        {formatMontant(r.montant_total, devise)}
                                    </p>
                                </Link>
                            ))}
                        </div>
                    )}
                </div>

            </main>
        </div>
    )
}