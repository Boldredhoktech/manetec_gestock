import React from 'react'
import { Document, Page, Text, View, Image, StyleSheet } from '@react-pdf/renderer'
import { couleurs } from '@/lib/pdf/styles'
import { formatMontantPDF, formatDatePDF } from '@/lib/pdf/utils-pdf'

const styles = StyleSheet.create({
    page: {
        fontFamily: 'Helvetica', fontSize: 9, color: couleurs.texte,
        paddingTop: 32, paddingBottom: 48, paddingHorizontal: 36, backgroundColor: '#fff',
    },
    entete: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' },
    logo: { width: 96, height: 48, objectFit: 'contain', marginBottom: 4 },
    nomBoutique: { fontSize: 14, fontFamily: 'Helvetica-Bold', color: couleurs.primaire },
    info: { fontSize: 8, color: couleurs.texteFaible, marginBottom: 1 },
    titre: { fontSize: 18, fontFamily: 'Helvetica-Bold', color: couleurs.primaire, textAlign: 'right' },
    ref: { fontSize: 10, fontFamily: 'Helvetica-Bold', color: couleurs.texte, textAlign: 'right', marginTop: 2 },
    badge: { marginTop: 6, alignSelf: 'flex-end', paddingHorizontal: 8, paddingVertical: 3, borderRadius: 3, fontSize: 8, fontFamily: 'Helvetica-Bold', backgroundColor: '#dcfce7', color: '#166534' },

    regle: { height: 2, backgroundColor: couleurs.primaire, marginTop: 12, marginBottom: 14 },

    metaRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 14 },
    metaCase: { backgroundColor: couleurs.fondClair, borderRadius: 4, paddingVertical: 6, paddingHorizontal: 10, minWidth: 150 },
    metaLabel: { fontSize: 7, fontFamily: 'Helvetica-Bold', color: couleurs.texteFaible, textTransform: 'uppercase', letterSpacing: 0.5 },
    metaValeur: { fontSize: 10, fontFamily: 'Helvetica-Bold', color: couleurs.texte, marginTop: 2 },

    cartesRow: { flexDirection: 'row', gap: 8, marginBottom: 16 },
    carte: { flex: 1, borderWidth: 1, borderColor: couleurs.bordure, borderRadius: 6, padding: 10, borderTopWidth: 3 },
    carteLabel: { fontSize: 7.5, color: couleurs.texteFaible, marginBottom: 4 },
    carteVal: { fontSize: 12.5, fontFamily: 'Helvetica-Bold' },

    thead: { flexDirection: 'row', backgroundColor: couleurs.primaire, paddingVertical: 6, paddingHorizontal: 6 },
    th: { fontFamily: 'Helvetica-Bold', fontSize: 8, color: '#fff' },
    tr: { flexDirection: 'row', alignItems: 'center', paddingVertical: 6, paddingHorizontal: 6, borderBottomWidth: 1, borderBottomColor: couleurs.bordure },
    trAlt: { backgroundColor: couleurs.fondClair },
    td: { fontSize: 8.5, color: couleurs.texte },

    totaux: { marginTop: 14, flexDirection: 'row', justifyContent: 'flex-end' },
    totBox: { width: '50%' },
    totLigne: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 3 },
    totLabel: { fontSize: 9, color: couleurs.texteFaible },
    totVal: { fontSize: 9, fontFamily: 'Helvetica-Bold', color: couleurs.texte },
    totNet: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', backgroundColor: couleurs.primaire, paddingVertical: 7, paddingHorizontal: 10, borderRadius: 3, marginTop: 6 },
    totNetLabel: { fontSize: 10, fontFamily: 'Helvetica-Bold', color: '#fff' },
    totNetVal: { fontSize: 12, fontFamily: 'Helvetica-Bold', color: '#fff' },

    pied: { position: 'absolute', bottom: 22, left: 36, right: 36, textAlign: 'center', fontSize: 7, color: couleurs.texteFaible, borderTopWidth: 1, borderTopColor: couleurs.bordure, paddingTop: 6 },
})

interface LigneRapport {
    nom: string; categorie: string; unite: string
    theorique: number; reel: number; ecart: number; valeurEcart: number
}
export interface DonneesRapportInventaire {
    boutique: {
        nom: string; adresse?: string | null; ville?: string | null
        telephone_1?: string | null; ifu?: string | null; rccm?: string | null
        devise: string; logo_url?: string | null
    }
    inventaire: {
        public_id: string; nom: string | null; warehouse_nom: string; date: string
        valeur_pertes: number; valeur_gains: number
    }
    lignes: LigneRapport[]
    genere_le: string
}

export function RapportInventairePDF({ donnees }: { donnees: DonneesRapportInventaire }) {
    const { boutique, inventaire, lignes } = donnees
    const d = boutique.devise
    const fmt = (n: number) => formatMontantPDF(n, d)
    const nbEcarts  = lignes.filter(l => l.ecart !== 0).length
    const valNette  = inventaire.valeur_gains - inventaire.valeur_pertes
    // Tri : écarts d'abord (les plus importants en valeur absolue)
    const tri = [...lignes].sort((a, b) => Math.abs(b.ecart) - Math.abs(a.ecart))

    return (
        <Document>
            <Page size="A4" style={styles.page}>
                <View style={styles.entete}>
                    <View style={{ maxWidth: 300 }}>
                        {boutique.logo_url
                            ? <Image src={boutique.logo_url} style={styles.logo} />
                            : <Text style={styles.nomBoutique}>{boutique.nom}</Text>}
                        {boutique.logo_url && <Text style={[styles.info, { fontFamily: 'Helvetica-Bold', color: couleurs.texte, fontSize: 9 }]}>{boutique.nom}</Text>}
                        {boutique.adresse && <Text style={styles.info}>{boutique.adresse}{boutique.ville ? `, ${boutique.ville}` : ''}</Text>}
                        {boutique.telephone_1 && <Text style={styles.info}>Tél : {boutique.telephone_1}</Text>}
                        {boutique.ifu && <Text style={styles.info}>IFU : {boutique.ifu}</Text>}
                    </View>
                    <View>
                        <Text style={styles.titre}>RAPPORT D'INVENTAIRE</Text>
                        <Text style={styles.ref}>{inventaire.public_id}</Text>
                        <Text style={styles.badge}>VALIDÉ</Text>
                    </View>
                </View>

                <View style={styles.regle} />

                <View style={styles.metaRow}>
                    <View style={styles.metaCase}>
                        <Text style={styles.metaLabel}>Inventaire</Text>
                        <Text style={styles.metaValeur}>{inventaire.nom ?? inventaire.public_id}</Text>
                    </View>
                    <View style={styles.metaCase}>
                        <Text style={styles.metaLabel}>Entrepôt</Text>
                        <Text style={styles.metaValeur}>{inventaire.warehouse_nom}</Text>
                    </View>
                    <View style={styles.metaCase}>
                        <Text style={styles.metaLabel}>Date de validation</Text>
                        <Text style={styles.metaValeur}>{formatDatePDF(inventaire.date)}</Text>
                    </View>
                </View>

                {/* Cartes synthèse */}
                <View style={styles.cartesRow}>
                    <View style={[styles.carte, { borderTopColor: couleurs.primaire }]}>
                        <Text style={styles.carteLabel}>Articles inventoriés</Text>
                        <Text style={[styles.carteVal, { color: couleurs.primaire }]}>{lignes.length}</Text>
                    </View>
                    <View style={[styles.carte, { borderTopColor: couleurs.orange }]}>
                        <Text style={styles.carteLabel}>Articles avec écart</Text>
                        <Text style={[styles.carteVal, { color: couleurs.orange }]}>{nbEcarts}</Text>
                    </View>
                    <View style={[styles.carte, { borderTopColor: couleurs.rouge }]}>
                        <Text style={styles.carteLabel}>Pertes</Text>
                        <Text style={[styles.carteVal, { color: couleurs.rouge }]}>−{fmt(inventaire.valeur_pertes)}</Text>
                    </View>
                    <View style={[styles.carte, { borderTopColor: couleurs.vert }]}>
                        <Text style={styles.carteLabel}>Gains</Text>
                        <Text style={[styles.carteVal, { color: couleurs.vert }]}>+{fmt(inventaire.valeur_gains)}</Text>
                    </View>
                </View>

                {/* Tableau détaillé */}
                <View style={styles.thead}>
                    <Text style={[styles.th, { width: '30%' }]}>Désignation</Text>
                    <Text style={[styles.th, { width: '18%' }]}>Catégorie</Text>
                    <Text style={[styles.th, { width: '13%', textAlign: 'center' }]}>Théorique</Text>
                    <Text style={[styles.th, { width: '13%', textAlign: 'center' }]}>Réel</Text>
                    <Text style={[styles.th, { width: '10%', textAlign: 'center' }]}>Écart</Text>
                    <Text style={[styles.th, { width: '16%', textAlign: 'right' }]}>Valeur</Text>
                </View>
                {tri.map((l, i) => {
                    const coul = l.ecart === 0 ? couleurs.texteFaible : l.ecart < 0 ? couleurs.rouge : couleurs.vert
                    return (
                        <View key={i} style={[styles.tr, i % 2 !== 0 ? styles.trAlt : {}]} wrap={false}>
                            <Text style={[styles.td, { width: '30%', fontFamily: 'Helvetica-Bold' }]}>{l.nom}</Text>
                            <Text style={[styles.td, { width: '18%' }]}>{l.categorie || '—'}</Text>
                            <Text style={[styles.td, { width: '13%', textAlign: 'center' }]}>{l.theorique} {l.unite}</Text>
                            <Text style={[styles.td, { width: '13%', textAlign: 'center' }]}>{l.reel} {l.unite}</Text>
                            <Text style={[styles.td, { width: '10%', textAlign: 'center', fontFamily: 'Helvetica-Bold', color: coul }]}>
                                {l.ecart > 0 ? '+' : ''}{l.ecart}
                            </Text>
                            <Text style={[styles.td, { width: '16%', textAlign: 'right', color: coul }]}>
                                {l.ecart === 0 ? '—' : (l.ecart < 0 ? '−' : '+') + fmt(l.valeurEcart)}
                            </Text>
                        </View>
                    )
                })}

                {/* Totaux */}
                <View style={styles.totaux}>
                    <View style={styles.totBox}>
                        <View style={styles.totLigne}>
                            <Text style={[styles.totLabel, { color: couleurs.rouge }]}>Total pertes</Text>
                            <Text style={[styles.totVal, { color: couleurs.rouge }]}>−{fmt(inventaire.valeur_pertes)}</Text>
                        </View>
                        <View style={styles.totLigne}>
                            <Text style={[styles.totLabel, { color: couleurs.vert }]}>Total gains</Text>
                            <Text style={[styles.totVal, { color: couleurs.vert }]}>+{fmt(inventaire.valeur_gains)}</Text>
                        </View>
                        <View style={styles.totNet}>
                            <Text style={styles.totNetLabel}>Impact net sur la valeur du stock</Text>
                            <Text style={styles.totNetVal}>{valNette >= 0 ? '+' : '−'}{fmt(Math.abs(valNette))}</Text>
                        </View>
                    </View>
                </View>

                <Text style={styles.pied} fixed>
                    {boutique.nom}{boutique.ifu ? ` · IFU ${boutique.ifu}` : ''}
                    {'  —  '}Rapport d'inventaire {inventaire.public_id} · Généré le {donnees.genere_le}
                </Text>
            </Page>
        </Document>
    )
}
