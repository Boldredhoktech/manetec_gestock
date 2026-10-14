import React from 'react'
import { Document, Page, Text, View, Image, StyleSheet, Font } from '@react-pdf/renderer'
import { couleurs } from '@/lib/pdf/styles'
import {
    formatMontantPDF, nombreEnLettresPDF, deviseEnLettresPDF,
} from '@/lib/pdf/utils-pdf'

// ══════════════════════════════════════════════════════════════
// Gabarit des pièces commerciales (facture, proforma)
// --------------------------------------------------------------
// Le gabarit de RAPPORT (lib/pdf/template.tsx) ne couvre pas ce qu'une
// pièce commerciale doit porter : vendeur identifié (IFU, RCCM), badge
// d'état, bloc « Facturé à », totaux HT / remise / TVA / TTC, montant en
// toutes lettres, cachet. Facture et proforma recopiaient chacune ces
// 280 lignes. Ici, une pièce se déclare ; la mise en page vit à un seul
// endroit (FAC-21).
// ══════════════════════════════════════════════════════════════

Font.registerHyphenationCallback(mot => [mot])

const s = StyleSheet.create({
    page: {
        fontFamily: 'Helvetica', fontSize: 9, color: couleurs.texte,
        paddingTop: 36, paddingBottom: 60, paddingHorizontal: 40, backgroundColor: '#fff',
    },

    entete: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' },
    logo: { width: 110, height: 56, objectFit: 'contain', marginBottom: 6 },
    nomVendeur: { fontSize: 17, fontFamily: 'Helvetica-Bold', color: couleurs.primaire, marginBottom: 4 },
    infoVendeur: { fontSize: 8, color: couleurs.texteFaible, marginBottom: 1.5 },
    enteteDroite: { alignItems: 'flex-end', maxWidth: 230 },
    titre: { fontSize: 26, fontFamily: 'Helvetica-Bold', color: couleurs.primaire, letterSpacing: 1 },
    reference: { fontSize: 11, fontFamily: 'Helvetica-Bold', color: couleurs.texte, marginTop: 2 },
    badge: {
        marginTop: 8, paddingHorizontal: 10, paddingVertical: 4,
        borderRadius: 3, fontSize: 8, fontFamily: 'Helvetica-Bold',
    },
    regle: { height: 2, backgroundColor: couleurs.primaire, marginTop: 14, marginBottom: 16 },

    blocRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 16, gap: 16 },
    destinataire: { flex: 1 },
    blocLabel: {
        fontSize: 7.5, fontFamily: 'Helvetica-Bold', color: couleurs.accent,
        textTransform: 'uppercase', letterSpacing: 0.8, marginBottom: 5,
    },
    clientNom: { fontSize: 11, fontFamily: 'Helvetica-Bold', color: couleurs.texte, marginBottom: 2 },
    clientInfo: { fontSize: 8.5, color: couleurs.texteFaible, marginBottom: 1.5 },

    infos: { width: 215, borderWidth: 1, borderColor: couleurs.bordure, borderRadius: 3 },
    infoLigne: { flexDirection: 'row', justifyContent: 'space-between', paddingHorizontal: 10, paddingVertical: 5 },
    infoAlt: { backgroundColor: couleurs.fondClair },
    infoLabel: { fontSize: 8.5, color: couleurs.texteFaible },
    infoValeur: { fontSize: 8.5, fontFamily: 'Helvetica-Bold', color: couleurs.texte },

    objet: { fontSize: 9, marginBottom: 12 },
    encart: {
        backgroundColor: '#fff8e1', borderLeftWidth: 3, borderLeftColor: couleurs.accent,
        paddingVertical: 7, paddingHorizontal: 10, borderRadius: 2, marginBottom: 14,
    },
    encartTexte: { fontSize: 8, color: '#92400e' },

    thead: { flexDirection: 'row', backgroundColor: couleurs.primaire, paddingVertical: 7, paddingHorizontal: 8 },
    th: { fontFamily: 'Helvetica-Bold', fontSize: 8, color: '#fff' },
    tr: { flexDirection: 'row', paddingVertical: 6, paddingHorizontal: 8, borderBottomWidth: 1, borderBottomColor: couleurs.bordure },
    trAlt: { backgroundColor: couleurs.fondClair },
    td: { fontSize: 8.5, color: couleurs.texte },
    col: { flexGrow: 0, flexShrink: 0, paddingRight: 4 },

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
    reste: {
        flexDirection: 'row', justifyContent: 'space-between',
        marginTop: 6, paddingVertical: 5, paddingHorizontal: 10,
        borderWidth: 1, borderColor: couleurs.accent, borderRadius: 3,
    },
    resteTexte: { fontSize: 9, fontFamily: 'Helvetica-Bold', color: couleurs.accent },

    enLettres: {
        marginTop: 18, paddingVertical: 8, paddingHorizontal: 10,
        backgroundColor: couleurs.fondClair, borderLeftWidth: 3, borderLeftColor: couleurs.primaire, borderRadius: 2,
    },
    enLettresLabel: { fontSize: 7.5, fontFamily: 'Helvetica-Bold', color: couleurs.texteFaible, marginBottom: 2 },
    enLettresTexte: { fontSize: 9, fontFamily: 'Helvetica-Bold', color: couleurs.texte },

    basRow: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 18, gap: 20 },
    blocs: { flex: 1, gap: 10 },
    blocTexte: { fontSize: 8, color: couleurs.texte, lineHeight: 1.4 },
    signatures: { flexDirection: 'row', gap: 12 },
    signature: { width: 160, height: 72, borderWidth: 1, borderColor: couleurs.bordure, borderRadius: 3, padding: 6 },
    signatureLabel: { fontSize: 7.5, fontFamily: 'Helvetica-Bold', color: couleurs.texteFaible },

    pied: {
        position: 'absolute', bottom: 26, left: 40, right: 40,
        textAlign: 'center', fontSize: 7, color: couleurs.texteFaible,
        borderTopWidth: 1, borderTopColor: couleurs.bordure, paddingTop: 6,
    },
})

// ── Données d'une pièce ───────────────────────────────────────
export interface Vendeur {
    nom: string; adresse?: string | null; ville?: string | null
    telephone_1: string; email?: string | null
    ifu?: string | null; rccm?: string | null; devise: string
    logo_url?: string | null
}

export interface ClientPiece {
    nom: string; adresse?: string | null; ville?: string | null; pays?: string | null
    telephone?: string | null; email?: string | null; ifu?: string | null; rccm?: string | null
}

export interface LigneCommerciale {
    designation: string; quantite: number; prix_unitaire: number
    remise_pct: number; tva_pct: number; montant_ttc: number
}

export interface TotauxPiece {
    /** Après remise globale (colonne montant_ht de la pièce). */
    montant_ht:  number
    remise_pct:  number
    remise_val:  number
    montant_tva: number
    montant_ttc: number
    /** Facture seulement. */
    montant_paye?:    number
    montant_restant?: number
}

export type TonBadge = 'neutre' | 'attente' | 'succes' | 'alerte' | 'inactif'

const TONS: Record<TonBadge, { bg: string; color: string }> = {
    neutre:  { bg: '#dbeafe', color: '#1d4ed8' },
    attente: { bg: '#fef3c7', color: '#92400e' },
    succes:  { bg: '#dcfce7', color: '#166534' },
    alerte:  { bg: '#fee2e2', color: '#b91c1c' },
    inactif: { bg: '#f3f4f6', color: '#6b7280' },
}

const capitaliser = (t: string) => t.charAt(0).toUpperCase() + t.slice(1)

export function DocumentCommercial({
    vendeur, titre, reference, badge, labelDestinataire, client, sansClient,
    infos, objet, encart, lignes, totaux, libelleEnLettres, blocs, signatures, pied,
}: {
    vendeur:           Vendeur
    titre:             string
    reference:         string
    badge?:            { libelle: string; ton: TonBadge }
    labelDestinataire: string
    client:            ClientPiece | null | undefined
    sansClient:        string
    /** Cadre à droite du destinataire (dates, référence…). Les dates sont des AAAA-MM-JJ. */
    infos:             { label: string; valeur: string }[]
    objet?:            string | null
    encart?:           string | null
    lignes:            LigneCommerciale[]
    totaux:            TotauxPiece
    /** « ARRÊTÉE LA PRÉSENTE FACTURE À LA SOMME DE » */
    libelleEnLettres:  string
    blocs:             { titre: string; texte: string }[]
    signatures:        string[]
    pied:              string
}) {
    const fmt = (n: number) => formatMontantPDF(n, vendeur.devise)

    // Une boutique non assujettie n'affiche ni colonne TVA ni mention TTC :
    // « TOTAL TTC » avec 0 de TVA laissait croire à une taxe facturée.
    const avecTva = totaux.montant_tva > 0 || lignes.some(l => l.tva_pct > 0)
    const avecRemiseLigne = lignes.some(l => l.remise_pct > 0)

    const colonnes = [
        { entete: 'Désignation', largeur: 0, align: 'left' as const,
          rendu: (l: LigneCommerciale) => l.designation, gras: false },
        { entete: 'Qté', largeur: 9, align: 'center' as const,
          rendu: (l: LigneCommerciale) => String(l.quantite), gras: false },
        { entete: avecTva ? 'P.U. HT' : 'Prix unitaire', largeur: 17, align: 'right' as const,
          rendu: (l: LigneCommerciale) => fmt(l.prix_unitaire), gras: false },
        ...(avecRemiseLigne ? [{ entete: 'Rem.', largeur: 9, align: 'center' as const,
          rendu: (l: LigneCommerciale) => (l.remise_pct > 0 ? `${l.remise_pct}%` : '—'), gras: false }] : []),
        ...(avecTva ? [{ entete: 'TVA', largeur: 8, align: 'center' as const,
          rendu: (l: LigneCommerciale) => (l.tva_pct > 0 ? `${l.tva_pct}%` : '—'), gras: false }] : []),
        { entete: avecTva ? 'Total TTC' : 'Total', largeur: 17, align: 'right' as const,
          rendu: (l: LigneCommerciale) => fmt(l.montant_ttc), gras: true },
    ]
    // La désignation prend ce que les autres colonnes laissent.
    colonnes[0].largeur = 100 - colonnes.slice(1).reduce((a, c) => a + c.largeur, 0)

    const enLettres = `${capitaliser(nombreEnLettresPDF(totaux.montant_ttc))} ${deviseEnLettresPDF(vendeur.devise)}`
    const ton = badge ? TONS[badge.ton] : null

    return (
        <Document>
            <Page size="A4" style={s.page}>

                {/* En-tête : le vendeur à gauche, la pièce à droite */}
                <View style={s.entete}>
                    <View style={{ maxWidth: 280 }}>
                        {vendeur.logo_url
                            ? <Image src={vendeur.logo_url} style={s.logo} />
                            : <Text style={s.nomVendeur}>{vendeur.nom}</Text>}
                        {vendeur.logo_url && (
                            <Text style={[s.infoVendeur, { fontFamily: 'Helvetica-Bold', color: couleurs.texte, fontSize: 9.5 }]}>
                                {vendeur.nom}
                            </Text>
                        )}
                        {vendeur.adresse && (
                            <Text style={s.infoVendeur}>{vendeur.adresse}{vendeur.ville ? `, ${vendeur.ville}` : ''}</Text>
                        )}
                        <Text style={s.infoVendeur}>Tél : {vendeur.telephone_1}</Text>
                        {vendeur.email && <Text style={s.infoVendeur}>{vendeur.email}</Text>}
                        {vendeur.ifu && <Text style={s.infoVendeur}>IFU : {vendeur.ifu}</Text>}
                        {vendeur.rccm && <Text style={s.infoVendeur}>RCCM : {vendeur.rccm}</Text>}
                    </View>
                    <View style={s.enteteDroite}>
                        <Text style={s.titre}>{titre}</Text>
                        <Text style={s.reference}>{reference}</Text>
                        {badge && ton && (
                            <Text style={[s.badge, { backgroundColor: ton.bg, color: ton.color }]}>
                                {badge.libelle.toUpperCase()}
                            </Text>
                        )}
                    </View>
                </View>

                <View style={s.regle} />

                {/* Destinataire + informations */}
                <View style={s.blocRow}>
                    <View style={s.destinataire}>
                        <Text style={s.blocLabel}>{labelDestinataire}</Text>
                        {client ? (
                            <>
                                <Text style={s.clientNom}>{client.nom}</Text>
                                {client.adresse
                                    ? <Text style={s.clientInfo}>{client.adresse}</Text>
                                    : (client.ville || client.pays) && (
                                        <Text style={s.clientInfo}>{[client.ville, client.pays].filter(Boolean).join(', ')}</Text>
                                    )}
                                {client.telephone && <Text style={s.clientInfo}>Tél : {client.telephone}</Text>}
                                {client.email && <Text style={s.clientInfo}>{client.email}</Text>}
                                {client.ifu && <Text style={s.clientInfo}>IFU : {client.ifu}</Text>}
                                {client.rccm && <Text style={s.clientInfo}>RCCM : {client.rccm}</Text>}
                            </>
                        ) : (
                            <Text style={s.clientInfo}>{sansClient}</Text>
                        )}
                    </View>
                    <View style={s.infos}>
                        {infos.map((info, i) => (
                            <View key={i} style={[s.infoLigne, i % 2 !== 0 ? s.infoAlt : {}]}>
                                <Text style={s.infoLabel}>{info.label}</Text>
                                <Text style={s.infoValeur}>{info.valeur}</Text>
                            </View>
                        ))}
                    </View>
                </View>

                {objet && (
                    <Text style={s.objet}>
                        <Text style={{ fontFamily: 'Helvetica-Bold' }}>Objet : </Text>{objet}
                    </Text>
                )}

                {encart && (
                    <View style={s.encart}><Text style={s.encartTexte}>{encart}</Text></View>
                )}

                {/* Lignes */}
                <View style={s.thead}>
                    {colonnes.map((c, i) => (
                        <View key={i} style={[s.col, { width: `${c.largeur}%` }]}>
                            <Text style={[s.th, { textAlign: c.align }]}>{c.entete}</Text>
                        </View>
                    ))}
                </View>
                {lignes.map((l, i) => (
                    <View key={i} style={[s.tr, i % 2 !== 0 ? s.trAlt : {}]} wrap={false}>
                        {colonnes.map((c, j) => (
                            <View key={j} style={[s.col, { width: `${c.largeur}%` }]}>
                                <Text style={[s.td, { textAlign: c.align }, c.gras ? { fontFamily: 'Helvetica-Bold' } : {}]}>
                                    {c.rendu(l)}
                                </Text>
                            </View>
                        ))}
                    </View>
                ))}

                {/* Totaux, montant en lettres, conditions et cachet : un bloc
                    qui ne se coupe pas entre deux pages. */}
                <View wrap={false}>
                    <View style={s.totauxRow}>
                        <View style={s.totaux}>
                            <View style={s.totLigne}>
                                <Text style={s.totLabel}>{avecTva ? 'Sous-total HT' : 'Sous-total'}</Text>
                                <Text style={s.totValeur}>{fmt(totaux.montant_ht + totaux.remise_val)}</Text>
                            </View>
                            {totaux.remise_val > 0 && (
                                <View style={s.totLigne}>
                                    <Text style={[s.totLabel, { color: couleurs.vert }]}>Remise ({totaux.remise_pct}%)</Text>
                                    <Text style={[s.totValeur, { color: couleurs.vert }]}>-{fmt(totaux.remise_val)}</Text>
                                </View>
                            )}
                            {avecTva && (
                                <View style={s.totLigne}>
                                    <Text style={s.totLabel}>TVA</Text>
                                    <Text style={s.totValeur}>{fmt(totaux.montant_tva)}</Text>
                                </View>
                            )}
                            <View style={s.grandTotal}>
                                <Text style={s.grandTotalLabel}>{avecTva ? 'TOTAL TTC' : 'TOTAL'}</Text>
                                <Text style={s.grandTotalValeur}>{fmt(totaux.montant_ttc)}</Text>
                            </View>
                            {(totaux.montant_paye ?? 0) > 0 && (
                                <View style={s.totLigne}>
                                    <Text style={[s.totLabel, { color: couleurs.vert }]}>Déjà réglé</Text>
                                    <Text style={[s.totValeur, { color: couleurs.vert }]}>{fmt(totaux.montant_paye!)}</Text>
                                </View>
                            )}
                            {(totaux.montant_restant ?? 0) > 0 && (
                                <View style={s.reste}>
                                    <Text style={s.resteTexte}>RESTE À PAYER</Text>
                                    <Text style={s.resteTexte}>{fmt(totaux.montant_restant!)}</Text>
                                </View>
                            )}
                        </View>
                    </View>

                    <View style={s.enLettres}>
                        <Text style={s.enLettresLabel}>{libelleEnLettres}</Text>
                        <Text style={s.enLettresTexte}>{enLettres}.</Text>
                    </View>

                    <View style={s.basRow}>
                        <View style={s.blocs}>
                            {blocs.map((b, i) => (
                                <View key={i}>
                                    <Text style={s.blocLabel}>{b.titre}</Text>
                                    <Text style={s.blocTexte}>{b.texte}</Text>
                                </View>
                            ))}
                        </View>
                        <View style={s.signatures}>
                            {signatures.map((sig, i) => (
                                <View key={i} style={s.signature}>
                                    <Text style={s.signatureLabel}>{sig}</Text>
                                </View>
                            ))}
                        </View>
                    </View>
                </View>

                <Text style={s.pied} fixed render={({ pageNumber, totalPages }) =>
                    [pied, totalPages > 1 ? `Page ${pageNumber} / ${totalPages}` : null].filter(Boolean).join('  ·  ')
                } />
            </Page>
        </Document>
    )
}

