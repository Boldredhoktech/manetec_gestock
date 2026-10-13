// app/(shop)/admin/abonnement/page.tsx
//
// Seule page qu'une boutique expirée peut encore atteindre (D3) :
// l'administrateur y règle ou renouvelle l'abonnement en ligne (ABO-02)
// et retrouve ses reçus (ABO-17). Toutes les lectures passent par le
// client admin : la RLS bloque une session de boutique expirée (mig 034).

import type { Metadata } from 'next'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { redirect } from 'next/navigation'
import { estAdminComplet } from '@/lib/constants/permissions'
import { ENTREPRISE } from '@/lib/config/entreprise'
import {
    CheckCircle, AlertTriangle, Crown, Rocket, Star, Clock, FileText,
    Phone, MessageSquare, Mail, ChevronRight, Gift,
    type LucideIcon,
} from 'lucide-react'
import { formatDate } from '@/lib/utils'
import {
    fichePlan, fonctionnalitesPlan, labelPlan, prixPeriode, formatMontant,
    PLANS_ORDONNES, DUREES, estDuree, JOURS_ESSAI,
} from '@/lib/abonnement/catalogue'
import { etatAbonnement } from '@/lib/abonnement/regle'
import { configWidgetKkiapay } from '@/lib/abonnement/kkiapay'
import PaiementAbonnement, { type OffrePlan } from '@/components/shop/abonnement/PaiementAbonnement'

export const metadata: Metadata = { title: 'Mon abonnement' }

// Présentation seulement : libellés, prix et fonctionnalités viennent
// du catalogue (lib/abonnement/catalogue.ts, ABO-08).
const STYLE_PLAN: Record<string, { bgHeader: string; icone: LucideIcon }> = {
    essai:      { bgHeader: 'from-amber-600 to-orange-600',     icone: Gift   },
    starter:    { bgHeader: 'from-gray-600 to-gray-700',       icone: Rocket },
    pro:        { bgHeader: 'from-[#15335a] to-[#0f2742]',     icone: Star   },
    enterprise: { bgHeader: 'from-emerald-600 to-emerald-700', icone: Crown  },
}

const STATUTS: Record<string, { label: string; classe: string }> = {
    reussi:     { label: 'Payé',        classe: 'bg-green-100 text-green-700' },
    en_attente: { label: 'Non abouti',  classe: 'bg-gray-100 text-gray-600'   },
    echoue:     { label: 'Échoué',      classe: 'bg-red-100 text-red-700'     },
    abandonne:  { label: 'Abandonné',   classe: 'bg-gray-100 text-gray-600'   },
    rembourse:  { label: 'Remboursé',   classe: 'bg-amber-100 text-amber-700' },
}

export default async function PageAbonnement() {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user || user.user_metadata?.type_acteur !== 'shop') redirect('/login')
    if (!estAdminComplet(user.user_metadata?.role)) redirect('/admin/dashboard')

    const adminClient = createAdminClient()
    const shopId = user.user_metadata.shop_id as string
    const [{ data: boutique }, { data: paiements }] = await Promise.all([
        adminClient.from('shops')
            .select('nom, plan, plan_expire_le, created_at, est_active')
            .eq('id', shopId).single(),
        adminClient.from('abonnement_paiements')
            .select('id, public_id, plan, duree, montant, moyen, statut, periode_debut, periode_fin, created_at')
            .eq('shop_id', shopId)
            .order('created_at', { ascending: false })
            .limit(20),
    ])

    const plan          = boutique?.plan ?? 'starter'
    const fiche         = fichePlan(plan)
    const style         = STYLE_PLAN[fiche.id] ?? STYLE_PLAN.starter
    const PlanIcone     = style.icone
    const expiration    = boutique?.plan_expire_le ? new Date(boutique.plan_expire_le) : null
    const estExpire     = etatAbonnement(boutique) === 'expire'
    const joursRestants = expiration && !estExpire
        ? Math.max(0, Math.ceil((expiration.getTime() - Date.now()) / 86400000))
        : null
    const bientot       = joursRestants !== null && joursRestants <= 7
    const historique    = (paiements ?? []).filter(p => p.statut !== 'en_attente' || Date.now() - new Date(p.created_at).getTime() > 3600_000)
    const enEssai       = plan === 'essai'

    const widget = configWidgetKkiapay()
    const offres: OffrePlan[] = PLANS_ORDONNES
        .filter(id => fichePlan(id).payableEnLigne)
        .map(id => ({
            id,
            label:           labelPlan(id),
            couleur:         fichePlan(id).couleur,
            fonctionnalites: fonctionnalitesPlan(id),
            prix: { mensuel: prixPeriode(id, 'mensuel') ?? 0, annuel: prixPeriode(id, 'annuel') ?? 0 },
        }))

    return (
        <div className="flex flex-col min-h-screen bg-[#f8fafc]">

            <header className={`px-6 py-5 shadow-lg bg-gradient-to-r ${style.bgHeader}`}>
                <div className="flex items-center gap-4">
                    <PlanIcone className="w-9 h-9 text-white shrink-0" />
                    <div>
                        <h1 className="text-xl font-bold text-white">Mon abonnement</h1>
                        <p className="text-sm text-white/70 mt-0.5">{boutique?.nom}</p>
                    </div>
                    <span className="ml-auto px-4 py-1.5 rounded-full text-sm font-black bg-white/20 text-white border border-white/30">
                        Plan {fiche.label}
                    </span>
                </div>
            </header>

            <main className="flex-1 p-4 sm:p-6 max-w-3xl mx-auto w-full space-y-5">

                {(estExpire || bientot) && (
                    <div className={`flex items-start gap-3 p-4 rounded-2xl border-2 ${
                        estExpire ? 'bg-red-50 border-red-300 text-red-700' : 'bg-amber-50 border-amber-300 text-amber-700'}`}>
                        <AlertTriangle className="w-5 h-5 shrink-0 mt-0.5" />
                        <div>
                            <p className="font-bold text-sm">
                                {enEssai
                                    ? (estExpire ? 'Votre période d\'essai est terminée' : `Votre période d'essai se termine dans ${joursRestants} jour(s)`)
                                    : (estExpire ? 'Votre abonnement a expiré' : `Votre abonnement expire dans ${joursRestants} jour(s)`)}
                            </p>
                            <p className="text-xs mt-1 opacity-80">
                                {estExpire
                                    ? `Vos équipes ne peuvent plus se connecter et plus aucune opération n'est possible. ${enEssai ? 'Choisissez Starter ou Pro' : 'Renouvelez'} ci-dessous : l'accès est rétabli dès la confirmation du paiement.`
                                    : enEssai
                                        ? 'Choisissez dès maintenant Starter ou Pro : vos jours d\'essai restants sont conservés.'
                                        : 'Renouvelez dès maintenant : les jours restants sont conservés.'}
                            </p>
                        </div>
                    </div>
                )}

                {/* Plan actuel */}
                <div className="bg-white border border-gray-200 rounded-2xl shadow-sm overflow-hidden">
                    <div className={`p-5 bg-gradient-to-r ${style.bgHeader} flex items-center justify-between`}>
                        <div>
                            <p className="text-xs text-white/70 uppercase tracking-wider font-bold">
                                {enEssai ? `Période d'essai (${JOURS_ESSAI} jours)` : 'Plan actuel'}
                            </p>
                            <p className="text-2xl font-black text-white mt-1 flex items-center gap-2">
                                <PlanIcone className="w-6 h-6" /> {fiche.label}
                            </p>
                        </div>
                        {expiration && (
                            <div className="text-right px-4 py-2 rounded-xl bg-white/15">
                                <p className="text-xs text-white/70">{estExpire ? 'Expiré le' : 'Valable jusqu\'au'}</p>
                                <p className="text-sm font-black text-white">{formatDate(expiration.toISOString())}</p>
                                {joursRestants !== null && <p className="text-xs font-bold mt-0.5 text-white/70">J-{joursRestants}</p>}
                            </div>
                        )}
                    </div>
                    <div className="p-5 grid grid-cols-1 sm:grid-cols-2 gap-2">
                        {fonctionnalitesPlan(plan).map(f => (
                            <div key={f} className="flex items-center gap-2">
                                <CheckCircle className="w-4 h-4 text-green-500 shrink-0" />
                                <span className="text-sm text-gray-700">{f}</span>
                            </div>
                        ))}
                    </div>
                </div>

                {/* Paiement en ligne */}
                {widget && offres.length > 0 ? (
                    <PaiementAbonnement offres={offres} planActuel={plan} sandbox={widget.sandbox} />
                ) : (
                    <div className="p-4 rounded-2xl border border-gray-200 bg-white text-sm text-gray-600">
                        Le paiement en ligne est momentanément indisponible. Contactez-nous ci-dessous.
                    </div>
                )}

                {/* Historique et reçus */}
                <div className="bg-white border border-gray-200 rounded-2xl p-5 shadow-sm space-y-3">
                    <div className="flex items-center gap-2">
                        <Clock className="w-4 h-4 text-[#15335a]" />
                        <h2 className="text-sm font-bold text-gray-900">Historique des paiements</h2>
                    </div>
                    {historique.length === 0 ? (
                        <p className="text-sm text-gray-500">
                            Aucun paiement pour l&apos;instant. Boutique créée le {boutique?.created_at ? formatDate(boutique.created_at) : '—'}.
                        </p>
                    ) : (
                        <ul className="divide-y divide-gray-100">
                            {historique.map(p => {
                                const st = STATUTS[p.statut] ?? STATUTS.en_attente
                                return (
                                    <li key={p.id} className="py-2.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm">
                                        <span className="font-mono text-xs text-gray-500">{p.public_id}</span>
                                        <span className="font-semibold text-gray-800">
                                            {labelPlan(p.plan)} · {estDuree(p.duree) ? DUREES[p.duree].label : p.duree}
                                        </span>
                                        <span className="text-gray-600">{formatMontant(Number(p.montant))}</span>
                                        <span className={`px-2 py-0.5 rounded-full text-[11px] font-bold ${st.classe}`}>{st.label}</span>
                                        {p.statut === 'reussi' && p.periode_fin && (
                                            <span className="text-xs text-gray-500">
                                                du {formatDate(p.periode_debut)} au {formatDate(p.periode_fin)}
                                            </span>
                                        )}
                                        {p.statut === 'reussi' && (
                                            <a href={`/api/v1/pdf/recu-abonnement/${p.id}`} target="_blank" rel="noopener noreferrer"
                                               className="ml-auto inline-flex items-center gap-1 text-xs font-semibold text-[#15335a] hover:underline">
                                                <FileText className="w-3.5 h-3.5" /> Reçu
                                            </a>
                                        )}
                                    </li>
                                )
                            })}
                        </ul>
                    )}
                </div>

                {/* Contact (Enterprise sur devis, aide) */}
                <div className="bg-white border border-gray-200 rounded-2xl p-5 shadow-sm space-y-4">
                    <h2 className="text-sm font-bold text-gray-900">Contacter {ENTREPRISE.nom}</h2>
                    <p className="text-sm text-gray-500">
                        Le plan Enterprise s&apos;active sur devis. Pour lui, pour une facture ou pour toute aide, contactez notre équipe.
                    </p>
                    <div className="space-y-2.5">
                        <a href={`https://wa.me/${ENTREPRISE.whatsapp.replace(/\s/g, '')}`} target="_blank" rel="noopener noreferrer"
                           className="flex items-center gap-3 p-3.5 bg-green-50 border border-green-200 rounded-xl hover:bg-green-100 transition-colors">
                            <div className="w-9 h-9 bg-green-500 rounded-xl flex items-center justify-center shrink-0">
                                <MessageSquare className="w-4 h-4 text-white" />
                            </div>
                            <div className="flex-1">
                                <p className="text-sm font-bold text-green-800">WhatsApp</p>
                                <p className="text-xs text-green-600">{ENTREPRISE.whatsapp}</p>
                            </div>
                            <ChevronRight className="w-4 h-4 text-green-500" />
                        </a>
                        <a href={`tel:${ENTREPRISE.telephone_1}`}
                           className="flex items-center gap-3 p-3.5 bg-blue-50 border border-blue-200 rounded-xl hover:bg-blue-100 transition-colors">
                            <div className="w-9 h-9 bg-[#15335a] rounded-xl flex items-center justify-center shrink-0">
                                <Phone className="w-4 h-4 text-white" />
                            </div>
                            <div className="flex-1">
                                <p className="text-sm font-bold text-blue-800">Appel téléphonique</p>
                                <p className="text-xs text-blue-600">{ENTREPRISE.telephone_1}</p>
                            </div>
                            <ChevronRight className="w-4 h-4 text-blue-500" />
                        </a>
                        <a href={`mailto:${ENTREPRISE.email_commercial}`}
                           className="flex items-center gap-3 p-3.5 bg-gray-50 border border-gray-200 rounded-xl hover:bg-gray-100 transition-colors">
                            <div className="w-9 h-9 bg-gray-600 rounded-xl flex items-center justify-center shrink-0">
                                <Mail className="w-4 h-4 text-white" />
                            </div>
                            <div className="flex-1">
                                <p className="text-sm font-bold text-gray-800">E-mail</p>
                                <p className="text-xs text-gray-500">{ENTREPRISE.email_commercial}</p>
                            </div>
                            <ChevronRight className="w-4 h-4 text-gray-400" />
                        </a>
                    </div>
                </div>

            </main>
        </div>
    )
}
