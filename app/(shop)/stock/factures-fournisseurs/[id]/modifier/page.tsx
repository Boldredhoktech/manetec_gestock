// app/(shop)/stock/factures-fournisseurs/[id]/modifier/page.tsx

import type { Metadata } from 'next'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { redirect, notFound } from 'next/navigation'
import Link from 'next/link'
import { ArrowLeft } from 'lucide-react'
import { aPermission } from '@/lib/auth/permissions-serveur'
import { PERMISSIONS } from '@/lib/constants/permissions'
import { LIENS } from '@/lib/constants/liens'
import FormulaireFactureFournisseur from '@/components/shop/fournisseurs/FormulaireFactureFournisseur'
import type { LigneFactureFourn } from '@/actions/fournisseurs'

export const metadata: Metadata = { title: 'Modifier la facture fournisseur' }

interface Props { params: Promise<{ id: string }> }

export default async function PageModifierFactureFournisseur({ params }: Props) {
    const { id } = await params

    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user || user.user_metadata?.type_acteur !== 'shop') redirect('/login')
    if (!aPermission(user, PERMISSIONS.FACTURE_FOURNISSEUR_SAISIR)) redirect('/admin/dashboard')

    const shopId      = user.user_metadata.shop_id as string
    const adminClient = createAdminClient()

    const { data: facture } = await adminClient
        .from('factures_fournisseurs')
        .select(`
            *,
            suppliers(nom),
            facture_fournisseur_items(*),
            supplier_payments(id),
            receptions(id, reception_items(product_id, designation, quantite_recue, prix_unitaire))
        `)
        .eq('id', id)
        .eq('shop_id', shopId)
        .maybeSingle()

    if (!facture) notFound()

    // Payée, même en partie, ou annulée : plus de modification. Le
    // serveur le refuse aussi (modifier_facture_fournisseur).
    if (facture.statut === 'annulee' || ((facture.supplier_payments as unknown[]) ?? []).length > 0) {
        redirect(LIENS.factureFournisseur(id))
    }

    const { data: produits } = await adminClient
        .from('products').select('id, nom, prix_achat, unite')
        .eq('shop_id', shopId).eq('est_actif', true).order('nom')

    type ItemFacture = { product_id: string | null; designation: string; quantite: number; prix_unitaire: number; tva_pct: number; ordre: number }
    type ItemRecu    = { product_id: string | null; designation: string; quantite_recue: number; prix_unitaire: number }

    const items  = ((facture.facture_fournisseur_items as ItemFacture[]) ?? [])
        .slice().sort((a, b) => a.ordre - b.ordre)
    const recus  = ((facture.receptions as { reception_items: ItemRecu[] }[]) ?? [])
        .flatMap(r => r.reception_items ?? [])
        .filter(r => r.product_id)
    const enStock = recus.length > 0

    const versLigne = (l: { product_id: string | null; designation: string; quantite: number; prix_unitaire: number; tva_pct?: number }): LigneFactureFourn => ({
        product_id:    l.product_id,
        designation:   l.designation,
        quantite:      Number(l.quantite),
        prix_unitaire: Number(l.prix_unitaire),
        tva_pct:       Number(l.tva_pct ?? 0),
    })

    let lignes: LigneFactureFourn[]
    let nbLignesFigees = 0

    if (items.length > 0) {
        // Les lignes de produit d'abord : si la marchandise est entrée,
        // ce sont elles qui sont figées.
        const produitsL = items.filter(l => l.product_id).map(versLigne)
        const libres    = items.filter(l => !l.product_id).map(versLigne)
        lignes = [...produitsL, ...libres]
        nbLignesFigees = enStock ? produitsL.length : 0
    } else {
        // Facture « à compléter » : aucune ligne, la réception dit ce qui
        // est arrivé (plusieurs réceptions d'un même bon s'additionnent).
        const parProduit = new Map<string, LigneFactureFourn>()
        for (const r of recus) {
            const deja = parProduit.get(r.product_id!)
            if (deja) deja.quantite += Number(r.quantite_recue)
            else parProduit.set(r.product_id!, versLigne({ ...r, quantite: r.quantite_recue }))
        }
        lignes = [...parProduit.values()]
        nbLignesFigees = lignes.length
    }

    return (
        <div className="flex flex-col min-h-screen bg-[#f8fafc]">
            <header style={{ background: 'linear-gradient(135deg, #15335a 0%, #0f2742 100%)' }}
                    className="px-6 py-5 shadow-lg">
                <div className="flex items-center gap-4">
                    <Link href={LIENS.factureFournisseur(id)}
                          className="flex items-center justify-center w-9 h-9 rounded-xl bg-white/20 hover:bg-white/30 transition-colors">
                        <ArrowLeft className="w-5 h-5 text-white" />
                    </Link>
                    <div>
                        <h1 className="text-xl font-bold text-white">
                            {facture.a_completer ? 'Compléter' : 'Modifier'} la facture {facture.public_id}
                        </h1>
                        <p className="text-sm text-white/70 mt-0.5">{(facture.suppliers as { nom: string } | null)?.nom ?? '—'}</p>
                    </div>
                </div>
            </header>
            <main className="flex-1 p-4 sm:p-6 max-w-3xl mx-auto w-full">
                <FormulaireFactureFournisseur
                    factureExistante={{
                        id:              facture.id,
                        public_id:       facture.public_id,
                        reference_fourn: facture.reference_fourn,
                        date_echeance:   facture.date_echeance,
                        notes:           facture.notes,
                        lignes,
                        nbLignesFigees,
                    }}
                    supplierId={facture.supplier_id}
                    produits={produits ?? []}
                    entrepots={[]}
                />
            </main>
        </div>
    )
}
