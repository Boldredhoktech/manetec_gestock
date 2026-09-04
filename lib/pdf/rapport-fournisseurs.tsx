import React from 'react'
import { Document, Page, Text, View, StyleSheet } from '@react-pdf/renderer'
import { couleurs } from '@/lib/pdf/styles'
import { formatMontantPDF } from '@/lib/pdf/utils-pdf'
import { EnteteRapportPDF, type BoutiqueEntete } from '@/lib/pdf/entete-rapport'

// Rapport de période : ce que la boutique a acheté, ce qu'elle a payé,
// et où en est sa dette — au lieu de l'ancien annuaire de soldes.
const styles = StyleSheet.create({
    page: {
        fontFamily: 'Helvetica', fontSize: 9,
        color: couleurs.texte, padding: 30, backgroundColor: '#fff',
    },
    statsRow: { display: 'flex', flexDirection: 'row', gap: 8, marginBottom: 8 },
    statCard: {
        flex: 1, backgroundColor: couleurs.fondClair, padding: 10,
        borderRadius: 6, borderLeftWidth: 3,
    },
    statLabel: { fontSize: 7, color: couleurs.texteFaible, marginBottom: 3 },
    statVal:   { fontSize: 12, fontFamily: 'Helvetica-Bold' },
    alerte: {
        backgroundColor: '#fef2f2', borderLeftWidth: 3, borderLeftColor: couleurs.rouge,
        padding: 8, borderRadius: 4, marginBottom: 14,
    },
    sectionTitre: {
        fontSize: 10, fontFamily: 'Helvetica-Bold', color: couleurs.primaire,
        marginTop: 6, marginBottom: 6,
    },
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
    cell:     { fontSize: 8, color: couleurs.texte },
    cellGris: { fontSize: 7, color: couleurs.texteFaible },
    totaux: {
        display: 'flex', flexDirection: 'row', padding: 6,
        backgroundColor: couleurs.fondClair, borderTopWidth: 2, borderTopColor: couleurs.primaire,
    },
    cellTot: { fontSize: 8, fontFamily: 'Helvetica-Bold', color: couleurs.primaire },
    note: { fontSize: 7, color: couleurs.texteFaible, marginTop: 10, lineHeight: 1.4 },
    pied: {
        position: 'absolute', bottom: 20, left: 30, right: 30,
        textAlign: 'center', fontSize: 7, color: couleurs.texteFaible,
        borderTopWidth: 1, borderTopColor: couleurs.bordure, paddingTop: 6,
    },
})

interface LigneFournisseur {
    public_id: string; nom: string; telephone: string | null
    solde_ouverture: number; achats: number; paiements: number; solde_du: number
    nb_factures: number; nb_impayees: number; nb_en_retard: number
    montant_en_retard: number; a_completer: number
    dernier_achat: string | null; dernier_paiement: string | null
}

interface DonneesRapportFournisseurs {
    boutique: BoutiqueEntete & { devise: string }
    periode:   string
    genere_le: string
    total_fournisseurs:       number
    fournisseurs_mouvementes: number
    total_achats:      number
    total_paiements:   number
    total_ouverture:   number
    total_dette:       number
    fournisseurs_avec_dette: number
    total_en_retard:   number
    factures_a_completer: number
    fournisseurs:      LigneFournisseur[]
}

const L = { nom: '26%', ouv: '14%', achats: '14%', paie: '14%', solde: '16%', etat: '16%' }

export function RapportFournisseursPDF({ donnees }: { donnees: DonneesRapportFournisseurs }) {
    const d = donnees.boutique.devise
    const fmt = (n: number) => formatMontantPDF(n, d)

    return (
        <Document>
            <Page size="A4" style={styles.page}>

                <EnteteRapportPDF
                    boutique={donnees.boutique}
                    titre="RAPPORT FOURNISSEURS"
                    sousTitre={donnees.periode}
                    genereLe={donnees.genere_le}
                />

                <View style={styles.statsRow}>
                    <View style={[styles.statCard, { borderLeftColor: couleurs.orange }]}>
                        <Text style={styles.statLabel}>Achats de la période</Text>
                        <Text style={[styles.statVal, { color: couleurs.orange }]}>{fmt(donnees.total_achats)}</Text>
                    </View>
                    <View style={[styles.statCard, { borderLeftColor: couleurs.vert }]}>
                        <Text style={styles.statLabel}>Réglé sur la période</Text>
                        <Text style={[styles.statVal, { color: couleurs.vert }]}>{fmt(donnees.total_paiements)}</Text>
                    </View>
                    <View style={[styles.statCard, { borderLeftColor: couleurs.rouge }]}>
                        <Text style={styles.statLabel}>Dette à la clôture</Text>
                        <Text style={[styles.statVal, { color: couleurs.rouge }]}>{fmt(donnees.total_dette)}</Text>
                    </View>
                    <View style={[styles.statCard, { borderLeftColor: couleurs.primaire }]}>
                        <Text style={styles.statLabel}>Fournisseurs mouvementés</Text>
                        <Text style={[styles.statVal, { color: couleurs.primaire }]}>
                            {donnees.fournisseurs_mouvementes} / {donnees.total_fournisseurs}
                        </Text>
                    </View>
                </View>

                <Text style={styles.note}>
                    Dette à la clôture = dette à l&apos;ouverture ({fmt(donnees.total_ouverture)}) + achats − règlements.
                </Text>

                {donnees.total_en_retard > 0 && (
                    <View style={[styles.alerte, { marginTop: 10 }]}>
                        <Text style={{ fontSize: 8, fontFamily: 'Helvetica-Bold', color: couleurs.rouge }}>
                            {fmt(donnees.total_en_retard)} en retard de paiement
                        </Text>
                        <Text style={{ fontSize: 7, color: couleurs.texteFaible, marginTop: 2 }}>
                            Factures dont la date d&apos;échéance est dépassée et qui restent partiellement ou totalement impayées.
                        </Text>
                    </View>
                )}

                <Text style={styles.sectionTitre}>Détail par fournisseur</Text>

                <View style={styles.tableauEntete}>
                    <Text style={[styles.cellEnt, { width: L.nom }]}>Fournisseur</Text>
                    <Text style={[styles.cellEnt, { width: L.ouv, textAlign: 'right' }]}>Ouverture</Text>
                    <Text style={[styles.cellEnt, { width: L.achats, textAlign: 'right' }]}>Achats</Text>
                    <Text style={[styles.cellEnt, { width: L.paie, textAlign: 'right' }]}>Réglé</Text>
                    <Text style={[styles.cellEnt, { width: L.solde, textAlign: 'right' }]}>Solde dû</Text>
                    <Text style={[styles.cellEnt, { width: L.etat, textAlign: 'right' }]}>État</Text>
                </View>

                {donnees.fournisseurs.length === 0 && (
                    <View style={styles.ligne}>
                        <Text style={[styles.cell, { width: '100%', textAlign: 'center', color: couleurs.texteFaible }]}>
                            Aucun mouvement fournisseur sur cette période.
                        </Text>
                    </View>
                )}

                {donnees.fournisseurs.map((f, i) => (
                    <View key={f.public_id} style={[styles.ligne, i % 2 !== 0 ? styles.ligneImp : {}]} wrap={false}>
                        <View style={{ width: L.nom }}>
                            <Text style={styles.cell}>{f.nom}</Text>
                            <Text style={styles.cellGris}>
                                {f.public_id}{f.telephone ? ` · ${f.telephone}` : ''}
                            </Text>
                        </View>
                        <Text style={[styles.cell, { width: L.ouv, textAlign: 'right' }]}>{fmt(f.solde_ouverture)}</Text>
                        <Text style={[styles.cell, { width: L.achats, textAlign: 'right' }]}>{fmt(f.achats)}</Text>
                        <Text style={[styles.cell, { width: L.paie, textAlign: 'right', color: couleurs.vert }]}>
                            {fmt(f.paiements)}
                        </Text>
                        <Text style={[styles.cell, {
                            width: L.solde, textAlign: 'right',
                            fontFamily: 'Helvetica-Bold',
                            color: f.solde_du > 0 ? couleurs.rouge : couleurs.vert,
                        }]}>
                            {f.solde_du > 0 ? fmt(f.solde_du) : 'Soldé'}
                        </Text>
                        <View style={{ width: L.etat }}>
                            {f.nb_en_retard > 0 ? (
                                <Text style={[styles.cell, { textAlign: 'right', color: couleurs.rouge }]}>
                                    {f.nb_en_retard} en retard
                                </Text>
                            ) : (
                                <Text style={[styles.cell, { textAlign: 'right', color: couleurs.texteFaible }]}>
                                    {f.nb_impayees > 0 ? `${f.nb_impayees} à régler` : 'À jour'}
                                </Text>
                            )}
                            {f.a_completer > 0 && (
                                <Text style={[styles.cellGris, { textAlign: 'right', color: couleurs.orange }]}>
                                    {f.a_completer} à compléter
                                </Text>
                            )}
                        </View>
                    </View>
                ))}

                <View style={styles.totaux}>
                    <Text style={[styles.cellTot, { width: L.nom }]}>TOTAL</Text>
                    <Text style={[styles.cellTot, { width: L.ouv, textAlign: 'right' }]}>{fmt(donnees.total_ouverture)}</Text>
                    <Text style={[styles.cellTot, { width: L.achats, textAlign: 'right' }]}>{fmt(donnees.total_achats)}</Text>
                    <Text style={[styles.cellTot, { width: L.paie, textAlign: 'right' }]}>{fmt(donnees.total_paiements)}</Text>
                    <Text style={[styles.cellTot, { width: L.solde, textAlign: 'right' }]}>{fmt(donnees.total_dette)}</Text>
                    <Text style={[styles.cellTot, { width: L.etat, textAlign: 'right' }]}>
                        {donnees.fournisseurs_avec_dette} à devoir
                    </Text>
                </View>

                {donnees.factures_a_completer > 0 && (
                    <Text style={styles.note}>
                        {donnees.factures_a_completer} facture(s) « à compléter » : créées automatiquement par une
                        réception de marchandise sans document. Leur montant provient du bon de réception et doit
                        être confirmé à l&apos;arrivée de la facture du fournisseur.
                    </Text>
                )}

                <Text style={styles.pied} fixed>
                    Achats et règlements de la période · les règlements incluent ceux affectés à une facture
                    comme les versements libres sur le solde.
                </Text>
            </Page>
        </Document>
    )
}
