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
    infoBoutique: { fontSize: 8, color: couleurs.texteFaible, marginTop: 2 },
    titrePage: { fontSize: 11, fontFamily: 'Helvetica-Bold', textAlign: 'right', marginBottom: 2 },
    infoGrise: { fontSize: 8, color: couleurs.texteFaible, textAlign: 'right' },
    statsRow: { display: 'flex', flexDirection: 'row', gap: 8, marginBottom: 16 },
    statCard: {
        flex: 1, backgroundColor: couleurs.fondClair, padding: 10,
        borderRadius: 6, borderLeftWidth: 3, borderLeftColor: couleurs.rouge,
    },
    statLabel: { fontSize: 7, color: couleurs.texteFaible, marginBottom: 3 },
    statVal: { fontSize: 13, fontFamily: 'Helvetica-Bold', color: couleurs.rouge },
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

interface FournisseurDette {
    public_id: string; nom: string; telephone: string | null
    email: string | null; solde_du: number
    nb_commandes: number; dernier_achat: string | null
}

interface DonneesRapportFournisseurs {
    boutique:         { nom: string; telephone_1: string; devise: string }
    genere_le:        string
    total_fournisseurs: number
    fournisseurs_avec_dette: number
    total_dette:      number
    fournisseurs:     FournisseurDette[]
}

function fmt(n: number, d: string) {
    return new Intl.NumberFormat('fr-FR').format(n) + ' ' + d
}

export function RapportFournisseursPDF({ donnees }: { donnees: DonneesRapportFournisseurs }) {
    const d = donnees.boutique.devise
    const avecDette  = donnees.fournisseurs.filter(f => f.solde_du > 0)
    const sansDette  = donnees.fournisseurs.filter(f => f.solde_du <= 0)

    return (
        <Document>
            <Page size="A4" style={styles.page}>

                <View style={styles.entete}>
                    <View>
                        <Text style={styles.titreBoutique}>{donnees.boutique.nom}</Text>
                        <Text style={styles.infoBoutique}>Tél : {donnees.boutique.telephone_1}</Text>
                    </View>
                    <View>
                        <Text style={styles.titrePage}>RAPPORT FOURNISSEURS</Text>
                        <Text style={styles.infoGrise}>Généré le {donnees.genere_le}</Text>
                    </View>
                </View>

                <View style={styles.statsRow}>
                    <View style={[styles.statCard, { borderLeftColor: couleurs.accent }]}>
                        <Text style={styles.statLabel}>Total fournisseurs</Text>
                        <Text style={[styles.statVal, { color: couleurs.accent }]}>
                            {donnees.total_fournisseurs}
                        </Text>
                    </View>
                    <View style={styles.statCard}>
                        <Text style={styles.statLabel}>Avec dette</Text>
                        <Text style={styles.statVal}>{donnees.fournisseurs_avec_dette}</Text>
                    </View>
                    <View style={[styles.statCard, { flex: 2 }]}>
                        <Text style={styles.statLabel}>Total dettes</Text>
                        <Text style={styles.statVal}>{fmt(donnees.total_dette, d)}</Text>
                    </View>
                </View>

                {avecDette.length > 0 && (
                    <>
                        <Text style={{
                            fontSize: 10, fontFamily: 'Helvetica-Bold', color: couleurs.rouge,
                            marginBottom: 6, paddingBottom: 3,
                            borderBottomWidth: 1, borderBottomColor: couleurs.bordure,
                        }}>
                            Fournisseurs avec solde dû ({avecDette.length})
                        </Text>
                        <View style={styles.tableauEntete}>
                            <Text style={[styles.cellEnt, { width: '12%' }]}>ID</Text>
                            <Text style={[styles.cellEnt, { width: '30%' }]}>Fournisseur</Text>
                            <Text style={[styles.cellEnt, { width: '18%' }]}>Téléphone</Text>
                            <Text style={[styles.cellEnt, { width: '12%', textAlign: 'center' }]}>Cmds</Text>
                            <Text style={[styles.cellEnt, { width: '14%' }]}>Dernier achat</Text>
                            <Text style={[styles.cellEnt, { width: '14%', textAlign: 'right' }]}>Solde dû</Text>
                        </View>
                        {avecDette.map((f, i) => (
                            <View key={f.public_id} style={[styles.ligne, i % 2 !== 0 ? styles.ligneImp : {}]}>
                                <Text style={[styles.cell, { width: '12%', fontSize: 7, fontFamily: 'Helvetica-Bold' }]}>
                                    {f.public_id}
                                </Text>
                                <Text style={[styles.cell, { width: '30%', fontFamily: 'Helvetica-Bold' }]} numberOfLines={1}>
                                    {f.nom}
                                </Text>
                                <Text style={[styles.cell, { width: '18%' }]}>{f.telephone ?? '—'}</Text>
                                <Text style={[styles.cell, { width: '12%', textAlign: 'center' }]}>{f.nb_commandes}</Text>
                                <Text style={[styles.cell, { width: '14%' }]}>{f.dernier_achat ?? '—'}</Text>
                                <Text style={[styles.cell, {
                                    width: '14%', textAlign: 'right',
                                    fontFamily: 'Helvetica-Bold', color: couleurs.rouge,
                                }]}>
                                    {fmt(f.solde_du, d)}
                                </Text>
                            </View>
                        ))}
                    </>
                )}

                {sansDelete.length > 0 && (
                    <>
                        <Text style={{
                            fontSize: 10, fontFamily: 'Helvetica-Bold', color: couleurs.vert,
                            marginTop: 14, marginBottom: 6, paddingBottom: 3,
                            borderBottomWidth: 1, borderBottomColor: couleurs.bordure,
                        }}>
                            Fournisseurs soldés ({sansDelete.length})
                        </Text>
                        <View style={styles.tableauEntete}>
                            <Text style={[styles.cellEnt, { width: '15%' }]}>ID</Text>
                            <Text style={[styles.cellEnt, { width: '45%' }]}>Fournisseur</Text>
                            <Text style={[styles.cellEnt, { width: '25%' }]}>Téléphone</Text>
                            <Text style={[styles.cellEnt, { width: '15%', textAlign: 'center' }]}>Cmds</Text>
                        </View>
                        {sansDelete.map((f, i) => (
                            <View key={f.public_id} style={[styles.ligne, i % 2 !== 0 ? styles.ligneImp : {}]}>
                                <Text style={[styles.cell, { width: '15%', fontSize: 7, fontFamily: 'Helvetica-Bold' }]}>
                                    {f.public_id}
                                </Text>
                                <Text style={[styles.cell, { width: '45%' }]} numberOfLines={1}>{f.nom}</Text>
                                <Text style={[styles.cell, { width: '25%' }]}>{f.telephone ?? '—'}</Text>
                                <Text style={[styles.cell, { width: '15%', textAlign: 'center' }]}>{f.nb_commandes}</Text>
                            </View>
                        ))}
                    </>
                )}

                <Text style={styles.pied}>
                    {donnees.boutique.nom} — Rapport fournisseurs — {donnees.genere_le} — Manetec Gestock
                </Text>
            </Page>
        </Document>
    )
}