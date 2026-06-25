import React from 'react'
import { Document, Page, Text, View, Image, StyleSheet } from '@react-pdf/renderer'
import { couleurs } from '@/lib/pdf/styles'
import {
    formatMontantPDF, formatDatePDF, nombreEnLettresPDF, deviseEnLettresPDF,
} from '@/lib/pdf/utils-pdf'

const styles = StyleSheet.create({
    page: {
        fontFamily: 'Helvetica',
        fontSize: 9,
        color: couleurs.texte,
        paddingTop: 36,
        paddingBottom: 64,
        paddingHorizontal: 40,
        backgroundColor: '#fff',
    },

    /* En-tête */
    entete: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' },
    logo: { width: 110, height: 56, objectFit: 'contain', marginBottom: 6 },
    nomBoutique: { fontSize: 17, fontFamily: 'Helvetica-Bold', color: couleurs.primaire, marginBottom: 4 },
    infoBoutique: { fontSize: 8, color: couleurs.texteFaible, marginBottom: 1.5 },
    enteteDroite: { alignItems: 'flex-end', maxWidth: 220 },
    titreFact: { fontSize: 26, fontFamily: 'Helvetica-Bold', color: couleurs.primaire, letterSpacing: 1 },
    refFact: { fontSize: 11, fontFamily: 'Helvetica-Bold', color: couleurs.texte, marginTop: 2 },
    statutBadge: {
        marginTop: 8, paddingHorizontal: 10, paddingVertical: 4,
        borderRadius: 3, fontSize: 8, fontFamily: 'Helvetica-Bold',
    },

    regle: { height: 2, backgroundColor: couleurs.primaire, marginTop: 14, marginBottom: 16 },

    /* Client + méta */
    blocRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 18, gap: 16 },
    factureA: { flex: 1 },
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

    objet: { fontSize: 9, marginBottom: 12 },

    /* Tableau */
    thead: { flexDirection: 'row', backgroundColor: couleurs.primaire, paddingVertical: 7, paddingHorizontal: 8 },
    th: { fontFamily: 'Helvetica-Bold', fontSize: 8, color: '#fff' },
    tr: { flexDirection: 'row', paddingVertical: 6, paddingHorizontal: 8, borderBottomWidth: 1, borderBottomColor: couleurs.bordure },
    trAlt: { backgroundColor: couleurs.fondClair },
    td: { fontSize: 8.5, color: couleurs.texte },

    /* Totaux */
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
    resteLigne: {
        flexDirection: 'row', justifyContent: 'space-between',
        marginTop: 6, paddingVertical: 5, paddingHorizontal: 10,
        borderWidth: 1, borderColor: couleurs.accent, borderRadius: 3,
    },
    resteLabel: { fontSize: 9, fontFamily: 'Helvetica-Bold', color: couleurs.accent },
    resteValeur: { fontSize: 9, fontFamily: 'Helvetica-Bold', color: couleurs.accent },

    /* Montant en lettres */
    enLettres: {
        marginTop: 18, paddingVertical: 8, paddingHorizontal: 10,
        backgroundColor: couleurs.fondClair, borderLeftWidth: 3, borderLeftColor: couleurs.primaire,
        borderRadius: 2,
    },
    enLettresLabel: { fontSize: 7.5, fontFamily: 'Helvetica-Bold', color: couleurs.texteFaible, marginBottom: 2 },
    enLettresTexte: { fontSize: 9, fontFamily: 'Helvetica-Bold', color: couleurs.texte },

    /* Bas de page : modalités + signature */
    basRow: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 18, gap: 20 },
    modalites: { flex: 1 },
    modalitesTexte: { fontSize: 8, color: couleurs.texteFaible, lineHeight: 1.4 },
    signatureBox: {
        width: 170, height: 70, borderWidth: 1, borderColor: couleurs.bordure,
        borderRadius: 3, padding: 6,
    },
    signatureLabel: { fontSize: 7.5, fontFamily: 'Helvetica-Bold', color: couleurs.texteFaible },

    note: { marginTop: 14 },
    noteTexte: { fontSize: 8, color: couleurs.texte },

    /* Pied de page fixe */
    pied: {
        position: 'absolute', bottom: 26, left: 40, right: 40,
        textAlign: 'center', fontSize: 7, color: couleurs.texteFaible,
        borderTopWidth: 1, borderTopColor: couleurs.bordure, paddingTop: 6,
    },
})

interface LigneFacturePDF {
    designation: string; quantite: number; prix_unitaire: number
    remise_pct: number; tva_pct: number; montant_ttc: number
}
interface DonneesFacturePDF {
    boutique: {
        nom: string; adresse?: string | null; ville?: string | null
        telephone_1: string; email?: string | null
        ifu?: string | null; rccm?: string | null; devise: string
        message_pied_facture?: string | null; logo_url?: string | null
    }
    facture: {
        public_id: string; date_facture: string; date_echeance?: string | null
        statut: string; objet?: string | null; note_client?: string | null
        montant_ht: number; remise_val: number; remise_pct: number
        montant_tva: number; montant_ttc: number
        montant_paye: number; montant_restant: number
    }
    client?: {
        nom: string; adresse?: string | null; ville?: string | null; pays?: string | null
        telephone?: string | null; email?: string | null; ifu?: string | null; rccm?: string | null
    } | null
    lignes: LigneFacturePDF[]
    genere_le: string
}

const STATUT_LABELS: Record<string, { label: string; bg: string; color: string }> = {
    emise:               { label: 'ÉMISE',               bg: '#dbeafe', color: '#1d4ed8' },
    partiellement_payee: { label: 'PARTIELLEMENT PAYÉE', bg: '#fef3c7', color: '#92400e' },
    payee:               { label: 'PAYÉE',               bg: '#dcfce7', color: '#166534' },
    annulee:             { label: 'ANNULÉE',             bg: '#f3f4f6', color: '#6b7280' },
}

function capitaliser(s: string) { return s.charAt(0).toUpperCase() + s.slice(1) }

export function FacturePDF({ donnees }: { donnees: DonneesFacturePDF }) {
    const { boutique, facture, client, lignes } = donnees
    const d = boutique.devise
    const fmt = (n: number) => formatMontantPDF(n, d)
    const statut = STATUT_LABELS[facture.statut] ?? STATUT_LABELS.emise
    const enLettres = capitaliser(nombreEnLettresPDF(facture.montant_ttc)) + ' ' + deviseEnLettresPDF(d)

    return (
        <Document>
            <Page size="A4" style={styles.page}>

                {/* EN-TÊTE : vendeur (gauche) + FACTURE (droite) */}
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
                        <Text style={styles.titreFact}>FACTURE</Text>
                        <Text style={styles.refFact}>{facture.public_id}</Text>
                        <Text style={[styles.statutBadge, { backgroundColor: statut.bg, color: statut.color }]}>
                            {statut.label}
                        </Text>
                    </View>
                </View>

                <View style={styles.regle} />

                {/* FACTURÉ À + MÉTA */}
                <View style={styles.blocRow}>
                    <View style={styles.factureA}>
                        <Text style={styles.blocLabel}>Facturé à</Text>
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
                            <Text style={styles.clientInfo}>Client de passage</Text>
                        )}
                    </View>

                    <View style={styles.metaBox}>
                        <View style={styles.metaLigne}>
                            <Text style={styles.metaLabel}>Date d'émission</Text>
                            <Text style={styles.metaValeur}>{formatDatePDF(facture.date_facture)}</Text>
                        </View>
                        {facture.date_echeance && (
                            <View style={[styles.metaLigne, styles.metaLigneAlt]}>
                                <Text style={styles.metaLabel}>Date d'échéance</Text>
                                <Text style={styles.metaValeur}>{formatDatePDF(facture.date_echeance)}</Text>
                            </View>
                        )}
                        <View style={[styles.metaLigne, facture.date_echeance ? {} : styles.metaLigneAlt]}>
                            <Text style={styles.metaLabel}>Référence</Text>
                            <Text style={styles.metaValeur}>{facture.public_id}</Text>
                        </View>
                    </View>
                </View>

                {/* OBJET */}
                {facture.objet && (
                    <Text style={styles.objet}>
                        <Text style={{ fontFamily: 'Helvetica-Bold' }}>Objet : </Text>{facture.objet}
                    </Text>
                )}

                {/* TABLEAU LIGNES */}
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
                            <Text style={styles.totValeur}>{fmt(facture.montant_ht + facture.remise_val)}</Text>
                        </View>
                        {facture.remise_val > 0 && (
                            <View style={styles.totLigne}>
                                <Text style={[styles.totLabel, { color: couleurs.vert }]}>Remise ({facture.remise_pct}%)</Text>
                                <Text style={[styles.totValeur, { color: couleurs.vert }]}>-{fmt(facture.remise_val)}</Text>
                            </View>
                        )}
                        {facture.montant_tva > 0 && (
                            <View style={styles.totLigne}>
                                <Text style={styles.totLabel}>TVA</Text>
                                <Text style={styles.totValeur}>{fmt(facture.montant_tva)}</Text>
                            </View>
                        )}
                        <View style={styles.grandTotal}>
                            <Text style={styles.grandTotalLabel}>TOTAL TTC</Text>
                            <Text style={styles.grandTotalValeur}>{fmt(facture.montant_ttc)}</Text>
                        </View>
                        {facture.montant_paye > 0 && (
                            <View style={styles.totLigne}>
                                <Text style={[styles.totLabel, { color: couleurs.vert }]}>Déjà payé</Text>
                                <Text style={[styles.totValeur, { color: couleurs.vert }]}>{fmt(facture.montant_paye)}</Text>
                            </View>
                        )}
                        {facture.montant_restant > 0 && (
                            <View style={styles.resteLigne}>
                                <Text style={styles.resteLabel}>RESTE À PAYER</Text>
                                <Text style={styles.resteValeur}>{fmt(facture.montant_restant)}</Text>
                            </View>
                        )}
                    </View>
                </View>

                {/* MONTANT EN LETTRES */}
                <View style={styles.enLettres}>
                    <Text style={styles.enLettresLabel}>ARRÊTÉE LA PRÉSENTE FACTURE À LA SOMME DE</Text>
                    <Text style={styles.enLettresTexte}>{enLettres}.</Text>
                </View>

                {/* MODALITÉS + SIGNATURE */}
                <View style={styles.basRow}>
                    <View style={styles.modalites}>
                        <Text style={styles.blocLabel}>Modalités de paiement</Text>
                        <Text style={styles.modalitesTexte}>
                            {boutique.message_pied_facture
                                ? boutique.message_pied_facture
                                : 'Paiement à réception de la facture.'}
                        </Text>
                        {facture.note_client && (
                            <View style={styles.note}>
                                <Text style={styles.blocLabel}>Note</Text>
                                <Text style={styles.noteTexte}>{facture.note_client}</Text>
                            </View>
                        )}
                    </View>
                    <View style={styles.signatureBox}>
                        <Text style={styles.signatureLabel}>Cachet et signature</Text>
                    </View>
                </View>

                {/* PIED DE PAGE */}
                <Text style={styles.pied} fixed>
                    {boutique.nom}
                    {boutique.ifu ? ` · IFU ${boutique.ifu}` : ''}
                    {boutique.rccm ? ` · RCCM ${boutique.rccm}` : ''}
                    {'  —  '}{facture.public_id} · Généré le {donnees.genere_le}
                </Text>

            </Page>
        </Document>
    )
}
