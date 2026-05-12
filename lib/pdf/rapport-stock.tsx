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
        display: 'flex', flexDirection: 'row',
        justifyContent: 'space-between', marginBottom: 20,
        paddingBottom: 12, borderBottomWidth: 2, borderBottomColor: couleurs.primaire,
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
    alerteBadge: {
        paddingHorizontal: 6, paddingVertical: 1,
        borderRadius: 3, fontSize: 7, fontFamily: 'Helvetica-Bold',
        backgroundColor: '#fee2e2', color: couleurs.rouge,
    },
    pied: {
        position: 'absolute', bottom: 20, left: 30, right: 30,
        textAlign: 'center', fontSize: 7, color: couleurs.texteFaible,
        borderTopWidth: 1, borderTopColor: couleurs.bordure, paddingTop: 6,
    },
})

interface ProduitStock {
    public_id: string; nom: string; categorie: string | null
    unite: string; prix_achat: number; prix_vente: number
    stock: number; seuil_alerte: number; en_alerte: boolean
    entrepot: string
}

interface DonneesRapportStock {
    boutique:          { nom: string; telephone_1: string; devise: string }
    entrepot_filtre:   string
    genere_le:         string
    total_produits:    number
    produits_en_alerte: number
    valeur_stock:      number
    produits:          ProduitStock[]
}

function fmt(n: number, d: string) {
    return formatMontantPDF(n, d)
}

export function RapportStockPDF({ donnees }: { donnees: DonneesRapportStock }) {
    const d = donnees.boutique.devise
    const alertes = donnees.produits.filter(p => p.en_alerte)
    const normaux = donnees.produits.filter(p => !p.en_alerte)

    return (
        <Document>
            <Page size="A4" style={styles.page}>

                {/* EN-TÊTE */}
                <View style={styles.entete}>
                    <View>
                        <Text style={styles.titreBoutique}>{donnees.boutique.nom}</Text>
                        <Text style={styles.infoBoutique}>Tél : {donnees.boutique.telephone_1}</Text>
                    </View>
                    <View>
                        <Text style={styles.titrePage}>ÉTAT DU STOCK</Text>
                        <Text style={styles.infoGrise}>{donnees.entrepot_filtre}</Text>
                        <Text style={[styles.infoGrise, { marginTop: 2 }]}>
                            Généré le {donnees.genere_le}
                        </Text>
                    </View>
                </View>

                {/* STATS */}
                <View style={styles.statsRow}>
                    <View style={styles.statCard}>
                        <Text style={styles.statLabel}>Total produits</Text>
                        <Text style={styles.statVal}>{donnees.total_produits}</Text>
                    </View>
                    <View style={[styles.statCard, { borderLeftColor: couleurs.rouge }]}>
                        <Text style={styles.statLabel}>En alerte</Text>
                        <Text style={[styles.statVal, { color: couleurs.rouge }]}>
                            {donnees.produits_en_alerte}
                        </Text>
                    </View>
                    <View style={[styles.statCard, { borderLeftColor: couleurs.vert }]}>
                        <Text style={styles.statLabel}>Valeur stock (prix achat)</Text>
                        <Text style={[styles.statVal, { color: couleurs.vert, fontSize: 10 }]}>
                            {fmt(donnees.valeur_stock, d)}
                        </Text>
                    </View>
                </View>

                {/* ALERTES D'ABORD */}
                {alertes.length > 0 && (
                    <>
                        <Text style={[styles.sectionTitre, { color: couleurs.rouge }]}>
                            ⚠ Produits en alerte de stock ({alertes.length})
                        </Text>
                        <View style={styles.tableauEntete}>
                            <Text style={[styles.cellEnt, { width: '10%' }]}>ID</Text>
                            <Text style={[styles.cellEnt, { width: '30%' }]}>Produit</Text>
                            <Text style={[styles.cellEnt, { width: '18%' }]}>Catégorie</Text>
                            <Text style={[styles.cellEnt, { width: '12%', textAlign: 'center' }]}>Stock</Text>
                            <Text style={[styles.cellEnt, { width: '12%', textAlign: 'center' }]}>Seuil</Text>
                            <Text style={[styles.cellEnt, { width: '18%', textAlign: 'right' }]}>Val. stock</Text>
                        </View>
                        {alertes.map((p, i) => (
                            <View key={p.public_id}
                                  style={[styles.ligne, i % 2 !== 0 ? styles.ligneImp : {}, { backgroundColor: '#fff5f5' }]}>
                                <Text style={[styles.cell, { width: '10%', fontSize: 7, fontFamily: 'Helvetica-Bold' }]}>
                                    {p.public_id}
                                </Text>
                                <Text style={[styles.cell, { width: '30%', fontFamily: 'Helvetica-Bold', color: couleurs.rouge, maxLines: 1 }]}>{p.nom}</Text>
                                <Text style={[styles.cell, { width: '18%' }]}>{p.categorie ?? '—'}</Text>
                                <Text style={[styles.cell, { width: '12%', textAlign: 'center', color: couleurs.rouge, fontFamily: 'Helvetica-Bold' }]}>
                                    {p.stock} {p.unite}
                                </Text>
                                <Text style={[styles.cell, { width: '12%', textAlign: 'center' }]}>{p.seuil_alerte}</Text>
                                <Text style={[styles.cell, { width: '18%', textAlign: 'right' }]}>
                                    {fmt(p.stock * p.prix_achat, d)}
                                </Text>
                            </View>
                        ))}
                    </>
                )}

                {/* PRODUITS NORMAUX */}
                <Text style={styles.sectionTitre}>
                    Stock normal ({normaux.length} produit(s))
                </Text>
                <View style={styles.tableauEntete}>
                    <Text style={[styles.cellEnt, { width: '10%' }]}>ID</Text>
                    <Text style={[styles.cellEnt, { width: '28%' }]}>Produit</Text>
                    <Text style={[styles.cellEnt, { width: '16%' }]}>Catégorie</Text>
                    <Text style={[styles.cellEnt, { width: '12%', textAlign: 'center' }]}>Stock</Text>
                    <Text style={[styles.cellEnt, { width: '12%', textAlign: 'right' }]}>Prix achat</Text>
                    <Text style={[styles.cellEnt, { width: '12%', textAlign: 'right' }]}>Prix vente</Text>
                    <Text style={[styles.cellEnt, { width: '10%', textAlign: 'right' }]}>Val. stock</Text>
                </View>
                {normaux.map((p, i) => (
                    <View key={p.public_id} style={[styles.ligne, i % 2 !== 0 ? styles.ligneImp : {}]}>
                        <Text style={[styles.cell, { width: '10%', fontSize: 7, fontFamily: 'Helvetica-Bold' }]}>
                            {p.public_id}
                        </Text>
                        <Text style={[styles.cell, { width: '28%', maxLines: 1 }]}>{p.nom}</Text>
                        <Text style={[styles.cell, { width: '16%' }]}>{p.categorie ?? '—'}</Text>
                        <Text style={[styles.cell, { width: '12%', textAlign: 'center', fontFamily: 'Helvetica-Bold' }]}>
                            {p.stock} {p.unite}
                        </Text>
                        <Text style={[styles.cell, { width: '12%', textAlign: 'right' }]}>{fmt(p.prix_achat, d)}</Text>
                        <Text style={[styles.cell, { width: '12%', textAlign: 'right' }]}>{fmt(p.prix_vente, d)}</Text>
                        <Text style={[styles.cell, { width: '10%', textAlign: 'right', fontFamily: 'Helvetica-Bold' }]}>
                            {fmt(p.stock * p.prix_achat, d)}
                        </Text>
                    </View>
                ))}

                <Text style={styles.pied}>
                    {donnees.boutique.nom} — État du stock — {donnees.genere_le} — Manetec Gestock
                </Text>
            </Page>
        </Document>
    )
}