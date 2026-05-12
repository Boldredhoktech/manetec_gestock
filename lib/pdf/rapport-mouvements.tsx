import React from 'react'
import { Document, Page, Text, View, StyleSheet } from '@react-pdf/renderer'
import { couleurs } from '@/lib/pdf/styles'
import { formatMontantPDF } from '@/lib/pdf/utils-pdf'

const styles = StyleSheet.create({
    page: {
        fontFamily: 'Helvetica', fontSize: 9,
        color: couleurs.texte, padding: 30, backgroundColor: '#fff',
    },
    entete: {
        display: 'flex', flexDirection: 'row', justifyContent: 'space-between',
        marginBottom: 20, paddingBottom: 12,
        borderBottomWidth: 2, borderBottomColor: couleurs.primaire,
    },
    titreBoutique: { fontSize: 16, fontFamily: 'Helvetica-Bold', color: couleurs.primaire },
    infoBoutique: { fontSize: 8, color: couleurs.texteFaible, marginTop: 2 },
    titrePage: { fontSize: 11, fontFamily: 'Helvetica-Bold', textAlign: 'right', marginBottom: 2 },
    infoGrise: { fontSize: 8, color: couleurs.texteFaible, textAlign: 'right' },
    statsRow: { display: 'flex', flexDirection: 'row', gap: 8, marginBottom: 16 },
    statCard: {
        flex: 1, backgroundColor: couleurs.fondClair, padding: 10,
        borderRadius: 6, borderLeftWidth: 3, borderLeftColor: couleurs.accent,
    },
    statLabel: { fontSize: 7, color: couleurs.texteFaible, marginBottom: 3 },
    statVal: { fontSize: 13, fontFamily: 'Helvetica-Bold', color: couleurs.primaire },
    tableauEntete: {
        display: 'flex', flexDirection: 'row',
        backgroundColor: couleurs.primaire, padding: 6, borderRadius: 4,
    },
    cellEnt: { fontFamily: 'Helvetica-Bold', fontSize: 8, color: '#fff' },
    ligne: {
        display: 'flex', flexDirection: 'row',
        padding: 5, borderBottomWidth: 1, borderBottomColor: couleurs.bordure,
    },
    ligneImp: { backgroundColor: couleurs.fondClair },
    cell: { fontSize: 8, color: couleurs.texte },
    pied: {
        position: 'absolute', bottom: 20, left: 30, right: 30,
        textAlign: 'center', fontSize: 7, color: couleurs.texteFaible,
        borderTopWidth: 1, borderTopColor: couleurs.bordure, paddingTop: 6,
    },
})

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

interface Mouvement {
    public_id: string; type_mouvement: string
    produit_nom: string; entrepot_nom: string
    quantite: number; quantite_avant: number; quantite_apres: number
    date: string
}

interface DonneesRapportMouvements {
    boutique:        { nom: string; telephone_1: string }
    periode:         string
    genere_le:       string
    total_entrees:   number
    total_sorties:   number
    total_transferts: number
    mouvements:      Mouvement[]
}

export function RapportMouvementsPDF({ donnees }: { donnees: DonneesRapportMouvements }) {
    return (
        <Document>
            <Page size="A4" style={styles.page}>

                <View style={styles.entete}>
                    <View>
                        <Text style={styles.titreBoutique}>{donnees.boutique.nom}</Text>
                        <Text style={styles.infoBoutique}>Tél : {donnees.boutique.telephone_1}</Text>
                    </View>
                    <View>
                        <Text style={styles.titrePage}>MOUVEMENTS DE STOCK</Text>
                        <Text style={styles.infoGrise}>{donnees.periode}</Text>
                        <Text style={[styles.infoGrise, { marginTop: 2 }]}>
                            Généré le {donnees.genere_le}
                        </Text>
                    </View>
                </View>

                <View style={styles.statsRow}>
                    <View style={[styles.statCard, { borderLeftColor: couleurs.vert }]}>
                        <Text style={styles.statLabel}>Entrées</Text>
                        <Text style={[styles.statVal, { color: couleurs.vert }]}>{donnees.total_entrees}</Text>
                    </View>
                    <View style={[styles.statCard, { borderLeftColor: couleurs.rouge }]}>
                        <Text style={styles.statLabel}>Sorties</Text>
                        <Text style={[styles.statVal, { color: couleurs.rouge }]}>{donnees.total_sorties}</Text>
                    </View>
                    <View style={[styles.statCard, { borderLeftColor: couleurs.orange }]}>
                        <Text style={styles.statLabel}>Transferts</Text>
                        <Text style={[styles.statVal, { color: couleurs.orange }]}>{donnees.total_transferts}</Text>
                    </View>
                </View>

                <View style={styles.tableauEntete}>
                    <Text style={[styles.cellEnt, { width: '12%' }]}>ID</Text>
                    <Text style={[styles.cellEnt, { width: '16%' }]}>Type</Text>
                    <Text style={[styles.cellEnt, { width: '26%' }]}>Produit</Text>
                    <Text style={[styles.cellEnt, { width: '16%' }]}>Entrepôt</Text>
                    <Text style={[styles.cellEnt, { width: '10%', textAlign: 'center' }]}>Qté</Text>
                    <Text style={[styles.cellEnt, { width: '10%', textAlign: 'center' }]}>Avant</Text>
                    <Text style={[styles.cellEnt, { width: '10%', textAlign: 'center' }]}>Après</Text>
                </View>

                {donnees.mouvements.map((m, i) => {
                    const estEntree = ['entree_initiale','reception','retour_vente','transfert_entree','ajustement_positif'].includes(m.type_mouvement)
                    return (
                        <View key={m.public_id} style={[styles.ligne, i % 2 !== 0 ? styles.ligneImp : {}]}>
                            <Text style={[styles.cell, { width: '12%', fontSize: 7, fontFamily: 'Helvetica-Bold' }]}>
                                {m.public_id}
                            </Text>
                            <Text style={[styles.cell, { width: '16%', color: estEntree ? couleurs.vert : couleurs.rouge }]}>
                                {TYPE_LABELS[m.type_mouvement] ?? m.type_mouvement}
                            </Text>
                            <Text style={[styles.cell, { width: '26%', maxLines: 1 }]}>{m.produit_nom}</Text>
                            <Text style={[styles.cell, { width: '16%', maxLines: 1 }]}>{m.entrepot_nom}</Text>
                            <Text style={[styles.cell, {
                                width: '10%', textAlign: 'center', fontFamily: 'Helvetica-Bold',
                                color: estEntree ? couleurs.vert : couleurs.rouge,
                            }]}>
                                {estEntree ? '+' : '-'}{m.quantite}
                            </Text>
                            <Text style={[styles.cell, { width: '10%', textAlign: 'center' }]}>{m.quantite_avant}</Text>
                            <Text style={[styles.cell, { width: '10%', textAlign: 'center', fontFamily: 'Helvetica-Bold' }]}>
                                {m.quantite_apres}
                            </Text>
                        </View>
                    )
                })}

                <Text style={styles.pied}>
                    {donnees.boutique.nom} — Mouvements de stock — {donnees.genere_le} — Manetec Gestock
                </Text>
            </Page>
        </Document>
    )
}