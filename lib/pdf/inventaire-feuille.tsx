import React from 'react'
import { Document, Page, Text, View, Image, StyleSheet } from '@react-pdf/renderer'
import { couleurs } from '@/lib/pdf/styles'
import { formatDatePDF } from '@/lib/pdf/utils-pdf'

const styles = StyleSheet.create({
    page: {
        fontFamily: 'Helvetica', fontSize: 9, color: couleurs.texte,
        paddingTop: 32, paddingBottom: 56, paddingHorizontal: 36, backgroundColor: '#fff',
    },
    entete: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' },
    logo: { width: 96, height: 48, objectFit: 'contain', marginBottom: 4 },
    nomBoutique: { fontSize: 14, fontFamily: 'Helvetica-Bold', color: couleurs.primaire },
    info: { fontSize: 8, color: couleurs.texteFaible, marginBottom: 1 },
    titre: { fontSize: 18, fontFamily: 'Helvetica-Bold', color: couleurs.primaire, textAlign: 'right' },
    sousTitre: { fontSize: 8, color: couleurs.texteFaible, textAlign: 'right', marginTop: 2 },
    ref: { fontSize: 10, fontFamily: 'Helvetica-Bold', color: couleurs.texte, textAlign: 'right', marginTop: 2 },

    regle: { height: 2, backgroundColor: couleurs.primaire, marginTop: 12, marginBottom: 14 },

    metaRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 12 },
    metaCase: { backgroundColor: couleurs.fondClair, borderRadius: 4, paddingVertical: 6, paddingHorizontal: 10, minWidth: 150 },
    metaLabel: { fontSize: 7, fontFamily: 'Helvetica-Bold', color: couleurs.texteFaible, textTransform: 'uppercase', letterSpacing: 0.5 },
    metaValeur: { fontSize: 10, fontFamily: 'Helvetica-Bold', color: couleurs.texte, marginTop: 2 },

    consigne: {
        flexDirection: 'row', gap: 6, backgroundColor: '#fff8e1', borderLeftWidth: 3, borderLeftColor: couleurs.accent,
        paddingVertical: 6, paddingHorizontal: 10, borderRadius: 2, marginBottom: 12,
    },
    consigneTexte: { fontSize: 8, color: '#92400e' },

    thead: { flexDirection: 'row', backgroundColor: couleurs.primaire, paddingVertical: 6, paddingHorizontal: 6 },
    th: { fontFamily: 'Helvetica-Bold', fontSize: 8, color: '#fff' },
    tr: { flexDirection: 'row', alignItems: 'center', paddingVertical: 7, paddingHorizontal: 6, borderBottomWidth: 1, borderBottomColor: couleurs.bordure },
    trAlt: { backgroundColor: couleurs.fondClair },
    td: { fontSize: 8.5, color: couleurs.texte },
    boite: { borderWidth: 1, borderColor: '#94a3b8', height: 16, borderRadius: 2 },

    pied: {
        position: 'absolute', bottom: 24, left: 36, right: 36, flexDirection: 'row',
        justifyContent: 'space-between', borderTopWidth: 1, borderTopColor: couleurs.bordure, paddingTop: 6,
    },
    signature: { width: '45%' },
    signLabel: { fontSize: 8, fontFamily: 'Helvetica-Bold', color: couleurs.texteFaible, marginBottom: 18 },
    signLigne: { borderTopWidth: 1, borderTopColor: '#94a3b8', paddingTop: 3, fontSize: 7, color: couleurs.texteFaible },
    piedNum: { position: 'absolute', bottom: 10, left: 36, right: 36, textAlign: 'center', fontSize: 7, color: couleurs.texteFaible },
})

export interface DonneesFeuilleComptage {
    boutique: {
        nom: string; adresse?: string | null; ville?: string | null
        telephone_1?: string | null; ifu?: string | null; logo_url?: string | null
    }
    inventaire: { public_id: string; nom: string | null; warehouse_nom: string; date: string }
    lignes: { nom: string; categorie: string; unite: string }[]
    genere_le: string
}

export function FeuilleComptagePDF({ donnees }: { donnees: DonneesFeuilleComptage }) {
    const { boutique, inventaire, lignes } = donnees
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
                    </View>
                    <View>
                        <Text style={styles.titre}>FEUILLE DE COMPTAGE</Text>
                        <Text style={styles.sousTitre}>À imprimer et remplir lors du comptage physique</Text>
                        <Text style={styles.ref}>{inventaire.public_id}</Text>
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
                        <Text style={styles.metaLabel}>Date</Text>
                        <Text style={styles.metaValeur}>{formatDatePDF(inventaire.date)}</Text>
                    </View>
                    <View style={styles.metaCase}>
                        <Text style={styles.metaLabel}>Articles à compter</Text>
                        <Text style={styles.metaValeur}>{lignes.length}</Text>
                    </View>
                </View>

                <View style={styles.consigne}>
                    <Text style={styles.consigneTexte}>
                        Comptez physiquement chaque article et inscrivez la quantité réelle dans la case prévue.
                        La quantité théorique n'est pas affichée afin de garantir un comptage objectif.
                    </Text>
                </View>

                {/* En-tête tableau */}
                <View style={styles.thead}>
                    <Text style={[styles.th, { width: '6%' }]}>N°</Text>
                    <Text style={[styles.th, { width: '44%' }]}>Désignation</Text>
                    <Text style={[styles.th, { width: '24%' }]}>Catégorie</Text>
                    <Text style={[styles.th, { width: '10%' }]}>Unité</Text>
                    <Text style={[styles.th, { width: '16%', textAlign: 'center' }]}>Qté comptée</Text>
                </View>
                {lignes.map((l, i) => (
                    <View key={i} style={[styles.tr, i % 2 !== 0 ? styles.trAlt : {}]} wrap={false}>
                        <Text style={[styles.td, { width: '6%' }]}>{i + 1}</Text>
                        <Text style={[styles.td, { width: '44%', fontFamily: 'Helvetica-Bold' }]}>{l.nom}</Text>
                        <Text style={[styles.td, { width: '24%' }]}>{l.categorie || '—'}</Text>
                        <Text style={[styles.td, { width: '10%' }]}>{l.unite}</Text>
                        <View style={{ width: '16%', paddingHorizontal: 6 }}><View style={styles.boite} /></View>
                    </View>
                ))}

                {/* Pied : signatures */}
                <View style={styles.pied} fixed>
                    <View style={styles.signature}>
                        <Text style={styles.signLabel}>Compté par</Text>
                        <Text style={styles.signLigne}>Nom et signature</Text>
                    </View>
                    <View style={styles.signature}>
                        <Text style={styles.signLabel}>Vérifié par</Text>
                        <Text style={styles.signLigne}>Nom et signature</Text>
                    </View>
                </View>
                <Text style={styles.piedNum} fixed render={({ pageNumber, totalPages }) =>
                    `${boutique.nom} — Feuille de comptage ${inventaire.public_id} — Page ${pageNumber}/${totalPages} — Générée le ${donnees.genere_le}`
                } />
            </Page>
        </Document>
    )
}
