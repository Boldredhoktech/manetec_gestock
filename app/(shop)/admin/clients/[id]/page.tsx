import type { Metadata } from 'next'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { redirect, notFound } from 'next/navigation'
import Link from 'next/link'
import {
    ArrowLeft, UserSquare, Phone, Mail, MapPin,
    Globe, FileText, CreditCard, ShoppingCart,
    Plus, RotateCcw, Building2,
} from 'lucide-react'
import CarteSoldesClient from '@/components/shop/CarteSoldesClient'
import CarteHistoriqueClient from '@/components/shop/CarteHistoriqueClient'
import CarteVentesClient from '@/components/shop/clients/CarteVentesClient'
import CarteActionsClient from '@/components/shop/clients/CarteActionsClient'

export const metadata: Metadata = { title: 'Fiche client' }

interface Props { params: Promise<{ id: string }> }

export default async function PageDetailClient({ params }: Props) {
    const { id } = await params

    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user || user.user_metadata?.type_acteur !== 'shop') redirect('/login')

    const shopId      = user.user_metadata.shop_id as string
    const adminClient = createAdminClient()

    const { data: client } = await adminClient
        .from('clients')
        .select('*')
        .eq('id', id)
        .eq('shop_id', shopId)
        .single()

    if (!client) notFound()

    // 10 dernières ventes du client
    const { data: ventes } = await adminClient
        .from('sales')
        .select(`
      id, public_id, statut, montant_total, created_at,
      sale_items(id),
      sale_payments(moyen_paiement, montant)
    `)
        .eq('client_id', id)
        .eq('shop_id', shopId)
        .eq('statut', 'completee')
        .order('created_at', { ascending: false })
        .limit(10)

    // Historique opérations soldes
    const { data: operations } = await adminClient
        .from('client_balance_operations')
        .select('*')
        .eq('client_id', id)
        .order('created_at', { ascending: false })
        .limit(20)

    // Stats agrégées
    const { data: statsVentes } = await adminClient
        .from('sales')
        .select('montant_total')
        .eq('client_id', id)
        .eq('shop_id', shopId)
        .eq('statut', 'completee')

    const totalAchats = statsVentes?.length ?? 0
    const caTotal     = statsVentes?.reduce((a, v) => a + v.montant_total, 0) ?? 0

    // Boutique pour la devise
    const { data: boutique } = await adminClient
        .from('shops').select('devise, remise_max_pct').eq('id', shopId).single()

    return (
        <div className="flex flex-col min-h-screen bg-[#f8fafc]">

            {/* HEADER BLEU ROI */}
            <header
                style={{ background: 'linear-gradient(135deg, #1a56db 0%, #1648c0 100%)' }}
                className="px-6 py-5 shadow-lg"
            >
                <div className="flex items-center justify-between">
                    <div className="flex items-center gap-4">
                        <Link href="/admin/clients"
                              className="flex items-center justify-center w-9 h-9 rounded-xl bg-white/20 hover:bg-white/30 transition-colors">
                            <ArrowLeft className="w-5 h-5 text-white" />
                        </Link>
                        <div>
                            <div className="flex items-center gap-3">
                                <h1 className="text-xl font-bold text-white">{client.nom}</h1>
                                {!client.est_actif && (
                                    <span className="px-2.5 py-0.5 bg-white/20 text-white text-xs font-bold rounded-full">
                    DÉSACTIVÉ
                  </span>
                                )}
                            </div>
                            <p className="text-sm font-mono text-white/70 mt-0.5">{client.public_id}</p>
                        </div>
                    </div>

                    {/* Stats rapides dans le header */}
                    <div className="hidden sm:flex items-center gap-3">
                        <div className="text-center px-4 py-2 bg-white/15 rounded-xl">
                            <p className="text-xs text-white/70">Achats</p>
                            <p className="text-lg font-black text-white">{totalAchats}</p>
                        </div>
                        <div className="text-center px-4 py-2 bg-white/15 rounded-xl">
                            <p className="text-xs text-white/70">CA total</p>
                            <p className="text-lg font-black text-white">
                                {new Intl.NumberFormat('fr-FR').format(caTotal)} {boutique?.devise}
                            </p>
                        </div>
                        {client.credit_balance > 0 && (
                            <div className="text-center px-4 py-2 bg-red-500/30 rounded-xl border border-red-400/50">
                                <p className="text-xs text-red-200">Crédit dû</p>
                                <p className="text-lg font-black text-red-300">
                                    {new Intl.NumberFormat('fr-FR').format(client.credit_balance)}
                                </p>
                            </div>
                        )}
                    </div>
                </div>
            </header>

            <main className="flex-1 p-4 sm:p-6">
                <div className="max-w-6xl mx-auto grid grid-cols-1 lg:grid-cols-3 gap-5">

                    {/* Colonne gauche */}
                    <div className="lg:col-span-2 space-y-5">
                        <CarteProfilClient client={client} devise={boutique?.devise ?? 'FCFA'} />
                        <CarteSoldesClient client={client} />
                        <CarteVentesClient ventes={ventes ?? []} devise={boutique?.devise ?? 'FCFA'} />
                        <CarteHistoriqueClient operations={operations ?? []} />
                    </div>

                    {/* Colonne droite */}
                    <div className="space-y-5">
                        <CarteActionsClient
                            clientId={id}
                            clientNom={client.nom}
                            estActif={client.est_actif}
                        />
                    </div>

                </div>
            </main>
        </div>
    )
}

// ── Composant profil inline (Server Component) ────────────────
function CarteProfilClient({
                               client,
                               devise,
                           }: {
    client: any
    devise: string
}) {
    const infos = [
        client.telephone && { icone: Phone,    val: client.telephone,  label: 'Téléphone' },
        client.email     && { icone: Mail,     val: client.email,      label: 'Email'     },
        client.ville     && { icone: MapPin,   val: [client.ville, client.pays].filter(Boolean).join(', '), label: 'Localisation' },
        client.adresse   && { icone: MapPin,   val: client.adresse,    label: 'Adresse'   },
        client.site_web  && { icone: Globe,    val: client.site_web,   label: 'Site web'  },
        client.ifu       && { icone: Building2, val: `IFU : ${client.ifu}`, label: 'IFU'  },
        client.rccm      && { icone: FileText, val: `RCCM : ${client.rccm}`, label: 'RCCM' },
    ].filter(Boolean) as { icone: any; val: string; label: string }[]

    return (
        <div className="bg-white border border-gray-200 rounded-2xl p-5 shadow-sm space-y-4">

            <div className="flex items-center gap-2 pb-3 border-b border-gray-100">
                <div className="bg-[#1a56db]/10 p-2 rounded-lg">
                    <UserSquare className="w-5 h-5 text-[#1a56db]" />
                </div>
                <h2 className="text-sm font-bold text-gray-900">Profil client</h2>
                <Link href={`/admin/clients/${client.id}/modifier`}
                      className="ml-auto text-xs text-[#1a56db] font-bold hover:underline">
                    Modifier
                </Link>
            </div>

            {infos.length === 0 ? (
                <p className="text-sm text-gray-400 italic">
                    Aucune information de contact renseignée.
                </p>
            ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    {infos.map((info, i) => {
                        const Icone = info.icone
                        return (
                            <div key={i} className="flex items-center gap-2.5 p-3 bg-gray-50 rounded-xl">
                                <Icone className="w-4 h-4 text-[#1a56db] shrink-0" />
                                <div className="min-w-0">
                                    <p className="text-xs text-gray-400">{info.label}</p>
                                    <p className="text-sm font-medium text-gray-800 truncate">{info.val}</p>
                                </div>
                            </div>
                        )
                    })}
                </div>
            )}

            {client.notes && (
                <div className="p-3 bg-amber-50 border border-amber-200 rounded-xl">
                    <p className="text-xs font-bold text-amber-600 mb-1">Note interne</p>
                    <p className="text-sm text-amber-800">{client.notes}</p>
                </div>
            )}
        </div>
    )
}