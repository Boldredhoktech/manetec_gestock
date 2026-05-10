import type { Metadata } from 'next'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { redirect, notFound } from 'next/navigation'
import Link from 'next/link'
import { ArrowLeft, Tag, Package, ChevronRight } from 'lucide-react'
import { formatMontant } from '@/lib/utils'

export const metadata: Metadata = { title: 'Détail catégorie' }

interface Props { params: Promise<{ id: string }> }

export default async function PageDetailCategorie({ params }: Props) {
    const { id } = await params

    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user || user.user_metadata?.type_acteur !== 'shop') redirect('/login')

    const shopId      = user.user_metadata.shop_id as string
    const adminClient = createAdminClient()

    const { data: categorie } = await adminClient
        .from('categories')
        .select('id, nom, description')
        .eq('id', id).eq('shop_id', shopId).single()

    if (!categorie) notFound()

    const { data: produits } = await adminClient
        .from('products')
        .select(`
      id, public_id, nom, unite, prix_vente, prix_achat, est_actif,
      stock_levels(quantite)
    `)
        .eq('category_id', id)
        .eq('shop_id', shopId)
        .order('nom')

    const stockTotal  = (produits ?? []).reduce(
        (acc, p) => acc + ((p.stock_levels as any[])?.[0]?.quantite ?? 0), 0
    )
    const valeurStock = (produits ?? []).reduce(
        (acc, p) => acc + ((p.stock_levels as any[])?.[0]?.quantite ?? 0) * p.prix_achat, 0
    )

    return (
        <div className="flex flex-col min-h-screen bg-[#f8fafc]">

            <header
                style={{ background: 'linear-gradient(135deg, #1a56db 0%, #1648c0 100%)' }}
                className="px-6 py-5 shadow-lg"
            >
                <div className="flex items-center gap-4">
                    <Link href="/stock/categories"
                          className="flex items-center justify-center w-9 h-9 rounded-xl bg-white/20 hover:bg-white/30 transition-colors">
                        <ArrowLeft className="w-5 h-5 text-white" />
                    </Link>
                    <div>
                        <div className="flex items-center gap-2">
                            <Tag className="w-5 h-5 text-white/80" />
                            <h1 className="text-xl font-bold text-white">{categorie.nom}</h1>
                        </div>
                        {categorie.description && (
                            <p className="text-sm text-white/60 mt-0.5">{categorie.description}</p>
                        )}
                    </div>
                    <div className="ml-auto hidden sm:flex items-center gap-3">
                        <div className="text-center px-4 py-2 bg-white/15 rounded-xl">
                            <p className="text-xs text-white/70">Produits</p>
                            <p className="text-lg font-black text-white">{produits?.length ?? 0}</p>
                        </div>
                        <div className="text-center px-4 py-2 bg-white/15 rounded-xl">
                            <p className="text-xs text-white/70">Valeur stock</p>
                            <p className="text-lg font-black text-white">{formatMontant(valeurStock)}</p>
                        </div>
                    </div>
                </div>
            </header>

            <main className="flex-1 p-6 max-w-4xl mx-auto w-full">
                <div className="bg-white border border-gray-200 rounded-2xl shadow-sm overflow-hidden">

                    <div className="flex items-center gap-2 p-5 border-b border-gray-100">
                        <Package className="w-5 h-5 text-[#1a56db]" />
                        <h2 className="text-sm font-bold text-gray-900">
                            Articles dans cette catégorie ({produits?.length ?? 0})
                        </h2>
                    </div>

                    {!produits || produits.length === 0 ? (
                        <div className="text-center py-16 text-gray-400">
                            <Package className="w-10 h-10 mx-auto mb-3 opacity-30" />
                            <p className="text-sm">Aucun article dans cette catégorie.</p>
                            <Link href="/stock/produits/nouveau"
                                  className="mt-3 inline-block text-xs text-[#1a56db] font-bold hover:underline">
                                Créer un produit dans cette catégorie →
                            </Link>
                        </div>
                    ) : (
                        <div className="divide-y divide-gray-50">
                            {produits.map(p => {
                                const stock = (p.stock_levels as any[])?.[0]?.quantite ?? 0
                                return (
                                    <Link key={p.id} href={`/stock/produits/${p.id}`}
                                          className="flex items-center gap-4 px-5 py-3.5 hover:bg-[#1a56db]/5 transition-colors group">
                                        <div className="shrink-0 bg-[#1a56db]/10 p-2 rounded-xl group-hover:bg-[#1a56db]/20 transition-colors">
                                            <Package className="w-4 h-4 text-[#1a56db]" />
                                        </div>
                                        <div className="flex-1 min-w-0">
                                            <div className="flex items-center gap-2">
                                                <p className="text-sm font-semibold text-gray-900 group-hover:text-[#1a56db] transition-colors truncate">
                                                    {p.nom}
                                                </p>
                                                {!p.est_actif && (
                                                    <span className="text-xs text-gray-400 bg-gray-100 px-2 py-0.5 rounded-full shrink-0">
                            Désactivé
                          </span>
                                                )}
                                            </div>
                                            <p className="text-xs font-mono text-gray-400 mt-0.5">{p.public_id}</p>
                                        </div>
                                        <div className="text-right shrink-0">
                                            <p className={`text-sm font-bold ${
                                                stock <= 0 ? 'text-red-600' : 'text-gray-700'
                                            }`}>
                                                {stock <= 0 ? 'Rupture' : `${stock} ${p.unite}`}
                                            </p>
                                            <p className="text-xs text-gray-400">{formatMontant(p.prix_vente)}</p>
                                        </div>
                                        <ChevronRight className="w-4 h-4 text-[#1a56db] opacity-0 group-hover:opacity-100 transition-opacity shrink-0" />
                                    </Link>
                                )
                            })}
                        </div>
                    )}
                </div>
            </main>
        </div>
    )
}