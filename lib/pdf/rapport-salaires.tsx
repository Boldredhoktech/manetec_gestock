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

const MOIS = ['', 'Janv.', 'Févr.', 'Mars', 'Avr.', 'Mai', 'Juin',
    'Juill.', 'Août', 'Sept.', 'Oct.', 'Nov.', 'Déc.']

interface LigneSalaire {
    employe:       string
    poste:         string | null
    salaire_base:  number
    bonus:         number
    deductions:    number
    montant_net:   number
    moyen:         string
    date_paiement: string
}

interface DonneesRapportSalaires {
    boutique: BoutiqueEntete & { devise: string }
    periode:        string
    genere_le:      string
    nb_employes:    number
    total_brut:     number
    total_bonus:    number
    total_deductions: number
    total_net:      number
    salaires:       LigneSalaire[]
}

const MOYENS: Record<string, string> = {
    cash: 'Espèces', wave: 'Wave', mtn_momo: 'MTN MoMo',
    bank_transfer: 'Virement', bank_card: 'Carte',
}

function fmt(n: number, d: string) {
    return formatMontantPDF(n, d)
}

export function RapportSalairesPDF({ donnees }: { donnees: DonneesRapportSalaires }) {
    const d = donnees.boutique.devise

    return (
        <Document>
            <Page size="A4" style={styles.page}>

                <EnteteRapportPDF boutique={donnees.boutique} titre="RAPPORT DE PAIE" sousTitre={donnees.periode} genereLe={donnees.genere_le} />

                <View style={styles.statsRow}>
                    <View style={[styles.statCard, { borderLeftColor: couleurs.accent }]}>
                        <Text style={styles.statLabel}>Employés payés</Text>
                        <Text style={[styles.statVal, { color: couleurs.accent }]}>{donnees.nb_employes}</Text>
                    </View>
                    <View style={styles.statCard}>
                        <Text style={styles.statLabel}>Total brut</Text>
                        <Text style={styles.statVal}>{fmt(donnees.total_brut, d)}</Text>
                    </View>
                    <View style={[styles.statCard, { borderLeftColor: couleurs.vert }]}>
                        <Text style={styles.statLabel}>Total net versé</Text>
                        <Text style={[styles.statVal, { color: couleurs.vert }]}>
                            {fmt(donnees.total_net, d)}
                        </Text>
                    </View>
                </View>

                <View style={styles.tableauEntete}>
                    <Text style={[styles.cellEnt, { width: '25%' }]}>Employé</Text>
                    <Text style={[styles.cellEnt, { width: '15%' }]}>Poste</Text>
                    <Text style={[styles.cellEnt, { width: '13%', textAlign: 'right' }]}>Base</Text>
                    <Text style={[styles.cellEnt, { width: '10%', textAlign: 'right' }]}>Bonus</Text>
                    <Text style={[styles.cellEnt, { width: '11%', textAlign: 'right' }]}>Déduct.</Text>
                    <Text style={[styles.cellEnt, { width: '13%', textAlign: 'right' }]}>Net versé</Text>
                    <Text style={[styles.cellEnt, { width: '13%' }]}>Moyen</Text>
                </View>

                {donnees.salaires.map((s, i) => (
                    <View key={i} style={[styles.ligne, i % 2 !== 0 ? styles.ligneImp : {}]}>
                        <Text style={[styles.cell, { width: '25%', fontFamily: 'Helvetica-Bold', maxLines: 1 }]}>{s.employe}</Text>
                        <Text style={[styles.cell, { width: '15%', maxLines: 1 }]}>
                            {s.poste ?? '—'}
                        </Text>
                        <Text style={[styles.cell, { width: '13%', textAlign: 'right' }]}>
                            {fmt(s.salaire_base, d)}
                        </Text>
                        <Text style={[styles.cell, { width: '10%', textAlign: 'right', color: couleurs.vert }]}>
                            {s.bonus > 0 ? fmt(s.bonus, d) : '—'}
                        </Text>
                        <Text style={[styles.cell, { width: '11%', textAlign: 'right', color: couleurs.rouge }]}>
                            {s.deductions > 0 ? fmt(s.deductions, d) : '—'}
                        </Text>
                        <Text style={[styles.cell, {
                            width: '13%', textAlign: 'right', fontFamily: 'Helvetica-Bold', color: couleurs.vert,
                        }]}>
                            {fmt(s.montant_net, d)}
                        </Text>
                        <Text style={[styles.cell, { width: '13%' }]}>
                            {MOYENS[s.moyen] ?? s.moyen}
                        </Text>
                    </View>
                ))}

                <View style={{
                    display: 'flex', flexDirection: 'row', justifyContent: 'flex-end',
                    marginTop: 8,
                }}>
                    <View style={{ width: '40%', borderTopWidth: 2, borderTopColor: couleurs.primaire, paddingTop: 6 }}>
                        <View style={{ display: 'flex', flexDirection: 'row', justifyContent: 'space-between', marginBottom: 2 }}>
                            <Text style={{ fontSize: 8, color: couleurs.texteFaible }}>Total bonus</Text>
                            <Text style={{ fontSize: 8, color: couleurs.vert, fontFamily: 'Helvetica-Bold' }}>
                                +{fmt(donnees.total_bonus, d)}
                            </Text>
                        </View>
                        <View style={{ display: 'flex', flexDirection: 'row', justifyContent: 'space-between', marginBottom: 4 }}>
                            <Text style={{ fontSize: 8, color: couleurs.texteFaible }}>Total déductions</Text>
                            <Text style={{ fontSize: 8, color: couleurs.rouge, fontFamily: 'Helvetica-Bold' }}>
                                -{fmt(donnees.total_deductions, d)}
                            </Text>
                        </View>
                        <View style={{ display: 'flex', flexDirection: 'row', justifyContent: 'space-between' }}>
                            <Text style={{ fontSize: 10, fontFamily: 'Helvetica-Bold', color: couleurs.primaire }}>
                                TOTAL NET
                            </Text>
                            <Text style={{ fontSize: 10, fontFamily: 'Helvetica-Bold', color: couleurs.primaire }}>
                                {fmt(donnees.total_net, d)}
                            </Text>
                        </View>
                    </View>
                </View>

                <Text style={styles.pied}>
                    {donnees.boutique.nom} — Rapport de paie — {donnees.genere_le} — Manetec Gestock
                </Text>
            </Page>
        </Document>
    )
}