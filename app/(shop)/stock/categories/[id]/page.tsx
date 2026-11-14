import type { Metadata } from 'next'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { redirect, notFound } from 'next/navigation'
import Link from 'next/link'
import { ArrowLeft, Tag, Package, ChevronRight } from 'lucide-react'
import { formatMontant } from '@/lib/utils'
import { aPermission } from '@/lib/auth/permissions-serveur'
import { PERMISSIONS } from '@/lib/constants/permissions'

export const metadata: Metadata = { title: 'Détail catégorie' }

interface Props { params: Promise<{ id: string }> }

export default async function PageDetailCategorie({ params }: Props) {
    const { id } = await params

    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user || user.user_metadata?.type_acteur !== 'shop') redirect('/login')
    if (!aPermission(user, PERMISSIONS.PRODUITS_VOIR)) redirect('/admin/dashboard')

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
        <div className="flex flex-col min-h-screen">

            <header className="px-4 sm:px-6 lg:px-8 pt-5 pb-4">
                <div className="flex items-center gap-4">
                    <Link href="/stock/categories"
                          className="flex items-center justify-center w-9 h-9 rounded-xl bg-muted hover:bg-border transition-colors">
                        <ArrowLeft className="w-5 h-5 text-foreground" />
                    </Link>
                    <div>
                        <div className="flex items-center gap-2">
                            <Tag className="w-5 h-5 text-muted-foreground" />
                            <h1 className="text-2xl sm:text-3xl font-bold text-foreground">{categorie.nom}</h1>
                        </div>
                        {categorie.description && (
                            <p className="text-sm text-muted-foreground mt-0.5">{categorie.description}</p>
                        )}
                    </div>
                    <div className="ml-auto hidden sm:flex items-center gap-3">
                        <div className="text-center px-4 py-2 bg-muted rounded-xl">
                            <p className="text-xs text-muted-foreground">Produits</p>
                            <p className="text-lg font-black text-foreground">{produits?.length ?? 0}</p>
                        </div>
                        <div className="text-center px-4 py-2 bg-muted rounded-xl">
                            <p className="text-xs text-muted-foreground">Valeur stock</p>
                            <p className="text-lg font-black text-foreground">{formatMontant(valeurStock)}</p>
                        </div>
                    </div>
                </div>
            </header>

            <main className="flex-1 px-4 sm:px-6 lg:px-8 pb-8 max-w-5xl w-full">
                <div className="bg-card border border-border rounded-2xl shadow-sm overflow-hidden">

                    <div className="flex items-center gap-2 p-5 border-b border-border">
                        <Package className="w-5 h-5 text-[var(--primary-strong)]" />
                        <h2 className="text-sm font-bold text-foreground">
                            Articles dans cette catégorie ({produits?.length ?? 0})
                        </h2>
                    </div>

                    {!produits || produits.length === 0 ? (
                        <div className="text-center py-16 text-muted-foreground/80">
                            <Package className="w-10 h-10 mx-auto mb-3 opacity-30" />
                            <p className="text-sm">Aucun article dans cette catégorie.</p>
                            <Link href="/stock/produits/nouveau"
                                  className="mt-3 inline-block text-xs text-[var(--primary-strong)] font-bold hover:underline">
                                Créer un produit dans cette catégorie →
                            </Link>
                        </div>
                    ) : (
                        <div className="divide-y divide-gray-50">
                            {produits.map(p => {
                                const stock = (p.stock_levels as any[])?.[0]?.quantite ?? 0
                                return (
                                    <Link key={p.id} href={`/stock/produits/${p.id}`}
                                          className="flex items-center gap-4 px-5 py-3.5 hover:bg-[var(--primary-soft)] transition-colors group">
                                        <div className="shrink-0 bg-[var(--primary-soft)] p-2 rounded-xl group-hover:bg-[var(--primary-soft)] transition-colors">
                                            <Package className="w-4 h-4 text-[var(--primary-strong)]" />
                                        </div>
                                        <div className="flex-1 min-w-0">
                                            <div className="flex items-center gap-2">
                                                <p className="text-sm font-semibold text-foreground group-hover:text-primary transition-colors truncate">
                                                    {p.nom}
                                                </p>
                                                {!p.est_actif && (
                                                    <span className="text-xs text-muted-foreground/80 bg-muted px-2 py-0.5 rounded-full shrink-0">
                            Désactivé
                          </span>
                                                )}
                                            </div>
                                            <p className="text-xs font-mono text-muted-foreground/80 mt-0.5">{p.public_id}</p>
                                        </div>
                                        <div className="text-right shrink-0">
                                            <p className={`text-sm font-bold ${
                                                stock <= 0 ? 'text-red-600' : 'text-foreground'
                                            }`}>
                                                {stock <= 0 ? 'Rupture' : `${stock} ${p.unite}`}
                                            </p>
                                            <p className="text-xs text-muted-foreground/80">{formatMontant(p.prix_vente)}</p>
                                        </div>
                                        <ChevronRight className="w-4 h-4 text-[var(--primary-strong)] opacity-0 group-hover:opacity-100 transition-opacity shrink-0" />
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