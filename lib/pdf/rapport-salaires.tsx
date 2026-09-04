import React from 'react'
import { couleurs } from '@/lib/pdf/styles'
import { formatMontantPDF, formatDatePDF } from '@/lib/pdf/utils-pdf'
import type { BoutiqueEntete } from '@/lib/pdf/entete-rapport'
import {
    DocumentRapport, CartesStats, TableauRapport, NotePDF, type Colonne,
} from '@/lib/pdf/template'

// ══════════════════════════════════════════════════════════════
// Rapport de paie — repris sur le gabarit commun.
//
// Il redéfinissait sa propre feuille de styles et posait ses colonnes
// à la main, en `<Text style={{ width: '13%' }}>`. Une cellule de
// texte n'est pas une boîte : quand le montant était plus large que
// sa part, il débordait sur la colonne voisine. On lisait donc
// « 100 000 FCFAEspèces », et l'en-tête « Net verséMoyen ».
//
// Le tableau du gabarit enferme chaque cellule dans une vue de
// largeur fixe : le texte est coupé, jamais superposé.
// ══════════════════════════════════════════════════════════════

interface LigneSalaire {
    employe:       string
    poste:         string | null
    // Le mois travaillé, distinct du jour où l'argent est sorti.
    au_titre_de:   string
    salaire_base:  number
    bonus:         number
    deductions:    number
    montant_net:   number
    moyen:         string
    date_paiement: string
}

interface DonneesRapportSalaires {
    boutique: BoutiqueEntete & { devise: string }
    periode:        string
    genere_le:      string
    nb_employes:    number
    nb_versements:  number
    total_brut:     number
    total_bonus:    number
    total_deductions: number
    total_net:      number
    salaires:       LigneSalaire[]
}

const MOYENS: Record<string, string> = {
    cash: 'Espèces', wave: 'Wave', mtn_momo: 'MTN MoMo',
    celtiis_cash: 'Celtiis', moov_money: 'Moov', other_mobile: 'Mobile',
    bank_transfer: 'Virement', bank_card: 'Carte',
}

export function RapportSalairesPDF({ donnees }: { donnees: DonneesRapportSalaires }) {
    const d   = donnees.boutique.devise
    const fmt = (n: number) => formatMontantPDF(n, d)

    const colonnes: Colonne<LigneSalaire>[] = [
        { entete: 'Employé', largeur: '22%', gras: true,
          rendu: s => s.employe, sousTexte: s => s.poste },
        { entete: 'Au titre de', largeur: '10%', rendu: s => s.au_titre_de },
        { entete: 'Versé le',    largeur: '11%', rendu: s => formatDatePDF(s.date_paiement) },
        { entete: 'Base',        largeur: '13%', align: 'right', rendu: s => fmt(s.salaire_base) },
        { entete: 'Bonus',       largeur: '10%', align: 'right',
          rendu: s => s.bonus > 0 ? fmt(s.bonus) : '—',
          couleur: s => s.bonus > 0 ? couleurs.vert : undefined },
        { entete: 'Déduct.',     largeur: '10%', align: 'right',
          rendu: s => s.deductions > 0 ? fmt(s.deductions) : '—',
          couleur: s => s.deductions > 0 ? couleurs.rouge : undefined },
        { entete: 'Net versé',   largeur: '13%', align: 'right', gras: true,
          rendu: s => fmt(s.montant_net), couleur: () => couleurs.vert },
        { entete: 'Moyen',       largeur: '11%',
          rendu: s => MOYENS[s.moyen] ?? s.moyen },
    ]

    return (
        <DocumentRapport
            boutique={donnees.boutique}
            titre="RAPPORT DE PAIE"
            sousTitre={donnees.periode}
            genereLe={donnees.genere_le}
            pied={`${donnees.boutique.nom} — Rapport de paie — ${donnees.genere_le} — Manetec Gestock`}
        >
            <CartesStats cartes={[
                { label: 'Employés payés',  valeur: String(donnees.nb_employes),   couleur: couleurs.accent },
                { label: 'Versements',      valeur: String(donnees.nb_versements) },
                { label: 'Total brut',      valeur: fmt(donnees.total_brut) },
                { label: 'Total net versé', valeur: fmt(donnees.total_net), couleur: couleurs.vert },
            ]} />

            <TableauRapport
                colonnes={colonnes}
                lignes={donnees.salaires}
                vide="Aucun salaire versé sur cette période."
                totaux={['TOTAL', '', '', fmt(donnees.total_brut),
                         donnees.total_bonus > 0 ? `+${fmt(donnees.total_bonus)}` : '—',
                         donnees.total_deductions > 0 ? `-${fmt(donnees.total_deductions)}` : '—',
                         fmt(donnees.total_net), '']}
            />

            <NotePDF>
                Ce rapport liste les salaires effectivement VERSÉS sur la période, quel que
                soit le mois travaillé auquel ils se rapportent (colonne « Au titre de »).
                Un même employé peut y figurer plusieurs fois : acompte puis solde.
            </NotePDF>
        </DocumentRapport>
    )
}
