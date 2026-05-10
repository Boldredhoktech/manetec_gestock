import React from 'react'
import { Document, Page, Text, View, StyleSheet } from '@react-pdf/renderer'
import { couleurs } from '@/lib/pdf/styles'

const styles = StyleSheet.create({
    page: {
        fontFamily: 'Helvetica', fontSize: 9,
        color: couleurs.texte, padding: 40, backgroundColor: '#fff',
    },
    entete: {
        display: 'flex', flexDirection: 'row',
        justifyContent: 'space-between', marginBottom: 24,
    },
    nomBoutique: {
        fontSize: 18, fontFamily: 'Helvetica-Bold',
        color: couleurs.primaire, marginBottom: 4,
    },
    infoBoutique: { fontSize: 8, color: couleurs.texteFaible, marginBottom: 2 },
    titreDoc: {
        fontSize: 22, fontFamily: 'Helvetica-Bold',
        color: couleurs.primaire, textAlign: 'right', marginBottom: 4,
    },
    refDoc: { fontSize: 9, fontFamily: 'Helvetica-Bold', textAlign: 'right', marginBottom: 2 },
    dateDoc: { fontSize: 8, color: couleurs.texteFaible, textAlign: 'right' },
    partiesBlock: {
        display: 'flex', flexDirection: 'row',
        justifyContent: 'space-between', marginBottom: 20, gap: 16,
    },
    partieCard: {
        flex: 1, backgroundColor: couleurs.fondClair,
        padding: 10, borderRadius: 4,
    },
    partieLabel: {
        fontSize: 7, fontFamily: 'Helvetica-Bold', color: couleurs.texteFaible,
        textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 5,
    },
    partieNom: {
        fontSize: 10, fontFamily: 'Helvetica-Bold',
        color: couleurs.primaire, marginBottom: 3,
    },
    partieInfo: { fontSize: 8, color: couleurs.texteFaible, marginBottom: 1 },
    tableauEntete: {
        display: 'flex', flexDirection: 'row',
        backgroundColor: couleurs.primaire, padding: 7, borderRadius: 4,
    },
    cellEnt: { fontFamily: 'Helvetica-Bold', fontSize: 8, color: '#fff' },
    tableLigne: {
        display: 'flex', flexDirection: 'row',
        padding: 6, borderBottomWidth: 1, borderBottomColor: couleurs.bordure,
    },
    tableLigneImp: { backgroundColor: couleurs.fondClair },
    cell: { fontSize: 8.5, color: couleurs.texte },
    totauxBlock: {
        display: 'flex', flexDirection: 'row',
        justifyContent: 'flex-end', marginTop: 12,
    },
    totauxInner: { width: '35%' },
    totalLigne: {
        display: 'flex', flexDirection: 'row',
        justifyContent: 'space-between', marginBottom: 3,
    },
    totalLabel: { fontSize: 8.5, color: couleurs.texteFaible },
    totalValeur: { fontSize: 8.5, color: couleurs.texte },
    grandTotalLigne: {
        display: 'flex', flexDirection: 'row', justifyContent: 'space-between',
        borderTopWidth: 2, borderTopColor: couleurs.primaire,
        paddingTop: 6, marginTop: 4,
    },
    grandTotalLabel: { fontSize: 10, fontFamily: 'Helvetica-Bold', color: couleurs.primaire },
    grandTotalValeur: { fontSize: 10, fontFamily: 'Helvetica-Bold', color: couleurs.primaire },
    noteBlock: {
        marginTop: 16, padding: 10, backgroundColor: couleurs.fondClair,
        borderRadius: 4, borderLeftWidth: 3, borderLeftColor: couleurs.accent,
    },
    noteLabel: { fontSize: 7, fontFamily: 'Helvetica-Bold', color: couleurs.texteFaible, marginBottom: 3 },
    noteTexte: { fontSize: 8, color: couleurs.texte },
    pied: {
        position: 'absolute', bottom: 24, left: 40, right: 40,
        textAlign: 'center', fontSize: 7, color: couleurs.texteFaible,
        borderTopWidth: 1, borderTopColor: couleurs.bordure, paddingTop: 6,
    },
    signatureBlock: {
        display: 'flex', flexDirection: 'row',
        justifyContent: 'space-between', marginTop: 32, gap: 20,
    },
    signatureBox: {
        flex: 1, borderTopWidth: 1, borderTopColor: couleurs.bordure,
        paddingTop: 6, alignItems: 'center',
    },
    signatureLabel: { fontSize: 8, color: couleurs.texteFaible },
})

interface LignePO {
    designation: string; quantite: number
    prix_unitaire: number; montant_ligne: number
}

interface DonneesBonCommande {
    boutique: {
        nom: string; adresse?: string | null; telephone_1: string
        email?: string | null; ifu?: string | null; devise: string
    }
    fournisseur: {
        nom: string; adresse?: string | null; ville?: string | null
        telephone?: string | null; email?: string | null
        ifu?: string | null
    }
    bon: {
        public_id: string; date_commande: string
        date_livraison?: string | null; notes?: string | null
        montant_total: number
    }
    lignes:    LignePO[]
    genere_le: string
}

function fmt(n: number, d: string) {
    return new Intl.NumberFormat('fr-FR').format(n) + ' ' + d
}

export function BonCommandePDF({ donnees }: { donnees: DonneesBonCommande }) {
    const { boutique, fournisseur, bon, lignes } = donnees
    const d = boutique.devise

    return (
        <Document>
            <Page size="A4" style={styles.page}>

                <View style={styles.entete}>
                    <View>
                        <Text style={styles.nomBoutique}>{boutique.nom}</Text>
                        {boutique.adresse && <Text style={styles.infoBoutique}>{boutique.adresse}</Text>}
                        <Text style={styles.infoBoutique}>Tél : {boutique.telephone_1}</Text>
                        {boutique.email && <Text style={styles.infoBoutique}>{boutique.email}</Text>}
                        {boutique.ifu && <Text style={styles.infoBoutique}>IFU : {boutique.ifu}</Text>}
                    </View>
                    <View>
                        <Text style={styles.titreDoc}>BON DE COMMANDE</Text>
                        <Text style={styles.refDoc}>{bon.public_id}</Text>
                        <Text style={styles.dateDoc}>Date : {bon.date_commande}</Text>
                        {bon.date_livraison && (
                            <Text style={[styles.dateDoc, { marginTop: 2 }]}>
                                Livraison souhaitée : {bon.date_livraison}
                            </Text>
                        )}
                    </View>
                </View>

                <View style={styles.partiesBlock}>
                    <View style={styles.partieCard}>
                        <Text style={styles.partieLabel}>Acheteur</Text>
                        <Text style={styles.partieNom}>{boutique.nom}</Text>
                        {boutique.adresse && <Text style={styles.partieInfo}>{boutique.adresse}</Text>}
                        <Text style={styles.partieInfo}>{boutique.telephone_1}</Text>
                    </View>
                    <View style={styles.partieCard}>
                        <Text style={styles.partieLabel}>Fournisseur</Text>
                        <Text style={styles.partieNom}>{fournisseur.nom}</Text>
                        {fournisseur.adresse && <Text style={styles.partieInfo}>{fournisseur.adresse}</Text>}
                        {fournisseur.ville && <Text style={styles.partieInfo}>{fournisseur.ville}</Text>}
                        {fournisseur.telephone && <Text style={styles.partieInfo}>{fournisseur.telephone}</Text>}
                        {fournisseur.ifu && <Text style={styles.partieInfo}>IFU : {fournisseur.ifu}</Text>}
                    </View>
                </View>

                <View style={styles.tableauEntete}>
                    <Text style={[styles.cellEnt, { width: '44%' }]}>Désignation</Text>
                    <Text style={[styles.cellEnt, { width: '14%', textAlign: 'center' }]}>Quantité</Text>
                    <Text style={[styles.cellEnt, { width: '21%', textAlign: 'right' }]}>Prix unitaire</Text>
                    <Text style={[styles.cellEnt, { width: '21%', textAlign: 'right' }]}>Montant</Text>
                </View>

                {lignes.map((l, i) => (
                    <View key={i} style={[styles.tableLigne, i % 2 !== 0 ? styles.tableLigneImp : {}]}>
                        <Text style={[styles.cell, { width: '44%' }]}>{l.designation}</Text>
                        <Text style={[styles.cell, { width: '14%', textAlign: 'center' }]}>{l.quantite}</Text>
                        <Text style={[styles.cell, { width: '21%', textAlign: 'right' }]}>
                            {fmt(l.prix_unitaire, d)}
                        </Text>
                        <Text style={[styles.cell, { width: '21%', textAlign: 'right', fontFamily: 'Helvetica-Bold' }]}>
                            {fmt(l.montant_ligne, d)}
                        </Text>
                    </View>
                ))}

                <View style={styles.totauxBlock}>
                    <View style={styles.totauxInner}>
                        <View style={styles.grandTotalLigne}>
                            <Text style={styles.grandTotalLabel}>TOTAL</Text>
                            <Text style={styles.grandTotalValeur}>{fmt(bon.montant_total, d)}</Text>
                        </View>
                    </View>
                </View>

                {bon.notes && (
                    <View style={styles.noteBlock}>
                        <Text style={styles.noteLabel}>CONDITIONS / NOTES</Text>
                        <Text style={styles.noteTexte}>{bon.notes}</Text>
                    </View>
                )}

                <View style={styles.signatureBlock}>
                    <View style={styles.signatureBox}>
                        <Text style={styles.signatureLabel}>Signature acheteur</Text>
                    </View>
                    <View style={styles.signatureBox}>
                        <Text style={styles.signatureLabel}>Signature fournisseur</Text>
                    </View>
                </View>

                <Text style={styles.pied}>
                    {boutique.nom} — {bon.public_id} — Généré le {donnees.genere_le} — Manetec Gestock
                </Text>

            </Page>
        </Document>
    )
}