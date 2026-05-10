import React from 'react'
import { Document, Page, Text, View, StyleSheet } from '@react-pdf/renderer'
import { couleurs } from '@/lib/pdf/styles'

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
        fontSize:   18,
        fontFamily: 'Helvetica-Bold',
        color:      couleurs.primaire,
        marginBottom: 4,
    },
    infoBoutique: { fontSize: 8, color: couleurs.texteFaible, marginBottom: 2 },
    titreFact: {
        fontSize:   22,
        fontFamily: 'Helvetica-Bold',
        color:      couleurs.primaire,
        textAlign:  'right',
        marginBottom: 4,
    },
    refFact: {
        fontSize:  9,
        fontFamily: 'Helvetica-Bold',
        textAlign: 'right',
        color:     couleurs.texte,
        marginBottom: 2,
    },
    dateFact: { fontSize: 8, color: couleurs.texteFaible, textAlign: 'right' },
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
        fontSize:     7,
        fontFamily:   'Helvetica-Bold',
        color:        couleurs.texteFaible,
        textTransform: 'uppercase',
        letterSpacing: 0.5,
        marginBottom:  5,
    },
    partieNom: {
        fontSize:  10,
        fontFamily: 'Helvetica-Bold',
        color:     couleurs.primaire,
        marginBottom: 3,
    },
    partieInfo: { fontSize: 8, color: couleurs.texteFaible, marginBottom: 1 },
    tableauEntete: {
        display:         'flex',
        flexDirection:   'row',
        backgroundColor: couleurs.primaire,
        padding:         7,
        borderRadius:    4,
        marginBottom:    0,
    },
    tableCellEnt: {
        fontFamily: 'Helvetica-Bold',
        fontSize:   8,
        color:      '#fff',
    },
    tableLigne: {
        display:        'flex',
        flexDirection:  'row',
        padding:        6,
        borderBottomWidth: 1,
        borderBottomColor: couleurs.bordure,
    },
    tableLigneImp: { backgroundColor: couleurs.fondClair },
    tableCell: { fontSize: 8.5, color: couleurs.texte },
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
    totalLabel: { fontSize: 8.5, color: couleurs.texteFaible },
    totalValeur: { fontSize: 8.5, color: couleurs.texte },
    grandTotalLigne: {
        display:           'flex',
        flexDirection:     'row',
        justifyContent:    'space-between',
        borderTopWidth:    2,
        borderTopColor:    couleurs.primaire,
        paddingTop:        6,
        marginTop:         4,
    },
    grandTotalLabel: { fontSize: 10, fontFamily: 'Helvetica-Bold', color: couleurs.primaire },
    grandTotalValeur: { fontSize: 10, fontFamily: 'Helvetica-Bold', color: couleurs.primaire },
    restantBlock: {
        display:        'flex',
        flexDirection:  'row',
        justifyContent: 'space-between',
        marginTop:      4,
        paddingTop:     4,
        borderTopWidth: 1,
        borderTopColor: couleurs.bordure,
    },
    restantLabel: { fontSize: 9, fontFamily: 'Helvetica-Bold', color: couleurs.rouge },
    restantValeur: { fontSize: 9, fontFamily: 'Helvetica-Bold', color: couleurs.rouge },
    noteBlock: {
        marginTop:         16,
        padding:           10,
        backgroundColor:   couleurs.fondClair,
        borderRadius:      4,
        borderLeftWidth:   3,
        borderLeftColor:   couleurs.accent,
    },
    noteLabel: { fontSize: 7, fontFamily: 'Helvetica-Bold', color: couleurs.texteFaible, marginBottom: 3 },
    noteTexte: { fontSize: 8, color: couleurs.texte },
    pied: {
        position:   'absolute',
        bottom:     24,
        left:       40,
        right:      40,
        textAlign:  'center',
        fontSize:   7,
        color:      couleurs.texteFaible,
        borderTopWidth: 1,
        borderTopColor: couleurs.bordure,
        paddingTop: 6,
    },
    statutBadge: {
        paddingHorizontal: 8,
        paddingVertical:   3,
        borderRadius:      4,
        fontSize:          8,
        fontFamily:        'Helvetica-Bold',
        alignSelf:         'flex-end',
        marginBottom:      4,
    },
})

interface LigneFacturePDF {
    designation:   string
    quantite:      number
    prix_unitaire: number
    remise_pct:    number
    tva_pct:       number
    montant_ttc:   number
}

interface DonneesFacturePDF {
    boutique: {
        nom: string; adresse?: string | null; ville?: string | null
        telephone_1: string; email?: string | null
        ifu?: string | null; rccm?: string | null; devise: string
        message_pied_facture?: string | null
    }
    facture: {
        public_id: string; date_facture: string; date_echeance?: string | null
        statut: string; objet?: string | null; note_client?: string | null
        montant_ht: number; remise_val: number; remise_pct: number
        montant_tva: number; montant_ttc: number
        montant_paye: number; montant_restant: number
    }
    client?: {
        nom: string; adresse?: string | null; telephone?: string | null
        email?: string | null; ifu?: string | null; rccm?: string | null
    } | null
    lignes:    LigneFacturePDF[]
    genere_le: string
}

const STATUT_LABELS: Record<string, { label: string; bg: string; color: string }> = {
    emise:               { label: 'ÉMISE',              bg: '#dbeafe', color: '#1d4ed8' },
    partiellement_payee: { label: 'PARTIELLEMENT PAYÉE', bg: '#fef3c7', color: '#92400e' },
    payee:               { label: 'PAYÉE',              bg: '#dcfce7', color: '#166534' },
    annulee:             { label: 'ANNULÉE',            bg: '#f3f4f6', color: '#6b7280' },
}

function fmt(n: number, d: string) {
    return new Intl.NumberFormat('fr-FR').format(n) + ' ' + d
}

export function FacturePDF({ donnees }: { donnees: DonneesFacturePDF }) {
    const { boutique, facture, client, lignes } = donnees
    const d = boutique.devise
    const statut = STATUT_LABELS[facture.statut] ?? STATUT_LABELS.emise

    return (
        <Document>
            <Page size="A4" style={styles.page}>

                {/* EN-TÊTE */}
                <View style={styles.entete}>
                    <View>
                        <Text style={styles.nomBoutique}>{boutique.nom}</Text>
                        {boutique.adresse && (
                            <Text style={styles.infoBoutique}>
                                {boutique.adresse}{boutique.ville ? `, ${boutique.ville}` : ''}
                            </Text>
                        )}
                        <Text style={styles.infoBoutique}>Tél : {boutique.telephone_1}</Text>
                        {boutique.email && (
                            <Text style={styles.infoBoutique}>{boutique.email}</Text>
                        )}
                        {boutique.ifu && (
                            <Text style={styles.infoBoutique}>IFU : {boutique.ifu}</Text>
                        )}
                        {boutique.rccm && (
                            <Text style={styles.infoBoutique}>RCCM : {boutique.rccm}</Text>
                        )}
                    </View>
                    <View>
                        <Text style={[styles.statutBadge, {
                            backgroundColor: statut.bg, color: statut.color,
                        }]}>
                            {statut.label}
                        </Text>
                        <Text style={styles.titreFact}>FACTURE</Text>
                        <Text style={styles.refFact}>{facture.public_id}</Text>
                        <Text style={styles.dateFact}>Date : {facture.date_facture}</Text>
                        {facture.date_echeance && (
                            <Text style={[styles.dateFact, { marginTop: 2 }]}>
                                Échéance : {facture.date_echeance}
                            </Text>
                        )}
                    </View>
                </View>

                {/* PARTIES */}
                <View style={styles.partiesBlock}>
                    <View style={styles.partieCard}>
                        <Text style={styles.partieLabel}>Émetteur</Text>
                        <Text style={styles.partieNom}>{boutique.nom}</Text>
                        {boutique.adresse && (
                            <Text style={styles.partieInfo}>{boutique.adresse}</Text>
                        )}
                        <Text style={styles.partieInfo}>{boutique.telephone_1}</Text>
                    </View>
                    <View style={styles.partieCard}>
                        <Text style={styles.partieLabel}>Destinataire</Text>
                        {client ? (
                            <>
                                <Text style={styles.partieNom}>{client.nom}</Text>
                                {client.adresse && <Text style={styles.partieInfo}>{client.adresse}</Text>}
                                {client.telephone && <Text style={styles.partieInfo}>{client.telephone}</Text>}
                                {client.ifu && <Text style={styles.partieInfo}>IFU : {client.ifu}</Text>}
                            </>
                        ) : (
                            <Text style={styles.partieInfo}>Client non spécifié</Text>
                        )}
                    </View>
                </View>

                {/* OBJET */}
                {facture.objet && (
                    <View style={{ marginBottom: 12 }}>
                        <Text style={{ fontSize: 8.5 }}>
                            <Text style={{ fontFamily: 'Helvetica-Bold' }}>Objet : </Text>
                            {facture.objet}
                        </Text>
                    </View>
                )}

                {/* LIGNES */}
                <View style={styles.tableauEntete}>
                    <Text style={[styles.tableCellEnt, { width: '42%' }]}>Désignation</Text>
                    <Text style={[styles.tableCellEnt, { width: '10%', textAlign: 'center' }]}>Qté</Text>
                    <Text style={[styles.tableCellEnt, { width: '16%', textAlign: 'right' }]}>P.U. HT</Text>
                    <Text style={[styles.tableCellEnt, { width: '10%', textAlign: 'center' }]}>Remise</Text>
                    <Text style={[styles.tableCellEnt, { width: '8%', textAlign: 'center' }]}>TVA</Text>
                    <Text style={[styles.tableCellEnt, { width: '14%', textAlign: 'right' }]}>Total TTC</Text>
                </View>
                {lignes.map((l, i) => (
                    <View key={i} style={[styles.tableLigne, i % 2 !== 0 ? styles.tableLigneImp : {}]}>
                        <Text style={[styles.tableCell, { width: '42%' }]}>{l.designation}</Text>
                        <Text style={[styles.tableCell, { width: '10%', textAlign: 'center' }]}>{l.quantite}</Text>
                        <Text style={[styles.tableCell, { width: '16%', textAlign: 'right' }]}>
                            {fmt(l.prix_unitaire, d)}
                        </Text>
                        <Text style={[styles.tableCell, { width: '10%', textAlign: 'center' }]}>
                            {l.remise_pct > 0 ? `${l.remise_pct}%` : '—'}
                        </Text>
                        <Text style={[styles.tableCell, { width: '8%', textAlign: 'center' }]}>
                            {l.tva_pct > 0 ? `${l.tva_pct}%` : '—'}
                        </Text>
                        <Text style={[styles.tableCell, {
                            width: '14%', textAlign: 'right', fontFamily: 'Helvetica-Bold',
                        }]}>
                            {fmt(l.montant_ttc, d)}
                        </Text>
                    </View>
                ))}

                {/* TOTAUX */}
                <View style={styles.totauxBlock}>
                    <View style={styles.totauxInner}>
                        <View style={styles.totalLigne}>
                            <Text style={styles.totalLabel}>Sous-total HT</Text>
                            <Text style={styles.totalValeur}>
                                {fmt(facture.montant_ht + facture.remise_val, d)}
                            </Text>
                        </View>
                        {facture.remise_val > 0 && (
                            <View style={styles.totalLigne}>
                                <Text style={[styles.totalLabel, { color: couleurs.vert }]}>
                                    Remise ({facture.remise_pct}%)
                                </Text>
                                <Text style={[styles.totalValeur, { color: couleurs.vert }]}>
                                    -{fmt(facture.remise_val, d)}
                                </Text>
                            </View>
                        )}
                        {facture.montant_tva > 0 && (
                            <View style={styles.totalLigne}>
                                <Text style={styles.totalLabel}>TVA</Text>
                                <Text style={styles.totalValeur}>{fmt(facture.montant_tva, d)}</Text>
                            </View>
                        )}
                        <View style={styles.grandTotalLigne}>
                            <Text style={styles.grandTotalLabel}>TOTAL TTC</Text>
                            <Text style={styles.grandTotalValeur}>{fmt(facture.montant_ttc, d)}</Text>
                        </View>
                        {facture.montant_paye > 0 && (
                            <View style={styles.totalLigne}>
                                <Text style={[styles.totalLabel, { color: couleurs.vert }]}>Déjà payé</Text>
                                <Text style={[styles.totalValeur, { color: couleurs.vert }]}>
                                    {fmt(facture.montant_paye, d)}
                                </Text>
                            </View>
                        )}
                        {facture.montant_restant > 0 && (
                            <View style={styles.restantBlock}>
                                <Text style={styles.restantLabel}>RESTE À PAYER</Text>
                                <Text style={styles.restantValeur}>{fmt(facture.montant_restant, d)}</Text>
                            </View>
                        )}
                    </View>
                </View>

                {/* NOTE CLIENT */}
                {facture.note_client && (
                    <View style={styles.noteBlock}>
                        <Text style={styles.noteLabel}>NOTE</Text>
                        <Text style={styles.noteTexte}>{facture.note_client}</Text>
                    </View>
                )}

                {/* MESSAGE PIED */}
                {boutique.message_pied_facture && (
                    <View style={[styles.noteBlock, { marginTop: 8, borderLeftColor: couleurs.texteFaible }]}>
                        <Text style={styles.noteTexte}>{boutique.message_pied_facture}</Text>
                    </View>
                )}

                {/* PIED DE PAGE */}
                <Text style={styles.pied}>
                    {boutique.nom} — {facture.public_id} — Généré le {donnees.genere_le} — Manetec Gestock
                </Text>

            </Page>
        </Document>
    )
}