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
    infoBoutique: { fontSize: 8, color: couleurs.texteFaible, marginTop: 2 },
    titrePage: { fontSize: 11, fontFamily: 'Helvetica-Bold', textAlign: 'right', marginBottom: 2 },
    infoGrise: { fontSize: 8, color: couleurs.texteFaible, textAlign: 'right' },
    resultatBlock: {
        padding: 16, borderRadius: 8, marginBottom: 20,
        alignItems: 'center',
    },
    resultatLabel: { fontSize: 11, fontFamily: 'Helvetica-Bold', marginBottom: 6 },
    resultatVal: { fontSize: 28, fontFamily: 'Helvetica-Bold' },
    colonnes: { display: 'flex', flexDirection: 'row', gap: 12, marginBottom: 16 },
    colonne: { flex: 1 },
    colonneTitre: {
        fontSize: 9, fontFamily: 'Helvetica-Bold', color: '#fff',
        padding: 8, borderRadius: 4, marginBottom: 0, textAlign: 'center',
    },
    ligneCompte: {
        display: 'flex', flexDirection: 'row', justifyContent: 'space-between',
        padding: '5 8', borderBottomWidth: 1, borderBottomColor: couleurs.bordure,
    },
    ligneCompteImp: { backgroundColor: couleurs.fondClair },
    ligneLabel: { fontSize: 8, color: couleurs.texte },
    ligneVal: { fontSize: 8, fontFamily: 'Helvetica-Bold', color: couleurs.texte },
    totalColonne: {
        display: 'flex', flexDirection: 'row', justifyContent: 'space-between',
        padding: '7 8', borderTopWidth: 2, borderTopColor: couleurs.primaire,
        marginTop: 2,
    },
    totalLabel: { fontSize: 9, fontFamily: 'Helvetica-Bold', color: couleurs.primaire },
    totalVal:   { fontSize: 9, fontFamily: 'Helvetica-Bold', color: couleurs.primaire },
    sectionTitre: {
        fontSize: 10, fontFamily: 'Helvetica-Bold', color: couleurs.primaire,
        marginTop: 14, marginBottom: 6, paddingBottom: 3,
        borderBottomWidth: 1, borderBottomColor: couleurs.bordure,
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
    cell: { fontSize: 8, color: couleurs.texte },
    pied: {
        position: 'absolute', bottom: 20, left: 30, right: 30,
        textAlign: 'center', fontSize: 7, color: couleurs.texteFaible,
        borderTopWidth: 1, borderTopColor: couleurs.bordure, paddingTop: 6,
    },
})

interface DonneesRapportPP {
    boutique: BoutiqueEntete & { devise: string }
    periode:          string
    genere_le:        string
    ventes_facturees: number
    non_encaisse_pos: number
    entrees: {
        ventes_pos:       number
        paiements_factures: number
        total:            number
    }
    sorties: {
        depenses:         number
        salaires:         number
        fournisseurs:     number
        total:            number
    }
    resultat:         number
    variation_stock?: {
        pertes: number
        gains:  number
        net:    number
    }
    resultat_economique?: number
    detail_depenses:  { categorie: string; montant: number }[]
    // La courbe et le total de la page viennent de la meme fonction
    // SQL : ce sont des ENTREES et des SORTIES, pas un CA facture.
    evolution_mois:   { mois: string; entrees: number; sorties: number; resultat: number }[]
}

function fmt(n: number, d: string) {
    return formatMontantPDF(n, d)
}

export function RapportProfitPertesPDF({ donnees }: { donnees: DonneesRapportPP }) {
    const d = donnees.boutique.devise
    const positif = donnees.resultat >= 0

    return (
        <Document>
            <Page size="A4" style={styles.page}>

                {/* EN-TÊTE */}
                <EnteteRapportPDF boutique={donnees.boutique} titre="COMPTE DE RÉSULTAT" sousTitre={donnees.periode} genereLe={donnees.genere_le} />

                {/* RÉSULTAT NET */}
                <View style={[styles.resultatBlock, {
                    backgroundColor: positif ? '#f0fdf4' : '#fef2f2',
                }]}>
                    <Text style={[styles.resultatLabel, { color: positif ? couleurs.vert : couleurs.rouge }]}>
                        {positif ? 'BÉNÉFICE NET' : 'DÉFICIT NET'}
                    </Text>
                    <Text style={[styles.resultatVal, { color: positif ? couleurs.vert : couleurs.rouge }]}>
                        {positif ? '+' : '-'}{fmt(Math.abs(donnees.resultat), d)}
                    </Text>
                    <Text style={{ fontSize: 8, color: couleurs.texteFaible, marginTop: 4 }}>
                        Base trésorerie : encaissements et décaissements de la période
                    </Text>
                </View>

                {/* VARIATION DE VALEUR DU STOCK — hors trésorerie */}
                {donnees.variation_stock &&
                 (donnees.variation_stock.pertes > 0 || donnees.variation_stock.gains > 0) && (
                    <View style={{
                        borderWidth: 1, borderColor: '#e5e7eb', borderRadius: 4,
                        padding: 10, marginBottom: 14,
                    }}>
                        <Text style={{ fontSize: 9, fontFamily: 'Helvetica-Bold', marginBottom: 6 }}>
                            Variation de la valeur du stock (hors trésorerie)
                        </Text>
                        <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 3 }}>
                            <Text style={{ fontSize: 9 }}>Pertes constatées aux inventaires</Text>
                            <Text style={{ fontSize: 9, color: couleurs.rouge }}>
                                −{fmt(donnees.variation_stock.pertes, d)}
                            </Text>
                        </View>
                        <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 3 }}>
                            <Text style={{ fontSize: 9 }}>Gains constatés aux inventaires</Text>
                            <Text style={{ fontSize: 9, color: couleurs.vert }}>
                                +{fmt(donnees.variation_stock.gains, d)}
                            </Text>
                        </View>
                        <View style={{
                            flexDirection: 'row', justifyContent: 'space-between',
                            borderTopWidth: 1, borderTopColor: '#e5e7eb', paddingTop: 4, marginTop: 3,
                        }}>
                            <Text style={{ fontSize: 9, fontFamily: 'Helvetica-Bold' }}>
                                Résultat économique (résultat de caisse + variation de stock)
                            </Text>
                            <Text style={{
                                fontSize: 9, fontFamily: 'Helvetica-Bold',
                                color: (donnees.resultat_economique ?? 0) >= 0 ? couleurs.vert : couleurs.rouge,
                            }}>
                                {(donnees.resultat_economique ?? 0) >= 0 ? '+' : '−'}
                                {fmt(Math.abs(donnees.resultat_economique ?? 0), d)}
                            </Text>
                        </View>
                    </View>
                )}

                {/* ENTRÉES / SORTIES */}
                <View style={styles.colonnes}>

                    {/* ENTRÉES */}
                    <View style={styles.colonne}>
                        <Text style={[styles.colonneTitre, { backgroundColor: couleurs.vert }]}>
                            PRODUITS (ENTRÉES)
                        </Text>
                        {[
                            { label: 'Ventes POS encaissées', val: donnees.entrees.ventes_pos },
                            { label: 'Paiements factures',    val: donnees.entrees.paiements_factures },
                        ].map((ligne, i) => (
                            <View key={i} style={[styles.ligneCompte, i % 2 !== 0 ? styles.ligneCompteImp : {}]}>
                                <Text style={styles.ligneLabel}>{ligne.label}</Text>
                                <Text style={[styles.ligneVal, { color: couleurs.vert }]}>
                                    {fmt(ligne.val, d)}
                                </Text>
                            </View>
                        ))}
                        <View style={styles.totalColonne}>
                            <Text style={styles.totalLabel}>TOTAL ENTRÉES</Text>
                            <Text style={[styles.totalVal, { color: couleurs.vert }]}>
                                {fmt(donnees.entrees.total, d)}
                            </Text>
                        </View>
                        {/* Ce releve compte l'argent ENTRE. Ce qui a ete
                            vendu sans entrer en caisse est rappele ici, pour
                            qu'aucun chiffre ne disparaisse en silence. */}
                        {(donnees.non_encaisse_pos ?? 0) > 0 && (
                            <Text style={{
                                fontSize: 7, color: couleurs.texteFaible,
                                marginTop: 5, lineHeight: 1.4,
                            }}>
                                Facturé au comptoir sur la période :{' '}
                                {fmt(donnees.ventes_facturees ?? 0, d)} — dont{' '}
                                {fmt(donnees.non_encaisse_pos ?? 0, d)} non encaissés
                                (crédit accordé, soldes clients).
                            </Text>
                        )}
                    </View>

                    {/* SORTIES */}
                    <View style={styles.colonne}>
                        <Text style={[styles.colonneTitre, { backgroundColor: couleurs.rouge }]}>
                            CHARGES (SORTIES)
                        </Text>
                        {[
                            { label: 'Dépenses exploitation', val: donnees.sorties.depenses },
                            { label: 'Salaires',              val: donnees.sorties.salaires },
                            { label: 'Fournisseurs payés',    val: donnees.sorties.fournisseurs },
                        ].map((ligne, i) => (
                            <View key={i} style={[styles.ligneCompte, i % 2 !== 0 ? styles.ligneCompteImp : {}]}>
                                <Text style={styles.ligneLabel}>{ligne.label}</Text>
                                <Text style={[styles.ligneVal, { color: couleurs.rouge }]}>
                                    {fmt(ligne.val, d)}
                                </Text>
                            </View>
                        ))}
                        <View style={styles.totalColonne}>
                            <Text style={styles.totalLabel}>TOTAL SORTIES</Text>
                            <Text style={[styles.totalVal, { color: couleurs.rouge }]}>
                                {fmt(donnees.sorties.total, d)}
                            </Text>
                        </View>
                    </View>

                </View>

                {/* DÉTAIL DÉPENSES PAR CATÉGORIE */}
                {donnees.detail_depenses.length > 0 && (
                    <>
                        <Text style={styles.sectionTitre}>Détail des dépenses par catégorie</Text>
                        <View style={styles.tableauEntete}>
                            <Text style={[styles.cellEnt, { width: '65%' }]}>Catégorie</Text>
                            <Text style={[styles.cellEnt, { width: '35%', textAlign: 'right' }]}>Montant</Text>
                        </View>
                        {donnees.detail_depenses.map((d_item, i) => (
                            <View key={i} style={[styles.ligne, i % 2 !== 0 ? styles.ligneImp : {}]}>
                                <Text style={[styles.cell, { width: '65%' }]}>
                                    {d_item.categorie || 'Sans catégorie'}
                                </Text>
                                <Text style={[styles.cell, {
                                    width: '35%', textAlign: 'right',
                                    fontFamily: 'Helvetica-Bold', color: couleurs.rouge,
                                }]}>
                                    {fmt(d_item.montant, d)}
                                </Text>
                            </View>
                        ))}
                    </>
                )}

                {/* ÉVOLUTION MENSUELLE */}
                {donnees.evolution_mois.length > 1 && (
                    <>
                        <Text style={styles.sectionTitre}>Évolution mensuelle</Text>
                        <View style={styles.tableauEntete}>
                            <Text style={[styles.cellEnt, { width: '28%' }]}>Mois</Text>
                            <Text style={[styles.cellEnt, { width: '24%', textAlign: 'right' }]}>Entrées</Text>
                            <Text style={[styles.cellEnt, { width: '24%', textAlign: 'right' }]}>Sorties</Text>
                            <Text style={[styles.cellEnt, { width: '24%', textAlign: 'right' }]}>Résultat</Text>
                        </View>
                        {donnees.evolution_mois.map((m, i) => (
                            <View key={i} style={[styles.ligne, i % 2 !== 0 ? styles.ligneImp : {}]}>
                                <Text style={[styles.cell, { width: '28%', fontFamily: 'Helvetica-Bold' }]}>
                                    {m.mois}
                                </Text>
                                <Text style={[styles.cell, { width: '24%', textAlign: 'right', color: couleurs.vert }]}>
                                    {fmt(m.entrees, d)}
                                </Text>
                                <Text style={[styles.cell, { width: '24%', textAlign: 'right', color: couleurs.rouge }]}>
                                    {fmt(m.sorties, d)}
                                </Text>
                                <Text style={[styles.cell, {
                                    width: '24%', textAlign: 'right', fontFamily: 'Helvetica-Bold',
                                    color: m.resultat >= 0 ? couleurs.vert : couleurs.rouge,
                                }]}>
                                    {m.resultat >= 0 ? '+' : '-'}{fmt(Math.abs(m.resultat), d)}
                                </Text>
                            </View>
                        ))}
                    </>
                )}

                <Text style={styles.pied}>
                    {donnees.boutique.nom} — Compte de résultat — {donnees.genere_le} — Manetec Gestock
                </Text>
            </Page>
        </Document>
    )
}