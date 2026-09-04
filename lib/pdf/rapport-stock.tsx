import React from 'react'
import { couleurs } from '@/lib/pdf/styles'
import { formatMontantPDF } from '@/lib/pdf/utils-pdf'
import type { BoutiqueEntete } from '@/lib/pdf/entete-rapport'
import {
    DocumentRapport, CartesStats, TableauRapport, SectionTitre, NotePDF,
    type Colonne,
} from '@/lib/pdf/template'

// ══════════════════════════════════════════════════════════════
// État du stock — repris sur le gabarit commun.
//
// Le nom du produit débordait sur la colonne « Catégorie » : un
// `maxLines: 1` posé sur un `<Text>` de largeur relative ne coupe
// rien, il empile simplement les mots par-dessus le voisin. La
// catégorie descend donc sous le nom, en seconde ligne, et le nom
// récupère la place qui lui manquait.
//
// Les deux tableaux — alerte et stock normal — partagent désormais
// les mêmes colonnes : celui des alertes taisait le prix et la
// valeur, alors que ce sont les lignes qu'on regarde en premier.
// ══════════════════════════════════════════════════════════════

interface ProduitStock {
    public_id: string; nom: string; categorie: string | null
    unite: string; prix_achat: number; prix_vente: number
    // Le prix retenu pour valoriser la ligne est le dernier prix
    // RÉELLEMENT payé à la réception. `prix_courant` reste lisible à
    // côté, et `base_prix` dit laquelle des deux a servi.
    prix_courant: number; base_prix: string; valeur: number
    stock: number; seuil_alerte: number; en_alerte: boolean
    entrepot: string
}

interface DonneesRapportStock {
    boutique:          BoutiqueEntete & { devise: string }
    entrepot_filtre:   string
    genere_le:         string
    total_produits:    number
    produits_en_alerte: number
    valeur_stock:      number
    lignes_prix_courant: number
    produits:          ProduitStock[]
}

export function RapportStockPDF({ donnees }: { donnees: DonneesRapportStock }) {
    const d   = donnees.boutique.devise
    const fmt = (n: number) => formatMontantPDF(n, d)

    const alertes = donnees.produits.filter(p => p.en_alerte)
    const normaux = donnees.produits.filter(p => !p.en_alerte)

    function colonnes(enAlerte: boolean): Colonne<ProduitStock>[] {
        return [
            { entete: 'ID', largeur: '9%', rendu: p => p.public_id },
            { entete: 'Produit', largeur: '29%', gras: true,
              rendu: p => p.nom,
              sousTexte: p => p.categorie,
              couleur: () => enAlerte ? couleurs.rouge : undefined },
            { entete: 'Stock', largeur: '12%', align: 'center', gras: true,
              rendu: p => `${p.stock} ${p.unite}`,
              couleur: () => enAlerte ? couleurs.rouge : undefined },
            { entete: 'Seuil', largeur: '8%', align: 'center',
              rendu: p => String(p.seuil_alerte) },
            // L'asterisque marque une ligne valorisee faute de mieux :
            // aucune reception connue, donc le prix courant.
            { entete: 'Prix payé', largeur: '13%', align: 'right',
              rendu: p => fmt(p.prix_achat) + (p.base_prix === 'courant' ? ' *' : ''),
              couleur: p => p.base_prix === 'courant' ? couleurs.texteFaible : undefined },
            { entete: 'Prix vente', largeur: '13%', align: 'right',
              rendu: p => fmt(p.prix_vente) },
            { entete: 'Val. stock', largeur: '16%', align: 'right', gras: true,
              rendu: p => fmt(p.valeur) },
        ]
    }

    const totalAlertes = alertes.reduce((a, p) => a + p.valeur, 0)
    const totalNormaux = normaux.reduce((a, p) => a + p.valeur, 0)

    return (
        <DocumentRapport
            boutique={donnees.boutique}
            titre="ÉTAT DU STOCK"
            sousTitre={donnees.entrepot_filtre}
            genereLe={donnees.genere_le}
            pied={`${donnees.boutique.nom} — État du stock — ${donnees.genere_le} — Manetec Gestock`}
        >
            <CartesStats cartes={[
                { label: 'Total produits', valeur: String(donnees.total_produits) },
                { label: 'En alerte',      valeur: String(donnees.produits_en_alerte),
                  couleur: donnees.produits_en_alerte > 0 ? couleurs.rouge : couleurs.vert },
                { label: 'Valeur du stock', valeur: fmt(donnees.valeur_stock),
                  note: 'au prix réellement payé', couleur: couleurs.vert },
            ]} />

            {alertes.length > 0 && (
                <>
                    <SectionTitre>
                        Produits en alerte de stock ({alertes.length})
                    </SectionTitre>
                    <TableauRapport
                        colonnes={colonnes(true)}
                        lignes={alertes}
                        totaux={['', '', '', '', '', 'Valeur en alerte', fmt(totalAlertes)]}
                    />
                </>
            )}

            <SectionTitre>Stock normal ({normaux.length} produit(s))</SectionTitre>
            <TableauRapport
                colonnes={colonnes(false)}
                lignes={normaux}
                vide="Tous les produits sont en alerte de stock."
                totaux={['', '', '', '', '', 'Valeur', fmt(totalNormaux)]}
            />

            {donnees.lignes_prix_courant > 0 && (
                <NotePDF>
                    * {donnees.lignes_prix_courant} ligne(s) valorisée(s) au prix d&apos;achat
                    courant, faute d&apos;une réception connue pour ce produit. Les autres le
                    sont au dernier prix effectivement réglé au fournisseur.
                </NotePDF>
            )}
        </DocumentRapport>
    )
}
