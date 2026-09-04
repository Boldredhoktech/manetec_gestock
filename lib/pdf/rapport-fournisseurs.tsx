import React from 'react'
import { couleurs } from '@/lib/pdf/styles'
import { formatMontantPDF } from '@/lib/pdf/utils-pdf'
import type { BoutiqueEntete } from '@/lib/pdf/entete-rapport'
import {
    DocumentRapport, CartesStats, TableauRapport, SectionTitre, NotePDF, Encart,
    type Colonne,
} from '@/lib/pdf/template'

// ══════════════════════════════════════════════════════════════
// Rapport fournisseurs — repris sur le gabarit commun (D2).
//
// Le fond n'a pas bougé : c'est le document livré au Lot 4
// Fournisseurs, avec sa dette d'ouverture, ses achats et ses
// règlements de période. Seule la mise en page rejoint les autres.
// ══════════════════════════════════════════════════════════════

interface LigneFournisseur {
    public_id: string; nom: string; telephone: string | null
    solde_ouverture: number; achats: number; paiements: number; solde_du: number
    nb_factures: number; nb_impayees: number; nb_en_retard: number
    montant_en_retard: number; a_completer: number
    dernier_achat: string | null; dernier_paiement: string | null
}

interface DonneesRapportFournisseurs {
    boutique: BoutiqueEntete & { devise: string }
    periode:   string
    genere_le: string
    total_fournisseurs:       number
    fournisseurs_mouvementes: number
    total_achats:      number
    total_paiements:   number
    total_ouverture:   number
    total_dette:       number
    fournisseurs_avec_dette: number
    total_en_retard:   number
    factures_a_completer: number
    fournisseurs:      LigneFournisseur[]
}

export function RapportFournisseursPDF({ donnees }: { donnees: DonneesRapportFournisseurs }) {
    const d   = donnees.boutique.devise
    const fmt = (n: number) => formatMontantPDF(n, d)

    const etat = (f: LigneFournisseur) =>
        f.nb_en_retard > 0 ? `${f.nb_en_retard} en retard`
      : f.nb_impayees  > 0 ? `${f.nb_impayees} à régler`
      : 'À jour'

    const colonnes: Colonne<LigneFournisseur>[] = [
        { entete: 'Fournisseur', largeur: '26%', gras: true,
          rendu: f => f.nom,
          sousTexte: f => `${f.public_id}${f.telephone ? ' · ' + f.telephone : ''}` },
        { entete: 'Ouverture', largeur: '14%', align: 'right',
          rendu: f => fmt(f.solde_ouverture) },
        { entete: 'Achats', largeur: '14%', align: 'right',
          rendu: f => fmt(f.achats) },
        { entete: 'Réglé', largeur: '14%', align: 'right',
          rendu: f => fmt(f.paiements), couleur: () => couleurs.vert },
        { entete: 'Solde dû', largeur: '16%', align: 'right', gras: true,
          rendu: f => f.solde_du > 0 ? fmt(f.solde_du) : 'Soldé',
          couleur: f => f.solde_du > 0 ? couleurs.rouge : couleurs.vert },
        { entete: 'État', largeur: '16%', align: 'right',
          rendu: etat,
          sousTexte: f => f.a_completer > 0 ? `${f.a_completer} à compléter` : null,
          couleur: f => f.nb_en_retard > 0 ? couleurs.rouge : couleurs.texteFaible },
    ]

    return (
        <DocumentRapport
            boutique={donnees.boutique}
            titre="RAPPORT FOURNISSEURS"
            sousTitre={donnees.periode}
            genereLe={donnees.genere_le}
            pied={'Achats et règlements de la période · les règlements incluent ceux affectés '
                + 'à une facture comme les versements libres sur le solde.'}
        >
            <CartesStats cartes={[
                { label: 'Achats de la période',  valeur: fmt(donnees.total_achats),    couleur: couleurs.orange },
                { label: 'Réglé sur la période',  valeur: fmt(donnees.total_paiements), couleur: couleurs.vert },
                { label: 'Dette à la clôture',    valeur: fmt(donnees.total_dette),     couleur: couleurs.rouge },
                { label: 'Fournisseurs mouvementés',
                  valeur: `${donnees.fournisseurs_mouvementes} / ${donnees.total_fournisseurs}` },
            ]} />

            <NotePDF>
                Dette à la clôture = dette à l&apos;ouverture ({fmt(donnees.total_ouverture)})
                {' '}+ achats - règlements.
            </NotePDF>

            {donnees.total_en_retard > 0 && (
                <Encart
                    ton="alerte"
                    titre={`${fmt(donnees.total_en_retard)} en retard de paiement`}
                    texte="Factures dont la date d'échéance est dépassée et qui restent partiellement ou totalement impayées."
                />
            )}

            <SectionTitre>Détail par fournisseur</SectionTitre>
            <TableauRapport
                colonnes={colonnes}
                lignes={donnees.fournisseurs}
                vide="Aucun mouvement fournisseur sur cette période."
                totaux={['TOTAL', fmt(donnees.total_ouverture), fmt(donnees.total_achats),
                         fmt(donnees.total_paiements), fmt(donnees.total_dette),
                         `${donnees.fournisseurs_avec_dette} à devoir`]}
            />

            {donnees.factures_a_completer > 0 && (
                <NotePDF>
                    {donnees.factures_a_completer} facture(s) « à compléter » : créées
                    automatiquement par une réception de marchandise sans document. Leur
                    montant provient du bon de réception et doit être confirmé à
                    l&apos;arrivée de la facture du fournisseur.
                </NotePDF>
            )}
        </DocumentRapport>
    )
}
