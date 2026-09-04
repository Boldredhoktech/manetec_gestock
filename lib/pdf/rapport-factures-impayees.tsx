import React from 'react'
import { Document, Page, Text, View, StyleSheet } from '@react-pdf/renderer'
import { couleurs } from '@/lib/pdf/styles'
import { formatMontantPDF } from '@/lib/pdf/utils-pdf'
import { EnteteRapportPDF, type BoutiqueEntete } from '@/lib/pdf/entete-rapport'

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
    montant_avoirs:  number
    avoirs_refs:     string | null
    jours_retard:    number
    etat:            string
    statut:          string
}

interface DonneesFacturesImpayees {
    boutique: BoutiqueEntete & { devise: string }
    genere_le:         string
    total_factures:    number
    total_en_retard:   number
    total_avec_avoir:  number
    montant_total_du:  number
    montant_en_retard: number
    montant_avoirs:    number
    factures:          FactureImpayee[]
}

function fmt(n: number, d: string) {
    return formatMontantPDF(n, d)
}

export function RapportFacturesImpayeesPDF({ donnees }: { donnees: DonneesFacturesImpayees }) {
    const d = donnees.boutique.devise
    const enRetard = donnees.factures.filter(f => f.jours_retard > 0)
    const nonEchus = donnees.factures.filter(f => f.jours_retard <= 0)

    return (
        <Document>
            <Page size="A4" style={styles.page}>

                <EnteteRapportPDF boutique={donnees.boutique} titre="FACTURES IMPAYÉES" genereLe={donnees.genere_le} />

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
                    {donnees.montant_avoirs > 0 && (
                        <View style={[styles.statCard, { flex: 2, borderLeftColor: couleurs.vert }]}>
                            <Text style={styles.statLabel}>
                                Avoirs deduits ({donnees.total_avec_avoir})
                            </Text>
                            <Text style={[styles.statVal, { color: couleurs.vert }]}>
                                {fmt(donnees.montant_avoirs, d)}
                            </Text>
                        </View>
                    )}
                </View>

                {donnees.montant_avoirs > 0 && (
                    <Text style={{ fontSize: 7.5, color: couleurs.texteFaible, marginBottom: 8 }}>
                        Les montants restants sont nets des avoirs emis : ce qui figure ci-dessous
                        est ce qui reste reellement du apres deduction.
                    </Text>
                )}

                {enRetard.length > 0 && (
                    <>
                        <Text style={{
                            fontSize: 10, fontFamily: 'Helvetica-Bold', color: couleurs.rouge,
                            marginBottom: 6, paddingBottom: 3,
                            borderBottomWidth: 1, borderBottomColor: couleurs.bordure,
                        }}>
                            ! Factures en retard ({enRetard.length})
                        </Text>
                        <View style={styles.tableauEntete}>
                            <Text style={[styles.cellEnt, { width: '13%' }]}>N° Facture</Text>
                            <Text style={[styles.cellEnt, { width: '19%' }]}>Client</Text>
                            <Text style={[styles.cellEnt, { width: '12%' }]}>Émise le</Text>
                            <Text style={[styles.cellEnt, { width: '12%' }]}>Échéance</Text>
                            <Text style={[styles.cellEnt, { width: '9%', textAlign: 'center' }]}>Retard</Text>
                            <Text style={[styles.cellEnt, { width: '12%', textAlign: 'right' }]}>Total</Text>
                            <Text style={[styles.cellEnt, { width: '11%', textAlign: 'right' }]}>Avoir</Text>
                            <Text style={[styles.cellEnt, { width: '12%', textAlign: 'right' }]}>Restant</Text>
                        </View>
                        {enRetard.map((f, i) => (
                            <View key={f.public_id} style={[styles.ligne, styles.ligneRetard]}>
                                <Text style={[styles.cell, { width: '13%', fontFamily: 'Helvetica-Bold', fontSize: 7 }]}>
                                    {f.public_id}
                                </Text>
                                <Text style={[styles.cell, { width: '19%', maxLines: 1 }]}>{f.client_nom}</Text>
                                <Text style={[styles.cell, { width: '12%' }]}>{f.date_facture}</Text>
                                <Text style={[styles.cell, { width: '12%', color: couleurs.rouge }]}>
                                    {f.date_echeance ?? '—'}
                                </Text>
                                <Text style={[styles.cell, {
                                    width: '9%', textAlign: 'center',
                                    fontFamily: 'Helvetica-Bold', color: couleurs.rouge,
                                }]}>
                                    {f.jours_retard}j
                                </Text>
                                <Text style={[styles.cell, { width: '12%', textAlign: 'right' }]}>
                                    {fmt(f.montant_ttc, d)}
                                </Text>
                                <Text style={[styles.cell, {
                                    width: '11%', textAlign: 'right',
                                    color: f.montant_avoirs > 0 ? couleurs.vert : couleurs.texteFaible,
                                }]}>
                                    {f.montant_avoirs > 0 ? '- ' + fmt(f.montant_avoirs, d) : '—'}
                                </Text>
                                <Text style={[styles.cell, {
                                    width: '12%', textAlign: 'right',
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
                            <Text style={[styles.cellEnt, { width: '15%' }]}>N° Facture</Text>
                            <Text style={[styles.cellEnt, { width: '23%' }]}>Client</Text>
                            <Text style={[styles.cellEnt, { width: '14%' }]}>Émise le</Text>
                            <Text style={[styles.cellEnt, { width: '14%' }]}>Échéance</Text>
                            <Text style={[styles.cellEnt, { width: '15%', textAlign: 'right' }]}>Avoir</Text>
                            <Text style={[styles.cellEnt, { width: '19%', textAlign: 'right' }]}>Restant dû</Text>
                        </View>
                        {nonEchus.map((f, i) => (
                            <View key={f.public_id} style={[styles.ligne, i % 2 !== 0 ? styles.ligneImp : {}]}>
                                <Text style={[styles.cell, { width: '15%', fontFamily: 'Helvetica-Bold', fontSize: 7 }]}>
                                    {f.public_id}
                                </Text>
                                <Text style={[styles.cell, { width: '23%', maxLines: 1 }]}>{f.client_nom}</Text>
                                <Text style={[styles.cell, { width: '14%' }]}>{f.date_facture}</Text>
                                <Text style={[styles.cell, { width: '14%' }]}>{f.date_echeance ?? '—'}</Text>
                                <Text style={[styles.cell, {
                                    width: '15%', textAlign: 'right',
                                    color: f.montant_avoirs > 0 ? couleurs.vert : couleurs.texteFaible,
                                }]}>
                                    {f.montant_avoirs > 0 ? '- ' + fmt(f.montant_avoirs, d) : '—'}
                                </Text>
                                <Text style={[styles.cell, {
                                    width: '19%', textAlign: 'right',
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