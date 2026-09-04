import React from 'react'
import { couleurs } from '@/lib/pdf/styles'
import { formatMontantPDF } from '@/lib/pdf/utils-pdf'
import type { BoutiqueEntete } from '@/lib/pdf/entete-rapport'
import {
    DocumentRapport, CartesStats, TableauRapport, NotePDF, type Colonne,
} from '@/lib/pdf/template'

// ══════════════════════════════════════════════════════════════
// Rapport clients — repris sur le gabarit commun (D2).
//
// Le crédit dû est désormais situé face au plafond posé au Lot 3
// Facturation : c'est la question qu'on se pose en ouvrant ce
// document, et elle n'avait pas de réponse ici.
// ══════════════════════════════════════════════════════════════

interface ClientRapport {
    public_id: string; nom: string; telephone: string | null
    credit_balance: number; advance_balance: number; change_balance: number
    plafond_credit: number; depasse_plafond: boolean
    nb_achats: number; ca_total: number; nb_operations: number
}

interface DonneesRapportClients {
    boutique: BoutiqueEntete & { devise: string }
    genere_le:    string
    total_clients: number
    clients_en_credit: number
    clients_hors_plafond: number
    total_credit_du: number
    total_avances: number
    clients:      ClientRapport[]
}

export function RapportClientsPDF({ donnees }: { donnees: DonneesRapportClients }) {
    const d   = donnees.boutique.devise
    const fmt = (n: number) => formatMontantPDF(n, d)

    const colonnes: Colonne<ClientRapport>[] = [
        { entete: 'Client', largeur: '26%', gras: true,
          rendu: c => (c.depasse_plafond ? '! ' : '') + c.nom,
          sousTexte: c => `${c.public_id}${c.telephone ? ' · ' + c.telephone : ''}`,
          couleur: c => c.depasse_plafond ? couleurs.rouge : undefined },
        { entete: 'Crédit dû', largeur: '15%', align: 'right', gras: true,
          rendu: c => c.credit_balance > 0 ? fmt(c.credit_balance) : '—',
          couleur: c => c.credit_balance > 0 ? couleurs.rouge : undefined },
        { entete: 'Plafond', largeur: '15%', align: 'right',
          rendu: c => c.plafond_credit > 0 ? fmt(c.plafond_credit) : 'aucun',
          couleur: c => c.depasse_plafond ? couleurs.rouge : couleurs.texteFaible },
        { entete: 'Avance', largeur: '14%', align: 'right',
          rendu: c => c.advance_balance > 0 ? fmt(c.advance_balance) : '—',
          couleur: c => c.advance_balance > 0 ? couleurs.vert : undefined },
        { entete: 'Monnaie', largeur: '13%', align: 'right',
          rendu: c => c.change_balance > 0 ? fmt(c.change_balance) : '—',
          couleur: c => c.change_balance > 0 ? couleurs.vert : undefined },
        { entete: 'Achats', largeur: '17%', align: 'right', gras: true,
          rendu: c => fmt(c.ca_total),
          sousTexte: c => c.nb_achats > 0 ? `${c.nb_achats} achat(s)` : null },
    ]

    return (
        <DocumentRapport
            boutique={donnees.boutique}
            titre="RAPPORT CLIENTS"
            genereLe={donnees.genere_le}
            pied={`${donnees.boutique.nom} — Rapport clients — ${donnees.genere_le} — Manetec Gestock`}
        >
            <CartesStats cartes={[
                { label: 'Clients', valeur: String(donnees.total_clients) },
                { label: 'Avec crédit dû', valeur: String(donnees.clients_en_credit),
                  note: fmt(donnees.total_credit_du),
                  couleur: donnees.clients_en_credit > 0 ? couleurs.rouge : couleurs.vert },
                { label: 'Au-delà du plafond', valeur: String(donnees.clients_hors_plafond),
                  couleur: donnees.clients_hors_plafond > 0 ? couleurs.rouge : couleurs.vert },
                { label: 'Avances détenues', valeur: fmt(donnees.total_avances),
                  note: 'dues aux clients', couleur: couleurs.vert },
            ]} />

            <TableauRapport
                colonnes={colonnes}
                lignes={donnees.clients}
                vide="Aucun client actif."
                totaux={['TOTAL', fmt(donnees.total_credit_du), '',
                         fmt(donnees.total_avances), '', '']}
            />

            <NotePDF>
                Un plafond à « aucun » signifie qu&apos;aucune limite n&apos;a été posée pour
                ce client, pas que le crédit lui est interdit. Une avance et une monnaie
                laissée sont de l&apos;argent que la boutique DOIT au client : elles se
                déduisent de ce qu&apos;il vous doit.
                {donnees.clients_hors_plafond > 0
                    ? ` ${donnees.clients_hors_plafond} client(s) ont dépassé leur plafond, signalés par « ! ».`
                    : ''}
            </NotePDF>
        </DocumentRapport>
    )
}
