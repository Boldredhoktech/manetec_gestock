import React from 'react'
import {
    Document, Page, Text, View, StyleSheet,
} from '@react-pdf/renderer'
import { couleurs } from '@/lib/pdf/styles'
import { formatMontantPDF } from '@/lib/pdf/utils-pdf'
import { EnteteRapportPDF, type BoutiqueEntete } from '@/lib/pdf/entete-rapport'

const styles = StyleSheet.create({
    page: {
        fontFamily:  'Helvetica',
        fontSize:    9,
        color:       couleurs.texte,
        padding:     30,
        backgroundColor: '#fff',
    },
    entete: {
        display:        'flex',
        flexDirection:  'row',
        justifyContent: 'space-between',
        alignItems:     'flex-start',
        marginBottom:   20,
        paddingBottom:  12,
        borderBottomWidth: 2,
        borderBottomColor: couleurs.primaire,
    },
    titreBoutique: {
        fontSize:   16,
        fontFamily: 'Helvetica-Bold',
        color:      couleurs.primaire,
    },
    sousTitreBoutique: {
        fontSize:  8,
        color:     couleurs.texteFaible,
        marginTop: 2,
    },
    titrePage: {
        fontSize:  11,
        fontFamily: 'Helvetica-Bold',
        color:      couleurs.texte,
        marginBottom: 2,
    },
    periode: {
        fontSize: 8,
        color:    couleurs.texteFaible,
    },
    cartesStat: {
        display:       'flex',
        flexDirection: 'row',
        gap:           8,
        marginBottom:  16,
    },
    carte: {
        flex:            1,
        backgroundColor: couleurs.fondClair,
        padding:         10,
        borderRadius:    6,
        borderLeftWidth: 3,
        borderLeftColor: couleurs.accent,
    },
    carteLabel: {
        fontSize:  7,
        color:     couleurs.texteFaible,
        marginBottom: 3,
    },
    carteValeur: {
        fontSize:   13,
        fontFamily: 'Helvetica-Bold',
        color:      couleurs.primaire,
    },
    enteteTableau: {
        display:         'flex',
        flexDirection:   'row',
        backgroundColor: couleurs.primaire,
        padding:         6,
        borderRadius:    4,
        marginBottom:    0,
    },
    celluleEntete: {
        fontFamily: 'Helvetica-Bold',
        fontSize:   8,
        color:      '#fff',
    },
    ligne: {
        display:        'flex',
        flexDirection:  'row',
        padding:        5,
        borderBottomWidth: 1,
        borderBottomColor: couleurs.bordure,
    },
    ligneImpaire: {
        backgroundColor: couleurs.fondClair,
    },
    cellule: {
        fontSize: 8,
        color:    couleurs.texte,
    },
    sectionTitre: {
        fontSize:     10,
        fontFamily:   'Helvetica-Bold',
        color:        couleurs.primaire,
        marginTop:    14,
        marginBottom: 6,
        paddingBottom: 3,
        borderBottomWidth: 1,
        borderBottomColor: couleurs.bordure,
    },
    pied: {
        position:     'absolute',
        bottom:       20,
        left:         30,
        right:        30,
        textAlign:    'center',
        fontSize:     7,
        color:        couleurs.texteFaible,
        borderTopWidth: 1,
        borderTopColor: couleurs.bordure,
        paddingTop:   6,
    },
})

interface VenteLigne {
    public_id:     string
    date:          string
    client_nom:    string
    vendeur_nom:   string
    montant_total: number
    statut:        string
    nb_articles:   number
}

interface DonneesRapportVentes {
    boutique: BoutiqueEntete & { devise: string }
    periode:       string
    genere_le:     string
    total_ventes:  number
    ca_total:      number
    ca_moyen:      number
    ventes:        VenteLigne[]
    top_produits:  { nom: string; quantite: number; ca: number }[]
    par_vendeur:   { nom: string; nb_ventes: number; ca: number }[]
    par_moyen:     { moyen: string; montant: number }[]
}

function fmt(n: number, d: string) {
    return formatMontantPDF(n, d)
}

export function RapportVentesPDF({ donnees }: { donnees: DonneesRapportVentes }) {
    const { boutique, ventes, top_produits, par_vendeur, par_moyen } = donnees
    const d = boutique.devise

    const MOYENS_LABELS: Record<string, string> = {
        cash: 'Espèces', wave: 'Wave', mtn_momo: 'MTN MoMo',
        celtiis_cash: 'Celtiis', moov_money: 'Moov', bank_card: 'Carte', bank_transfer: 'Virement',
    }

    return (
        <Document>
            <Page size="A4" style={styles.page}>

                {/* EN-TÊTE */}
                <EnteteRapportPDF boutique={boutique} titre="RAPPORT DE VENTES" sousTitre={donnees.periode} genereLe={donnees.genere_le} />

                {/* STATISTIQUES */}
                <View style={styles.cartesStat}>
                    <View style={styles.carte}>
                        <Text style={styles.carteLabel}>Nombre de ventes</Text>
                        <Text style={styles.carteValeur}>{donnees.total_ventes}</Text>
                    </View>
                    <View style={[styles.carte, { borderLeftColor: couleurs.vert }]}>
                        <Text style={styles.carteLabel}>Chiffre d'affaires</Text>
                        <Text style={[styles.carteValeur, { color: couleurs.vert }]}>
                            {fmt(donnees.ca_total, d)}
                        </Text>
                    </View>
                    <View style={[styles.carte, { borderLeftColor: couleurs.orange }]}>
                        <Text style={styles.carteLabel}>Panier moyen</Text>
                        <Text style={[styles.carteValeur, { color: couleurs.orange }]}>
                            {fmt(donnees.ca_moyen, d)}
                        </Text>
                    </View>
                </View>

                {/* TABLEAU DES VENTES */}
                <Text style={styles.sectionTitre}>Détail des ventes</Text>
                <View style={styles.enteteTableau}>
                    <Text style={[styles.celluleEntete, { width: '15%' }]}>N° Vente</Text>
                    <Text style={[styles.celluleEntete, { width: '15%' }]}>Date</Text>
                    <Text style={[styles.celluleEntete, { width: '22%' }]}>Client</Text>
                    <Text style={[styles.celluleEntete, { width: '18%' }]}>Vendeur</Text>
                    <Text style={[styles.celluleEntete, { width: '8%', textAlign: 'center' }]}>Art.</Text>
                    <Text style={[styles.celluleEntete, { width: '12%', textAlign: 'right' }]}>Montant</Text>
                    <Text style={[styles.celluleEntete, { width: '10%', textAlign: 'center' }]}>Statut</Text>
                </View>
                {ventes.map((v, i) => (
                    <View key={v.public_id}
                          style={[styles.ligne, i % 2 !== 0 ? styles.ligneImpaire : {}]}>
                        <Text style={[styles.cellule, { width: '15%', fontFamily: 'Helvetica-Bold' }]}>
                            {v.public_id}
                        </Text>
                        <Text style={[styles.cellule, { width: '15%' }]}>{v.date}</Text>
                        <Text style={[styles.cellule, { width: '22%', maxLines: 1 }]}>
                            {v.client_nom || 'Anonyme'}
                        </Text>
                        <Text style={[styles.cellule, { width: '18%', maxLines: 1 }]}>
                            {v.vendeur_nom}
                        </Text>
                        <Text style={[styles.cellule, { width: '8%', textAlign: 'center' }]}>
                            {v.nb_articles}
                        </Text>
                        <Text style={[styles.cellule, { width: '12%', textAlign: 'right', fontFamily: 'Helvetica-Bold' }]}>
                            {fmt(v.montant_total, d)}
                        </Text>
                        <Text style={[styles.cellule, {
                            width: '10%', textAlign: 'center',
                            color: v.statut === 'completee' ? couleurs.vert : couleurs.rouge,
                        }]}>
                            {v.statut === 'completee' ? '✓' : '✗'}
                        </Text>
                    </View>
                ))}

                {/* TOP PRODUITS */}
                {top_produits.length > 0 && (
                    <>
                        <Text style={styles.sectionTitre}>Top produits</Text>
                        <View style={styles.enteteTableau}>
                            <Text style={[styles.celluleEntete, { width: '55%' }]}>Produit</Text>
                            <Text style={[styles.celluleEntete, { width: '20%', textAlign: 'center' }]}>Qté vendue</Text>
                            <Text style={[styles.celluleEntete, { width: '25%', textAlign: 'right' }]}>CA généré</Text>
                        </View>
                        {top_produits.slice(0, 10).map((p, i) => (
                            <View key={i} style={[styles.ligne, i % 2 !== 0 ? styles.ligneImpaire : {}]}>
                                <Text style={[styles.cellule, { width: '55%' }]}>{p.nom}</Text>
                                <Text style={[styles.cellule, { width: '20%', textAlign: 'center' }]}>{p.quantite}</Text>
                                <Text style={[styles.cellule, { width: '25%', textAlign: 'right', fontFamily: 'Helvetica-Bold' }]}>
                                    {fmt(p.ca, d)}
                                </Text>
                            </View>
                        ))}
                    </>
                )}

                {/* PAR VENDEUR */}
                {par_vendeur.length > 0 && (
                    <>
                        <Text style={styles.sectionTitre}>Performance par vendeur</Text>
                        <View style={styles.enteteTableau}>
                            <Text style={[styles.celluleEntete, { width: '50%' }]}>Vendeur</Text>
                            <Text style={[styles.celluleEntete, { width: '25%', textAlign: 'center' }]}>Nb ventes</Text>
                            <Text style={[styles.celluleEntete, { width: '25%', textAlign: 'right' }]}>CA total</Text>
                        </View>
                        {par_vendeur.map((v, i) => (
                            <View key={i} style={[styles.ligne, i % 2 !== 0 ? styles.ligneImpaire : {}]}>
                                <Text style={[styles.cellule, { width: '50%' }]}>{v.nom}</Text>
                                <Text style={[styles.cellule, { width: '25%', textAlign: 'center' }]}>{v.nb_ventes}</Text>
                                <Text style={[styles.cellule, { width: '25%', textAlign: 'right', fontFamily: 'Helvetica-Bold' }]}>
                                    {fmt(v.ca, d)}
                                </Text>
                            </View>
                        ))}
                    </>
                )}

                {/* PAR MOYEN DE PAIEMENT */}
                {par_moyen.length > 0 && (
                    <>
                        <Text style={styles.sectionTitre}>Encaissements par moyen de paiement</Text>
                        <View style={styles.enteteTableau}>
                            <Text style={[styles.celluleEntete, { width: '60%' }]}>Moyen</Text>
                            <Text style={[styles.celluleEntete, { width: '40%', textAlign: 'right' }]}>Montant encaissé</Text>
                        </View>
                        {par_moyen.map((m, i) => (
                            <View key={i} style={[styles.ligne, i % 2 !== 0 ? styles.ligneImpaire : {}]}>
                                <Text style={[styles.cellule, { width: '60%' }]}>
                                    {MOYENS_LABELS[m.moyen] ?? m.moyen}
                                </Text>
                                <Text style={[styles.cellule, { width: '40%', textAlign: 'right', fontFamily: 'Helvetica-Bold' }]}>
                                    {fmt(m.montant, d)}
                                </Text>
                            </View>
                        ))}
                    </>
                )}

                {/* PIED DE PAGE */}
                <Text style={styles.pied}>
                    {boutique.nom} — Rapport généré le {donnees.genere_le} — Manetec Gestock
                </Text>

            </Page>
        </Document>
    )
}