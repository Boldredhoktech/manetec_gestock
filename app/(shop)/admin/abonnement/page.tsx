// app/(shop)/admin/abonnement/page.tsx

import type { Metadata } from 'next'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { redirect } from 'next/navigation'
import { ROLES } from '@/lib/constants/permissions'
import { ENTREPRISE } from '@/lib/config/entreprise'
import {
    CheckCircle, Clock, AlertTriangle, Crown,
    Phone, MessageSquare, Mail, ChevronRight,
} from 'lucide-react'
import { formatDate } from '@/lib/utils'

export const metadata: Metadata = { title: 'Mon abonnement' }

const PLAN_CONFIG: Record<string, {
    label:        string
    couleur:      string
    bg:           string
    bgHeader:     string
    icone:        string
    fonctionnalites: string[]
}> = {
    starter: {
        label:    'Starter',
        couleur:  'text-gray-700',
        bg:       'bg-gray-100',
        bgHeader: 'from-gray-600 to-gray-700',
        icone:    '🚀',
        fonctionnalites: ['50 produits', '2 utilisateurs', '100 clients', 'Caisse POS', 'Stock de base', 'Reçus thermiques'],
    },
    pro: {
        label:    'Pro',
        couleur:  'text-blue-700',
        bg:       'bg-blue-100',
        bgHeader: 'from-[#1a56db] to-[#1648c0]',
        icone:    '⭐',
        fonctionnalites: ['500 produits', '10 utilisateurs', '1 000 clients', 'Factures A4 + Devis', 'Multi-entrepôts', 'Rapports avancés', 'Alertes email'],
    },
    enterprise: {
        label:    'Enterprise',
        couleur:  'text-green-700',
        bg:       'bg-green-100',
        bgHeader: 'from-emerald-600 to-emerald-700',
        icone:    '👑',
        fonctionnalites: ['Produits illimités', 'Utilisateurs illimités', 'Clients illimités', 'Tout du plan Pro', 'Emails promotionnels', 'Support prioritaire', 'Formation incluse'],
    },
}

export default async function PageAbonnement() {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user || user.user_metadata?.type_acteur !== 'shop') redirect('/login')
    if (user.user_metadata?.role !== ROLES.SUPER_ADMIN_BOUTIQUE) redirect('/admin/dashboard')

    const adminClient = createAdminClient()
    const { data: boutique } = await adminClient
        .from('shops')
        .select('nom, plan, plan_expire_le, devise, created_at')
        .eq('id', user.user_metadata.shop_id)
        .single()

    const plan          = boutique?.plan ?? 'starter'
    const planConfig    = PLAN_CONFIG[plan] ?? PLAN_CONFIG.starter
    const expiration    = boutique?.plan_expire_le ? new Date(boutique.plan_expire_le) : null
    const joursRestants = expiration
        ? Math.max(0, Math.ceil((expiration.getTime() - Date.now()) / 86400000))
        : null
    const estExpire     = joursRestants !== null && joursRestants === 0
    const alerteExpiration = joursRestants !== null && joursRestants <= 7

    const planSuivant = plan === 'starter' ? 'pro' : plan === 'pro' ? 'enterprise' : null

    return (
        <div className="flex flex-col min-h-screen bg-[#f8fafc]">

            {/* Header */}
            <header
                style={{ background: `linear-gradient(135deg, var(--tw-gradient-stops))` }}
                className={`px-6 py-5 shadow-lg bg-gradient-to-r ${planConfig.bgHeader}`}
            >
                <div className="flex items-center gap-4">
                    <div className="text-4xl">{planConfig.icone}</div>
                    <div>
                        <h1 className="text-xl font-bold text-white">Mon abonnement</h1>
                        <p className="text-sm text-white/70 mt-0.5">{boutique?.nom}</p>
                    </div>
                    <div className="ml-auto">
                        <span className={`px-4 py-1.5 rounded-full text-sm font-black bg-white/20 text-white border border-white/30`}>
                            Plan {planConfig.label}
                        </span>
                    </div>
                </div>
            </header>

            <main className="flex-1 p-4 sm:p-6 max-w-3xl mx-auto w-full space-y-5">

                {/* Alerte expiration */}
                {(estExpire || alerteExpiration) && (
                    <div className={`flex items-start gap-3 p-4 rounded-2xl border-2 ${
                        estExpire
                            ? 'bg-red-50 border-red-300 text-red-700'
                            : 'bg-amber-50 border-amber-300 text-amber-700'
                    }`}>
                        <AlertTriangle className="w-5 h-5 shrink-0 mt-0.5" />
                        <div>
                            <p className="font-bold text-sm">
                                {estExpire
                                    ? 'Votre abonnement a expiré'
                                    : `Votre abonnement expire dans ${joursRestants} jour(s)`
                                }
                            </p>
                            <p className="text-xs mt-1 opacity-80">
                                {estExpire
                                    ? 'Votre boutique est suspendue. Contactez Bold Redhok Tech immédiatement pour régulariser.'
                                    : 'Renouvelez votre abonnement dès maintenant pour éviter toute interruption.'
                                }
                            </p>
                        </div>
                    </div>
                )}

                {/* Carte plan actuel */}
                <div className="bg-white border border-gray-200 rounded-2xl shadow-sm overflow-hidden">
                    <div className={`p-5 bg-gradient-to-r ${planConfig.bgHeader}`}>
                        <div className="flex items-center justify-between">
                            <div>
                                <p className="text-xs text-white/70 uppercase tracking-wider font-bold">
                                    Plan actuel
                                </p>
                                <p className="text-2xl font-black text-white mt-1">
                                    {planConfig.icone} {planConfig.label}
                                </p>
                            </div>
                            <div className="text-right">
                                {expiration && (
                                    <div className={`px-4 py-2 rounded-xl ${
                                        estExpire ? 'bg-red-500/30 border border-red-400/50'
                                            : alerteExpiration ? 'bg-amber-500/30 border border-amber-400/50'
                                                : 'bg-white/15'
                                    }`}>
                                        <p className="text-xs text-white/70">
                                            {estExpire ? 'Expiré le' : 'Expire le'}
                                        </p>
                                        <p className="text-sm font-black text-white">
                                            {formatDate(expiration.toISOString())}
                                        </p>
                                        {!estExpire && joursRestants !== null && (
                                            <p className={`text-xs font-bold mt-0.5 ${
                                                alerteExpiration ? 'text-amber-300' : 'text-white/70'
                                            }`}>
                                                J-{joursRestants}
                                            </p>
                                        )}
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>

                    {/* Fonctionnalités incluses */}
                    <div className="p-5">
                        <p className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-3">
                            Fonctionnalités incluses dans votre plan
                        </p>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                            {planConfig.fonctionnalites.map((f, i) => (
                                <div key={i} className="flex items-center gap-2">
                                    <CheckCircle className="w-4 h-4 text-green-500 shrink-0" />
                                    <span className="text-sm text-gray-700">{f}</span>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>

                {/* Historique / dates */}
                <div className="bg-white border border-gray-200 rounded-2xl p-5 shadow-sm space-y-3">
                    <div className="flex items-center gap-2 mb-1">
                        <Clock className="w-4 h-4 text-[#1a56db]" />
                        <h2 className="text-sm font-bold text-gray-900">Historique</h2>
                    </div>
                    {[
                        {
                            label: 'Boutique créée le',
                            val:   boutique?.created_at ? formatDate(boutique.created_at) : '—',
                        },
                        {
                            label: 'Plan actuel',
                            val:   planConfig.label,
                        },
                        {
                            label: expiration && !estExpire ? 'Prochain renouvellement' : 'Date d\'expiration',
                            val:   expiration ? formatDate(expiration.toISOString()) : '—',
                        },
                    ].map(item => (
                        <div key={item.label} className="flex items-center justify-between py-2 border-b border-gray-50 last:border-0">
                            <span className="text-sm text-gray-500">{item.label}</span>
                            <span className="text-sm font-semibold text-gray-800">{item.val}</span>
                        </div>
                    ))}
                </div>

                {/* Passer au plan supérieur */}
                {planSuivant && (
                    <div className="bg-gradient-to-br from-[#1a56db]/5 to-purple-50 border-2 border-[#1a56db]/20 rounded-2xl p-5 space-y-4">
                        <div className="flex items-center gap-2">
                            <Crown className="w-5 h-5 text-[#f59e0b]" />
                            <h2 className="text-sm font-bold text-gray-900">
                                Passez au plan {PLAN_CONFIG[planSuivant].label}
                            </h2>
                        </div>
                        <p className="text-sm text-gray-600">
                            {planSuivant === 'pro'
                                ? 'Débloquez les factures A4, les devis, les rapports avancés et le multi-entrepôts.'
                                : 'Accédez aux fonctionnalités illimitées et aux emails promotionnels pour vos clients.'
                            }
                        </p>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                            {PLAN_CONFIG[planSuivant].fonctionnalites.map((f, i) => (
                                <div key={i} className="flex items-center gap-2">
                                    <ChevronRight className="w-3.5 h-3.5 text-[#1a56db] shrink-0" />
                                    <span className="text-xs text-gray-600">{f}</span>
                                </div>
                            ))}
                        </div>
                    </div>
                )}

                {/* Contact Bold Redhok Tech */}
                <div className="bg-white border border-gray-200 rounded-2xl p-5 shadow-sm space-y-4">
                    <h2 className="text-sm font-bold text-gray-900">
                        Contacter {ENTREPRISE.nom}
                    </h2>
                    <p className="text-sm text-gray-500">
                        Pour renouveler votre abonnement, changer de plan ou obtenir de l'aide,
                        contactez notre équipe directement.
                    </p>

                    <div className="space-y-2.5">
                        <a
                            href={`https://wa.me/${ENTREPRISE.whatsapp.replace(/\s/g, '')}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="flex items-center gap-3 p-3.5 bg-green-50 border border-green-200 rounded-xl hover:bg-green-100 transition-colors"
                        >
                            <div className="w-9 h-9 bg-green-500 rounded-xl flex items-center justify-center shrink-0">
                                <MessageSquare className="w-4 h-4 text-white" />
                            </div>
                            <div className="flex-1">
                                <p className="text-sm font-bold text-green-800">WhatsApp</p>
                                <p className="text-xs text-green-600">{ENTREPRISE.whatsapp}</p>
                            </div>
                            <ChevronRight className="w-4 h-4 text-green-500" />
                        </a>

                        <a
                            href={`tel:${ENTREPRISE.telephone_1}`}
                            className="flex items-center gap-3 p-3.5 bg-blue-50 border border-blue-200 rounded-xl hover:bg-blue-100 transition-colors"
                        >
                            <div className="w-9 h-9 bg-[#1a56db] rounded-xl flex items-center justify-center shrink-0">
                                <Phone className="w-4 h-4 text-white" />
                            </div>
                            <div className="flex-1">
                                <p className="text-sm font-bold text-blue-800">Appel téléphonique</p>
                                <p className="text-xs text-blue-600">{ENTREPRISE.telephone_1}</p>
                            </div>
                            <ChevronRight className="w-4 h-4 text-blue-500" />
                        </a>

                        <a
                            href={`mailto:${ENTREPRISE.email_commercial}`}
                            className="flex items-center gap-3 p-3.5 bg-gray-50 border border-gray-200 rounded-xl hover:bg-gray-100 transition-colors"
                        >
                            <div className="w-9 h-9 bg-gray-600 rounded-xl flex items-center justify-center shrink-0">
                                <Mail className="w-4 h-4 text-white" />
                            </div>
                            <div className="flex-1">
                                <p className="text-sm font-bold text-gray-800">Email</p>
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