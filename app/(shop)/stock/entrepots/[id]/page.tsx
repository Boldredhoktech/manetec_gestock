//app/(shop)/stock/entrepots/[id]/page.tsx

import type { Metadata } from 'next'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { redirect, notFound } from 'next/navigation'
import Link from 'next/link'
import { ArrowLeft, Star } from 'lucide-react'
import CarteInfosEntrepot from '@/components/shop/entrepots/CarteInfosEntrepot'
import CarteStockEntrepot from '@/components/shop/entrepots/CarteStockEntrepot'
import CarteDerniersMovements from '@/components/shop/entrepots/CarteDerniersMovements'

export const metadata: Metadata = { title: 'Fiche entrepôt' }

interface Props { params: Promise<{ id: string }> }

export default async function PageFicheEntrepot({ params }: Props) {
    const { id } = await params

    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user || user.user_metadata?.type_acteur !== 'shop') redirect('/login')

    const shopId      = user.user_metadata.shop_id as string
    const adminClient = createAdminClient()

    const { data: entrepot } = await adminClient
        .from('warehouses')
        .select('*')
        .eq('id', id)
        .eq('shop_id', shopId)
        .single()

    if (!entrepot) notFound()

    // Produits avec stock dans cet entrepôt
    const { data: stockLevelsRaw } = await adminClient
        .from('stock_levels')
        .select(`
      quantite,
      products(
        id, public_id, nom, unite, sku,
        prix_achat, prix_vente, seuil_alerte,
        est_actif, type_produit,
        categories(nom)
      )
    `)
        .eq('warehouse_id', id)
        .eq('shop_id', shopId)
        .order('quantite', { ascending: true })

    // Normalisation : Supabase retourne les relations (products, categories) comme
    // des tableaux lors des joins, mais les composants attendent des objets uniques ou null.
    const stockLevels = (stockLevelsRaw ?? []).map(s => {
        const prod = Array.isArray(s.products) ? (s.products[0] ?? null) : s.products
        return {
            ...s,
            products: prod
                ? {
                    ...prod,
                    categories: Array.isArray(prod.categories)
                        ? (prod.categories[0] ?? null)
                        : prod.categories,
                }
                : null,
        }
    })

    // 10 derniers mouvements de cet entrepôt
    const { data: mouvementsRaw } = await adminClient
        .from('stock_movements')
        .select(`
      id, public_id, type_mouvement, quantite,
      quantite_avant, quantite_apres, created_at,
      products(nom, unite),
      shop_users(nom_complet)
    `)
        .eq('warehouse_id', id)
        .eq('shop_id', shopId)
        .order('created_at', { ascending: false })
        .limit(10)

    const mouvements = (mouvementsRaw ?? []).map(m => ({
        ...m,
        products:   Array.isArray(m.products)   ? (m.products[0]   ?? null) : m.products,
        shop_users: Array.isArray(m.shop_users) ? (m.shop_users[0] ?? null) : m.shop_users,
    }))

    // Calculs
    const produitsActifs  = stockLevels.filter(s => s.products?.est_actif)
    const totalProduits   = produitsActifs.length
    const enAlerte        = produitsActifs.filter(s =>
        s.quantite <= (s.products?.seuil_alerte ?? 0)
    ).length
    const enRupture       = produitsActifs.filter(s => s.quantite <= 0).length
    const valeurStock     = produitsActifs.reduce((acc, s) =>
        acc + s.quantite * (s.products?.prix_achat ?? 0), 0
    )

    return (
        <div className="flex flex-col min-h-screen bg-[#f8fafc]">

            {/* HEADER BLEU ROI */}
            <header
                style={{ background: 'linear-gradient(135deg, #1a56db 0%, #1648c0 100%)' }}
                className="px-6 py-5 shadow-lg"
            >
                <div className="flex items-center justify-between">
                    <div className="flex items-center gap-4">
                        <Link href="/stock/entrepots"
                              className="flex items-center justify-center w-9 h-9 rounded-xl bg-white/20 hover:bg-white/30 transition-colors">
                            <ArrowLeft className="w-5 h-5 text-white" />
                        </Link>
                        <div>
                            <div className="flex items-center gap-3">
                                <h1 className="text-xl font-bold text-white">{entrepot.nom}</h1>
                                {entrepot.est_defaut && (
                                    <span className="flex items-center gap-1 px-2.5 py-0.5 bg-yellow-400 text-yellow-900 text-xs font-bold rounded-full">
                    <Star className="w-3 h-3" />
                    Défaut
                  </span>
                                )}
                                {!entrepot.est_actif && (
                                    <span className="px-2.5 py-0.5 bg-white/20 text-white text-xs font-bold rounded-full">
                    INACTIF
                  </span>
                                )}
                            </div>
                            <p className="text-sm font-mono text-white/70 mt-0.5">{entrepot.public_id}</p>
                        </div>
                    </div>

                    {/* Stats rapides dans le header */}
                    <div className="hidden sm:flex items-center gap-3">
                        <div className="text-center px-4 py-2 bg-white/15 rounded-xl">
                            <p className="text-xs text-white/70">Produits</p>
                            <p className="text-lg font-black text-white">{totalProduits}</p>
                        </div>
                        {enAlerte > 0 && (
                            <div className="text-center px-4 py-2 bg-yellow-400/30 rounded-xl border border-yellow-400/50">
                                <p className="text-xs text-yellow-200">En alerte</p>
                                <p className="text-lg font-black text-yellow-300">{enAlerte}</p>
                            </div>
                        )}
                        {enRupture > 0 && (
                            <div className="text-center px-4 py-2 bg-red-500/30 rounded-xl border border-red-400/50">
                                <p className="text-xs text-red-200">Rupture</p>
                                <p className="text-lg font-black text-red-300">{enRupture}</p>
                            </div>
                        )}
                    </div>
                </div>
            </header>

            <main className="flex-1 p-6">
                <div className="max-w-6xl mx-auto grid grid-cols-1 lg:grid-cols-3 gap-5">

                    {/* Colonne gauche — large */}
                    <div className="lg:col-span-2 space-y-5">
                        <CarteStockEntrepot
                            stockLevels={stockLevels}
                            valeurStock={valeurStock}
                        />
                        <CarteDerniersMovements mouvements={mouvements ?? []} />
                    </div>

                    {/* Colonne droite */}
                    <div className="space-y-5">
                        <CarteInfosEntrepot
                            entrepot={entrepot}
                            totalProduits={totalProduits}
                            enAlerte={enAlerte}
                            enRupture={enRupture}
                            valeurStock={valeurStock}
                            shopId={shopId}
                        />
                    </div>

                </div>
            </main>
        </div>
    )
}