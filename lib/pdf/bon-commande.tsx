import React from 'react'
import { Text, View } from '@react-pdf/renderer'
import { couleurs } from '@/lib/pdf/styles'
import { formatMontantPDF, formatDatePDF } from '@/lib/pdf/utils-pdf'
import {
    DocumentRapport, TableauRapport, BlocInfos, SectionTitre, NotePDF,
    type Colonne,
} from '@/lib/pdf/template'

// Le bon de commande est le premier document écrit sur le gabarit
// commun : on y déclare ses colonnes et ses blocs, la mise en page
// vient de lib/pdf/template.tsx.

interface Ligne {
    designation:   string
    quantite:      number
    prix_unitaire: number
    montant_ligne: number
}

interface DonneesBonCommande {
    boutique: {
        nom: string; adresse?: string | null; ville?: string | null
        telephone_1?: string | null; email?: string | null
        ifu?: string | null; logo_url?: string | null; devise: string
    }
    fournisseur: {
        nom?: string; adresse?: string | null; ville?: string | null
        telephone?: string | null; email?: string | null; ifu?: string | null
    }
    bon: {
        public_id: string; date_commande: string
        date_livraison: string | null; montant_total: number
        notes: string | null; statut?: string
    }
    lignes:    Ligne[]
    genere_le: string
}

const STATUTS: Record<string, string> = {
    brouillon:    'Brouillon — non transmis',
    soumis:       'Commande transmise au fournisseur',
    recu_partiel: 'Reçue en partie',
    recu_total:   'Reçue en totalité',
    annule:       'Commande annulée',
}

export function BonCommandePDF({ donnees }: { donnees: DonneesBonCommande }) {
    const d   = donnees.boutique.devise
    const fmt = (n: number) => formatMontantPDF(n, d)
    const f   = donnees.fournisseur

    const colonnes: Colonne<Ligne>[] = [
        { entete: 'Désignation', largeur: '52%', rendu: l => l.designation },
        { entete: 'Quantité',    largeur: '14%', align: 'right', rendu: l => String(l.quantite) },
        { entete: 'Prix unitaire', largeur: '17%', align: 'right', rendu: l => fmt(l.prix_unitaire) },
        { entete: 'Total',       largeur: '17%', align: 'right', gras: true, rendu: l => fmt(l.montant_ligne) },
    ]

    return (
        <DocumentRapport
            boutique={donnees.boutique}
            titre="BON DE COMMANDE"
            sousTitre={`${donnees.bon.public_id} · ${formatDatePDF(donnees.bon.date_commande)}`}
            genereLe={donnees.genere_le}
            pied="Merci de nous confirmer la disponibilité et le délai de livraison des articles commandés."
        >
            {/* Destinataire */}
            <View style={{
                backgroundColor: couleurs.fondClair, padding: 12, borderRadius: 6,
                marginBottom: 14, borderLeftWidth: 3, borderLeftColor: couleurs.primaire,
            }}>
                <Text style={{ fontSize: 7, color: couleurs.texteFaible }}>À l&apos;attention de</Text>
                <Text style={{ fontSize: 12, fontFamily: 'Helvetica-Bold', color: couleurs.primaire, marginTop: 2 }}>
                    {f.nom ?? 'Fournisseur'}
                </Text>
                {(f.adresse || f.ville) && (
                    <Text style={{ fontSize: 8, color: couleurs.texteFaible, marginTop: 2 }}>
                        {[f.adresse, f.ville].filter(Boolean).join(', ')}
                    </Text>
                )}
                {(f.telephone || f.email) && (
                    <Text style={{ fontSize: 8, color: couleurs.texteFaible, marginTop: 1 }}>
                        {[f.telephone, f.email].filter(Boolean).join(' · ')}
                    </Text>
                )}
                {f.ifu && (
                    <Text style={{ fontSize: 8, color: couleurs.texteFaible, marginTop: 1 }}>IFU : {f.ifu}</Text>
                )}
            </View>

            <BlocInfos infos={[
                { label: 'Date de commande',  valeur: formatDatePDF(donnees.bon.date_commande) },
                { label: 'Livraison souhaitée', valeur: donnees.bon.date_livraison
                    ? formatDatePDF(donnees.bon.date_livraison) : 'Non précisée' },
                { label: 'État',             valeur: STATUTS[donnees.bon.statut ?? ''] ?? 'Commande' },
            ]} />

            <SectionTitre>Articles commandés</SectionTitre>

            <TableauRapport
                colonnes={colonnes}
                lignes={donnees.lignes}
                totaux={['TOTAL DE LA COMMANDE', '', '', fmt(donnees.bon.montant_total)]}
                vide="Aucun article sur ce bon de commande."
            />

            {donnees.bon.notes && (
                <>
                    <SectionTitre>Notes</SectionTitre>
                    <Text style={{ fontSize: 8, color: couleurs.texte }}>{donnees.bon.notes}</Text>
                </>
            )}

            <NotePDF>
                Ce bon de commande vaut engagement d&apos;achat aux prix indiqués.
                La marchandise sera contrôlée à la réception ; toute différence de quantité
                ou de prix sera signalée avant règlement.
            </NotePDF>
        </DocumentRapport>
    )
}
