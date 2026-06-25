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
        display: 'flex', flexDirection: 'row',
        justifyContent: 'space-between', marginBottom: 20,
        paddingBottom: 12, borderBottomWidth: 2, borderBottomColor: couleurs.primaire,
    },
    titreBoutique: { fontSize: 16, fontFamily: 'Helvetica-Bold', color: couleurs.primaire },
    titrePage: { fontSize: 11, fontFamily: 'Helvetica-Bold', textAlign: 'right', marginBottom: 2 },
    infoGrise: { fontSize: 8, color: couleurs.texteFaible, textAlign: 'right' },
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
    sectionTitre: {
        fontSize: 10, fontFamily: 'Helvetica-Bold', color: couleurs.primaire,
        marginTop: 14, marginBottom: 6, paddingBottom: 3,
        borderBottomWidth: 1, borderBottomColor: couleurs.bordure,
    },
    pied: {
        position: 'absolute', bottom: 20, left: 30, right: 30,
        textAlign: 'center', fontSize: 7, color: couleurs.texteFaible,
        borderTopWidth: 1, borderTopColor: couleurs.bordure, paddingTop: 6,
    },
})

interface ClientRapport {
    public_id: string; nom: string; telephone: string | null
    credit_balance: number; advance_balance: number; change_balance: number
    nb_achats: number; ca_total: number
}

interface DonneesRapportClients {
    boutique: BoutiqueEntete & { devise: string }
    genere_le:    string
    total_clients: number
    clients_en_credit: number
    total_credit_du: number
    clients:      ClientRapport[]
}

function fmt(n: number, d: string) {
    return formatMontantPDF(n, d)
}

export function RapportClientsPDF({ donnees }: { donnees: DonneesRapportClients }) {
    const d = donnees.boutique.devise

    return (
        <Document>
            <Page size="A4" style={styles.page}>
                <EnteteRapportPDF boutique={donnees.boutique} titre="RAPPORT CLIENTS" genereLe={donnees.genere_le} />

                {/* Résumé */}
                <View style={{ display: 'flex', flexDirection: 'row', gap: 8, marginBottom: 16 }}>
                    {[
                        { label: 'Total clients', valeur: donnees.total_clients.toString(), color: couleurs.accent },
                        { label: 'Clients avec crédit dû', valeur: donnees.clients_en_credit.toString(), color: couleurs.rouge },
                        { label: 'Total crédit dû', valeur: fmt(donnees.total_credit_du, d), color: couleurs.rouge },
                    ].map((c, i) => (
                        <View key={i} style={{
                            flex: 1, backgroundColor: couleurs.fondClair, padding: 10,
                            borderRadius: 6, borderLeftWidth: 3, borderLeftColor: c.color,
                        }}>
                            <Text style={{ fontSize: 7, color: couleurs.texteFaible, marginBottom: 3 }}>{c.label}</Text>
                            <Text style={{ fontSize: 12, fontFamily: 'Helvetica-Bold', color: c.color }}>{c.valeur}</Text>
                        </View>
                    ))}
                </View>

                <Text style={styles.sectionTitre}>Liste des clients</Text>
                <View style={styles.tableauEntete}>
                    <Text style={[styles.cellEnt, { width: '12%' }]}>ID</Text>
                    <Text style={[styles.cellEnt, { width: '22%' }]}>Nom</Text>
                    <Text style={[styles.cellEnt, { width: '14%' }]}>Téléphone</Text>
                    <Text style={[styles.cellEnt, { width: '13%', textAlign: 'right' }]}>Crédit dû</Text>
                    <Text style={[styles.cellEnt, { width: '13%', textAlign: 'right' }]}>Avance</Text>
                    <Text style={[styles.cellEnt, { width: '13%', textAlign: 'center' }]}>Achats</Text>
                    <Text style={[styles.cellEnt, { width: '13%', textAlign: 'right' }]}>CA total</Text>
                </View>
                {donnees.clients.map((c, i) => (
                    <View key={c.public_id} style={[styles.ligne, i % 2 !== 0 ? styles.ligneImp : {}]}>
                        <Text style={[styles.cell, { width: '12%', fontFamily: 'Helvetica-Bold', fontSize: 7 }]}>
                            {c.public_id}
                        </Text>
                        <Text style={[styles.cell, { width: '22%', maxLines: 1 }]}>{c.nom}</Text>
                        <Text style={[styles.cell, { width: '14%' }]}>{c.telephone ?? '—'}</Text>
                        <Text style={[styles.cell, {
                            width: '13%', textAlign: 'right',
                            color: c.credit_balance > 0 ? couleurs.rouge : couleurs.texte,
                            fontFamily: c.credit_balance > 0 ? 'Helvetica-Bold' : 'Helvetica',
                        }]}>
                            {c.credit_balance > 0 ? fmt(c.credit_balance, d) : '—'}
                        </Text>
                        <Text style={[styles.cell, {
                            width: '13%', textAlign: 'right',
                            color: c.advance_balance > 0 ? couleurs.vert : couleurs.texte,
                        }]}>
                            {c.advance_balance > 0 ? fmt(c.advance_balance, d) : '—'}
                        </Text>
                        <Text style={[styles.cell, { width: '13%', textAlign: 'center' }]}>{c.nb_achats}</Text>
                        <Text style={[styles.cell, { width: '13%', textAlign: 'right', fontFamily: 'Helvetica-Bold' }]}>
                            {fmt(c.ca_total, d)}
                        </Text>
                    </View>
                ))}

                <Text style={styles.pied}>
                    {donnees.boutique.nom} — Rapport clients — {donnees.genere_le} — Manetec Gestock
                </Text>
            </Page>
        </Document>
    )
}