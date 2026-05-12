import type { Metadata } from 'next'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { redirect, notFound } from 'next/navigation'
import Link from 'next/link'
import { ArrowLeft, Edit, Power } from 'lucide-react'
import { Button } from '@/components/ui/button'
import CarteInfosProduit from '@/components/shop/produits/CarteInfosProduit'
import CarteStockProduit from '@/components/shop/produits/CarteStockProduit'
import CartePrixProduit from '@/components/shop/produits/CartePrixProduit'
import CarteVariantesProduit from '@/components/shop/produits/CarteVariantesProduit'
import CarteMouvementsProduit from '@/components/shop/produits/CarteMouvementsProduit'
import CarteHistoriquePrix from '@/components/shop/produits/CarteHistoriquePrix'
import { toggleActivationProduit } from '@/actions/produits'

export const metadata: Metadata = { title: 'Fiche produit' }

interface Props { params: Promise<{ id: string }> }

export default async function PageFicheProduit({ params }: Props) {
    const { id } = await params

    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user || user.user_metadata?.type_acteur !== 'shop') redirect('/login')

    const shopId      = user.user_metadata.shop_id as string
    const adminClient = createAdminClient()

    const { data: produit } = await adminClient
        .from('products')
        .select(`
      *,
      categories(nom),
      brands(nom),
      stock_levels(quantite, warehouses(id, nom, est_defaut)),
      product_variants(*)
    `)
        .eq('id', id)
        .eq('shop_id', shopId)
        .single()

    if (!produit) notFound()

    const { data: mouvementsRaw } = await adminClient
        .from('stock_movements')
        .select(`
      id, public_id, type_mouvement, quantite,
      quantite_avant, quantite_apres, note, created_at,
      warehouses(nom),
      shop_users(nom_complet)
    `)
        .eq('product_id', id)
        .eq('shop_id', shopId)
        .order('created_at', { ascending: false })
        .limit(5)

    const mouvements = (mouvementsRaw ?? []).map(m => ({
        ...m,
        warehouses: Array.isArray(m.warehouses) ? (m.warehouses[0] ?? null) : m.warehouses,
        shop_users: Array.isArray(m.shop_users) ? (m.shop_users[0] ?? null) : m.shop_users,
    }))

    const { data: historiquePrix } = await adminClient
        .from('price_history')
        .select('*')
        .eq('product_id', id)
        .order('created_at', { ascending: false })
        .limit(10)

    const stockTotal = (produit.stock_levels as any[])
        .reduce((acc: number, s: any) => acc + s.quantite, 0)

    return (
        <div className="flex flex-col min-h-screen bg-[#f8fafc]">

            {/* HEADER BLEU ROI */}
            <header style={{ background: 'linear-gradient(135deg, #1a56db 0%, #1648c0 100%)' }}
                    className="px-6 py-5 shadow-lg">
                <div className="flex items-center justify-between">
                    <div className="flex items-center gap-4">
                        <Link href="/stock/produits"
                              className="flex items-center justify-center w-9 h-9 rounded-xl bg-white/20 hover:bg-white/30 transition-colors">
                            <ArrowLeft className="w-5 h-5 text-white" />
                        </Link>
                        <div>
                            <div className="flex items-center gap-3">
                                <h1 className="text-xl font-bold text-white">{produit.nom}</h1>
                                {!produit.est_actif && (
                                    <span className="px-2.5 py-0.5 bg-white/20 text-white text-xs font-bold rounded-full">
                    DÉSACTIVÉ
                  </span>
                                )}
                            </div>
                            <div className="flex items-center gap-3 mt-1">
                                <span className="text-sm font-mono text-white/80">{produit.public_id}</span>
                                <span className="text-white/60">·</span>
                                <span className="text-sm text-white/80 capitalize">{produit.type_produit}</span>
                                {produit.sku && (
                                    <>
                                        <span className="text-white/60">·</span>
                                        <span className="text-sm text-white/80">SKU : {produit.sku}</span>
                                    </>
                                )}
                            </div>
                        </div>
                    </div>

                    <div className="flex items-center gap-2">
                        {/* Badge stock */}
                        <div className={`px-4 py-2 rounded-xl text-sm font-bold ${
                            stockTotal <= 0
                                ? 'bg-red-500 text-white'
                                : stockTotal <= produit.seuil_alerte
                                    ? 'bg-yellow-400 text-yellow-900'
                                    : 'bg-green-500 text-white'
                        }`}>
                            {stockTotal <= 0 ? 'RUPTURE' : `${stockTotal} ${produit.unite}`}
                        </div>
                        <Link href={`/stock/produits/${id}/modifier`}>
                            <Button size="sm" className="bg-white text-[#1a56db] hover:bg-white/90 font-bold">
                                <Edit className="w-4 h-4 mr-1.5" />
                                Modifier
                            </Button>
                        </Link>
                    </div>
                </div>
            </header>

            <main className="flex-1 p-6">
                <div className="max-w-6xl mx-auto grid grid-cols-1 lg:grid-cols-3 gap-5">

                    {/* Colonne gauche */}
                    <div className="lg:col-span-2 space-y-5">
                        <CarteInfosProduit produit={produit} />
                        <CartePrixProduit produit={produit} shopId={shopId} />
                        {(produit.product_variants as any[])?.length > 0 && (
                            <CarteVariantesProduit
                                variantes={produit.product_variants as any[]}
                                productId={id}
                                shopId={shopId}
                            />
                        )}
                        <CarteMouvementsProduit mouvements={mouvements ?? []} />
                    </div>

                    {/* Colonne droite */}
                    <div className="space-y-5">
                        <CarteStockProduit
                            stockLevels={produit.stock_levels as any[]}
                            seuilAlerte={produit.seuil_alerte}
                            unite={produit.unite}
                        />
                        <CarteHistoriquePrix historique={historiquePrix ?? []} />

                        {/* Actions rapides */}
                        <div className="bg-white border border-gray-200 rounded-2xl p-5 shadow-sm space-y-3">
                            <h3 className="text-sm font-bold text-[#1a56db]">Actions</h3>
                            <form action={async () => {
                                'use server'
                                await toggleActivationProduit(id, !produit.est_actif)
                            }}>
                                <button type="submit"
                                        className={`w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl text-sm font-bold transition-all ${
                                            produit.est_actif
                                                ? 'bg-red-50 text-red-600 border border-red-200 hover:bg-red-100'
                                                : 'bg-green-50 text-green-600 border border-green-200 hover:bg-green-100'
                                        }`}>
                                    <Power className="w-4 h-4" />
                                    {produit.est_actif ? 'Désactiver le produit' : 'Réactiver le produit'}
                                </button>
                            </form>
                        </div>
                    </div>

                </div>
            </main>
        </div>
    )
}