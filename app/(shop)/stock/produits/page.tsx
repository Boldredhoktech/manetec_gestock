import type { Metadata } from 'next'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import { Plus } from 'lucide-react'
import EnTetePage from '@/components/shop/EnTetePage'
import { ModaleUrl } from '@/components/ui/ModalesPartagees'
import { classeBouton } from '@/components/ui/classe-bouton'
import TableauProduits from '@/components/shop/TableauProduits'
import FormulaireProduit from '@/components/shop/FormulaireProduit'
import { imagesAutorisees } from '@/lib/produits/image'
import { aPermission } from '@/lib/auth/permissions-serveur'
import { PERMISSIONS } from '@/lib/constants/permissions'

export const metadata: Metadata = { title: 'Produits' }

export default async function PageProduits({ searchParams }: { searchParams: Promise<{ nouveau?: string }> }) {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user || user.user_metadata?.type_acteur !== 'shop') redirect('/login')
    if (!aPermission(user, PERMISSIONS.PRODUITS_VOIR)) redirect('/admin/dashboard')
    const peutCreer = aPermission(user, PERMISSIONS.PRODUITS_CREER)
    const { nouveau } = await searchParams
    const choixFormulaire = peutCreer && nouveau !== undefined ? await chargerChoixProduit(user.user_metadata.shop_id as string) : null

    const shopId      = user.user_metadata.shop_id as string
    const adminClient = createAdminClient()

    const peutVoirCout = aPermission(user, PERMISSIONS.PRODUITS_COUT_VOIR)

    const { data: produits } = await adminClient
        .from('products')
        .select(`
      id, public_id, nom, type_produit, sku, code_barres,
      prix_achat, prix_vente, prix_gros, prix_minimum,
      unite, seuil_alerte, est_actif,
      categories(nom),
      brands(nom),
      stock_levels(quantite, warehouse_id, warehouses(nom))
    `)
        .eq('shop_id', shopId)
        .order('created_at', { ascending: false })

    // Normalisation : categories et brands sont des relations *-to-one, Supabase les retourne en tableau
    const produitsNormalises = (produits ?? []).map(p => ({
        ...p,
        // Le prix d'achat ne quitte même pas le serveur pour un rôle qui
        // n'a pas le droit de voir les coûts.
        prix_achat: peutVoirCout ? p.prix_achat : null,
        categories: Array.isArray(p.categories) ? (p.categories[0] ?? null) : p.categories,
        brands:     Array.isArray(p.brands)      ? (p.brands[0]      ?? null) : p.brands,
        stock_levels: (p.stock_levels ?? []).map((s: any) => ({
            quantite:  s.quantite,
            entrepot:  Array.isArray(s.warehouses)
                ? (s.warehouses[0]?.nom ?? null)
                : (s.warehouses?.nom ?? null),
        })),
    }))

    return (
        <div className="flex flex-col min-h-screen">
            <EnTetePage
                titre="Produits"
                sousTitre={`${produits?.length ?? 0} produit(s) au catalogue`}
                ariane={[{ label: 'Stock' }, { label: 'Produits' }]}
                actions={peutCreer ? (
                    <Link href="/stock/produits?nouveau=1" scroll={false} className={classeBouton('primaire')}>
                        <Plus className="w-4 h-4" aria-hidden="true" />Nouveau produit
                    </Link>
                ) : undefined}
            />
            {peutCreer && (
                <ModaleUrl param="nouveau" titre="Nouveau produit" description="Seuls le nom et le prix de vente sont obligatoires." taille="lg">
                    <FormulaireProduit categories={choixFormulaire?.categories ?? []} marques={choixFormulaire?.marques ?? []}
                                       entrepots={choixFormulaire?.entrepots ?? []} imagesAutorisees={choixFormulaire?.images ?? false} />
                </ModaleUrl>
            )}
            <main className="flex-1 px-4 sm:px-6 lg:px-8 pb-8">
                <TableauProduits produits={produitsNormalises} />
            </main>
        </div>
    )
}
async function chargerChoixProduit(shopId: string) {
    const db = createAdminClient()
    const [{ data: categories }, { data: marques }, { data: entrepots }, images] = await Promise.all([
        db.from('categories').select('id, nom, parent_id').eq('shop_id', shopId).eq('est_actif', true).order('nom'),
        db.from('brands').select('id, nom').eq('shop_id', shopId).eq('est_actif', true).order('nom'),
        db.from('warehouses').select('id, nom, est_defaut').eq('shop_id', shopId).eq('est_actif', true).order('nom'),
        imagesAutorisees(db, shopId),
    ])
    return { categories: categories ?? [], marques: marques ?? [], entrepots: entrepots ?? [], images }
}
