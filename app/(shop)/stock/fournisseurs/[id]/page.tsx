// app/(shop)/stock/fournisseurs/[id]/page.tsx

import type { Metadata } from 'next'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { redirect, notFound } from 'next/navigation'
import Link from 'next/link'
import { ArrowLeft, Plus, FileInput, PackageCheck, Phone, Mail, MapPin, Building2, ClipboardList, FileText } from 'lucide-react'
import { formatDate, formatMontant } from '@/lib/utils'
import CartePaiementFournisseur from '@/components/shop/fournisseurs/CartePaiementFournisseur'
import StatutFournisseur from '@/components/shop/fournisseurs/StatutFournisseur'
import { aPermission } from '@/lib/auth/permissions-serveur'
import { PERMISSIONS } from '@/lib/constants/permissions'

export const metadata: Metadata = { title: 'Fiche fournisseur' }

interface Props { params: Promise<{ id: string }> }

export default async function PageDetailFournisseur({ params }: Props) {
    const { id } = await params

    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user || user.user_metadata?.type_acteur !== 'shop') redirect('/login')
    if (!aPermission(user, PERMISSIONS.FOURNISSEURS_VOIR)) redirect('/admin/dashboard')

    const shopId      = user.user_metadata.shop_id as string
    const adminClient = createAdminClient()
    const peutPayer   = aPermission(user, PERMISSIONS.PAIEMENT_FOURNISSEUR)
    const peutModifier = aPermission(user, PERMISSIONS.FOURNISSEURS_MODIFIER)

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
        annulee:             { label: 'Annulée',      bg: 'bg-muted',  couleur: 'text-muted-foreground'  },
    }

    return (
        <div className="flex flex-col min-h-screen">

            {/* ── Header ─────────────────────────────────── */}
            <header className="px-4 sm:px-6 lg:px-8 pt-5 pb-4">
                <div className="flex items-center justify-between">
                    <div className="flex items-center gap-4">
                        <Link href="/stock/fournisseurs"
                              className="flex items-center justify-center w-9 h-9 rounded-xl bg-muted hover:bg-border transition-colors">
                            <ArrowLeft className="w-5 h-5 text-foreground" />
                        </Link>
                        <div>
                            <h1 className="text-2xl sm:text-3xl font-bold text-foreground">{fournisseur.nom}</h1>
                            <p className="text-sm text-muted-foreground mt-0.5 font-mono">{fournisseur.public_id}</p>
                        </div>
                    </div>

                    {/* Boutons d'action */}
                    <div className="flex items-center gap-2 flex-wrap">
                        <Link href={`/stock/bons-de-commande/nouveau?fournisseur=${id}`}
                              className="flex items-center gap-2 px-4 py-2 bg-muted hover:bg-border text-foreground font-bold text-sm rounded-xl transition-colors border border-border">
                            <ClipboardList className="w-4 h-4" />
                            Bon de commande
                        </Link>
                        <Link href={`/stock/fournisseurs/${id}/reception`}
                              className="flex items-center gap-2 px-4 py-2 bg-muted hover:bg-border text-foreground font-bold text-sm rounded-xl transition-colors border border-border">
                            <PackageCheck className="w-4 h-4" />
                            Réception
                        </Link>
                        <a href={`/api/v1/pdf/releve-fournisseur/${id}`}
                           target="_blank" rel="noopener noreferrer"
                           className="flex items-center gap-2 px-4 py-2 bg-muted hover:bg-border text-foreground font-bold text-sm rounded-xl transition-colors border border-border">
                            <FileText className="w-4 h-4" />
                            Relevé
                        </a>
                        <Link href={`/stock/fournisseurs/${id}/factures/nouvelle`}
                              className="flex items-center gap-2 px-4 py-2 bg-card text-[var(--primary-strong)] font-bold text-sm rounded-xl hover:bg-white/90 transition-colors shadow-sm">
                            <FileInput className="w-4 h-4" />
                            Facture fourn.
                        </Link>
                    </div>
                </div>
            </header>

            <main className="flex-1 px-4 sm:px-6 lg:px-8 pb-8 max-w-5xl mx-auto w-full space-y-5">

                {/* ── Infos fournisseur ──────────────────── */}
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">

                    {/* Carte contact */}
                    <div className="lg:col-span-2 bg-card border border-border rounded-2xl p-5 shadow-sm space-y-4">
                        <div className="flex items-center gap-2 pb-3 border-b border-border">
                            <Building2 className="w-5 h-5 text-[var(--primary-strong)]" />
                            <h2 className="text-sm font-bold text-foreground">Informations</h2>
                        </div>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-sm">
                            {fournisseur.telephone && (
                                <div className="flex items-center gap-2 text-muted-foreground">
                                    <Phone className="w-4 h-4 text-muted-foreground/80 shrink-0" />
                                    {fournisseur.telephone}
                                </div>
                            )}
                            {fournisseur.email && (
                                <div className="flex items-center gap-2 text-muted-foreground">
                                    <Mail className="w-4 h-4 text-muted-foreground/80 shrink-0" />
                                    {fournisseur.email}
                                </div>
                            )}
                            {(fournisseur.ville || fournisseur.pays) && (
                                <div className="flex items-center gap-2 text-muted-foreground">
                                    <MapPin className="w-4 h-4 text-muted-foreground/80 shrink-0" />
                                    {[fournisseur.adresse, fournisseur.ville, fournisseur.pays].filter(Boolean).join(', ')}
                                </div>
                            )}
                            {fournisseur.nom_contact && (
                                <div className="text-muted-foreground">
                                    <span className="text-muted-foreground/80 text-xs">Contact : </span>
                                    {fournisseur.nom_contact}
                                    {fournisseur.poste_contact && (
                                        <span className="text-muted-foreground/80 text-xs ml-1">({fournisseur.poste_contact})</span>
                                    )}
                                </div>
                            )}
                            {fournisseur.ifu && (
                                <div className="text-muted-foreground text-xs">IFU : {fournisseur.ifu}</div>
                            )}
                            {fournisseur.rccm && (
                                <div className="text-muted-foreground text-xs">RCCM : {fournisseur.rccm}</div>
                            )}
                        </div>
                        {fournisseur.notes && (
                            <p className="text-xs text-muted-foreground/80 italic border-t border-border pt-3">
                                {fournisseur.notes}
                            </p>
                        )}
                    </div>

                    {/* Carte solde */}
                    <div className={`bg-card border-2 rounded-2xl p-5 shadow-sm flex flex-col items-center justify-center gap-3 ${
                        soldeDu > 0 ? 'border-[var(--rouge-texte)]/30' : 'border-border'
                    }`}>
                        <p className="text-xs font-bold text-muted-foreground/80 uppercase tracking-wider">Solde dû</p>
                        <p className={`text-3xl font-black ${soldeDu > 0 ? 'text-[var(--rouge-texte)]' : 'text-[var(--primary-strong)]'}`}>
                            {formatMontant(soldeDu, devise)}
                        </p>
                        {soldeDu > 0 && (
                            <Link href={`/stock/fournisseurs/${id}/factures`}
                                  className="text-xs text-[var(--primary-strong)] font-bold hover:underline">
                                Voir les factures →
                            </Link>
                        )}
                        {peutPayer && soldeDu > 0 && (
                            <CartePaiementFournisseur
                                fournisseur={{ id: fournisseur.id, solde_dû: fournisseur.solde_dû }}
                            />
                        )}
                    </div>
                </div>

                {/* ── Dernières factures fournisseur ──────── */}
                <div className="bg-card border border-border rounded-2xl shadow-sm overflow-hidden">
                    <div className="flex items-center justify-between px-5 py-4 border-b border-border">
                        <div className="flex items-center gap-2">
                            <FileInput className="w-4 h-4 text-[var(--primary-strong)]" />
                            <h2 className="text-sm font-bold text-foreground">
                                Dernières factures fournisseur
                            </h2>
                        </div>
                        <Link href={`/stock/fournisseurs/${id}/factures`}
                              className="text-xs text-[var(--primary-strong)] font-bold hover:underline">
                            Voir tout →
                        </Link>
                    </div>

                    {!factures || factures.length === 0 ? (
                        <div className="text-center py-8 text-muted-foreground/80">
                            <p className="text-sm">Aucune facture.</p>
                            <Link href={`/stock/fournisseurs/${id}/factures/nouvelle`}
                                  className="text-xs text-[var(--primary-strong)] font-bold hover:underline mt-1 inline-block">
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
                                          className={`flex items-center gap-4 px-5 py-3.5 hover:bg-[var(--primary-soft)] transition-colors group ${i % 2 === 0 ? '' : 'bg-[var(--surface2)]/50'}`}>
                                        <div className="flex-1 min-w-0">
                                            <p className="text-sm font-bold font-mono text-foreground group-hover:text-primary">
                                                {f.public_id}
                                            </p>
                                            <p className="text-xs text-muted-foreground/80">{formatDate(f.date_facture)}</p>
                                        </div>
                                        <span className={`px-2 py-0.5 rounded-full text-xs font-bold ${cfg.bg} ${cfg.couleur}`}>
                                            {cfg.label}
                                        </span>
                                        <div className="text-right shrink-0">
                                            <p className="text-sm font-bold text-foreground">{formatMontant(f.montant_ttc, devise)}</p>
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
                <div className="bg-card border border-border rounded-2xl shadow-sm overflow-hidden">
                    <div className="flex items-center justify-between px-5 py-4 border-b border-border">
                        <div className="flex items-center gap-2">
                            <PackageCheck className="w-4 h-4 text-[var(--primary-strong)]" />
                            <h2 className="text-sm font-bold text-foreground">
                                Dernières réceptions
                            </h2>
                        </div>
                        <Link href="/stock/receptions"
                              className="text-xs text-[var(--primary-strong)] font-bold hover:underline">
                            Voir tout →
                        </Link>
                    </div>

                    {!receptions || receptions.length === 0 ? (
                        <div className="text-center py-8 text-muted-foreground/80">
                            <p className="text-sm">Aucune réception.</p>
                            <Link href={`/stock/fournisseurs/${id}/reception`}
                                  className="text-xs text-[var(--primary-strong)] font-bold hover:underline mt-1 inline-block">
                                Enregistrer une réception →
                            </Link>
                        </div>
                    ) : (
                        <div className="divide-y divide-gray-50">
                            {receptions.map((r, i) => (
                                <Link key={r.id}
                                      href={`/stock/receptions/${r.id}`}
                                      className={`flex items-center justify-between px-5 py-3.5 hover:bg-[var(--primary-soft)] transition-colors group ${i % 2 === 0 ? '' : 'bg-[var(--surface2)]/50'}`}>
                                    <div>
                                        <p className="text-sm font-bold font-mono text-foreground group-hover:text-primary">
                                            {r.public_id}
                                        </p>
                                        <p className="text-xs text-muted-foreground/80">{formatDate(r.date_reception)}</p>
                                    </div>
                                    <p className="text-sm font-bold text-foreground">
                                        {formatMontant(r.montant_total, devise)}
                                    </p>
                                </Link>
                            ))}
                        </div>
                    )}
                </div>

                {peutModifier && (
                    <StatutFournisseur
                        supplierId={fournisseur.id}
                        estActif={fournisseur.est_actif !== false}
                    />
                )}

                {/* Reglement libre du solde : cet ecran existait depuis
                    le debut sans etre affiche nulle part, donc
                    payerFournisseur() n'etait atteignable par personne. */}

            </main>
        </div>
    )
}