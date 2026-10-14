// lib/pdf/devis-pdf.tsx
// La proforma (table `devis`) : même gabarit que la facture, sans
// règlement, avec une date de validité et le « bon pour accord ».

import React from 'react'
import { formatDatePDF } from '@/lib/pdf/utils-pdf'
import { DocumentCommercial, type LigneCommerciale } from '@/lib/pdf/document-commercial'

export interface DonneesDevisPDF {
    boutique: {
        nom: string; adresse?: string | null; ville?: string | null; telephone_1: string
        email?: string | null; ifu?: string | null; rccm?: string | null
        message_pied_facture?: string | null; devise: string; logo_url?: string | null
    }
    client?: {
        nom: string; adresse?: string | null; telephone?: string | null; email?: string | null
        ifu?: string | null; rccm?: string | null; ville?: string | null; pays?: string | null
    } | null
    devis: {
        public_id: string; date_devis: string; date_validite?: string | null
        objet?: string | null; note_client?: string | null
        montant_ht: number; remise_val: number; remise_pct: number
        montant_tva: number; montant_ttc: number
    }
    lignes: LigneCommerciale[]
    genere_le: string
}

export function DevisPDF({ donnees }: { donnees: DonneesDevisPDF }) {
    const { boutique, client, devis, lignes } = donnees

    const infos = [
        { label: 'Date', valeur: formatDatePDF(devis.date_devis) },
        ...(devis.date_validite ? [{ label: 'Valable jusqu’au', valeur: formatDatePDF(devis.date_validite) }] : []),
        { label: 'Référence', valeur: devis.public_id },
    ]

    const conditions = devis.note_client || boutique.message_pied_facture

    return (
        <DocumentCommercial
            vendeur={boutique}
            titre="PROFORMA"
            reference={devis.public_id}
            labelDestinataire="Adressé à"
            client={client}
            sansClient="Client non spécifié"
            infos={infos}
            objet={devis.objet}
            encart={devis.date_validite
                ? `Offre valable jusqu’au ${formatDatePDF(devis.date_validite)}.`
                : null}
            lignes={lignes}
            totaux={devis}
            libelleEnLettres="ARRÊTÉE LA PRÉSENTE PROFORMA À LA SOMME DE"
            blocs={conditions ? [{ titre: 'Conditions', texte: conditions }] : []}
            signatures={['Cachet et signature', 'Bon pour accord — Client']}
            pied={[
                boutique.nom,
                boutique.ifu ? `IFU ${boutique.ifu}` : null,
                boutique.rccm ? `RCCM ${boutique.rccm}` : null,
            ].filter(Boolean).join(' · ') + `  —  ${devis.public_id} · Généré le ${donnees.genere_le}`}
        />
    )
}
