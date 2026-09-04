import type { Metadata } from 'next'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { redirect, notFound } from 'next/navigation'
import Link from 'next/link'
import { ArrowLeft, PackageCheck, Truck, Warehouse, Calendar, FileText } from 'lucide-react'
import { formatDate, formatMontant } from '@/lib/utils'
import ActionsBonCommande from '@/components/shop/fournisseurs/ActionsBonCommande'
import { aPermission } from '@/lib/auth/permissions-serveur'
import { PERMISSIONS } from '@/lib/constants/permissions'

export const metadata: Metadata = { title: 'Bon de commande' }

const STATUT_BC: Record<string, { label: string; bg: string; couleur: string }> = {
    brouillon:    { label: 'Brouillon',      bg: 'bg-gray-100',  couleur: 'text-gray-600'  },
    soumis:       { label: 'Envoyé',         bg: 'bg-blue-100',  couleur: 'text-blue-700'  },
    recu_partiel: { label: 'Reçu en partie', bg: 'bg-amber-100', couleur: 'text-amber-700' },
    recu_total:   { label: 'Reçu',           bg: 'bg-green-100', couleur: 'text-green-700' },
    annule:       { label: 'Annulé',         bg: 'bg-red-100',   couleur: 'text-red-700'   },
}

interface Props { params: Promise<{ id: string }> }

export default async function PageBonCommande({ params }: Props) {
    const { id } = await params
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user || user.user_metadata?.type_acteur !== 'shop') redirect('/login')
    if (!aPermission(user, PERMISSIONS.FOURNISSEURS_VOIR)) redirect('/admin/dashboard')

    const shopId      = user.user_metadata.shop_id as string
    const adminClient = createAdminClient()

    const [{ data: bon }, { data: boutique }] = await Promise.all([
        adminClient.from('purchase_orders')
            .select(`
                id, public_id, statut, date_commande, date_livraison, montant_total, notes,
                motif_annulation, soumis_le, annule_le, supplier_id,
                suppliers(id, nom, telephone, email),
                warehouses(nom),
                purchase_order_items(
                    id, designation, quantite_cmd, quantite_recue, prix_unitaire, montant_ligne,
                    products(nom, unite)
                )
            `)
            .eq('id', id).eq('shop_id', shopId).single(),
        adminClient.from('shops').select('devise').eq('id', shopId).single(),
    ])

    if (!bon) notFound()

    const devise      = boutique?.devise ?? 'XOF'
    const cfg         = STATUT_BC[bon.statut] ?? STATUT_BC.brouillon
    const lignes      = (bon.purchase_order_items ?? []) as {
        id: string; designation: string; quantite_cmd: number; quantite_recue: number
        prix_unitaire: number; montant_ligne: number
        products: { nom: string; unite: string } | { nom: string; unite: string }[] | null
    }[]
    const totalCmd    = lignes.reduce((a, l) => a + l.quantite_cmd, 0)
    const totalRecu   = lignes.reduce((a, l) => a + l.quantite_recue, 0)
    const dejaRecu    = totalRecu > 0
    const fournisseur = (Array.isArray(bon.suppliers) ? bon.suppliers[0] : bon.suppliers) as
        { id: string; nom: string; telephone: string | null; email: string | null } | null
    const entrepot    = (Array.isArray(bon.warehouses) ? bon.warehouses[0] : bon.warehouses) as
        { nom: string } | null

    const peutReceptionner = aPermission(user, PERMISSIONS.RECEPTION_CREER)
        && ['soumis', 'recu_partiel'].includes(bon.statut)

    return (
        <div className="flex flex-col min-h-screen">
            <header className="border-b border-border bg-card px-4 sm:px-6 py-4">
                <div className="flex items-start justify-between gap-3 flex-wrap">
                    <div className="flex items-center gap-3">
                        <Link href="/stock/bons-de-commande" className="text-muted-foreground hover:text-foreground">
                            <ArrowLeft className="w-5 h-5" />
                        </Link>
                        <div>
                            <div className="flex items-center gap-2 flex-wrap">
                                <h1 className="text-xl font-bold text-foreground">{bon.public_id}</h1>
                                <span className={`px-2.5 py-0.5 text-xs font-bold rounded-full ${cfg.bg} ${cfg.couleur}`}>
                                    {cfg.label}
                                </span>
                            </div>
                            <p className="text-sm text-muted-foreground mt-0.5">
                                {fournisseur?.nom} · {formatDate(bon.date_commande)}
                            </p>
                        </div>
                    </div>
                    <div className="flex items-center gap-2 flex-wrap">
                    <a href={`/api/v1/pdf/bon-commande/${bon.id}`}
                       target="_blank" rel="noopener noreferrer"
                       className="flex items-center gap-2 px-4 py-2 text-xs font-bold text-[#15335a] border border-[#15335a]/30 rounded-lg hover:bg-[#15335a]/5 transition-colors">
                        <FileText className="w-4 h-4" />
                        Imprimer / envoyer
                    </a>
                    {peutReceptionner && fournisseur && (
                        <Link
                            href={`/stock/fournisseurs/${fournisseur.id}/reception`}
                            className="flex items-center gap-2 px-4 py-2 text-xs font-bold text-white bg-green-600 rounded-lg hover:bg-green-700 transition-colors"
                        >
                            <PackageCheck className="w-4 h-4" />
                            Réceptionner
                        </Link>
                    )}
                    </div>
                </div>
            </header>

            <main className="flex-1 p-4 sm:p-6">
                <div className="max-w-4xl mx-auto space-y-5">

                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                        <div className="bg-white border border-gray-200 rounded-2xl p-4">
                            <p className="text-xs text-gray-400 flex items-center gap-1.5"><Truck className="w-3.5 h-3.5" />Fournisseur</p>
                            <p className="text-sm font-bold text-gray-900 mt-1">{fournisseur?.nom}</p>
                            {fournisseur?.telephone && <p className="text-xs text-gray-500">{fournisseur.telephone}</p>}
                        </div>
                        <div className="bg-white border border-gray-200 rounded-2xl p-4">
                            <p className="text-xs text-gray-400 flex items-center gap-1.5"><Warehouse className="w-3.5 h-3.5" />Entrepôt prévu</p>
                            <p className="text-sm font-bold text-gray-900 mt-1">{entrepot?.nom ?? 'Non précisé'}</p>
                        </div>
                        <div className="bg-white border border-gray-200 rounded-2xl p-4">
                            <p className="text-xs text-gray-400 flex items-center gap-1.5"><Calendar className="w-3.5 h-3.5" />Livraison attendue</p>
                            <p className="text-sm font-bold text-gray-900 mt-1">
                                {bon.date_livraison ? formatDate(bon.date_livraison) : 'Non précisée'}
                            </p>
                        </div>
                    </div>

                    {bon.statut === 'annule' && bon.motif_annulation && (
                        <div className="p-3 bg-red-50 border border-red-200 rounded-xl text-xs text-red-800">
                            Annulé : {bon.motif_annulation}
                        </div>
                    )}

                    <div className="bg-white border border-gray-200 rounded-2xl overflow-hidden">
                        <div className="px-5 py-4 border-b border-gray-100 flex items-center justify-between">
                            <h2 className="text-sm font-bold text-gray-900">Articles commandés</h2>
                            <p className="text-xs text-gray-500">
                                Reçu {totalRecu} / {totalCmd}
                            </p>
                        </div>
                        <div className="overflow-x-auto">
                            <table className="w-full text-sm">
                                <thead>
                                    <tr className="bg-gray-50 text-xs text-gray-500">
                                        <th className="text-left px-5 py-2.5 font-medium">Article</th>
                                        <th className="text-right px-3 py-2.5 font-medium">Commandé</th>
                                        <th className="text-right px-3 py-2.5 font-medium">Reçu</th>
                                        <th className="text-right px-3 py-2.5 font-medium">P.U.</th>
                                        <th className="text-right px-5 py-2.5 font-medium">Total</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-gray-100">
                                    {lignes.map(l => {
                                        const p = Array.isArray(l.products) ? l.products[0] : l.products
                                        const complet = l.quantite_recue >= l.quantite_cmd
                                        return (
                                            <tr key={l.id}>
                                                <td className="px-5 py-3 text-xs font-medium text-gray-800">
                                                    {p?.nom ?? l.designation}
                                                </td>
                                                <td className="px-3 py-3 text-xs text-right tabular-nums text-gray-600">
                                                    {l.quantite_cmd} {p?.unite}
                                                </td>
                                                <td className={`px-3 py-3 text-xs text-right tabular-nums font-bold ${
                                                    complet ? 'text-green-600' : l.quantite_recue > 0 ? 'text-amber-600' : 'text-gray-400'
                                                }`}>
                                                    {l.quantite_recue}
                                                </td>
                                                <td className="px-3 py-3 text-xs text-right tabular-nums text-gray-600">
                                                    {formatMontant(l.prix_unitaire, devise)}
                                                </td>
                                                <td className="px-5 py-3 text-xs text-right tabular-nums font-bold text-gray-800">
                                                    {formatMontant(l.montant_ligne, devise)}
                                                </td>
                                            </tr>
                                        )
                                    })}
                                </tbody>
                                <tfoot>
                                    <tr className="bg-gray-50">
                                        <td colSpan={4} className="px-5 py-3 text-xs font-bold text-gray-700 text-right">
                                            Total commandé
                                        </td>
                                        <td className="px-5 py-3 text-sm font-black text-[#15335a] text-right tabular-nums">
                                            {formatMontant(bon.montant_total, devise)}
                                        </td>
                                    </tr>
                                </tfoot>
                            </table>
                        </div>
                    </div>

                    {bon.notes && (
                        <div className="bg-white border border-gray-200 rounded-2xl p-5">
                            <p className="text-xs font-bold text-gray-500 mb-1">Notes</p>
                            <p className="text-sm text-gray-700">{bon.notes}</p>
                        </div>
                    )}

                    {aPermission(user, PERMISSIONS.BONS_COMMANDE_CREER) && (
                        <div className="bg-white border border-gray-200 rounded-2xl p-5">
                            <h2 className="text-sm font-bold text-gray-900 mb-3">Suite à donner</h2>
                            <ActionsBonCommande poId={bon.id} statut={bon.statut} dejaRecu={dejaRecu} />
                            <p className="text-xs text-gray-400 mt-3">
                                La réception se fait depuis la fiche du fournisseur : c&apos;est elle qui fait entrer
                                la marchandise en stock et qui fait passer ce bon en « reçu ».
                            </p>
                        </div>
                    )}
                </div>
            </main>
        </div>
    )
}
