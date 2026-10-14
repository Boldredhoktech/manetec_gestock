import React from 'react'
import { Text, View } from '@react-pdf/renderer'
import { couleurs } from '@/lib/pdf/styles'
import { formatMontantPDF } from '@/lib/pdf/utils-pdf'
import { type BoutiqueEntete } from '@/lib/pdf/entete-rapport'
import {
    DocumentRapport, TableauRapport, CartesStats, SectionTitre,
    type Colonne,
} from '@/lib/pdf/template'

// Le relevé qu'on envoie au fournisseur en cas de désaccord : chaque
// pièce dans l'ordre, avec le solde qui court après chacune.

interface LigneReleve {
    date_fr: string; type: 'facture' | 'paiement'
    piece: string; libelle: string
    debit: number; credit: number; solde: number
}

interface DonneesReleve {
    boutique: BoutiqueEntete & { devise: string }
    fournisseur: {
        public_id: string; nom: string
        telephone: string | null; email: string | null
        adresse: string | null; ville: string | null
    }
    periode:         string
    genere_le:       string
    solde_ouverture: number
    total_achats:    number
    total_paiements: number
    solde_cloture:   number
    lignes:          LigneReleve[]
}

export function ReleveFournisseurPDF({ donnees }: { donnees: DonneesReleve }) {
    const fmt = (n: number) => formatMontantPDF(n, donnees.boutique.devise)
    const f = donnees.fournisseur

    const colonnes: Colonne<LigneReleve>[] = [
        { entete: 'Date',      largeur: '12%', rendu: l => l.date_fr },
        { entete: 'Pièce',     largeur: '15%', rendu: l => l.piece },
        { entete: 'Libellé',   largeur: '35%', rendu: l => l.libelle },
        { entete: 'Achat',     largeur: '12%', align: 'right', rendu: l => (l.debit > 0 ? fmt(l.debit) : '') },
        { entete: 'Règlement', largeur: '12%', align: 'right', couleur: () => couleurs.vert,
          rendu: l => (l.credit > 0 ? fmt(l.credit) : '') },
        { entete: 'Solde',     largeur: '14%', align: 'right', gras: true, rendu: l => fmt(l.solde) },
    ]

    return (
        <DocumentRapport
            boutique={donnees.boutique}
            titre="RELEVÉ DE COMPTE FOURNISSEUR"
            sousTitre={donnees.periode}
            genereLe={donnees.genere_le}
            pied={`Relevé établi par ${donnees.boutique.nom} · en cas de désaccord, merci de nous contacter en précisant les numéros de pièce concernés.`}
        >
            {/* Destinataire */}
            <View style={{
                backgroundColor: couleurs.fondClair, padding: 12, borderRadius: 6,
                marginBottom: 14, borderLeftWidth: 3, borderLeftColor: couleurs.primaire,
            }}>
                <Text style={{ fontSize: 12, fontFamily: 'Helvetica-Bold', color: couleurs.primaire }}>{f.nom}</Text>
                <Text style={{ fontSize: 8, color: couleurs.texteFaible, marginTop: 2 }}>
                    {[f.public_id, f.telephone, f.email].filter(Boolean).join(' · ')}
                </Text>
                {(f.adresse || f.ville) && (
                    <Text style={{ fontSize: 8, color: couleurs.texteFaible, marginTop: 2 }}>
                        {[f.adresse, f.ville].filter(Boolean).join(', ')}
                    </Text>
                )}
            </View>

            <CartesStats cartes={[
                { label: "Solde à l'ouverture",  valeur: fmt(donnees.solde_ouverture) },
                { label: 'Achats de la période', valeur: `+${fmt(donnees.total_achats)}`, couleur: couleurs.orange },
                { label: 'Règlements',           valeur: `-${fmt(donnees.total_paiements)}`, couleur: couleurs.vert },
                { label: 'Solde à la clôture',   valeur: fmt(donnees.solde_cloture),
                  couleur: donnees.solde_cloture > 0 ? couleurs.rouge : couleurs.vert },
            ]} />

            <SectionTitre>Mouvements de la période</SectionTitre>
            <TableauRapport
                colonnes={colonnes}
                lignes={donnees.lignes}
                totaux={['SOLDE DÛ AU TERME DE LA PÉRIODE', '', '', '', '', fmt(donnees.solde_cloture)]}
                vide="Aucun mouvement sur cette période."
            />
        </DocumentRapport>
    )
}
