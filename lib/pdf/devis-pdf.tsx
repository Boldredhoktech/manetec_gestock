// lib/pdf/devis-pdf.tsx
// Template PDF pour les devis — affiche "PROFORMA" comme titre du document

import React from 'react'
import { Document, Page, Text, View, StyleSheet } from '@react-pdf/renderer'
import { couleurs } from '@/lib/pdf/styles'
import { formatMontantPDF, formatDatePDF } from '@/lib/pdf/utils-pdf'

function fmt(n: number, d: string) {
    return formatMontantPDF(n, d)
}

const styles = StyleSheet.create({
    page: {
        fontFamily:      'Helvetica',
        fontSize:        9,
        color:           couleurs.texte,
        padding:         40,
        backgroundColor: '#fff',
    },
    entete: {
        display:        'flex',
        flexDirection:  'row',
        justifyContent: 'space-between',
        marginBottom:   24,
    },
    nomBoutique: {
        fontSize:     18,
        fontFamily:   'Helvetica-Bold',
        color:        couleurs.primaire,
        marginBottom: 4,
    },
    infoBoutique: { fontSize: 8, color: couleurs.texteFaible, marginBottom: 2 },
    titreDoc: {
        fontSize:     22,
        fontFamily:   'Helvetica-Bold',
        color:        couleurs.primaire,
        textAlign:    'right',
        marginBottom: 4,
    },
    refDoc:  { fontSize: 9, fontFamily: 'Helvetica-Bold', textAlign: 'right', marginBottom: 2 },
    dateDoc: { fontSize: 8, color: couleurs.texteFaible, textAlign: 'right' },
    partiesBlock: {
        display:        'flex',
        flexDirection:  'row',
        justifyContent: 'space-between',
        marginBottom:   20,
        gap:            16,
    },
    partieCard: {
        flex:            1,
        backgroundColor: couleurs.fondClair,
        padding:         10,
        borderRadius:    4,
    },
    partieLabel: {
        fontSize:      7,
        fontFamily:    'Helvetica-Bold',
        color:         couleurs.texteFaible,
        textTransform: 'uppercase',
        letterSpacing: 0.5,
        marginBottom:  5,
    },
    partieNom:  { fontSize: 10, fontFamily: 'Helvetica-Bold', color: couleurs.primaire, marginBottom: 3 },
    partieInfo: { fontSize: 8, color: couleurs.texteFaible, marginBottom: 1 },
    // Bande de validité
    validiteBlock: {
        backgroundColor: '#fff8e1',
        borderLeftWidth: 3,
        borderLeftColor: couleurs.orange,
        padding:         8,
        borderRadius:    4,
        marginBottom:    16,
    },
    validiteTexte: { fontSize: 8, color: couleurs.orange, fontFamily: 'Helvetica-Bold' },
    // Tableau
    tableauEntete: {
        display:         'flex',
        flexDirection:   'row',
        backgroundColor: couleurs.primaire,
        padding:         7,
        borderRadius:    4,
    },
    cellEnt:   { fontFamily: 'Helvetica-Bold', fontSize: 8, color: '#fff' },
    tableLigne: {
        display:          'flex',
        flexDirection:    'row',
        padding:          6,
        borderBottomWidth:1,
        borderBottomColor:couleurs.bordure,
    },
    tableLigneImp: { backgroundColor: couleurs.fondClair },
    cell:      { fontSize: 8.5, color: couleurs.texte },
    // Totaux
    totauxBlock: {
        display:        'flex',
        flexDirection:  'row',
        justifyContent: 'flex-end',
        marginTop:      12,
    },
    totauxInner: { width: '40%' },
    totalLigne: {
        display:        'flex',
        flexDirection:  'row',
        justifyContent: 'space-between',
        marginBottom:   3,
    },
    totalLabel:  { fontSize: 8.5, color: couleurs.texteFaible },
    totalValeur: { fontSize: 8.5, color: couleurs.texte },
    grandTotalLigne: {
        display:          'flex',
        flexDirection:    'row',
        justifyContent:   'space-between',
        borderTopWidth:   2,
        borderTopColor:   couleurs.primaire,
        paddingTop:       6,
        marginTop:        4,
    },
    grandTotalLabel:  { fontSize: 11, fontFamily: 'Helvetica-Bold', color: couleurs.primaire },
    grandTotalValeur: { fontSize: 11, fontFamily: 'Helvetica-Bold', color: couleurs.primaire },
    // Note
    noteBlock: {
        marginTop:       16,
        padding:         10,
        backgroundColor: couleurs.fondClair,
        borderRadius:    4,
        borderLeftWidth: 3,
        borderLeftColor: couleurs.accent,
    },
    noteLabel:  { fontSize: 7, fontFamily: 'Helvetica-Bold', color: couleurs.texteFaible, marginBottom: 3 },
    noteTexte:  { fontSize: 8, color: couleurs.texte },
    // Signatures
    signatureBlock: {
        display:        'flex',
        flexDirection:  'row',
        justifyContent: 'space-between',
        marginTop:      36,
        gap:            20,
    },
    signatureBox: {
        flex:           1,
        borderTopWidth: 1,
        borderTopColor: couleurs.bordure,
        paddingTop:     6,
        alignItems:     'center',
    },
    signatureLabel: { fontSize: 8, color: couleurs.texteFaible },
    // Pied de page
    pied: {
        position:         'absolute',
        bottom:           24,
        left:             40,
        right:            40,
        textAlign:        'center',
        fontSize:         7,
        color:            couleurs.texteFaible,
        borderTopWidth:   1,
        borderTopColor:   couleurs.bordure,
        paddingTop:       6,
    },
})

interface LigneDevis {
    designation:   string
    quantite:      number
    prix_unitaire: number
    remise_pct:    number
    tva_pct:       number
    montant_ttc:   number
}

export interface DonneesDevisPDF {
    boutique: {
        nom:        string
        adresse?:   string | null
        ville?:     string | null
        telephone_1: string
        email?:     string | null
        ifu?:       string | null
        rccm?:      string | null
        message_pied_facture?: string | null
        devise:     string
    }
    client?: {
        nom:        string
        adresse?:   string | null
        telephone?: string | null
        email?:     string | null
        ifu?:       string | null
        rccm?:      string | null
        ville?:     string | null
        pays?:      string | null
    } | null
    devis: {
        public_id:      string
        date_devis:     string
        date_validite?: string | null
        objet?:         string | null
        note_client?:   string | null
        montant_ht:     number
        remise_val:     number
        remise_pct:     number
        montant_tva:    number
        montant_ttc:    number
    }
    lignes:    LigneDevis[]
    genere_le: string
}

export function DevisPDF({ donnees }: { donnees: DonneesDevisPDF }) {
    const { boutique, client, devis, lignes } = donnees
    const d = boutique.devise

    return (
        <Document>
            <Page size="A4" style={styles.page}>

                {/* ── EN-TÊTE ── */}
                <View style={styles.entete}>
                    <View>
                        <Text style={styles.nomBoutique}>{boutique.nom}</Text>
                        {boutique.adresse && <Text style={styles.infoBoutique}>{boutique.adresse}</Text>}
                        {boutique.ville  && <Text style={styles.infoBoutique}>{boutique.ville}</Text>}
                        <Text style={styles.infoBoutique}>Tél : {boutique.telephone_1}</Text>
                        {boutique.email  && <Text style={styles.infoBoutique}>{boutique.email}</Text>}
                        {boutique.ifu   && <Text style={styles.infoBoutique}>IFU : {boutique.ifu}</Text>}
                        {boutique.rccm  && <Text style={styles.infoBoutique}>RCCM : {boutique.rccm}</Text>}
                    </View>
                    <View>
                        {/* PROFORMA au lieu de DEVIS */}
                        <Text style={styles.titreDoc}>PROFORMA</Text>
                        <Text style={styles.refDoc}>{devis.public_id}</Text>
                        <Text style={styles.dateDoc}>Date : {formatDatePDF(devis.date_devis)}</Text>
                        {devis.date_validite && (
                            <Text style={[styles.dateDoc, { marginTop: 2 }]}>
                                Valide jusqu'au : {formatDatePDF(devis.date_validite)}
                            </Text>
                        )}
                        {devis.objet && (
                            <Text style={[styles.dateDoc, { marginTop: 4, fontFamily: 'Helvetica-Bold' }]}>
                                Objet : {devis.objet}
                            </Text>
                        )}
                    </View>
                </View>

                {/* ── BANDEAU VALIDITÉ ── */}
                {devis.date_validite && (
                    <View style={styles.validiteBlock}>
                        <Text style={styles.validiteTexte}>
                            Ce document est un devis commercial. Il est valable jusqu'au {formatDatePDF(devis.date_validite)}.
                            Passé ce délai, les prix peuvent être sujets à modification.
                        </Text>
                    </View>
                )}

                {/* ── PARTIES ── */}
                <View style={styles.partiesBlock}>
                    <View style={styles.partieCard}>
                        <Text style={styles.partieLabel}>Émetteur</Text>
                        <Text style={styles.partieNom}>{boutique.nom}</Text>
                        {boutique.adresse   && <Text style={styles.partieInfo}>{boutique.adresse}</Text>}
                        <Text style={styles.partieInfo}>{boutique.telephone_1}</Text>
                        {boutique.ifu  && <Text style={styles.partieInfo}>IFU : {boutique.ifu}</Text>}
                        {boutique.rccm && <Text style={styles.partieInfo}>RCCM : {boutique.rccm}</Text>}
                    </View>
                    <View style={styles.partieCard}>
                        <Text style={styles.partieLabel}>Destinataire</Text>
                        {client ? (
                            <>
                                <Text style={styles.partieNom}>{client.nom}</Text>
                                {client.adresse   && <Text style={styles.partieInfo}>{client.adresse}</Text>}
                                {client.ville     && <Text style={styles.partieInfo}>{client.ville}</Text>}
                                {client.telephone && <Text style={styles.partieInfo}>{client.telephone}</Text>}
                                {client.ifu       && <Text style={styles.partieInfo}>IFU : {client.ifu}</Text>}
                                {client.rccm      && <Text style={styles.partieInfo}>RCCM : {client.rccm}</Text>}
                            </>
                        ) : (
                            <Text style={styles.partieInfo}>Client non spécifié</Text>
                        )}
                    </View>
                </View>

                {/* ── TABLEAU DES LIGNES ── */}
                <View style={styles.tableauEntete}>
                    <Text style={[styles.cellEnt, { width: '40%' }]}>Désignation</Text>
                    <Text style={[styles.cellEnt, { width: '10%', textAlign: 'center' }]}>Qté</Text>
                    <Text style={[styles.cellEnt, { width: '15%', textAlign: 'right' }]}>P.U. HT</Text>
                    <Text style={[styles.cellEnt, { width: '10%', textAlign: 'right' }]}>Remise</Text>
                    <Text style={[styles.cellEnt, { width: '10%', textAlign: 'right' }]}>TVA</Text>
                    <Text style={[styles.cellEnt, { width: '15%', textAlign: 'right' }]}>Total TTC</Text>
                </View>

                {lignes.map((l, i) => (
                    <View key={i} style={[styles.tableLigne, i % 2 !== 0 ? styles.tableLigneImp : {}]}>
                        <Text style={[styles.cell, { width: '40%' }]}>{l.designation}</Text>
                        <Text style={[styles.cell, { width: '10%', textAlign: 'center' }]}>{l.quantite}</Text>
                        <Text style={[styles.cell, { width: '15%', textAlign: 'right' }]}>
                            {fmt(l.prix_unitaire, d)}
                        </Text>
                        <Text style={[styles.cell, { width: '10%', textAlign: 'right' }]}>
                            {l.remise_pct > 0 ? `${l.remise_pct}%` : '—'}
                        </Text>
                        <Text style={[styles.cell, { width: '10%', textAlign: 'right' }]}>
                            {l.tva_pct > 0 ? `${l.tva_pct}%` : '—'}
                        </Text>
                        <Text style={[styles.cell, { width: '15%', textAlign: 'right', fontFamily: 'Helvetica-Bold' }]}>
                            {fmt(l.montant_ttc, d)}
                        </Text>
                    </View>
                ))}

                {/* ── TOTAUX ── */}
                <View style={styles.totauxBlock}>
                    <View style={styles.totauxInner}>
                        <View style={styles.totalLigne}>
                            <Text style={styles.totalLabel}>Sous-total HT</Text>
                            <Text style={styles.totalValeur}>{fmt(devis.montant_ht + devis.remise_val, d)}</Text>
                        </View>
                        {devis.remise_val > 0 && (
                            <View style={styles.totalLigne}>
                                <Text style={[styles.totalLabel, { color: couleurs.vert }]}>
                                    Remise ({devis.remise_pct}%)
                                </Text>
                                <Text style={[styles.totalValeur, { color: couleurs.vert }]}>
                                    -{fmt(devis.remise_val, d)}
                                </Text>
                            </View>
                        )}
                        {devis.montant_tva > 0 && (
                            <View style={styles.totalLigne}>
                                <Text style={styles.totalLabel}>TVA</Text>
                                <Text style={styles.totalValeur}>{fmt(devis.montant_tva, d)}</Text>
                            </View>
                        )}
                        <View style={styles.grandTotalLigne}>
                            <Text style={styles.grandTotalLabel}>TOTAL TTC</Text>
                            <Text style={styles.grandTotalValeur}>{fmt(devis.montant_ttc, d)}</Text>
                        </View>
                    </View>
                </View>

                {/* ── NOTE CLIENT ── */}
                {devis.note_client && (
                    <View style={styles.noteBlock}>
                        <Text style={styles.noteLabel}>CONDITIONS / NOTES</Text>
                        <Text style={styles.noteTexte}>{devis.note_client}</Text>
                    </View>
                )}

                {/* ── SIGNATURES ── */}
                <View style={styles.signatureBlock}>
                    <View style={styles.signatureBox}>
                        <Text style={styles.signatureLabel}>Signature et cachet émetteur</Text>
                    </View>
                    <View style={styles.signatureBox}>
                        <Text style={styles.signatureLabel}>Bon pour accord — Client</Text>
                    </View>
                </View>

                {/* ── PIED DE PAGE ── */}
                <Text style={styles.pied}>
                    {boutique.nom}
                    {boutique.message_pied_facture
                        ? ` — ${boutique.message_pied_facture}`
                        : ' — Manetec Gestock'
                    }
                    {' — '}{devis.public_id} — Généré le {donnees.genere_le}
                </Text>

            </Page>
        </Document>
    )
}