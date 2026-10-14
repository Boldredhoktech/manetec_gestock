import React from 'react'
import { formatDatePDF } from '@/lib/pdf/utils-pdf'
import { etatFacture } from '@/lib/facturation/etat-facture'
import { DocumentCommercial, type LigneCommerciale } from '@/lib/pdf/document-commercial'

interface DonneesFacturePDF {
    boutique: {
        nom: string; adresse?: string | null; ville?: string | null
        telephone_1: string; email?: string | null
        ifu?: string | null; rccm?: string | null; devise: string
        message_pied_facture?: string | null; logo_url?: string | null
    }
    facture: {
        public_id: string; date_facture: string; date_echeance?: string | null
        statut: string; objet?: string | null; note_client?: string | null
        montant_ht: number; remise_val: number; remise_pct: number
        montant_tva: number; montant_ttc: number
        montant_paye: number; montant_restant: number
    }
    client?: {
        nom: string; adresse?: string | null; ville?: string | null; pays?: string | null
        telephone?: string | null; email?: string | null; ifu?: string | null; rccm?: string | null
    } | null
    lignes: LigneCommerciale[]
    genere_le: string
}

export function FacturePDF({ donnees }: { donnees: DonneesFacturePDF }) {
    const { boutique, facture, client, lignes } = donnees

    // Le retard se lit au moment où l'on imprime (décision D1) : une
    // facture échue et impayée ne s'imprime plus « Émise ».
    const etat = etatFacture({
        statut:          facture.statut,
        date_echeance:   facture.date_echeance ?? null,
        montant_restant: facture.montant_restant,
    })

    const infos = [
        { label: "Date d'émission", valeur: formatDatePDF(facture.date_facture) },
        ...(facture.date_echeance ? [{ label: "Date d'échéance", valeur: formatDatePDF(facture.date_echeance) }] : []),
        { label: 'Référence', valeur: facture.public_id },
    ]

    return (
        <DocumentCommercial
            vendeur={boutique}
            titre="FACTURE"
            reference={facture.public_id}
            badge={{ libelle: etat.libelle, ton: etat.ton }}
            labelDestinataire="Facturé à"
            client={client}
            sansClient="Client de passage"
            infos={infos}
            objet={facture.objet}
            lignes={lignes}
            totaux={facture}
            libelleEnLettres="ARRÊTÉE LA PRÉSENTE FACTURE À LA SOMME DE"
            blocs={[
                { titre: 'Modalités de paiement', texte: boutique.message_pied_facture || 'Paiement à réception de la facture.' },
                ...(facture.note_client ? [{ titre: 'Note', texte: facture.note_client }] : []),
            ]}
            signatures={['Cachet et signature']}
            pied={[
                boutique.nom,
                boutique.ifu ? `IFU ${boutique.ifu}` : null,
                boutique.rccm ? `RCCM ${boutique.rccm}` : null,
            ].filter(Boolean).join(' · ') + `  —  ${facture.public_id} · Généré le ${donnees.genere_le}`}
        />
    )
}
