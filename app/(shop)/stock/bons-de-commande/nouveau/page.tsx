import type { Metadata } from 'next'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import { ArrowLeft, Truck, ChevronRight } from 'lucide-react'
import FormulaireBonCommande from '@/components/shop/fournisseurs/FormulaireBonCommande'
import { aPermission } from '@/lib/auth/permissions-serveur'
import { PERMISSIONS } from '@/lib/constants/permissions'

export const metadata: Metadata = { title: 'Nouveau bon de commande' }

interface Props {
    searchParams: Promise<{ fournisseur?: string }>
}

export default async function PageNouveauBonCommande({ searchParams }: Props) {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user || user.user_metadata?.type_acteur !== 'shop') redirect('/login')
    if (!aPermission(user, PERMISSIONS.BONS_COMMANDE_CREER)) redirect('/admin/dashboard')

    const { fournisseur: supplierId } = await searchParams
    const shopId      = user.user_metadata.shop_id as string
    const adminClient = createAdminClient()

    // Sans fournisseur choisi, on commence par le demander : un bon de
    // commande s'adresse toujours à quelqu'un.
    if (!supplierId) {
        const { data: fournisseurs } = await adminClient
            .from('suppliers')
            .select('id, nom, telephone')
            .eq('shop_id', shopId).eq('est_actif', true)
            .order('nom')

        return (
            <div className="flex flex-col min-h-screen">
                <header className="border-b border-border bg-card px-4 sm:px-6 py-4">
                    <div className="flex items-center gap-3">
                        <Link href="/stock/bons-de-commande" className="text-muted-foreground hover:text-foreground">
                            <ArrowLeft className="w-5 h-5" />
                        </Link>
                        <div>
                            <h1 className="text-xl font-bold text-foreground">Nouveau bon de commande</h1>
                            <p className="text-sm text-muted-foreground mt-0.5">Chez quel fournisseur ?</p>
                        </div>
                    </div>
                </header>

                <main className="flex-1 p-4 sm:p-6">
                    <div className="max-w-2xl mx-auto">
                        {(fournisseurs ?? []).length === 0 ? (
                            <div className="bg-white border border-gray-200 rounded-2xl px-6 py-12 text-center">
                                <Truck className="w-9 h-9 text-gray-300 mx-auto mb-3" />
                                <p className="text-sm font-bold text-gray-700">Aucun fournisseur actif</p>
                                <Link href="/stock/fournisseurs/nouveau" className="text-xs font-bold text-[#15335a] underline mt-2 inline-block">
                                    Créer un fournisseur
                                </Link>
                            </div>
                        ) : (
                            <div className="bg-white border border-gray-200 rounded-2xl overflow-hidden divide-y divide-gray-100">
                                {(fournisseurs ?? []).map(f => (
                                    <Link key={f.id}
                                          href={`/stock/bons-de-commande/nouveau?fournisseur=${f.id}`}
                                          className="flex items-center justify-between gap-3 px-5 py-4 hover:bg-[#15335a]/5 transition-colors group">
                                        <div>
                                            <p className="text-sm font-bold text-gray-900 group-hover:text-[#15335a]">{f.nom}</p>
                                            {f.telephone && <p className="text-xs text-gray-400 mt-0.5">{f.telephone}</p>}
                                        </div>
                                        <ChevronRight className="w-4 h-4 text-gray-300 group-hover:text-[#15335a]" />
                                    </Link>
                                ))}
                            </div>
                        )}
                    </div>
                </main>
            </div>
        )
    }

    const [{ data: fournisseur }, { data: produits }, { data: entrepots }] = await Promise.all([
        adminClient.from('suppliers').select('id, nom')
            .eq('id', supplierId).eq('shop_id', shopId).single(),
        adminClient.from('products').select('id, nom, public_id, prix_achat, unite')
            .eq('shop_id', shopId).eq('est_actif', true).order('nom'),
        adminClient.from('warehouses').select('id, nom')
            .eq('shop_id', shopId).eq('est_actif', true)
            .order('est_defaut', { ascending: false }),
    ])

    if (!fournisseur) redirect('/stock/bons-de-commande/nouveau')

    return (
        <div className="flex flex-col min-h-screen">
            <header className="border-b border-border bg-card px-4 sm:px-6 py-4">
                <div className="flex items-center gap-3">
                    <Link href="/stock/bons-de-commande/nouveau" className="text-muted-foreground hover:text-foreground">
                        <ArrowLeft className="w-5 h-5" />
                    </Link>
                    <div>
                        <h1 className="text-xl font-bold text-foreground">Nouveau bon de commande</h1>
                        <p className="text-sm text-muted-foreground mt-0.5">{fournisseur.nom}</p>
                    </div>
                </div>
            </header>

            <main className="flex-1 p-4 sm:p-6">
                <div className="max-w-3xl mx-auto">
                    <FormulaireBonCommande
                        supplierId={fournisseur.id}
                        fournisseurNom={fournisseur.nom}
                        produits={produits ?? []}
                        entrepots={entrepots ?? []}
                    />
                </div>
            </main>
        </div>
    )
}
