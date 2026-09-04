import React from 'react'
import { couleurs } from '@/lib/pdf/styles'
import { formatMontantPDF } from '@/lib/pdf/utils-pdf'
import type { BoutiqueEntete } from '@/lib/pdf/entete-rapport'
import {
    DocumentRapport, CartesStats, TableauRapport, SectionTitre, NotePDF,
    type Colonne,
} from '@/lib/pdf/template'

// ══════════════════════════════════════════════════════════════
// Retours, avoirs et ventes annulées — RAP-07 et RAP-10.
//
// Trois faits qui existaient en base sans jamais sortir sur papier.
// Ce sont pourtant ceux qu'un gérant surveille : ce qui revient,
// pourquoi, et ce que ça coûte. Une vente annulée n'est pas rien :
// trop d'annulations sur un vendeur, ou toujours au même moment de
// la journée, se voient dans un rapport et nulle part ailleurs.
//
// Les trois sont réunis dans un seul document parce qu'ils répondent
// à la même question — « qu'est-ce qui est reparti ? » — mais ils
// sont comptés séparément : leur somme ne veut rien dire.
// ══════════════════════════════════════════════════════════════

const LIBELLE_REGLEMENT: Record<string, string> = {
    a_traiter:  'À traiter',
    avance:     'Porté en avance',
    avoir:      'Avoir émis',
    rembourse:  'Remboursé',
    sans_suite: 'Sans suite',
}

interface LigneRetour {
    public_id: string; date: string; vente: string; client: string
    entrepot: string; motif: string; montant: number
    reglement: string; note: string | null; par: string
}

interface LigneAvoir {
    public_id: string; date: string; facture: string; client: string
    motif: string; montant: number; deduit: number; avance: number
}

interface LigneAnnulee {
    public_id: string; date: string; annule_le: string
    client: string; vendeur: string; montant: number; motif: string
}

interface DonneesRapportRetours {
    boutique: BoutiqueEntete & { devise: string }
    periode:        string
    genere_le:      string
    nb_retours:     number
    total_retours:  number
    rembourse:      number
    a_traiter:      number
    nb_avoirs:      number
    total_avoirs:   number
    nb_annulees:    number
    total_annulees: number
    par_reglement:  { reglement: string; nb: number; montant: number }[]
    retours:        LigneRetour[]
    avoirs:         LigneAvoir[]
    annulees:       LigneAnnulee[]
}

export function RapportRetoursPDF({ donnees }: { donnees: DonneesRapportRetours }) {
    const d   = donnees.boutique.devise
    const fmt = (n: number) => formatMontantPDF(n, d)

    const colRetours: Colonne<LigneRetour>[] = [
        { entete: 'Retour', largeur: '13%', gras: true,
          rendu: r => r.public_id, sousTexte: r => r.date },
        { entete: 'Vente', largeur: '12%', rendu: r => r.vente },
        { entete: 'Client', largeur: '16%', rendu: r => r.client, sousTexte: r => r.entrepot },
        { entete: 'Motif', largeur: '25%', rendu: r => r.motif, sousTexte: r => r.note },
        { entete: 'Suite donnée', largeur: '18%',
          rendu: r => LIBELLE_REGLEMENT[r.reglement] ?? r.reglement,
          sousTexte: r => r.par,
          couleur: r => r.reglement === 'a_traiter' ? couleurs.orange : undefined },
        { entete: 'Montant', largeur: '16%', align: 'right', gras: true,
          rendu: r => fmt(r.montant) },
    ]

    const colAvoirs: Colonne<LigneAvoir>[] = [
        { entete: 'Avoir', largeur: '14%', gras: true,
          rendu: a => a.public_id, sousTexte: a => a.date },
        { entete: 'Facture', largeur: '14%', rendu: a => a.facture },
        { entete: 'Client', largeur: '18%', rendu: a => a.client },
        { entete: 'Motif', largeur: '24%', rendu: a => a.motif },
        { entete: 'Déduit', largeur: '15%', align: 'right',
          rendu: a => a.deduit > 0 ? fmt(a.deduit) : '—' },
        { entete: 'Porté en avance', largeur: '15%', align: 'right',
          rendu: a => a.avance > 0 ? fmt(a.avance) : '—',
          couleur: a => a.avance > 0 ? couleurs.orange : undefined },
    ]

    const colAnnulees: Colonne<LigneAnnulee>[] = [
        { entete: 'Vente', largeur: '13%', gras: true,
          rendu: v => v.public_id, sousTexte: v => v.date },
        { entete: 'Annulée le', largeur: '16%', rendu: v => v.annule_le },
        { entete: 'Client', largeur: '17%', rendu: v => v.client },
        { entete: 'Vendeur', largeur: '15%', rendu: v => v.vendeur },
        { entete: 'Motif', largeur: '23%', rendu: v => v.motif },
        { entete: 'Montant', largeur: '16%', align: 'right', gras: true,
          rendu: v => fmt(v.montant), couleur: () => couleurs.rouge },
    ]

    return (
        <DocumentRapport
            boutique={donnees.boutique}
            titre="RETOURS ET AVOIRS"
            sousTitre={donnees.periode}
            genereLe={donnees.genere_le}
            pied={`${donnees.boutique.nom} — Retours et avoirs — ${donnees.genere_le} — Manetec Gestock`}
        >
            <CartesStats cartes={[
                { label: 'Retours', valeur: String(donnees.nb_retours),
                  note: fmt(donnees.total_retours),
                  couleur: donnees.nb_retours > 0 ? couleurs.orange : couleurs.vert },
                { label: 'Dont à traiter', valeur: String(donnees.a_traiter),
                  couleur: donnees.a_traiter > 0 ? couleurs.rouge : couleurs.vert,
                  note: 'sans suite décidée' },
                { label: 'Avoirs émis', valeur: String(donnees.nb_avoirs),
                  note: fmt(donnees.total_avoirs) },
                { label: 'Ventes annulées', valeur: String(donnees.nb_annulees),
                  note: fmt(donnees.total_annulees),
                  couleur: donnees.nb_annulees > 0 ? couleurs.rouge : couleurs.vert },
            ]} />

            <SectionTitre>Retours de marchandise ({donnees.nb_retours})</SectionTitre>
            <TableauRapport
                colonnes={colRetours}
                lignes={donnees.retours}
                vide="Aucun retour sur cette période."
                totaux={donnees.nb_retours > 0
                    ? ['TOTAL', '', '', '', '', fmt(donnees.total_retours)]
                    : undefined}
            />

            {donnees.par_reglement.length > 0 && (
                <NotePDF>
                    Suite donnée aux retours :{' '}
                    {donnees.par_reglement
                        .map(r => `${LIBELLE_REGLEMENT[r.reglement] ?? r.reglement} — `
                                + `${r.nb} pour ${fmt(r.montant)}`)
                        .join(' · ')}.
                    {donnees.a_traiter > 0
                        ? ` ${donnees.a_traiter} retour(s) attendent encore une décision.`
                        : ''}
                </NotePDF>
            )}

            <SectionTitre>Avoirs émis ({donnees.nb_avoirs})</SectionTitre>
            <TableauRapport
                colonnes={colAvoirs}
                lignes={donnees.avoirs}
                vide="Aucun avoir émis sur cette période."
            />

            <SectionTitre>Ventes annulées ({donnees.nb_annulees})</SectionTitre>
            <TableauRapport
                colonnes={colAnnulees}
                lignes={donnees.annulees}
                vide="Aucune vente annulée sur cette période."
                totaux={donnees.nb_annulees > 0
                    ? ['TOTAL', '', '', '', '', fmt(donnees.total_annulees)]
                    : undefined}
            />

            <NotePDF>
                Ces trois montants ne s&apos;additionnent pas : un retour porté en avance
                reste dû au client, un avoir déduit a déjà réduit la facture, et une vente
                annulée est sortie des totaux le jour de son annulation. Les ventes annulées
                sont datées deux fois — le jour de la vente, et le jour de l&apos;annulation.
            </NotePDF>
        </DocumentRapport>
    )
}
