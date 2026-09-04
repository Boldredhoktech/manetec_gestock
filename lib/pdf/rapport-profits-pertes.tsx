import React from 'react'
import { Text, View } from '@react-pdf/renderer'
import { couleurs } from '@/lib/pdf/styles'
import { formatMontantPDF } from '@/lib/pdf/utils-pdf'
import type { BoutiqueEntete } from '@/lib/pdf/entete-rapport'
import {
    DocumentRapport, TableauRapport, SectionTitre, NotePDF, type Colonne,
} from '@/lib/pdf/template'

// ══════════════════════════════════════════════════════════════
// Compte de résultat — repris sur le gabarit commun (D2).
//
// C'est le seul rapport qui n'est pas une liste : le résultat et les
// deux colonnes entrées/sorties restent dessinés à la main, parce
// qu'ils ne sont pas un tableau. Les deux vraies listes du document
// — le détail des dépenses et l'évolution sur six mois — passent, elles,
// par le tableau commun.
//
// Ce document est un relevé de TRÉSORERIE : il compte l'argent entré,
// pas le montant facturé. Ce qui a été vendu sans entrer en caisse
// est rappelé sous le total, pour qu'aucun chiffre ne disparaisse en
// silence.
// ══════════════════════════════════════════════════════════════

interface DonneesRapportPP {
    boutique: BoutiqueEntete & { devise: string }
    periode:          string
    genere_le:        string
    ventes_facturees: number
    non_encaisse_pos: number
    entrees: {
        ventes_pos:       number
        paiements_factures: number
        total:            number
    }
    sorties: {
        depenses:         number
        salaires:         number
        fournisseurs:     number
        total:            number
    }
    resultat:         number
    variation_stock?: {
        pertes: number
        gains:  number
        net:    number
    }
    resultat_economique?: number
    detail_depenses:  { categorie: string; montant: number }[]
    // La courbe et le total de la page viennent de la meme fonction
    // SQL : ce sont des ENTREES et des SORTIES, pas un CA facture.
    evolution_mois:   { mois: string; entrees: number; sorties: number; resultat: number }[]
}

export function RapportProfitPertesPDF({ donnees }: { donnees: DonneesRapportPP }) {
    const d   = donnees.boutique.devise
    const fmt = (n: number) => formatMontantPDF(n, d)

    const positif = donnees.resultat >= 0
    const teinte  = positif ? couleurs.vert : couleurs.rouge
    const signe   = (n: number) => `${n >= 0 ? '+' : '-'}${fmt(Math.abs(n))}`

    const stock = donnees.variation_stock
    const aDuStock = !!stock && (stock.pertes > 0 || stock.gains > 0)

    function Colonne2({ titre, fond, lignes, total, couleurLigne }: {
        titre: string
        fond:  string
        lignes: { label: string; val: number }[]
        total: number
        couleurLigne: string
    }) {
        return (
            <View style={{ flex: 1 }}>
                <Text style={{
                    fontSize: 9, fontFamily: 'Helvetica-Bold', color: '#fff',
                    backgroundColor: fond, padding: 6, borderRadius: 4, textAlign: 'center',
                }}>
                    {titre}
                </Text>
                {lignes.map((l, i) => (
                    <View key={i} style={{
                        flexDirection: 'row', justifyContent: 'space-between',
                        padding: 5, borderBottomWidth: 1, borderBottomColor: couleurs.bordure,
                        backgroundColor: i % 2 !== 0 ? couleurs.fondClair : undefined,
                    }}>
                        <Text style={{ fontSize: 8 }}>{l.label}</Text>
                        <Text style={{ fontSize: 8, fontFamily: 'Helvetica-Bold', color: couleurLigne }}>
                            {fmt(l.val)}
                        </Text>
                    </View>
                ))}
                <View style={{
                    flexDirection: 'row', justifyContent: 'space-between',
                    padding: 6, borderTopWidth: 2, borderTopColor: couleurs.primaire,
                }}>
                    <Text style={{ fontSize: 9, fontFamily: 'Helvetica-Bold', color: couleurs.primaire }}>
                        TOTAL
                    </Text>
                    <Text style={{ fontSize: 9, fontFamily: 'Helvetica-Bold', color: couleurLigne }}>
                        {fmt(total)}
                    </Text>
                </View>
            </View>
        )
    }

    const colEvolution: Colonne<DonneesRapportPP['evolution_mois'][number]>[] = [
        { entete: 'Mois', largeur: '28%', gras: true, rendu: m => m.mois },
        { entete: 'Entrées', largeur: '24%', align: 'right',
          rendu: m => fmt(m.entrees), couleur: () => couleurs.vert },
        { entete: 'Sorties', largeur: '24%', align: 'right',
          rendu: m => fmt(m.sorties), couleur: () => couleurs.rouge },
        { entete: 'Résultat', largeur: '24%', align: 'right', gras: true,
          rendu: m => signe(m.resultat),
          couleur: m => m.resultat >= 0 ? couleurs.vert : couleurs.rouge },
    ]

    return (
        <DocumentRapport
            boutique={donnees.boutique}
            titre="COMPTE DE RÉSULTAT"
            sousTitre={donnees.periode}
            genereLe={donnees.genere_le}
            pied={`${donnees.boutique.nom} — Compte de résultat — ${donnees.genere_le} — Manetec Gestock`}
        >
            {/* ── Le résultat, en tête ─────────────────────── */}
            <View style={{
                backgroundColor: positif ? '#f0fdf4' : '#fef2f2',
                padding: 14, borderRadius: 6, marginBottom: 14, alignItems: 'center',
            }}>
                <Text style={{ fontSize: 10, fontFamily: 'Helvetica-Bold', color: teinte }}>
                    {positif ? 'BÉNÉFICE NET' : 'DÉFICIT NET'}
                </Text>
                <Text style={{ fontSize: 22, fontFamily: 'Helvetica-Bold', color: teinte, marginTop: 2 }}>
                    {signe(donnees.resultat)}
                </Text>
                <Text style={{ fontSize: 8, color: couleurs.texteFaible, marginTop: 4 }}>
                    Base trésorerie : encaissements et décaissements de la période
                </Text>
            </View>

            {/* ── Entrées et sorties, côte à côte ──────────── */}
            <View style={{ flexDirection: 'row', gap: 10, marginBottom: 4 }}>
                <Colonne2
                    titre="PRODUITS (ENTRÉES)"
                    fond={couleurs.vert}
                    couleurLigne={couleurs.vert}
                    lignes={[
                        { label: 'Ventes POS encaissées', val: donnees.entrees.ventes_pos },
                        { label: 'Règlements de facture', val: donnees.entrees.paiements_factures },
                    ]}
                    total={donnees.entrees.total}
                />
                <Colonne2
                    titre="CHARGES (SORTIES)"
                    fond={couleurs.rouge}
                    couleurLigne={couleurs.rouge}
                    lignes={[
                        { label: 'Dépenses d’exploitation', val: donnees.sorties.depenses },
                        { label: 'Salaires versés',         val: donnees.sorties.salaires },
                        { label: 'Fournisseurs payés',      val: donnees.sorties.fournisseurs },
                    ]}
                    total={donnees.sorties.total}
                />
            </View>

            {(donnees.non_encaisse_pos ?? 0) > 0 && (
                <NotePDF>
                    Facturé au comptoir sur la période : {fmt(donnees.ventes_facturees ?? 0)} —
                    dont {fmt(donnees.non_encaisse_pos ?? 0)} non encaissés (crédit accordé,
                    soldes clients). Ce relevé ne compte que l&apos;argent entré.
                </NotePDF>
            )}

            {/* ── Variation du stock, hors trésorerie ──────── */}
            {aDuStock && (
                <>
                    <SectionTitre>Variation de la valeur du stock (hors trésorerie)</SectionTitre>
                    <View style={{
                        borderWidth: 1, borderColor: couleurs.bordure,
                        borderRadius: 4, padding: 10, marginBottom: 4,
                    }}>
                        {[
                            { label: 'Pertes constatées aux inventaires', val: -stock!.pertes, coul: couleurs.rouge },
                            { label: 'Gains constatés aux inventaires',   val:  stock!.gains,  coul: couleurs.vert },
                        ].map((l, i) => (
                            <View key={i} style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 3 }}>
                                <Text style={{ fontSize: 9 }}>{l.label}</Text>
                                <Text style={{ fontSize: 9, color: l.coul }}>{signe(l.val)}</Text>
                            </View>
                        ))}
                        <View style={{
                            flexDirection: 'row', justifyContent: 'space-between',
                            borderTopWidth: 1, borderTopColor: couleurs.bordure, paddingTop: 4, marginTop: 2,
                        }}>
                            <Text style={{ fontSize: 9, fontFamily: 'Helvetica-Bold' }}>
                                Résultat économique
                            </Text>
                            <Text style={{
                                fontSize: 9, fontFamily: 'Helvetica-Bold',
                                color: (donnees.resultat_economique ?? 0) >= 0 ? couleurs.vert : couleurs.rouge,
                            }}>
                                {signe(donnees.resultat_economique ?? 0)}
                            </Text>
                        </View>
                    </View>
                    <NotePDF>
                        Les écarts d&apos;inventaire ne sont PAS de la trésorerie : aucun argent
                        n&apos;est entré ni sorti. Ils sont présentés à part pour que le résultat
                        de caisse reste lisible tel quel.
                    </NotePDF>
                </>
            )}

            {donnees.detail_depenses.length > 0 && (
                <>
                    <SectionTitre>Détail des dépenses par catégorie</SectionTitre>
                    <TableauRapport
                        colonnes={[
                            { entete: 'Catégorie', largeur: '65%',
                              rendu: c => c.categorie || 'Sans catégorie' },
                            { entete: 'Montant', largeur: '35%', align: 'right', gras: true,
                              rendu: c => fmt(c.montant), couleur: () => couleurs.rouge },
                        ]}
                        lignes={donnees.detail_depenses}
                        totaux={['TOTAL', fmt(donnees.sorties.depenses)]}
                    />
                </>
            )}

            {donnees.evolution_mois.length > 1 && (
                <>
                    <SectionTitre>Évolution sur six mois</SectionTitre>
                    <TableauRapport colonnes={colEvolution} lignes={donnees.evolution_mois} />
                    <NotePDF>
                        Cette courbe est calculée par la même fonction que le total ci-dessus :
                        le point du mois en cours et le résultat de la page disent forcément
                        la même chose.
                    </NotePDF>
                </>
            )}
        </DocumentRapport>
    )
}
