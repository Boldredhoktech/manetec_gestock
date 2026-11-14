// app/(shop)/admin/factures/[id]/page.tsx

import type { Metadata } from 'next'
import { createClient } from '@/lib/supabase/server'
import { aPermission } from '@/lib/auth/permissions-serveur'
import { PERMISSIONS } from '@/lib/constants/permissions'
import { createAdminClient } from '@/lib/supabase/admin'
import { redirect, notFound } from 'next/navigation'
import Link from 'next/link'
import { Pencil } from 'lucide-react'
import EnTetePage from '@/components/shop/EnTetePage'
import { classeBouton } from '@/components/ui/classe-bouton'
import CarteDetailFacture from '@/components/shop/facturation/CarteDetailFacture'
import CartePaiementFacture from '@/components/shop/facturation/CartePaiementFacture'
import CarteAvoir from '@/components/shop/facturation/CarteAvoir'
import CarteAnnulationFacture from '@/components/shop/facturation/CarteAnnulationFacture'
import HistoriqueReglements from '@/components/shop/facturation/HistoriqueReglements'
import { etatFacture } from '@/lib/facturation/etat-facture'

export const metadata: Metadata = { title: 'Détail facture' }

interface Props { params: Promise<{ id: string }> }

export default async function PageDetailFacture({ params }: Props) {
    const { id } = await params
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user || user.user_metadata?.type_acteur !== 'shop') redirect('/login')
    if (!aPermission(user, PERMISSIONS.FACTURES_VOIR)) redirect('/admin/factures')

    const shopId      = user.user_metadata.shop_id as string
    const adminClient = createAdminClient()

    const { data: facture } = await adminClient
        .from('factures')
        .select(`
            *,
            clients(nom, email, telephone, adresse, ifu, rccm, ville, pays),
            facture_items(*, products(nom, unite)),
            facture_payments(*, compte:comptes_tresorerie(nom)),
            avoirs(*)
        `)
        .eq('id', id)
        .eq('shop_id', shopId)
        .single()

    if (!facture) notFound()

    // Le retard n'est pas stocké : il se lit sur la date d'échéance au
    // moment de l'affichage (décision D1).
    const etat = etatFacture(facture)

    const { data: boutique } = await adminClient
        .from('shops')
        .select('nom, adresse, ville, telephone_1, telephone_2, email, devise, ifu, rccm, logo_url, message_pied_facture')
        .eq('id', shopId)
        .single()

    // Corrigeable tant que rien n'est réglé ni déduit (décision du
    // 2026-10-14) ; la base refait le contrôle (modifier_facture).
    const modifiable = facture.statut !== 'annulee'
        && aPermission(user, PERMISSIONS.FACTURES_CREER)
        && !((facture.facture_payments as any[]) ?? []).some(p => !p.est_annule)
        && ((facture.avoirs as any[]) ?? []).length === 0

    return (
        <div className="flex flex-col min-h-screen">

            <EnTetePage
                titre={facture.public_id}
                sousTitre={(facture.clients as any)?.nom ?? 'Client non spécifié'}
                ariane={[{ label: 'Ventes' }, { label: 'Factures', href: '/admin/factures' }, { label: facture.public_id }]}
                actions={
                    <>
                        {modifiable && (
                            <Link href={`/admin/factures/${facture.id}/modifier`} className={classeBouton('secondaire')}>
                                <Pencil className="w-4 h-4" aria-hidden="true" />Modifier
                            </Link>
                        )}
                        {facture.statut !== 'payee' && facture.statut !== 'annulee' && aPermission(user, PERMISSIONS.FACTURES_PAIEMENT) && (
                            <CartePaiementFacture facture={facture} />
                        )}
                    </>
                }
            />

            <main className="flex-1 px-4 sm:px-6 lg:px-8 pb-8 max-w-5xl w-full space-y-5">
                <CarteDetailFacture facture={facture} boutique={boutique} />
                <HistoriqueReglements
                    factureId={facture.id}
                    reglements={((facture.facture_payments as any[]) ?? [])
                        .slice()
                        .sort((a, b) => (a.date_paiement < b.date_paiement ? 1 : -1))}
                    peutCorriger={aPermission(user, PERMISSIONS.FACTURES_PAIEMENT)}
                />
                {facture.statut !== 'annulee' && (
                    <CarteAvoir
                        factureId={facture.id}
                        avoirs={(facture.avoirs as any[]) ?? []}
                        resteAPayer={facture.montant_restant}
                        montantTtc={facture.montant_ttc}
                        aUnClient={Boolean(facture.client_id)}
                    />
                )}
                <CarteAnnulationFacture
                    factureId={facture.id}
                    statut={facture.statut}
                    montantPaye={facture.montant_paye}
                    annuleLe={facture.annule_le}
                    motifAnnulation={facture.motif_annulation}
                    peutAnnuler={aPermission(user, PERMISSIONS.FACTURES_CREER)}
                />
            </main>
        </div>
    )
}