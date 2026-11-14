import type { Metadata } from 'next'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { redirect } from 'next/navigation'
import { formatDate, formatMontant } from '@/lib/utils'
import { Undo2 } from 'lucide-react'
import FormulaireRetour from '@/components/shop/stock/FormulaireRetour'
import ReglerRetour from '@/components/shop/stock/ReglerRetour'
import { aPermission } from '@/lib/auth/permissions-serveur'
import { PERMISSIONS } from '@/lib/constants/permissions'

export const metadata: Metadata = { title: 'Retours' }

const REGLEMENT_LABELS: Record<string, string> = {
    a_traiter:  'À traiter',
    avance:     'Porté en avance',
    avoir:      'Avoir à établir',
    rembourse:  'Remboursé',
    sans_suite: 'Sans suite',
}

export default async function PageRetours() {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user || user.user_metadata?.type_acteur !== 'shop') redirect('/login')

    const peutRetourClient      = aPermission(user, PERMISSIONS.VENTES_RETOUR)
    const peutRetourFournisseur = aPermission(user, PERMISSIONS.STOCK_AJUSTEMENT)
    if (!peutRetourClient && !peutRetourFournisseur) redirect('/admin/dashboard')

    const peutVoirCout = aPermission(user, PERMISSIONS.PRODUITS_COUT_VOIR)
    const shopId       = user.user_metadata.shop_id as string
    const adminClient  = createAdminClient()

    const [
        { data: boutique }, { data: entrepots }, { data: produits },
        { data: clients }, { data: fournisseurs },
        { data: retoursClients }, { data: retoursFournisseurs },
    ] = await Promise.all([
        adminClient.from('shops').select('devise').eq('id', shopId).single(),
        adminClient.from('warehouses')
            .select('id, nom, est_defaut')
            .eq('shop_id', shopId).eq('est_actif', true)
            .order('est_defaut', { ascending: false }),
        adminClient.from('products')
            .select('id, nom, unite, prix_vente, prix_achat')
            .eq('shop_id', shopId).eq('est_actif', true)
            .order('nom'),
        adminClient.from('clients')
            .select('id, nom').eq('shop_id', shopId).eq('est_actif', true)
            .order('nom').limit(500),
        adminClient.from('suppliers')
            .select('id, nom').eq('shop_id', shopId).order('nom'),
        adminClient.from('sale_returns')
            .select(`
                id, public_id, motif, montant, reglement, created_at, client_id, warehouse_id,
                clients(nom), warehouses(nom),
                sale_return_items(quantite, products(nom))
            `)
            .eq('shop_id', shopId).order('created_at', { ascending: false }).limit(15),
        adminClient.from('supplier_returns')
            .select(`
                id, public_id, motif, montant, created_at,
                suppliers(nom),
                supplier_return_items(quantite, designation)
            `)
            .eq('shop_id', shopId).order('created_at', { ascending: false }).limit(15),
    ])

    const devise = boutique?.devise ?? 'XOF'
    const nom = (rel: unknown) =>
        Array.isArray(rel) ? (rel[0] as { nom?: string })?.nom : (rel as { nom?: string })?.nom

    return (
        <div className="flex flex-col min-h-screen">
            <header className="px-4 sm:px-6 lg:px-8 pt-5 pb-4">
                <h1 className="text-2xl sm:text-3xl font-bold text-foreground">Retours</h1>
                <p className="text-sm text-muted-foreground mt-0.5">
                    Marchandise rendue par un client ou renvoyée à un fournisseur
                </p>
            </header>

            <main className="flex-1 px-4 sm:px-6 lg:px-8 pb-8">
                <div className="max-w-4xl mx-auto space-y-5">

                    <FormulaireRetour
                        entrepots={entrepots ?? []}
                        produits={(produits ?? []).map(p => ({
                            ...p,
                            // Le prix d'achat ne part vers le navigateur que
                            // pour les rôles autorisés à voir les coûts.
                            prix_achat: peutVoirCout ? p.prix_achat : null,
                        }))}
                        clients={clients ?? []}
                        fournisseurs={fournisseurs ?? []}
                        devise={devise}
                        peutRetourClient={peutRetourClient}
                        peutRetourFournisseur={peutRetourFournisseur}
                    />

                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">

                        <div className="bg-card border border-border rounded-2xl overflow-hidden">
                            <div className="px-5 py-4 border-b border-border flex items-center gap-2">
                                <Undo2 className="w-4 h-4 text-green-600" />
                                <h2 className="text-sm font-bold text-foreground">Retours clients</h2>
                            </div>
                            {(retoursClients ?? []).length === 0 ? (
                                <p className="px-5 py-10 text-center text-sm text-muted-foreground">
                                    Aucun retour client.
                                </p>
                            ) : (
                                <ul className="divide-y divide-border">
                                    {(retoursClients ?? []).map(r => (
                                        <li key={r.id} className="px-5 py-3.5">
                                            <div className="flex items-start justify-between gap-3">
                                                <div>
                                                    <p className="text-sm font-semibold text-foreground">
                                                        {nom(r.clients) ?? 'Client de passage'}
                                                    </p>
                                                    <p className="text-xs text-muted-foreground mt-0.5">{r.motif}</p>
                                                    <p className="text-xs font-mono text-muted-foreground/80 mt-0.5">
                                                        {r.public_id} · {nom(r.warehouses)} · {formatDate(r.created_at)}
                                                    </p>
                                                </div>
                                                <div className="text-right shrink-0">
                                                    <p className="text-sm font-bold text-foreground">
                                                        {formatMontant(r.montant, devise)}
                                                    </p>
                                                    <span className={`inline-block mt-1 px-2 py-0.5 text-[11px] font-bold rounded-full ${
                                                        r.reglement === 'a_traiter'
                                                            ? 'bg-amber-100 text-amber-700'
                                                            : 'bg-muted text-muted-foreground'
                                                    }`}>
                                                        {REGLEMENT_LABELS[r.reglement] ?? r.reglement}
                                                    </span>
                                                </div>
                                            </div>

                                            {/* La partie stock etait faite, la partie
                                                financiere ne l'etait jamais. */}
                                            {r.reglement === 'a_traiter' && peutRetourClient && (
                                                <ReglerRetour
                                                    retourId={r.id}
                                                    montant={r.montant}
                                                    devise={devise}
                                                    aUnClient={Boolean(r.client_id)}
                                                    warehouseId={r.warehouse_id}
                                                />
                                            )}
                                        </li>
                                    ))}
                                </ul>
                            )}
                        </div>

                        <div className="bg-card border border-border rounded-2xl overflow-hidden">
                            <div className="px-5 py-4 border-b border-border flex items-center gap-2">
                                <Undo2 className="w-4 h-4 text-amber-600" />
                                <h2 className="text-sm font-bold text-foreground">Retours fournisseurs</h2>
                            </div>
                            {(retoursFournisseurs ?? []).length === 0 ? (
                                <p className="px-5 py-10 text-center text-sm text-muted-foreground">
                                    Aucun retour fournisseur.
                                </p>
                            ) : (
                                <ul className="divide-y divide-border">
                                    {(retoursFournisseurs ?? []).map(r => (
                                        <li key={r.id} className="px-5 py-3.5">
                                            <div className="flex items-start justify-between gap-3">
                                                <div>
                                                    <p className="text-sm font-semibold text-foreground">
                                                        {nom(r.suppliers) ?? 'Fournisseur'}
                                                    </p>
                                                    <p className="text-xs text-muted-foreground mt-0.5">{r.motif}</p>
                                                    <p className="text-xs font-mono text-muted-foreground/80 mt-0.5">
                                                        {r.public_id} · {formatDate(r.created_at)}
                                                    </p>
                                                </div>
                                                <p className="text-sm font-bold text-foreground shrink-0">
                                                    {formatMontant(r.montant, devise)}
                                                </p>
                                            </div>
                                        </li>
                                    ))}
                                </ul>
                            )}
                        </div>
                    </div>
                </div>
            </main>
        </div>
    )
}
