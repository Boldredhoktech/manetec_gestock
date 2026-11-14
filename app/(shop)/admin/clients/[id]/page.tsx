import type { Metadata } from 'next'
import { createClient } from '@/lib/supabase/server'
import { aPermission } from '@/lib/auth/permissions-serveur'
import { PERMISSIONS } from '@/lib/constants/permissions'
import { createAdminClient } from '@/lib/supabase/admin'
import { redirect, notFound } from 'next/navigation'
import Link from 'next/link'
import {
    UserSquare, Phone, Mail, MapPin,
    Globe, FileText,
    Building2, Pencil,
} from 'lucide-react'
import EnTetePage from '@/components/shop/EnTetePage'
import FormulaireModifierClient from '@/components/shop/clients/FormulaireModifierClient'
import { ModaleUrl } from '@/components/ui/ModalesPartagees'
import { classeBouton } from '@/components/ui/classe-bouton'
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
    if (!aPermission(user, PERMISSIONS.CLIENTS_ACCES_COMPLET)) redirect('/admin/clients')

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
        <div className="flex flex-col min-h-screen">

            <EnTetePage
                titre={client.nom}
                sousTitre={`${client.public_id}${client.est_actif ? '' : ' · désactivé'}`}
                ariane={[{ label: 'Ventes' }, { label: 'Clients', href: '/admin/clients' }, { label: client.nom }]}
                actions={
                    <Link href={`/admin/clients/${id}?modifier=1`} scroll={false} className={classeBouton('secondaire')}>
                        <Pencil className="w-4 h-4" aria-hidden="true" />Modifier
                    </Link>
                }
            />
            <ModaleUrl param="modifier" titre="Modifier le client" description={client.nom} taille="lg">
                <FormulaireModifierClient client={client} />
            </ModaleUrl>

            <section aria-label="Chiffres du client" className="px-4 sm:px-6 lg:px-8 pb-4 grid grid-cols-2 lg:grid-cols-3 gap-3">
                <div className="rounded-2xl p-4 bg-card border border-border">
                    <p className="text-xs font-bold uppercase tracking-wide text-muted-foreground">Achats</p>
                    <p className="titre-design text-xl font-bold tabular-nums mt-1">{totalAchats}</p>
                </div>
                <div className="rounded-2xl p-4 bg-card border border-border">
                    <p className="text-xs font-bold uppercase tracking-wide text-muted-foreground">CA total</p>
                    <p className="titre-design text-xl font-bold tabular-nums mt-1">
                        {new Intl.NumberFormat('fr-FR').format(caTotal)} {boutique?.devise}
                    </p>
                </div>
                <div className={`col-span-2 lg:col-span-1 rounded-2xl p-4 border ${client.credit_balance > 0 ? 'bg-[var(--rouge-doux)] border-[var(--rouge-texte)]/30' : 'bg-card border-border'}`}>
                    <p className={`text-xs font-bold uppercase tracking-wide ${client.credit_balance > 0 ? 'text-[var(--rouge-texte)]' : 'text-muted-foreground'}`}>Me doit</p>
                    <p className={`titre-design text-xl font-bold tabular-nums mt-1 ${client.credit_balance > 0 ? 'text-[var(--rouge-texte)]' : ''}`}>
                        {new Intl.NumberFormat('fr-FR').format(client.credit_balance)} {boutique?.devise}
                    </p>
                </div>
            </section>

            <main className="flex-1 px-4 sm:px-6 lg:px-8 pb-8">
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">

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
        <div className="bg-card border border-border rounded-2xl p-5 shadow-sm space-y-4">

            <div className="flex items-center gap-2 pb-3 border-b border-border">
                <div className="bg-[var(--primary-soft)] p-2 rounded-lg">
                    <UserSquare className="w-5 h-5 text-[var(--primary-strong)]" />
                </div>
                <h2 className="text-sm font-bold text-foreground">Profil client</h2>
                <Link href={`/admin/clients/${client.id}?modifier=1`} scroll={false}
                      className="ml-auto text-xs text-[var(--primary-strong)] font-bold hover:underline">
                    Modifier
                </Link>
            </div>

            {infos.length === 0 ? (
                <p className="text-sm text-muted-foreground/80 italic">
                    Aucune information de contact renseignée.
                </p>
            ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    {infos.map((info, i) => {
                        const Icone = info.icone
                        return (
                            <div key={i} className="flex items-center gap-2.5 p-3 bg-[var(--surface2)] rounded-xl">
                                <Icone className="w-4 h-4 text-[var(--primary-strong)] shrink-0" />
                                <div className="min-w-0">
                                    <p className="text-xs text-muted-foreground/80">{info.label}</p>
                                    <p className="text-sm font-medium text-foreground truncate">{info.val}</p>
                                </div>
                            </div>
                        )
                    })}
                </div>
            )}

            {client.notes && (
                <div className="p-3 bg-accent border border-[#FACC15]/40 rounded-xl">
                    <p className="text-xs font-bold text-accent-foreground mb-1">Note interne</p>
                    <p className="text-sm text-accent-foreground">{client.notes}</p>
                </div>
            )}
        </div>
    )
}