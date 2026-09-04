import React from 'react'
import { couleurs } from '@/lib/pdf/styles'
import type { BoutiqueEntete } from '@/lib/pdf/entete-rapport'
import {
    DocumentRapport, CartesStats, TableauRapport, NotePDF, type Colonne,
} from '@/lib/pdf/template'

// ══════════════════════════════════════════════════════════════
// Mouvements de stock — repris sur le gabarit commun (D2).
//
// La date du mouvement manquait dans le tableau : on lisait « Vente
// -1, avant 9, après 8 » sans savoir quand. Elle passe sous le
// numéro, là où le gabarit place déjà les seconds textes.
// ══════════════════════════════════════════════════════════════

const TYPE_LABELS: Record<string, string> = {
    entree_initiale:    'Entrée initiale',
    vente:              'Vente',
    retour_vente:       'Retour vente',
    reception:          'Réception',
    retour_fournisseur: 'Retour fourn.',
    transfert_sortie:   'Transfert sortant',
    transfert_entree:   'Transfert entrant',
    ajustement_positif: 'Ajustement +',
    ajustement_negatif: 'Ajustement -',
    inventaire:         'Inventaire',
}

const ENTREES = [
    'entree_initiale', 'reception', 'retour_vente',
    'transfert_entree', 'ajustement_positif',
]

interface Mouvement {
    public_id: string; type_mouvement: string
    produit_nom: string; entrepot_nom: string
    quantite: number; quantite_avant: number; quantite_apres: number
    date: string
    reference?: string
}

interface DonneesRapportMouvements {
    boutique: BoutiqueEntete
    periode:         string
    genere_le:       string
    total_entrees:   number
    total_sorties:   number
    total_transferts: number
    quantite_entree?: number
    quantite_sortie?: number
    mouvements:      Mouvement[]
}

export function RapportMouvementsPDF({ donnees }: { donnees: DonneesRapportMouvements }) {
    const estEntree = (m: Mouvement) => ENTREES.includes(m.type_mouvement)

    const colonnes: Colonne<Mouvement>[] = [
        { entete: 'Mouvement', largeur: '15%', gras: true,
          rendu: m => m.public_id, sousTexte: m => m.date },
        { entete: 'Type', largeur: '15%',
          rendu: m => TYPE_LABELS[m.type_mouvement] ?? m.type_mouvement,
          sousTexte: m => m.reference && m.reference !== m.public_id ? m.reference : null,
          couleur: m => estEntree(m) ? couleurs.vert : couleurs.rouge },
        { entete: 'Produit', largeur: '30%',
          rendu: m => m.produit_nom, sousTexte: m => m.entrepot_nom },
        { entete: 'Qté', largeur: '14%', align: 'center', gras: true,
          rendu: m => `${estEntree(m) ? '+' : '-'}${m.quantite}`,
          couleur: m => estEntree(m) ? couleurs.vert : couleurs.rouge },
        { entete: 'Avant', largeur: '13%', align: 'center',
          rendu: m => String(m.quantite_avant) },
        { entete: 'Après', largeur: '13%', align: 'center', gras: true,
          rendu: m => String(m.quantite_apres) },
    ]

    return (
        <DocumentRapport
            boutique={donnees.boutique}
            titre="MOUVEMENTS DE STOCK"
            sousTitre={donnees.periode}
            genereLe={donnees.genere_le}
            pied={`${donnees.boutique.nom} — Mouvements de stock — ${donnees.genere_le} — Manetec Gestock`}
        >
            <CartesStats cartes={[
                { label: 'Entrées', valeur: String(donnees.total_entrees),
                  note: donnees.quantite_entree !== undefined
                      ? `${donnees.quantite_entree} unité(s)` : undefined,
                  couleur: couleurs.vert },
                { label: 'Sorties', valeur: String(donnees.total_sorties),
                  note: donnees.quantite_sortie !== undefined
                      ? `${donnees.quantite_sortie} unité(s)` : undefined,
                  couleur: couleurs.rouge },
                { label: 'Transferts', valeur: String(donnees.total_transferts),
                  note: 'entre entrepôts', couleur: couleurs.orange },
            ]} />

            <TableauRapport
                colonnes={colonnes}
                lignes={donnees.mouvements}
                vide="Aucun mouvement de stock sur cette période."
            />

            <NotePDF>
                Un transfert produit deux lignes — une sortie et une entrée — et ne change
                pas la quantité totale détenue par la boutique.
            </NotePDF>
        </DocumentRapport>
    )
}
