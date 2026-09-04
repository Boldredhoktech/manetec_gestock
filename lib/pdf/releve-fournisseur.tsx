import React from 'react'
import { Document, Page, Text, View, StyleSheet } from '@react-pdf/renderer'
import { couleurs } from '@/lib/pdf/styles'
import { formatMontantPDF } from '@/lib/pdf/utils-pdf'
import { EnteteRapportPDF, type BoutiqueEntete } from '@/lib/pdf/entete-rapport'

// Le relevé qu'on envoie au fournisseur en cas de désaccord : chaque
// pièce dans l'ordre, avec le solde qui court après chacune.
const styles = StyleSheet.create({
    page: {
        fontFamily: 'Helvetica', fontSize: 9,
        color: couleurs.texte, padding: 30, backgroundColor: '#fff',
    },
    bandeau: {
        backgroundColor: couleurs.fondClair, padding: 12, borderRadius: 6,
        marginBottom: 14, borderLeftWidth: 3, borderLeftColor: couleurs.primaire,
    },
    nomFourn: { fontSize: 12, fontFamily: 'Helvetica-Bold', color: couleurs.primaire },
    infoFourn: { fontSize: 8, color: couleurs.texteFaible, marginTop: 2 },
    resume: { display: 'flex', flexDirection: 'row', gap: 8, marginBottom: 14 },
    carte: { flex: 1, padding: 8, borderRadius: 4, borderWidth: 1, borderColor: couleurs.bordure },
    carteLabel: { fontSize: 7, color: couleurs.texteFaible },
    carteVal: { fontSize: 11, fontFamily: 'Helvetica-Bold', marginTop: 2 },
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
    totaux: {
        display: 'flex', flexDirection: 'row', padding: 7,
        backgroundColor: couleurs.primaire, borderRadius: 4, marginTop: 10,
    },
    cellTot: { fontSize: 9, fontFamily: 'Helvetica-Bold', color: '#fff' },
    pied: {
        position: 'absolute', bottom: 20, left: 30, right: 30,
        textAlign: 'center', fontSize: 7, color: couleurs.texteFaible,
        borderTopWidth: 1, borderTopColor: couleurs.bordure, paddingTop: 6,
    },
})

interface LigneReleve {
    date_fr: string; type: 'facture' | 'paiement'
    piece: string; libelle: string
    debit: number; credit: number; solde: number
}

interface DonneesReleve {
    boutique: BoutiqueEntete & { devise: string }
    fournisseur: {
        public_id: string; nom: string
        telephone: string | null; email: string | null
        adresse: string | null; ville: string | null
    }
    periode:         string
    genere_le:       string
    solde_ouverture: number
    total_achats:    number
    total_paiements: number
    solde_cloture:   number
    lignes:          LigneReleve[]
}

const L = { date: '12%', piece: '15%', libelle: '35%', debit: '12%', credit: '12%', solde: '14%' }

export function ReleveFournisseurPDF({ donnees }: { donnees: DonneesReleve }) {
    const d = donnees.boutique.devise
    const fmt = (n: number) => formatMontantPDF(n, d)
    const f = donnees.fournisseur

    return (
        <Document>
            <Page size="A4" style={styles.page}>

                <EnteteRapportPDF
                    boutique={donnees.boutique}
                    titre="RELEVÉ DE COMPTE FOURNISSEUR"
                    sousTitre={donnees.periode}
                    genereLe={donnees.genere_le}
                />

                <View style={styles.bandeau}>
                    <Text style={styles.nomFourn}>{f.nom}</Text>
                    <Text style={styles.infoFourn}>
                        {f.public_id}
                        {f.telephone ? ` · ${f.telephone}` : ''}
                        {f.email ? ` · ${f.email}` : ''}
                    </Text>
                    {(f.adresse || f.ville) && (
                        <Text style={styles.infoFourn}>
                            {[f.adresse, f.ville].filter(Boolean).join(', ')}
                        </Text>
                    )}
                </View>

                <View style={styles.resume}>
                    <View style={styles.carte}>
                        <Text style={styles.carteLabel}>Solde à l&apos;ouverture</Text>
                        <Text style={styles.carteVal}>{fmt(donnees.solde_ouverture)}</Text>
                    </View>
                    <View style={styles.carte}>
                        <Text style={styles.carteLabel}>Achats de la période</Text>
                        <Text style={[styles.carteVal, { color: couleurs.orange }]}>+{fmt(donnees.total_achats)}</Text>
                    </View>
                    <View style={styles.carte}>
                        <Text style={styles.carteLabel}>Règlements</Text>
                        <Text style={[styles.carteVal, { color: couleurs.vert }]}>-{fmt(donnees.total_paiements)}</Text>
                    </View>
                    <View style={[styles.carte, { borderColor: couleurs.primaire, borderWidth: 2 }]}>
                        <Text style={styles.carteLabel}>Solde à la clôture</Text>
                        <Text style={[styles.carteVal, {
                            color: donnees.solde_cloture > 0 ? couleurs.rouge : couleurs.vert,
                        }]}>
                            {fmt(donnees.solde_cloture)}
                        </Text>
                    </View>
                </View>

                <View style={styles.tableauEntete}>
                    <Text style={[styles.cellEnt, { width: L.date }]}>Date</Text>
                    <Text style={[styles.cellEnt, { width: L.piece }]}>Pièce</Text>
                    <Text style={[styles.cellEnt, { width: L.libelle }]}>Libellé</Text>
                    <Text style={[styles.cellEnt, { width: L.debit, textAlign: 'right' }]}>Achat</Text>
                    <Text style={[styles.cellEnt, { width: L.credit, textAlign: 'right' }]}>Règlement</Text>
                    <Text style={[styles.cellEnt, { width: L.solde, textAlign: 'right' }]}>Solde</Text>
                </View>

                {donnees.lignes.length === 0 && (
                    <View style={styles.ligne}>
                        <Text style={[styles.cell, { width: '100%', textAlign: 'center', color: couleurs.texteFaible }]}>
                            Aucun mouvement sur cette période.
                        </Text>
                    </View>
                )}

                {donnees.lignes.map((l, i) => (
                    <View key={`${l.piece}-${i}`} style={[styles.ligne, i % 2 !== 0 ? styles.ligneImp : {}]} wrap={false}>
                        <Text style={[styles.cell, { width: L.date }]}>{l.date_fr}</Text>
                        <Text style={[styles.cell, { width: L.piece }]}>{l.piece}</Text>
                        <Text style={[styles.cell, { width: L.libelle }]}>{l.libelle}</Text>
                        <Text style={[styles.cell, { width: L.debit, textAlign: 'right' }]}>
                            {l.debit > 0 ? fmt(l.debit) : ''}
                        </Text>
                        <Text style={[styles.cell, { width: L.credit, textAlign: 'right', color: couleurs.vert }]}>
                            {l.credit > 0 ? fmt(l.credit) : ''}
                        </Text>
                        <Text style={[styles.cell, { width: L.solde, textAlign: 'right', fontFamily: 'Helvetica-Bold' }]}>
                            {fmt(l.solde)}
                        </Text>
                    </View>
                ))}

                <View style={styles.totaux}>
                    <Text style={[styles.cellTot, { width: '62%' }]}>SOLDE DÛ AU TERME DE LA PÉRIODE</Text>
                    <Text style={[styles.cellTot, { width: '38%', textAlign: 'right' }]}>
                        {fmt(donnees.solde_cloture)}
                    </Text>
                </View>

                <Text style={styles.pied} fixed>
                    Relevé établi par {donnees.boutique.nom} · en cas de désaccord, merci de nous contacter
                    en précisant les numéros de pièce concernés.
                </Text>
            </Page>
        </Document>
    )
}
