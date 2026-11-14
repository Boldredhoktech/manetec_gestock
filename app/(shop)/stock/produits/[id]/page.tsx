import type { Metadata } from 'next'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { redirect, notFound } from 'next/navigation'
import Link from 'next/link'
import { Edit, Power } from 'lucide-react'
import { Button } from '@/components/ui/button'
import CarteInfosProduit from '@/components/shop/produits/CarteInfosProduit'
import CarteStockProduit from '@/components/shop/produits/CarteStockProduit'
import CartePrixProduit from '@/components/shop/produits/CartePrixProduit'
import CarteVariantesProduit from '@/components/shop/produits/CarteVariantesProduit'
import CarteMouvementsProduit from '@/components/shop/produits/CarteMouvementsProduit'
import CarteHistoriquePrix from '@/components/shop/produits/CarteHistoriquePrix'
import { toggleActivationProduit } from '@/actions/produits'
import { aPermission } from '@/lib/auth/permissions-serveur'
import { PERMISSIONS } from '@/lib/constants/permissions'
import EnTetePage from '@/components/shop/EnTetePage'
import { ModaleUrl } from '@/components/ui/ModalesPartagees'
import { classeBouton } from '@/components/ui/classe-bouton'
import FormulaireModifierProduit from '@/components/shop/produits/FormulaireModifierProduit'
import { imagesAutorisees } from '@/lib/produits/image'

export const metadata: Metadata = { title: 'Fiche produit' }

interface Props { params: Promise<{ id: string }>; searchParams: Promise<{ modifier?: string }> }

export default async function PageFicheProduit({ params, searchParams }: Props) {
    const { id } = await params

    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user || user.user_metadata?.type_acteur !== 'shop') redirect('/login')
    if (!aPermission(user, PERMISSIONS.PRODUITS_VOIR)) redirect('/admin/dashboard')

    // Prix d'achat, marge et historique des prix : réservés aux rôles
    // qui ont explicitement le droit de voir les coûts.
    const peutVoirCout = aPermission(user, PERMISSIONS.PRODUITS_COUT_VOIR)

    const shopId      = user.user_metadata.shop_id as string
    const peutModifier = aPermission(user, PERMISSIONS.PRODUITS_MODIFIER)
    const { modifier } = await searchParams
    const choixModif = peutModifier && modifier !== undefined ? await (async () => {
        const db = createAdminClient()
        const [{ data: categories }, { data: marques }, images] = await Promise.all([
            db.from('categories').select('id, nom').eq('shop_id', shopId).eq('est_actif', true).order('nom'),
            db.from('brands').select('id, nom').eq('shop_id', shopId).eq('est_actif', true).order('nom'),
            imagesAutorisees(db, shopId),
        ])
        return { categories: categories ?? [], marques: marques ?? [], images }
    })() : null
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
        <div className="flex flex-col min-h-screen bg-background">

            {/* HEADER BLEU ROI */}
            <EnTetePage
                titre={produit.nom}
                sousTitre={[produit.public_id, produit.type_produit, produit.sku ? `SKU : ${produit.sku}` : null,
                            produit.est_actif ? null : 'désactivé'].filter(Boolean).join(' · ')}
                ariane={[{ label: 'Stock' }, { label: 'Produits', href: '/stock/produits' }, { label: produit.nom }]}
                actions={
                    <>
                        <span className={`self-center px-3 py-1.5 rounded-full text-xs font-bold ${
                            stockTotal <= 0
                                ? 'bg-[var(--rouge-doux)] text-[var(--rouge-texte)]'
                                : stockTotal <= produit.seuil_alerte
                                    ? 'bg-accent text-accent-foreground'
                                    : 'bg-[var(--primary-soft)] text-[var(--primary-strong)]'
                        }`}>
                            {stockTotal <= 0 ? 'Rupture' : `${stockTotal} ${produit.unite} en stock`}
                        </span>
                        {peutModifier && (
                            <Link href={`/stock/produits/${id}?modifier=1`} scroll={false} className={classeBouton('secondaire')}>
                                <Edit className="w-4 h-4" aria-hidden="true" />Modifier
                            </Link>
                        )}
                    </>
                }
            />
            {peutModifier && modifier !== undefined && (
                <ModaleUrl param="modifier" titre="Modifier le produit" description={`${produit.nom} · ${produit.public_id}`} taille="lg">
                    <FormulaireModifierProduit produit={produit} categories={choixModif?.categories ?? []}
                                               marques={choixModif?.marques ?? []} imagesAutorisees={choixModif?.images ?? false} />
                </ModaleUrl>
            )}

            <main className="flex-1 px-4 sm:px-6 lg:px-8 pb-8">
                <div className="max-w-6xl mx-auto grid grid-cols-1 lg:grid-cols-3 gap-5">

                    {/* Colonne gauche */}
                    <div className="lg:col-span-2 space-y-5">
                        <CarteInfosProduit produit={produit} />
                        <CartePrixProduit produit={produit} shopId={shopId} peutVoirCout={peutVoirCout} />
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
                        {peutVoirCout && (
                            <CarteHistoriquePrix historique={historiquePrix ?? []} />
                        )}

                        {/* Actions rapides */}
                        <div className="bg-card border border-border rounded-2xl p-5 shadow-sm space-y-3">
                            <h3 className="text-sm font-bold text-[var(--primary-strong)]">Actions</h3>
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