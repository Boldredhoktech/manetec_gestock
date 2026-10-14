import React from 'react'
import { couleurs } from '@/lib/pdf/styles'
import { formatMontantPDF, formatDatePDF } from '@/lib/pdf/utils-pdf'
import {
    DocumentRapport, TableauRapport, BlocInfos, CartesStats, SectionTitre, NotePDF,
    type Colonne,
} from '@/lib/pdf/template'

interface LigneRapport {
    nom: string; categorie: string; unite: string
    theorique: number; reel: number; ecart: number; valeurEcart: number
}
export interface DonneesRapportInventaire {
    boutique: {
        nom: string; adresse?: string | null; ville?: string | null
        telephone_1?: string | null; ifu?: string | null; rccm?: string | null
        devise: string; logo_url?: string | null
    }
    inventaire: {
        public_id: string; nom: string | null; warehouse_nom: string; date: string
        valeur_pertes: number; valeur_gains: number
    }
    lignes: LigneRapport[]
    genere_le: string
}

export function RapportInventairePDF({ donnees }: { donnees: DonneesRapportInventaire }) {
    const { boutique, inventaire, lignes } = donnees
    const fmt = (n: number) => formatMontantPDF(n, boutique.devise)
    const nbEcarts = lignes.filter(l => l.ecart !== 0).length
    const valNette = inventaire.valeur_gains - inventaire.valeur_pertes
    // Les écarts d'abord, les plus forts en tête : c'est ce qu'on vient lire.
    const tri = [...lignes].sort((a, b) => Math.abs(b.ecart) - Math.abs(a.ecart))

    const couleurEcart = (l: LigneRapport) =>
        l.ecart === 0 ? couleurs.texteFaible : l.ecart < 0 ? couleurs.rouge : couleurs.vert
    const signe = (n: number) => (n > 0 ? '+' : n < 0 ? '-' : '')

    const colonnes: Colonne<LigneRapport>[] = [
        { entete: 'Désignation', largeur: '30%', gras: true, rendu: l => l.nom },
        { entete: 'Catégorie',   largeur: '18%', rendu: l => l.categorie || '—' },
        { entete: 'Théorique',   largeur: '13%', align: 'right', rendu: l => `${l.theorique} ${l.unite}` },
        { entete: 'Réel',        largeur: '13%', align: 'right', rendu: l => `${l.reel} ${l.unite}` },
        { entete: 'Écart',       largeur: '10%', align: 'right', gras: true, couleur: couleurEcart,
          rendu: l => `${signe(l.ecart)}${Math.abs(l.ecart)}` },
        { entete: 'Valeur',      largeur: '16%', align: 'right', couleur: couleurEcart,
          rendu: l => (l.ecart === 0 ? '—' : `${signe(l.ecart)}${fmt(l.valeurEcart)}`) },
    ]

    return (
        <DocumentRapport
            boutique={boutique}
            titre="RAPPORT D'INVENTAIRE"
            sousTitre={`${inventaire.public_id} · validé`}
            genereLe={donnees.genere_le}
            pied={`${boutique.nom}${boutique.ifu ? ` · IFU ${boutique.ifu}` : ''} — Rapport d'inventaire ${inventaire.public_id}`}
        >
            <BlocInfos infos={[
                { label: 'Inventaire',         valeur: inventaire.nom ?? inventaire.public_id },
                { label: 'Entrepôt',           valeur: inventaire.warehouse_nom },
                { label: 'Date de validation', valeur: formatDatePDF(inventaire.date) },
            ]} />

            <CartesStats cartes={[
                { label: 'Articles inventoriés', valeur: String(lignes.length) },
                { label: 'Articles avec écart',  valeur: String(nbEcarts), couleur: couleurs.orange },
                { label: 'Pertes', valeur: `-${fmt(inventaire.valeur_pertes)}`, couleur: couleurs.rouge },
                { label: 'Gains',  valeur: `+${fmt(inventaire.valeur_gains)}`,  couleur: couleurs.vert },
            ]} />

            <SectionTitre>Détail par article</SectionTitre>
            <TableauRapport
                colonnes={colonnes}
                lignes={tri}
                totaux={[
                    'IMPACT NET SUR LA VALEUR DU STOCK', '', '', '', '',
                    `${valNette >= 0 ? '+' : '-'}${fmt(Math.abs(valNette))}`,
                ]}
                vide="Aucun article dans cet inventaire."
            />

            <NotePDF>
                Valorisation au prix d&apos;achat. Les écarts ont été passés en ajustement de stock à la
                validation ; ils n&apos;entrent pas dans la trésorerie.
            </NotePDF>
        </DocumentRapport>
    )
}
