// lib/pdf/devis-pdf.tsx
// Template PDF pour les devis — affiche "PROFORMA" comme titre du document

import React from 'react'
import { Document, Page, Text, View, Image, StyleSheet } from '@react-pdf/renderer'
import { couleurs } from '@/lib/pdf/styles'
import {
    formatMontantPDF, formatDatePDF, nombreEnLettresPDF, deviseEnLettresPDF,
} from '@/lib/pdf/utils-pdf'

const styles = StyleSheet.create({
    page: {
        fontFamily: 'Helvetica', fontSize: 9, color: couleurs.texte,
        paddingTop: 36, paddingBottom: 64, paddingHorizontal: 40, backgroundColor: '#fff',
    },
    entete: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' },
    logo: { width: 110, height: 56, objectFit: 'contain', marginBottom: 6 },
    nomBoutique: { fontSize: 17, fontFamily: 'Helvetica-Bold', color: couleurs.primaire, marginBottom: 4 },
    infoBoutique: { fontSize: 8, color: couleurs.texteFaible, marginBottom: 1.5 },
    enteteDroite: { alignItems: 'flex-end', maxWidth: 220 },
    titreDoc: { fontSize: 24, fontFamily: 'Helvetica-Bold', color: couleurs.primaire, letterSpacing: 1 },
    refDoc: { fontSize: 11, fontFamily: 'Helvetica-Bold', color: couleurs.texte, marginTop: 2 },

    regle: { height: 2, backgroundColor: couleurs.primaire, marginTop: 14, marginBottom: 16 },

    blocRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 16, gap: 16 },
    adresseA: { flex: 1 },
    blocLabel: {
        fontSize: 7.5, fontFamily: 'Helvetica-Bold', color: couleurs.accent,
        textTransform: 'uppercase', letterSpacing: 0.8, marginBottom: 5,
    },
    clientNom: { fontSize: 11, fontFamily: 'Helvetica-Bold', color: couleurs.texte, marginBottom: 2 },
    clientInfo: { fontSize: 8.5, color: couleurs.texteFaible, marginBottom: 1.5 },
    metaBox: { width: 215, borderWidth: 1, borderColor: couleurs.bordure, borderRadius: 3 },
    metaLigne: { flexDirection: 'row', justifyContent: 'space-between', paddingHorizontal: 10, paddingVertical: 5 },
    metaLigneAlt: { backgroundColor: couleurs.fondClair },
    metaLabel: { fontSize: 8.5, color: couleurs.texteFaible },
    metaValeur: { fontSize: 8.5, fontFamily: 'Helvetica-Bold', color: couleurs.texte },

    validiteBlock: {
        backgroundColor: '#fff8e1', borderLeftWidth: 3, borderLeftColor: couleurs.accent,
        paddingVertical: 7, paddingHorizontal: 10, borderRadius: 2, marginBottom: 14,
    },
    validiteTexte: { fontSize: 8, color: '#92400e' },
    objet: { fontSize: 9, marginBottom: 12 },

    thead: { flexDirection: 'row', backgroundColor: couleurs.primaire, paddingVertical: 7, paddingHorizontal: 8 },
    th: { fontFamily: 'Helvetica-Bold', fontSize: 8, color: '#fff' },
    tr: { flexDirection: 'row', paddingVertical: 6, paddingHorizontal: 8, borderBottomWidth: 1, borderBottomColor: couleurs.bordure },
    trAlt: { backgroundColor: couleurs.fondClair },
    td: { fontSize: 8.5, color: couleurs.texte },

    totauxRow: { flexDirection: 'row', justifyContent: 'flex-end', marginTop: 14 },
    totaux: { width: '45%' },
    totLigne: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 2.5 },
    totLabel: { fontSize: 9, color: couleurs.texteFaible },
    totValeur: { fontSize: 9, color: couleurs.texte },
    grandTotal: {
        flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
        backgroundColor: couleurs.primaire, paddingVertical: 7, paddingHorizontal: 10,
        borderRadius: 3, marginTop: 6,
    },
    grandTotalLabel: { fontSize: 10, fontFamily: 'Helvetica-Bold', color: '#fff' },
    grandTotalValeur: { fontSize: 12, fontFamily: 'Helvetica-Bold', color: '#fff' },

    enLettres: {
        marginTop: 18, paddingVertical: 8, paddingHorizontal: 10,
        backgroundColor: couleurs.fondClair, borderLeftWidth: 3, borderLeftColor: couleurs.primaire, borderRadius: 2,
    },
    enLettresLabel: { fontSize: 7.5, fontFamily: 'Helvetica-Bold', color: couleurs.texteFaible, marginBottom: 2 },
    enLettresTexte: { fontSize: 9, fontFamily: 'Helvetica-Bold', color: couleurs.texte },

    note: { marginTop: 14 },
    noteTexte: { fontSize: 8, color: couleurs.texte },

    signatureBlock: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 28, gap: 24 },
    signatureBox: { flex: 1, borderWidth: 1, borderColor: couleurs.bordure, borderRadius: 3, height: 70, padding: 6 },
    signatureLabel: { fontSize: 7.5, fontFamily: 'Helvetica-Bold', color: couleurs.texteFaible },

    pied: {
        position: 'absolute', bottom: 26, left: 40, right: 40, textAlign: 'center',
        fontSize: 7, color: couleurs.texteFaible, borderTopWidth: 1, borderTopColor: couleurs.bordure, paddingTop: 6,
    },
})

interface LigneDevis {
    designation: string; quantite: number; prix_unitaire: number
    remise_pct: number; tva_pct: number; montant_ttc: number
}
export interface DonneesDevisPDF {
    boutique: {
        nom: string; adresse?: string | null; ville?: string | null; telephone_1: string
        email?: string | null; ifu?: string | null; rccm?: string | null
        message_pied_facture?: string | null; devise: string; logo_url?: string | null
    }
    client?: {
        nom: string; adresse?: string | null; telephone?: string | null; email?: string | null
        ifu?: string | null; rccm?: string | null; ville?: string | null; pays?: string | null
    } | null
    devis: {
        public_id: string; date_devis: string; date_validite?: string | null
        objet?: string | null; note_client?: string | null
        montant_ht: number; remise_val: number; remise_pct: number
        montant_tva: number; montant_ttc: number
    }
    lignes: LigneDevis[]
    genere_le: string
}

function capitaliser(s: string) { return s.charAt(0).toUpperCase() + s.slice(1) }

export function DevisPDF({ donnees }: { donnees: DonneesDevisPDF }) {
    const { boutique, client, devis, lignes } = donnees
    const d = boutique.devise
    const fmt = (n: number) => formatMontantPDF(n, d)
    const enLettres = capitaliser(nombreEnLettresPDF(devis.montant_ttc)) + ' ' + deviseEnLettresPDF(d)

    return (
        <Document>
            <Page size="A4" style={styles.page}>

                {/* EN-TÊTE */}
                <View style={styles.entete}>
                    <View style={{ maxWidth: 280 }}>
                        {boutique.logo_url
                            ? <Image src={boutique.logo_url} style={styles.logo} />
                            : <Text style={styles.nomBoutique}>{boutique.nom}</Text>}
                        {boutique.logo_url && (
                            <Text style={[styles.infoBoutique, { fontFamily: 'Helvetica-Bold', color: couleurs.texte, fontSize: 9.5 }]}>
                                {boutique.nom}
                            </Text>
                        )}
                        {boutique.adresse && (
                            <Text style={styles.infoBoutique}>
                                {boutique.adresse}{boutique.ville ? `, ${boutique.ville}` : ''}
                            </Text>
                        )}
                        <Text style={styles.infoBoutique}>Tél : {boutique.telephone_1}</Text>
                        {boutique.email && <Text style={styles.infoBoutique}>{boutique.email}</Text>}
                        {boutique.ifu && <Text style={styles.infoBoutique}>IFU : {boutique.ifu}</Text>}
                        {boutique.rccm && <Text style={styles.infoBoutique}>RCCM : {boutique.rccm}</Text>}
                    </View>
                    <View style={styles.enteteDroite}>
                        <Text style={styles.titreDoc}>PROFORMA</Text>
                        <Text style={styles.refDoc}>{devis.public_id}</Text>
                    </View>
                </View>

                <View style={styles.regle} />

                {/* ADRESSÉ À + MÉTA */}
                <View style={styles.blocRow}>
                    <View style={styles.adresseA}>
                        <Text style={styles.blocLabel}>Adressé à</Text>
                        {client ? (
                            <>
                                <Text style={styles.clientNom}>{client.nom}</Text>
                                {client.adresse
                                    ? <Text style={styles.clientInfo}>{client.adresse}</Text>
                                    : (client.ville || client.pays) && (
                                        <Text style={styles.clientInfo}>
                                            {[client.ville, client.pays].filter(Boolean).join(', ')}
                                        </Text>
                                    )}
                                {client.telephone && <Text style={styles.clientInfo}>Tél : {client.telephone}</Text>}
                                {client.email && <Text style={styles.clientInfo}>{client.email}</Text>}
                                {client.ifu && <Text style={styles.clientInfo}>IFU : {client.ifu}</Text>}
                            </>
                        ) : (
                            <Text style={styles.clientInfo}>Client non spécifié</Text>
                        )}
                    </View>
                    <View style={styles.metaBox}>
                        <View style={styles.metaLigne}>
                            <Text style={styles.metaLabel}>Date</Text>
                            <Text style={styles.metaValeur}>{formatDatePDF(devis.date_devis)}</Text>
                        </View>
                        {devis.date_validite && (
                            <View style={[styles.metaLigne, styles.metaLigneAlt]}>
                                <Text style={styles.metaLabel}>Valable jusqu'au</Text>
                                <Text style={styles.metaValeur}>{formatDatePDF(devis.date_validite)}</Text>
                            </View>
                        )}
                        <View style={[styles.metaLigne, devis.date_validite ? {} : styles.metaLigneAlt]}>
                            <Text style={styles.metaLabel}>Référence</Text>
                            <Text style={styles.metaValeur}>{devis.public_id}</Text>
                        </View>
                    </View>
                </View>

                {devis.date_validite && (
                    <View style={styles.validiteBlock}>
                        <Text style={styles.validiteTexte}>
                            Devis commercial valable jusqu'au {formatDatePDF(devis.date_validite)}. Passé ce délai, les prix peuvent être révisés.
                        </Text>
                    </View>
                )}

                {devis.objet && (
                    <Text style={styles.objet}>
                        <Text style={{ fontFamily: 'Helvetica-Bold' }}>Objet : </Text>{devis.objet}
                    </Text>
                )}

                {/* TABLEAU */}
                <View style={styles.thead}>
                    <Text style={[styles.th, { width: '44%' }]}>Désignation</Text>
                    <Text style={[styles.th, { width: '9%', textAlign: 'center' }]}>Qté</Text>
                    <Text style={[styles.th, { width: '17%', textAlign: 'right' }]}>P.U. HT</Text>
                    <Text style={[styles.th, { width: '9%', textAlign: 'center' }]}>Rem.</Text>
                    <Text style={[styles.th, { width: '7%', textAlign: 'center' }]}>TVA</Text>
                    <Text style={[styles.th, { width: '14%', textAlign: 'right' }]}>Total TTC</Text>
                </View>
                {lignes.map((l, i) => (
                    <View key={i} style={[styles.tr, i % 2 !== 0 ? styles.trAlt : {}]}>
                        <Text style={[styles.td, { width: '44%' }]}>{l.designation}</Text>
                        <Text style={[styles.td, { width: '9%', textAlign: 'center' }]}>{l.quantite}</Text>
                        <Text style={[styles.td, { width: '17%', textAlign: 'right' }]}>{fmt(l.prix_unitaire)}</Text>
                        <Text style={[styles.td, { width: '9%', textAlign: 'center' }]}>{l.remise_pct > 0 ? `${l.remise_pct}%` : '—'}</Text>
                        <Text style={[styles.td, { width: '7%', textAlign: 'center' }]}>{l.tva_pct > 0 ? `${l.tva_pct}%` : '—'}</Text>
                        <Text style={[styles.td, { width: '14%', textAlign: 'right', fontFamily: 'Helvetica-Bold' }]}>{fmt(l.montant_ttc)}</Text>
                    </View>
                ))}

                {/* TOTAUX */}
                <View style={styles.totauxRow}>
                    <View style={styles.totaux}>
                        <View style={styles.totLigne}>
                            <Text style={styles.totLabel}>Sous-total HT</Text>
                            <Text style={styles.totValeur}>{fmt(devis.montant_ht + devis.remise_val)}</Text>
                        </View>
                        {devis.remise_val > 0 && (
                            <View style={styles.totLigne}>
                                <Text style={[styles.totLabel, { color: couleurs.vert }]}>Remise ({devis.remise_pct}%)</Text>
                                <Text style={[styles.totValeur, { color: couleurs.vert }]}>-{fmt(devis.remise_val)}</Text>
                            </View>
                        )}
                        {devis.montant_tva > 0 && (
                            <View style={styles.totLigne}>
                                <Text style={styles.totLabel}>TVA</Text>
                                <Text style={styles.totValeur}>{fmt(devis.montant_tva)}</Text>
                            </View>
                        )}
                        <View style={styles.grandTotal}>
                            <Text style={styles.grandTotalLabel}>TOTAL TTC</Text>
                            <Text style={styles.grandTotalValeur}>{fmt(devis.montant_ttc)}</Text>
                        </View>
                    </View>
                </View>

                {/* MONTANT EN LETTRES */}
                <View style={styles.enLettres}>
                    <Text style={styles.enLettresLabel}>ARRÊTÉ LE PRÉSENT DEVIS À LA SOMME DE</Text>
                    <Text style={styles.enLettresTexte}>{enLettres}.</Text>
                </View>

                {/* CONDITIONS */}
                {(devis.note_client || boutique.message_pied_facture) && (
                    <View style={styles.note}>
                        <Text style={styles.blocLabel}>Conditions</Text>
                        <Text style={styles.noteTexte}>
                            {devis.note_client || boutique.message_pied_facture}
                        </Text>
                    </View>
                )}

                {/* SIGNATURES */}
                <View style={styles.signatureBlock}>
                    <View style={styles.signatureBox}>
                        <Text style={styles.signatureLabel}>Cachet et signature — Émetteur</Text>
                    </View>
                    <View style={styles.signatureBox}>
                        <Text style={styles.signatureLabel}>Bon pour accord — Client</Text>
                    </View>
                </View>

                {/* PIED */}
                <Text style={styles.pied} fixed>
                    {boutique.nom}
                    {boutique.ifu ? ` · IFU ${boutique.ifu}` : ''}
                    {boutique.rccm ? ` · RCCM ${boutique.rccm}` : ''}
                    {'  —  '}{devis.public_id} · Généré le {donnees.genere_le}
                </Text>

            </Page>
        </Document>
    )
}
