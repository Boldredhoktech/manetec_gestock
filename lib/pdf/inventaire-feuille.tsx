import React from 'react'
import { formatDatePDF } from '@/lib/pdf/utils-pdf'
import {
    DocumentRapport, TableauRapport, BlocInfos, Encart, BlocSignatures,
    type Colonne,
} from '@/lib/pdf/template'

// Feuille imprimée et remplie à la main pendant le comptage physique.
// La quantité théorique n'y figure pas : le compteur ne doit pas être
// tenté de la recopier.

export interface DonneesFeuilleComptage {
    boutique: {
        nom: string; adresse?: string | null; ville?: string | null
        telephone_1?: string | null; ifu?: string | null; logo_url?: string | null
    }
    inventaire: { public_id: string; nom: string | null; warehouse_nom: string; date: string }
    lignes: { nom: string; categorie: string; unite: string }[]
    genere_le: string
}

type Ligne = DonneesFeuilleComptage['lignes'][number] & { rang: number }

const colonnes: Colonne<Ligne>[] = [
    { entete: 'N°',          largeur: '6%',  rendu: l => String(l.rang) },
    { entete: 'Désignation', largeur: '44%', gras: true, rendu: l => l.nom },
    { entete: 'Catégorie',   largeur: '24%', rendu: l => l.categorie || '—' },
    { entete: 'Unité',       largeur: '10%', rendu: l => l.unite },
    { entete: 'Qté comptée', largeur: '16%', align: 'center', aRemplir: true, rendu: () => '' },
]

export function FeuilleComptagePDF({ donnees }: { donnees: DonneesFeuilleComptage }) {
    const { inventaire, lignes } = donnees

    return (
        <DocumentRapport
            boutique={donnees.boutique}
            titre="FEUILLE DE COMPTAGE"
            sousTitre={inventaire.public_id}
            genereLe={donnees.genere_le}
            pied={`${donnees.boutique.nom} — Feuille de comptage ${inventaire.public_id}`}
        >
            <BlocInfos infos={[
                { label: 'Inventaire',         valeur: inventaire.nom ?? inventaire.public_id },
                { label: 'Entrepôt',           valeur: inventaire.warehouse_nom },
                { label: 'Date',               valeur: formatDatePDF(inventaire.date) },
                { label: 'Articles à compter', valeur: String(lignes.length) },
            ]} />

            <Encart
                titre="Comptez chaque article et inscrivez la quantité réelle dans la case."
                texte="La quantité théorique n'est pas affichée, pour que le comptage reste objectif."
            />

            <TableauRapport
                colonnes={colonnes}
                lignes={lignes.map((l, i) => ({ ...l, rang: i + 1 }))}
                vide="Aucun article actif à compter dans cet entrepôt."
            />

            <BlocSignatures roles={['Compté par', 'Vérifié par']} />
        </DocumentRapport>
    )
}
