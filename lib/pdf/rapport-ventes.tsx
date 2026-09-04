import React from 'react'
import { couleurs } from '@/lib/pdf/styles'
import { formatMontantPDF } from '@/lib/pdf/utils-pdf'
import type { BoutiqueEntete } from '@/lib/pdf/entete-rapport'
import {
    DocumentRapport, CartesStats, TableauRapport, SectionTitre, Encart, NotePDF,
    type Colonne,
} from '@/lib/pdf/template'
import { MOYENS_PAIEMENT } from '@/lib/constants/moyens-paiement'

// ══════════════════════════════════════════════════════════════
// Rapport de ventes — repris sur le gabarit commun (D2).
//
// Décision D1 : le document dit les DEUX chiffres, côte à côte. Le
// facturé, c'est ce que la boutique a vendu ; l'encaissé, c'est ce
// qui est réellement entré. Les deux sont vrais et répondent à des
// questions différentes ; en cacher un force le gérant à faire le
// calcul de tête.
//
// Le rapprochement qui les relie est imprimé sous les cartes :
//   facturé - crédit accordé - soldes utilisés + ardoise remboursée
//   = encaissé au comptoir
// ══════════════════════════════════════════════════════════════

const MOYENS_LABELS: Record<string, string> = Object.fromEntries(
    MOYENS_PAIEMENT.map(m => [m.code, m.label]),
)

// Une vente n'a pas deux états mais trois : conclue, annulée,
// remboursée. La coche et la croix en confondaient deux.
const LIBELLES_STATUT: Record<string, string> = {
    completee:  'Conclue',
    annulee:    'Annulée',
    remboursee: 'Remboursée',
}

interface VenteLigne {
    public_id:     string
    date:          string
    client_nom:    string | null
    vendeur_nom:   string
    montant_total: number
    statut:        string
    nb_articles:   number
}

interface PaiementFactureLigne {
    facture_public_id: string
    date:              string
    client_nom:        string | null
    moyen:             string
    montant:           number
}

interface DonneesRapportVentes {
    boutique: BoutiqueEntete & { devise: string }
    periode:       string
    genere_le:     string
    total_ventes:  number
    // Ce que la boutique a VENDU au comptoir
    ca_pos_facture:  number
    // Ce qui est reellement ENTRE, et ce qui explique la difference
    encaisse_pos:    number
    credit_accorde:  number
    soldes_utilises: number
    remb_ardoise:    number
    ca_factures:     number
    encaisse_total:  number
    ca_moyen:        number
    nb_paiements_factures: number
    ventes:        VenteLigne[]
    ventes_facture: PaiementFactureLigne[]
    top_produits:  { nom: string; quantite: number; ca: number }[]
    par_vendeur:   { nom: string; nb_ventes: number; ca: number }[]
    par_moyen:     { moyen: string; montant: number }[]
}

export function RapportVentesPDF({ donnees }: { donnees: DonneesRapportVentes }) {
    const d   = donnees.boutique.devise
    const fmt = (n: number) => formatMontantPDF(n, d)

    const ecartPos = donnees.ca_pos_facture - donnees.encaisse_pos

    const rapprochement = [
        `${fmt(donnees.ca_pos_facture)} facturés`,
        donnees.credit_accorde  > 0 ? `- ${fmt(donnees.credit_accorde)} accordés à crédit` : '',
        donnees.soldes_utilises > 0 ? `- ${fmt(donnees.soldes_utilises)} réglés sur solde client` : '',
        donnees.remb_ardoise    > 0 ? `+ ${fmt(donnees.remb_ardoise)} d'ardoise remboursée` : '',
        `=  ${fmt(donnees.encaisse_pos)} entrés en caisse`,
    ].filter(Boolean).join('  ')

    const colVentes: Colonne<VenteLigne>[] = [
        { entete: 'N° vente', largeur: '18%', gras: true,
          rendu: v => v.public_id, sousTexte: v => v.date },
        { entete: 'Client', largeur: '26%',
          rendu: v => v.client_nom || 'Anonyme', sousTexte: v => v.vendeur_nom },
        { entete: 'Art.', largeur: '10%', align: 'center',
          rendu: v => String(v.nb_articles) },
        { entete: 'Montant', largeur: '24%', align: 'right', gras: true,
          rendu: v => fmt(v.montant_total) },
        { entete: 'Statut', largeur: '22%', align: 'center',
          rendu: v => LIBELLES_STATUT[v.statut] ?? v.statut,
          couleur: v => v.statut === 'completee' ? couleurs.vert : couleurs.rouge },
    ]

    const colFactures: Colonne<PaiementFactureLigne>[] = [
        { entete: 'N° facture', largeur: '20%', gras: true,
          rendu: p => p.facture_public_id, sousTexte: p => p.date },
        { entete: 'Client', largeur: '32%', rendu: p => p.client_nom || '—' },
        { entete: 'Moyen', largeur: '25%',
          rendu: p => MOYENS_LABELS[p.moyen] ?? p.moyen },
        { entete: 'Montant', largeur: '23%', align: 'right', gras: true,
          rendu: p => fmt(p.montant) },
    ]

    return (
        <DocumentRapport
            boutique={donnees.boutique}
            titre="RAPPORT DE VENTES"
            sousTitre={donnees.periode}
            genereLe={donnees.genere_le}
            pied={`${donnees.boutique.nom} — Rapport de ventes — ${donnees.genere_le} — Manetec Gestock`}
        >
            <CartesStats cartes={[
                { label: `Facturé — ventes POS (${donnees.total_ventes})`,
                  valeur: fmt(donnees.ca_pos_facture),
                  note: donnees.total_ventes > 0
                      ? `${fmt(donnees.ca_moyen)} par vente` : undefined },
                { label: 'Encaissé — POS + factures',
                  valeur: fmt(donnees.encaisse_total), couleur: couleurs.vert },
                { label: `dont sur facture (${donnees.nb_paiements_factures})`,
                  valeur: fmt(donnees.ca_factures), couleur: couleurs.orange },
            ]} />

            {ecartPos !== 0 && (
                <Encart titre="Du facturé à l'encaissé, au comptoir" texte={rapprochement} />
            )}

            <SectionTitre>Ventes au comptoir ({donnees.ventes.length})</SectionTitre>
            <TableauRapport
                colonnes={colVentes}
                lignes={donnees.ventes}
                vide="Aucune vente au comptoir sur cette période."
            />

            <SectionTitre>Règlements de facture encaissés ({donnees.ventes_facture.length})</SectionTitre>
            <TableauRapport
                colonnes={colFactures}
                lignes={donnees.ventes_facture}
                vide="Aucun règlement de facture sur cette période."
                totaux={donnees.ventes_facture.length > 0
                    ? ['TOTAL', '', '', fmt(donnees.ca_factures)] : undefined}
            />

            {donnees.top_produits.length > 0 && (
                <>
                    <SectionTitre>Produits les plus vendus</SectionTitre>
                    <TableauRapport
                        colonnes={[
                            { entete: 'Produit', largeur: '55%', rendu: p => p.nom },
                            { entete: 'Qté vendue', largeur: '20%', align: 'center',
                              rendu: p => String(p.quantite) },
                            { entete: 'CA généré', largeur: '25%', align: 'right', gras: true,
                              rendu: p => fmt(p.ca) },
                        ]}
                        lignes={donnees.top_produits.slice(0, 10)}
                    />
                </>
            )}

            {donnees.par_vendeur.length > 0 && (
                <>
                    <SectionTitre>Par vendeur</SectionTitre>
                    <TableauRapport
                        colonnes={[
                            { entete: 'Vendeur', largeur: '50%', rendu: v => v.nom },
                            { entete: 'Nb ventes', largeur: '25%', align: 'center',
                              rendu: v => String(v.nb_ventes) },
                            { entete: 'Facturé', largeur: '25%', align: 'right', gras: true,
                              rendu: v => fmt(v.ca) },
                        ]}
                        lignes={donnees.par_vendeur}
                    />
                </>
            )}

            {donnees.par_moyen.length > 0 && (
                <>
                    <SectionTitre>Encaissements par moyen de paiement</SectionTitre>
                    <TableauRapport
                        colonnes={[
                            { entete: 'Moyen', largeur: '60%',
                              rendu: m => MOYENS_LABELS[m.moyen] ?? m.moyen },
                            { entete: 'Montant encaissé', largeur: '40%', align: 'right', gras: true,
                              rendu: m => fmt(m.montant) },
                        ]}
                        lignes={donnees.par_moyen}
                        totaux={['TOTAL', fmt(donnees.encaisse_total)]}
                    />
                </>
            )}

            <NotePDF>
                Les ventes annulées figurent dans la liste avec leur statut, mais elles
                sortent du chiffre d&apos;affaires et de la ventilation par moyen : elles
                n&apos;ont rien encaissé. La colonne « Par vendeur » compte le FACTURÉ,
                pour mesurer ce qui a été vendu et non ce qui est rentré.
            </NotePDF>
        </DocumentRapport>
    )
}
