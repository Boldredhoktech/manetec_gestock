import type { Metadata } from 'next'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import { formatDate, formatMontant } from '@/lib/utils'
import { ArrowDown, ArrowUp, ArrowLeftRight, Scale } from 'lucide-react'
import FiltresMouvements from '@/components/shop/stock/FiltresMouvements'
import { aPermission } from '@/lib/auth/permissions-serveur'
import { PERMISSIONS } from '@/lib/constants/permissions'

export const metadata: Metadata = { title: 'Mouvements de stock' }

// Chaque type porte son sens : c'est ce qui permet de totaliser
// entrées et sorties sans oublier personne — l'ancien écran laissait
// le type « inventaire » hors de tout total.
const TYPE_CONFIG: Record<string, {
    label: string; icone: React.ElementType; couleur: string; sens: 'entree' | 'sortie' | 'neutre'
}> = {
    entree_initiale:    { label: 'Entrée initiale',    icone: ArrowDown,      couleur: 'text-green-600',   sens: 'entree' },
    reception:          { label: 'Réception',          icone: ArrowDown,      couleur: 'text-green-600',   sens: 'entree' },
    retour_vente:       { label: 'Retour client',      icone: ArrowDown,      couleur: 'text-blue-600',    sens: 'entree' },
    transfert_entree:   { label: 'Transfert entrant',  icone: ArrowLeftRight, couleur: 'text-purple-600',  sens: 'entree' },
    ajustement_positif: { label: 'Ajustement +',       icone: ArrowDown,      couleur: 'text-green-600',   sens: 'entree' },
    vente:              { label: 'Vente',              icone: ArrowUp,        couleur: 'text-destructive', sens: 'sortie' },
    retour_fournisseur: { label: 'Retour fournisseur', icone: ArrowUp,        couleur: 'text-amber-600',   sens: 'sortie' },
    transfert_sortie:   { label: 'Transfert sortant',  icone: ArrowLeftRight, couleur: 'text-purple-600',  sens: 'sortie' },
    ajustement_negatif: { label: 'Ajustement −',       icone: ArrowUp,        couleur: 'text-destructive', sens: 'sortie' },
    inventaire:         { label: 'Écart d\'inventaire', icone: Scale,         couleur: 'text-[#15335a]',   sens: 'neutre' },
}

const PAR_PAGE = 50

interface Props {
    searchParams: Promise<{
        type?: string; produit?: string; entrepot?: string
        debut?: string; fin?: string; page?: string
    }>
}

export default async function PageMouvements({ searchParams }: Props) {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user || user.user_metadata?.type_acteur !== 'shop') redirect('/login')
    if (!aPermission(user, PERMISSIONS.STOCK_VOIR)) redirect('/admin/dashboard')

    const filtres      = await searchParams
    const shopId       = user.user_metadata.shop_id as string
    const peutVoirCout = aPermission(user, PERMISSIONS.PRODUITS_COUT_VOIR)
    const adminClient  = createAdminClient()

    const page   = Math.max(1, parseInt(filtres.page ?? '1') || 1)
    const debut  = filtres.debut || ''
    const fin    = filtres.fin   || ''

    let requete = adminClient
        .from('stock_movements')
        .select(`
            id, public_id, type_mouvement, quantite,
            quantite_avant, quantite_apres, note, created_at,
            reference_type, reference_public_id,
            products(nom, unite, prix_achat),
            warehouses(nom),
            shop_users(nom_complet)
        `, { count: 'exact' })
        .eq('shop_id', shopId)

    if (filtres.type)     requete = requete.eq('type_mouvement', filtres.type)
    if (filtres.produit)  requete = requete.eq('product_id', filtres.produit)
    if (filtres.entrepot) requete = requete.eq('warehouse_id', filtres.entrepot)
    if (debut)            requete = requete.gte('created_at', debut + 'T00:00:00')
    if (fin)              requete = requete.lte('created_at', fin + 'T23:59:59')

    const [{ data: mouvements, count }, { data: produits }, { data: entrepots }] = await Promise.all([
        requete
            .order('created_at', { ascending: false })
            .range((page - 1) * PAR_PAGE, page * PAR_PAGE - 1),
        adminClient.from('products').select('id, nom').eq('shop_id', shopId).order('nom'),
        adminClient.from('warehouses').select('id, nom').eq('shop_id', shopId).order('nom'),
    ])

    const lignes = mouvements ?? []
    const total  = count ?? 0
    const pages  = Math.max(1, Math.ceil(total / PAR_PAGE))

    const rel = <T,>(v: T | T[] | null): T | null =>
        Array.isArray(v) ? (v[0] ?? null) : v

    // Totaux de la sélection courante, tous types classés.
    const totaux = lignes.reduce((acc, m) => {
        const sens = TYPE_CONFIG[m.type_mouvement]?.sens ?? 'neutre'
        const signe = sens === 'entree' ? 1 : sens === 'sortie' ? -1 : Math.sign(m.quantite_apres - m.quantite_avant)
        const prix = rel(m.products as { prix_achat?: number } | { prix_achat?: number }[])?.prix_achat ?? 0
        acc.lignes += 1
        if (signe > 0) acc.entrees += m.quantite
        else if (signe < 0) acc.sorties += m.quantite
        acc.valeur += signe * m.quantite * prix
        return acc
    }, { lignes: 0, entrees: 0, sorties: 0, valeur: 0 })

    const query = (p: number) => {
        const params = new URLSearchParams()
        if (filtres.type)     params.set('type', filtres.type)
        if (filtres.produit)  params.set('produit', filtres.produit)
        if (filtres.entrepot) params.set('entrepot', filtres.entrepot)
        if (debut)            params.set('debut', debut)
        if (fin)              params.set('fin', fin)
        params.set('page', String(p))
        return `/stock/mouvements?${params.toString()}`
    }

    return (
        <div className="flex flex-col min-h-screen">
            <header className="border-b border-border bg-card px-4 sm:px-6 py-4">
                <h1 className="text-xl font-bold text-foreground">Mouvements de stock</h1>
                <p className="text-sm text-muted-foreground mt-0.5">
                    {total} mouvement(s) — journal complet de toutes les entrées et sorties
                </p>
            </header>

            <main className="flex-1 p-4 sm:p-6 space-y-4">

                <FiltresMouvements
                    produits={produits ?? []}
                    entrepots={entrepots ?? []}
                    typeLabels={Object.fromEntries(
                        Object.entries(TYPE_CONFIG).map(([k, v]) => [k, v.label])
                    )}
                    valeurs={{
                        type: filtres.type ?? '', produit: filtres.produit ?? '',
                        entrepot: filtres.entrepot ?? '', debut, fin,
                    }}
                />

                {/* Totaux de la page affichée */}
                <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
                    <div className="bg-card border border-border rounded-xl p-3">
                        <p className="text-xs text-muted-foreground">Lignes affichées</p>
                        <p className="text-lg font-bold text-foreground">{totaux.lignes}</p>
                    </div>
                    <div className="bg-card border border-border rounded-xl p-3">
                        <p className="text-xs text-muted-foreground">Quantités entrées</p>
                        <p className="text-lg font-bold text-green-600">+{totaux.entrees}</p>
                    </div>
                    <div className="bg-card border border-border rounded-xl p-3">
                        <p className="text-xs text-muted-foreground">Quantités sorties</p>
                        <p className="text-lg font-bold text-destructive">−{totaux.sorties}</p>
                    </div>
                    {peutVoirCout && (
                        <div className="bg-card border border-border rounded-xl p-3">
                            <p className="text-xs text-muted-foreground">Valeur nette (prix d&apos;achat)</p>
                            <p className={`text-lg font-bold ${totaux.valeur < 0 ? 'text-destructive' : 'text-green-600'}`}>
                                {totaux.valeur > 0 ? '+' : ''}{formatMontant(totaux.valeur)}
                            </p>
                        </div>
                    )}
                </div>

                <div className="bg-card border border-border rounded-xl overflow-hidden">
                    <div className="overflow-x-auto">
                        <table className="w-full text-sm">
                            <thead>
                                <tr className="border-b border-border bg-muted/40">
                                    <th className="text-left px-4 py-3 font-medium text-muted-foreground">Type</th>
                                    <th className="text-left px-4 py-3 font-medium text-muted-foreground">Produit</th>
                                    <th className="text-left px-4 py-3 font-medium text-muted-foreground">Entrepôt</th>
                                    <th className="text-left px-4 py-3 font-medium text-muted-foreground">Qté</th>
                                    <th className="text-left px-4 py-3 font-medium text-muted-foreground">Avant → Après</th>
                                    <th className="text-left px-4 py-3 font-medium text-muted-foreground">Pièce</th>
                                    <th className="text-left px-4 py-3 font-medium text-muted-foreground">Par</th>
                                    <th className="text-left px-4 py-3 font-medium text-muted-foreground">Date</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-border">
                                {lignes.length === 0 && (
                                    <tr>
                                        <td colSpan={8} className="px-4 py-12 text-center text-sm text-muted-foreground">
                                            Aucun mouvement ne correspond à ces filtres.
                                        </td>
                                    </tr>
                                )}
                                {lignes.map(m => {
                                    const config  = TYPE_CONFIG[m.type_mouvement]
                                    const Icone   = config?.icone ?? ArrowLeftRight
                                    const produit = rel(m.products as { nom: string; unite: string } | { nom: string; unite: string }[])
                                    const auteur  = rel(m.shop_users as { nom_complet: string } | { nom_complet: string }[])
                                    return (
                                        <tr key={m.id} className="hover:bg-muted/30 transition-colors">
                                            <td className="px-4 py-3">
                                                <span className={`flex items-center gap-1.5 text-xs font-medium ${config?.couleur}`}>
                                                    <Icone className="w-3.5 h-3.5" />
                                                    {config?.label ?? m.type_mouvement}
                                                </span>
                                            </td>
                                            <td className="px-4 py-3 text-xs font-medium text-foreground">
                                                {produit?.nom}
                                            </td>
                                            <td className="px-4 py-3 text-xs text-muted-foreground">
                                                {rel(m.warehouses as { nom: string } | { nom: string }[])?.nom}
                                            </td>
                                            <td className="px-4 py-3 text-xs font-semibold text-foreground">
                                                {m.quantite} {produit?.unite}
                                            </td>
                                            <td className="px-4 py-3 text-xs text-muted-foreground font-mono tabular-nums">
                                                {m.quantite_avant} → {m.quantite_apres}
                                            </td>
                                            <td className="px-4 py-3 text-xs font-mono text-muted-foreground">
                                                {m.reference_public_id ?? m.public_id}
                                            </td>
                                            <td className="px-4 py-3 text-xs text-muted-foreground">
                                                {auteur?.nom_complet ?? '—'}
                                            </td>
                                            <td className="px-4 py-3 text-xs text-muted-foreground whitespace-nowrap">
                                                {formatDate(m.created_at)}
                                            </td>
                                        </tr>
                                    )
                                })}
                            </tbody>
                        </table>
                    </div>
                </div>

                {pages > 1 && (
                    <div className="flex items-center justify-between gap-3">
                        <p className="text-xs text-muted-foreground">
                            Page {page} sur {pages}
                        </p>
                        <div className="flex gap-2">
                            {page > 1 && (
                                <Link href={query(page - 1)}
                                      className="px-3 py-1.5 text-xs font-bold text-[#15335a] border border-[#15335a]/30 rounded-lg hover:bg-[#15335a]/5">
                                    Précédent
                                </Link>
                            )}
                            {page < pages && (
                                <Link href={query(page + 1)}
                                      className="px-3 py-1.5 text-xs font-bold text-[#15335a] border border-[#15335a]/30 rounded-lg hover:bg-[#15335a]/5">
                                    Suivant
                                </Link>
                            )}
                        </div>
                    </div>
                )}
            </main>
        </div>
    )
}
