import React from 'react'
import {
    Document, Page, Text, View, StyleSheet, Image,
} from '@react-pdf/renderer'
import { couleurs } from '@/lib/pdf/styles'

const styles = StyleSheet.create({
    page: {
        width:           226,  // 80mm en points
        fontFamily:      'Helvetica',
        fontSize:        8,
        color:           '#111',
        backgroundColor: '#fff',
        padding:         8,
    },
    centre: { textAlign: 'center' },
    gras:   { fontFamily: 'Helvetica-Bold' },
    ligne:  {
        display:        'flex',
        flexDirection:  'row',
        justifyContent: 'space-between',
        marginBottom:   2,
    },
    ligneArticle: {
        display:       'flex',
        flexDirection: 'column',
        marginBottom:  4,
    },
    separateur: {
        borderBottomWidth: 1,
        borderBottomColor: '#ccc',
        borderBottomStyle: 'dashed',
        marginVertical:    4,
    },
    separateurPlein: {
        borderBottomWidth: 1,
        borderBottomColor: '#111',
        marginVertical:    4,
    },
    totalLigne: {
        display:        'flex',
        flexDirection:  'row',
        justifyContent: 'space-between',
        marginBottom:   2,
        fontSize:       9,
    },
    grandTotal: {
        display:        'flex',
        flexDirection:  'row',
        justifyContent: 'space-between',
        fontFamily:     'Helvetica-Bold',
        fontSize:       11,
        marginVertical: 4,
    },
    footer: {
        textAlign:  'center',
        fontSize:   7,
        color:      '#666',
        marginTop:  6,
    },
})

interface ArticleRecu {
    nom:            string
    quantite:       number
    unite:          string
    prix_unitaire:  number
    remise_pct:     number
    montant_ligne:  number
    imei?:          string
}

interface PaiementRecu {
    moyen_paiement: string
    montant:        number
    reference?:     string
}

interface DonneesRecu {
    boutique: {
        nom:           string
        adresse?:      string | null
        ville?:        string | null
        telephone_1:   string
        telephone_2?:  string | null
        email?:        string | null
        ifu?:          string | null
        rccm?:         string | null
        message_recu?: string | null
        devise:        string
    }
    vente: {
        public_id:        string
        date:             string
        vendeur_nom:      string
        client_nom?:      string | null
        montant_brut:     number
        remise_globale_val: number
        montant_net:      number
        montant_tva:      number
        montant_total:    number
        montant_recu:     number
        montant_rendu:    number
        credit_accorde:   number
        credit_utilise:   number
        advance_utilise:  number
    }
    articles:  ArticleRecu[]
    paiements: PaiementRecu[]
}

const MOYENS_LABELS: Record<string, string> = {
    cash:          'Espèces',
    wave:          'Wave',
    mtn_momo:      'MTN MoMo',
    celtiis_cash:  'Celtiis Cash',
    moov_money:    'Moov Money',
    other_mobile:  'Mobile Money',
    bank_card:     'Carte bancaire',
    bank_transfer: 'Virement',
}

function fmt(montant: number, devise: string): string {
    return new Intl.NumberFormat('fr-FR', {
        minimumFractionDigits: 0,
        maximumFractionDigits: 0,
    }).format(montant) + ' ' + devise
}

export function RecuThermiquePDF({ donnees }: { donnees: DonneesRecu }) {
    const { boutique, vente, articles, paiements } = donnees
    const devise = boutique.devise

    return (
        <Document>
            <Page size={[226, 600]} style={styles.page}>

                {/* ── EN-TÊTE BOUTIQUE ── */}
                <View style={{ marginBottom: 6, alignItems: 'center' }}>
                    <Text style={[styles.gras, { fontSize: 12, marginBottom: 2 }]}>
                        {boutique.nom}
                    </Text>
                    {boutique.adresse && (
                        <Text style={[styles.centre, { fontSize: 7, color: '#555' }]}>
                            {boutique.adresse}
                            {boutique.ville ? `, ${boutique.ville}` : ''}
                        </Text>
                    )}
                    <Text style={[styles.centre, { fontSize: 7, color: '#555' }]}>
                        Tél : {boutique.telephone_1}
                        {boutique.telephone_2 ? ` / ${boutique.telephone_2}` : ''}
                    </Text>
                    {boutique.email && (
                        <Text style={[styles.centre, { fontSize: 7, color: '#555' }]}>
                            {boutique.email}
                        </Text>
                    )}
                    {boutique.ifu && (
                        <Text style={[styles.centre, { fontSize: 7, color: '#555' }]}>
                            IFU : {boutique.ifu}
                        </Text>
                    )}
                    {boutique.rccm && (
                        <Text style={[styles.centre, { fontSize: 7, color: '#555' }]}>
                            RCCM : {boutique.rccm}
                        </Text>
                    )}
                </View>

                <View style={styles.separateurPlein} />

                {/* ── INFO VENTE ── */}
                <View style={{ marginBottom: 4 }}>
                    <View style={styles.ligne}>
                        <Text style={[styles.gras, { fontSize: 7 }]}>N° :</Text>
                        <Text style={{ fontSize: 7 }}>{vente.public_id}</Text>
                    </View>
                    <View style={styles.ligne}>
                        <Text style={[styles.gras, { fontSize: 7 }]}>Date :</Text>
                        <Text style={{ fontSize: 7 }}>{vente.date}</Text>
                    </View>
                    <View style={styles.ligne}>
                        <Text style={[styles.gras, { fontSize: 7 }]}>Vendeur :</Text>
                        <Text style={{ fontSize: 7 }}>{vente.vendeur_nom}</Text>
                    </View>
                    {vente.client_nom && (
                        <View style={styles.ligne}>
                            <Text style={[styles.gras, { fontSize: 7 }]}>Client :</Text>
                            <Text style={{ fontSize: 7 }}>{vente.client_nom}</Text>
                        </View>
                    )}
                </View>

                <View style={styles.separateur} />

                {/* ── ARTICLES ── */}
                {articles.map((art, i) => (
                    <View key={i} style={styles.ligneArticle}>
                        <Text style={[styles.gras, { fontSize: 8 }]} numberOfLines={2}>
                            {art.nom}
                        </Text>
                        <View style={styles.ligne}>
                            <Text style={{ fontSize: 7, color: '#555' }}>
                                {art.quantite} {art.unite} × {fmt(art.prix_unitaire, devise)}
                                {art.remise_pct > 0 ? ` (-${art.remise_pct}%)` : ''}
                            </Text>
                            <Text style={[styles.gras, { fontSize: 8 }]}>
                                {fmt(art.montant_ligne, devise)}
                            </Text>
                        </View>
                        {art.imei && (
                            <Text style={{ fontSize: 6, color: '#888' }}>IMEI : {art.imei}</Text>
                        )}
                    </View>
                ))}

                <View style={styles.separateurPlein} />

                {/* ── TOTAUX ── */}
                {vente.montant_brut !== vente.montant_net && (
                    <>
                        <View style={styles.totalLigne}>
                            <Text>Sous-total</Text>
                            <Text>{fmt(vente.montant_brut, devise)}</Text>
                        </View>
                        <View style={styles.totalLigne}>
                            <Text style={{ color: couleurs.vert }}>Remises</Text>
                            <Text style={{ color: couleurs.vert }}>
                                -{fmt(vente.remise_globale_val + (vente.montant_brut - vente.montant_net - vente.remise_globale_val), devise)}
                            </Text>
                        </View>
                    </>
                )}
                {vente.montant_tva > 0 && (
                    <View style={styles.totalLigne}>
                        <Text style={{ color: '#555' }}>TVA</Text>
                        <Text>{fmt(vente.montant_tva, devise)}</Text>
                    </View>
                )}

                <View style={styles.grandTotal}>
                    <Text>TOTAL</Text>
                    <Text>{fmt(vente.montant_total, devise)}</Text>
                </View>

                <View style={styles.separateur} />

                {/* ── PAIEMENTS ── */}
                {paiements.map((p, i) => (
                    <View key={i} style={styles.totalLigne}>
                        <Text>{MOYENS_LABELS[p.moyen_paiement] ?? p.moyen_paiement}
                            {p.reference ? ` (${p.reference})` : ''}
                        </Text>
                        <Text>{fmt(p.montant, devise)}</Text>
                    </View>
                ))}
                {vente.advance_utilise > 0 && (
                    <View style={styles.totalLigne}>
                        <Text>Avance client</Text>
                        <Text>{fmt(vente.advance_utilise, devise)}</Text>
                    </View>
                )}
                {vente.credit_accorde > 0 && (
                    <View style={styles.totalLigne}>
                        <Text style={{ color: couleurs.rouge }}>Crédit accordé</Text>
                        <Text style={{ color: couleurs.rouge }}>{fmt(vente.credit_accorde, devise)}</Text>
                    </View>
                )}
                {vente.montant_rendu > 0 && (
                    <View style={[styles.totalLigne, { marginTop: 2 }]}>
                        <Text style={[styles.gras, { color: couleurs.vert }]}>Monnaie rendue</Text>
                        <Text style={[styles.gras, { color: couleurs.vert }]}>
                            {fmt(vente.montant_rendu, devise)}
                        </Text>
                    </View>
                )}

                <View style={styles.separateur} />

                {/* ── PIED DE PAGE ── */}
                {boutique.message_recu ? (
                    <Text style={styles.footer}>{boutique.message_recu}</Text>
                ) : (
                    <Text style={styles.footer}>Merci pour votre achat !</Text>
                )}
                <Text style={[styles.footer, { marginTop: 2 }]}>
                    *** Conservez ce reçu ***
                </Text>

            </Page>
        </Document>
    )
}