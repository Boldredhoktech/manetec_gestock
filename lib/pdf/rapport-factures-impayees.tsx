import React from 'react'
import { couleurs } from '@/lib/pdf/styles'
import { formatMontantPDF } from '@/lib/pdf/utils-pdf'
import type { BoutiqueEntete } from '@/lib/pdf/entete-rapport'
import {
    DocumentRapport, CartesStats, TableauRapport, SectionTitre, NotePDF,
    type Colonne,
} from '@/lib/pdf/template'

// ══════════════════════════════════════════════════════════════
// Factures impayées — repris sur le gabarit commun (D2).
//
// Le montant restant tient compte des avoirs depuis le Lot 2
// Facturation, mais rien ne le disait : le client recevait une
// relance sur un montant déjà amputé, sans un mot pour l'expliquer.
// La colonne « Avoir » est là pour ça.
// ══════════════════════════════════════════════════════════════

interface FactureImpayee {
    public_id:       string
    client_nom:      string
    date_facture:    string
    date_echeance:   string | null
    montant_ttc:     number
    montant_restant: number
    montant_avoirs:  number
    avoirs_refs:     string | null
    jours_retard:    number
    etat:            string
    statut:          string
}

interface DonneesFacturesImpayees {
    boutique: BoutiqueEntete & { devise: string }
    genere_le:         string
    total_factures:    number
    total_en_retard:   number
    total_avec_avoir:  number
    montant_total_du:  number
    montant_en_retard: number
    montant_avoirs:    number
    factures:          FactureImpayee[]
}

export function RapportFacturesImpayeesPDF({ donnees }: { donnees: DonneesFacturesImpayees }) {
    const d   = donnees.boutique.devise
    const fmt = (n: number) => formatMontantPDF(n, d)

    const enRetard = donnees.factures.filter(f => f.jours_retard > 0)
    const nonEchus = donnees.factures.filter(f => f.jours_retard <= 0)

    function colonnes(retard: boolean): Colonne<FactureImpayee>[] {
        return [
            { entete: 'Facture', largeur: '15%', gras: true,
              rendu: f => f.public_id, sousTexte: f => f.client_nom },
            { entete: 'Émise le', largeur: '13%', rendu: f => f.date_facture },
            { entete: 'Échéance', largeur: '13%',
              rendu: f => f.date_echeance ?? 'sans échéance',
              couleur: () => retard ? couleurs.rouge : undefined },
            { entete: retard ? 'Retard' : 'État', largeur: '15%',
              rendu: f => retard ? `${f.jours_retard} j` : f.etat,
              couleur: () => retard ? couleurs.rouge : couleurs.texteFaible },
            { entete: 'Total', largeur: '14%', align: 'right',
              rendu: f => fmt(f.montant_ttc) },
            { entete: 'Avoir', largeur: '15%', align: 'right',
              rendu: f => f.montant_avoirs > 0 ? `- ${fmt(f.montant_avoirs)}` : '—',
              sousTexte: f => f.avoirs_refs,
              couleur: f => f.montant_avoirs > 0 ? couleurs.vert : couleurs.texteFaible },
            { entete: 'Reste dû', largeur: '15%', align: 'right', gras: true,
              rendu: f => fmt(f.montant_restant),
              couleur: () => retard ? couleurs.rouge : couleurs.orange },
        ]
    }

    const cartes = [
        { label: 'Factures en attente', valeur: String(donnees.total_factures), couleur: couleurs.orange },
        { label: 'En retard', valeur: String(donnees.total_en_retard),
          note: fmt(donnees.montant_en_retard),
          couleur: donnees.total_en_retard > 0 ? couleurs.rouge : couleurs.vert },
        { label: 'Montant total dû', valeur: fmt(donnees.montant_total_du) },
    ]
    if (donnees.montant_avoirs > 0) {
        cartes.push({
            label: `Avoirs déduits (${donnees.total_avec_avoir})`,
            valeur: fmt(donnees.montant_avoirs),
            couleur: couleurs.vert,
        })
    }

    return (
        <DocumentRapport
            boutique={donnees.boutique}
            titre="FACTURES IMPAYÉES"
            genereLe={donnees.genere_le}
            pied={`${donnees.boutique.nom} — Factures impayées — ${donnees.genere_le} — Manetec Gestock`}
        >
            <CartesStats cartes={cartes} />

            {donnees.montant_avoirs > 0 && (
                <NotePDF>
                    Les montants restants sont NETS des avoirs émis : ce qui figure ci-dessous
                    est ce qui reste réellement dû après déduction.
                </NotePDF>
            )}

            {enRetard.length > 0 && (
                <>
                    <SectionTitre>Factures en retard ({enRetard.length})</SectionTitre>
                    <TableauRapport
                        colonnes={colonnes(true)}
                        lignes={enRetard}
                        totaux={['TOTAL', '', '', '', '', '',
                                 fmt(enRetard.reduce((a, f) => a + f.montant_restant, 0))]}
                    />
                </>
            )}

            <SectionTitre>Factures non encore échues ({nonEchus.length})</SectionTitre>
            <TableauRapport
                colonnes={colonnes(false)}
                lignes={nonEchus}
                vide="Toutes les factures en attente sont échues."
                totaux={nonEchus.length > 0
                    ? ['TOTAL', '', '', '', '', '',
                       fmt(nonEchus.reduce((a, f) => a + f.montant_restant, 0))]
                    : undefined}
            />

            <NotePDF>
                Le retard se compte en jours pleins depuis l&apos;échéance : une facture échue
                le 6 n&apos;est pas en retard le 6, elle l&apos;est le 7. Une facture sans
                échéance n&apos;est jamais comptée en retard.
            </NotePDF>
        </DocumentRapport>
    )
}
