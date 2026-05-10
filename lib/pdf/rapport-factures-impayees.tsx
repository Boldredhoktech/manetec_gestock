import React from 'react'
import { Document, Page, Text, View, StyleSheet } from '@react-pdf/renderer'
import { couleurs } from '@/lib/pdf/styles'

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
    titrePage: { fontSize: 11, fontFamily: 'Helvetica-Bold', textAlign: 'right', marginBottom: 2 },
    infoGrise: { fontSize: 8, color: couleurs.texteFaible, textAlign: 'right' },
    statsRow: { display: 'flex', flexDirection: 'row', gap: 8, marginBottom: 16 },
    statCard: {
        flex: 1, backgroundColor: couleurs.fondClair, padding: 10,
        borderRadius: 6, borderLeftWidth: 3, borderLeftColor: couleurs.rouge,
    },
    statLabel: { fontSize: 7, color: couleurs.texteFaible, marginBottom: 3 },
    statVal: { fontSize: 12, fontFamily: 'Helvetica-Bold', color: couleurs.rouge },
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
    ligneRetard: { backgroundColor: '#fff5f5' },
    cell: { fontSize: 8, color: couleurs.texte },
    pied: {
        position: 'absolute', bottom: 20, left: 30, right: 30,
        textAlign: 'center', fontSize: 7, color: couleurs.texteFaible,
        borderTopWidth: 1, borderTopColor: couleurs.bordure, paddingTop: 6,
    },
})

interface FactureImpayee {
    public_id:       string
    client_nom:      string
    date_facture:    string
    date_echeance:   string | null
    montant_ttc:     number
    montant_restant: number
    jours_retard:    number
    statut:          string
}

interface DonneesFacturesImpayees {
    boutique:          { nom: string; telephone_1: string; devise: string }
    genere_le:         string
    total_factures:    number
    total_en_retard:   number
    montant_total_du:  number
    montant_en_retard: number
    factures:          FactureImpayee[]
}

function fmt(n: number, d: string) {
    return new Intl.NumberFormat('fr-FR').format(n) + ' ' + d
}

export function RapportFacturesImpayeesPDF({ donnees }: { donnees: DonneesFacturesImpayees }) {
    const d = donnees.boutique.devise
    const enRetard = donnees.factures.filter(f => f.jours_retard > 0)
    const nonEchus = donnees.factures.filter(f => f.jours_retard <= 0)

    return (
        <Document>
            <Page size="A4" style={styles.page}>

                <View style={styles.entete}>
                    <View>
                        <Text style={styles.titreBoutique}>{donnees.boutique.nom}</Text>
                        <Text style={{ fontSize: 8, color: couleurs.texteFaible, marginTop: 2 }}>
                            Tél : {donnees.boutique.telephone_1}
                        </Text>
                    </View>
                    <View>
                        <Text style={styles.titrePage}>FACTURES IMPAYÉES</Text>
                        <Text style={styles.infoGrise}>Généré le {donnees.genere_le}</Text>
                    </View>
                </View>

                <View style={styles.statsRow}>
                    <View style={[styles.statCard, { borderLeftColor: couleurs.orange }]}>
                        <Text style={styles.statLabel}>Factures en attente</Text>
                        <Text style={[styles.statVal, { color: couleurs.orange }]}>
                            {donnees.total_factures}
                        </Text>
                    </View>
                    <View style={styles.statCard}>
                        <Text style={styles.statLabel}>En retard</Text>
                        <Text style={styles.statVal}>{donnees.total_en_retard}</Text>
                    </View>
                    <View style={[styles.statCard, { flex: 2 }]}>
                        <Text style={styles.statLabel}>Montant total dû</Text>
                        <Text style={styles.statVal}>{fmt(donnees.montant_total_du, d)}</Text>
                    </View>
                    <View style={[styles.statCard, { flex: 2 }]}>
                        <Text style={styles.statLabel}>Dont en retard</Text>
                        <Text style={styles.statVal}>{fmt(donnees.montant_en_retard, d)}</Text>
                    </View>
                </View>

                {enRetard.length > 0 && (
                    <>
                        <Text style={{
                            fontSize: 10, fontFamily: 'Helvetica-Bold', color: couleurs.rouge,
                            marginBottom: 6, paddingBottom: 3,
                            borderBottomWidth: 1, borderBottomColor: couleurs.bordure,
                        }}>
                            ⚠ Factures en retard ({enRetard.length})
                        </Text>
                        <View style={styles.tableauEntete}>
                            <Text style={[styles.cellEnt, { width: '14%' }]}>N° Facture</Text>
                            <Text style={[styles.cellEnt, { width: '22%' }]}>Client</Text>
                            <Text style={[styles.cellEnt, { width: '13%' }]}>Émise le</Text>
                            <Text style={[styles.cellEnt, { width: '13%' }]}>Échéance</Text>
                            <Text style={[styles.cellEnt, { width: '10%', textAlign: 'center' }]}>Retard</Text>
                            <Text style={[styles.cellEnt, { width: '14%', textAlign: 'right' }]}>Total</Text>
                            <Text style={[styles.cellEnt, { width: '14%', textAlign: 'right' }]}>Restant</Text>
                        </View>
                        {enRetard.map((f, i) => (
                            <View key={f.public_id} style={[styles.ligne, styles.ligneRetard]}>
                                <Text style={[styles.cell, { width: '14%', fontFamily: 'Helvetica-Bold', fontSize: 7 }]}>
                                    {f.public_id}
                                </Text>
                                <Text style={[styles.cell, { width: '22%' }]} numberOfLines={1}>{f.client_nom}</Text>
                                <Text style={[styles.cell, { width: '13%' }]}>{f.date_facture}</Text>
                                <Text style={[styles.cell, { width: '13%', color: couleurs.rouge }]}>
                                    {f.date_echeance ?? '—'}
                                </Text>
                                <Text style={[styles.cell, {
                                    width: '10%', textAlign: 'center',
                                    fontFamily: 'Helvetica-Bold', color: couleurs.rouge,
                                }]}>
                                    {f.jours_retard}j
                                </Text>
                                <Text style={[styles.cell, { width: '14%', textAlign: 'right' }]}>
                                    {fmt(f.montant_ttc, d)}
                                </Text>
                                <Text style={[styles.cell, {
                                    width: '14%', textAlign: 'right',
                                    fontFamily: 'Helvetica-Bold', color: couleurs.rouge,
                                }]}>
                                    {fmt(f.montant_restant, d)}
                                </Text>
                            </View>
                        ))}
                    </>
                )}

                {nonEchus.length > 0 && (
                    <>
                        <Text style={{
                            fontSize: 10, fontFamily: 'Helvetica-Bold', color: couleurs.orange,
                            marginTop: 14, marginBottom: 6, paddingBottom: 3,
                            borderBottomWidth: 1, borderBottomColor: couleurs.bordure,
                        }}>
                            Factures non encore échues ({nonEchus.length})
                        </Text>
                        <View style={styles.tableauEntete}>
                            <Text style={[styles.cellEnt, { width: '16%' }]}>N° Facture</Text>
                            <Text style={[styles.cellEnt, { width: '26%' }]}>Client</Text>
                            <Text style={[styles.cellEnt, { width: '16%' }]}>Émise le</Text>
                            <Text style={[styles.cellEnt, { width: '16%' }]}>Échéance</Text>
                            <Text style={[styles.cellEnt, { width: '26%', textAlign: 'right' }]}>Restant dû</Text>
                        </View>
                        {nonEchus.map((f, i) => (
                            <View key={f.public_id} style={[styles.ligne, i % 2 !== 0 ? styles.ligneImp : {}]}>
                                <Text style={[styles.cell, { width: '16%', fontFamily: 'Helvetica-Bold', fontSize: 7 }]}>
                                    {f.public_id}
                                </Text>
                                <Text style={[styles.cell, { width: '26%' }]} numberOfLines={1}>{f.client_nom}</Text>
                                <Text style={[styles.cell, { width: '16%' }]}>{f.date_facture}</Text>
                                <Text style={[styles.cell, { width: '16%' }]}>{f.date_echeance ?? '—'}</Text>
                                <Text style={[styles.cell, {
                                    width: '26%', textAlign: 'right',
                                    fontFamily: 'Helvetica-Bold', color: couleurs.orange,
                                }]}>
                                    {fmt(f.montant_restant, d)}
                                </Text>
                            </View>
                        ))}
                    </>
                )}

                <Text style={styles.pied}>
                    {donnees.boutique.nom} — Factures impayées — {donnees.genere_le} — Manetec Gestock
                </Text>
            </Page>
        </Document>
    )
}