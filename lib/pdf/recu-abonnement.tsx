// lib/pdf/recu-abonnement.tsx
// Reçu d'un paiement d'abonnement (ABO-17). Émis par Manetec à la
// boutique : l'en-tête est celui de l'éditeur, la boutique est le client.

import React from 'react'
import { DocumentRapport, BlocInfos, SectionTitre, NotePDF, Encart } from '@/lib/pdf/template'
import { formatMontantPDF, formatDatePDF } from '@/lib/pdf/utils-pdf'
import { ENTREPRISE } from '@/lib/config/entreprise'

export interface DonneesRecuAbonnement {
    paiement: {
        public_id:             string
        plan:                  string
        duree_label:           string
        montant:               number
        devise:                string
        moyen:                 'kkiapay' | 'manuel'
        reference_transaction: string | null
        periode_debut:         string
        periode_fin:           string
        confirme_le:           string
    }
    boutique: { nom: string; public_id: string; ville: string | null; telephone_1: string | null }
    genere_le: string
}

export function RecuAbonnementPDF({ donnees }: { donnees: DonneesRecuAbonnement }) {
    const p = donnees.paiement
    return (
        <DocumentRapport
            boutique={{
                nom:         ENTREPRISE.nom,
                adresse:     `${ENTREPRISE.quartier}, ${ENTREPRISE.adresse}`,
                telephone_1: ENTREPRISE.telephone_1,
            }}
            titre="REÇU D'ABONNEMENT"
            sousTitre={`${p.public_id} · ${formatDatePDF(p.confirme_le)}`}
            genereLe={donnees.genere_le}
            pied={`${ENTREPRISE.nom} · ${ENTREPRISE.produit} · ${ENTREPRISE.email_contact}`}
        >
            <SectionTitre>Client</SectionTitre>
            <BlocInfos infos={[
                { label: 'Boutique',        valeur: `${donnees.boutique.nom} (${donnees.boutique.public_id})` },
                { label: 'Ville',           valeur: donnees.boutique.ville ?? '—' },
                { label: 'Téléphone',       valeur: donnees.boutique.telephone_1 ?? '—' },
            ]} />

            <SectionTitre>Abonnement</SectionTitre>
            <BlocInfos infos={[
                { label: 'Plan',            valeur: `${p.plan} — ${p.duree_label}` },
                { label: 'Période couverte', valeur: `du ${formatDatePDF(p.periode_debut)} au ${formatDatePDF(p.periode_fin)}` },
                { label: 'Moyen de paiement', valeur: p.moyen === 'kkiapay' ? 'En ligne, KkiaPay' : 'Enregistré par Manetec' },
                { label: 'Référence de transaction', valeur: p.reference_transaction ?? '—' },
            ]} />

            <Encart ton="succes" titre={`Montant réglé : ${formatMontantPDF(p.montant, p.devise)}`}
                    texte={`Abonnement actif jusqu'au ${formatDatePDF(p.periode_fin)}.`} />

            <NotePDF>
                Ce reçu atteste le règlement de l&apos;abonnement indiqué ci-dessus. Il est émis
                automatiquement à la confirmation du paiement et ne nécessite pas de signature.
            </NotePDF>
        </DocumentRapport>
    )
}
