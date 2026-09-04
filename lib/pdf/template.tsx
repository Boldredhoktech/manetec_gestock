import React from 'react'
import { Document, Page, Text, View, StyleSheet } from '@react-pdf/renderer'
import { couleurs } from '@/lib/pdf/styles'
import { EnteteRapportPDF, type BoutiqueEntete } from '@/lib/pdf/entete-rapport'

// ══════════════════════════════════════════════════════════════
// Gabarit commun des documents PDF
// --------------------------------------------------------------
// Chaque PDF redéfinissait sa propre feuille de styles, son propre
// en-tête de tableau et ses propres totaux : la même mise en page
// réécrite douze fois, et douze occasions de diverger.
//
// Ici, un document se DÉCLARE : on décrit ses colonnes et on lui
// passe ses données. La mise en page vit à un seul endroit.
// ══════════════════════════════════════════════════════════════

const s = StyleSheet.create({
    page: {
        fontFamily: 'Helvetica', fontSize: 9,
        color: couleurs.texte, padding: 30, backgroundColor: '#fff',
    },
    cartes: { flexDirection: 'row', gap: 8, marginBottom: 14 },
    carte: {
        flex: 1, backgroundColor: couleurs.fondClair, padding: 10,
        borderRadius: 6, borderLeftWidth: 3, borderLeftColor: couleurs.primaire,
    },
    carteLabel: { fontSize: 7, color: couleurs.texteFaible, marginBottom: 3 },
    carteVal:   { fontSize: 12, fontFamily: 'Helvetica-Bold', color: couleurs.primaire },
    carteNote:  { fontSize: 7, color: couleurs.texteFaible, marginTop: 2 },

    sectionTitre: {
        fontSize: 10, fontFamily: 'Helvetica-Bold', color: couleurs.primaire,
        marginTop: 8, marginBottom: 6,
    },
    note: { fontSize: 7, color: couleurs.texteFaible, marginTop: 8, lineHeight: 1.4 },

    encart: { padding: 8, borderRadius: 4, marginBottom: 12, borderLeftWidth: 3 },
    encartTitre: { fontSize: 8, fontFamily: 'Helvetica-Bold' },
    encartTexte: { fontSize: 7, color: couleurs.texteFaible, marginTop: 2, lineHeight: 1.4 },

    tableauEntete: {
        flexDirection: 'row', backgroundColor: couleurs.primaire,
        padding: 6, borderRadius: 4,
    },
    cellEntete: { fontFamily: 'Helvetica-Bold', fontSize: 8, color: '#fff' },
    // Une colonne tient sa largeur : ni etirement, ni refus de
    // retrecir. Sans cela le contenu deborde sur la colonne voisine.
    colonne: { flexGrow: 0, flexShrink: 0, paddingRight: 3 },
    ligne: {
        flexDirection: 'row', padding: 5,
        borderBottomWidth: 1, borderBottomColor: couleurs.bordure,
    },
    ligneAlternee: { backgroundColor: couleurs.fondClair },
    cellule: { fontSize: 8, color: couleurs.texte },
    sousTexte: { fontSize: 7, color: couleurs.texteFaible },
    vide: { fontSize: 8, color: couleurs.texteFaible, textAlign: 'center', paddingVertical: 14 },
    totaux: {
        flexDirection: 'row', padding: 6, backgroundColor: couleurs.fondClair,
        borderTopWidth: 2, borderTopColor: couleurs.primaire,
    },
    cellTotal: { fontSize: 8, fontFamily: 'Helvetica-Bold', color: couleurs.primaire },
    pied: {
        position: 'absolute', bottom: 20, left: 30, right: 30,
        textAlign: 'center', fontSize: 7, color: couleurs.texteFaible,
        borderTopWidth: 1, borderTopColor: couleurs.bordure, paddingTop: 6,
    },
})

export type BoutiqueDocument = BoutiqueEntete & { devise?: string }

// ── Le document : en-tête, contenu, pied de page ──────────────
export function DocumentRapport({
    boutique, titre, sousTitre, genereLe, pied, orientation, children,
}: {
    boutique:    BoutiqueDocument
    titre:       string
    sousTitre?:  string
    genereLe:    string
    pied?:       string
    orientation?: 'portrait' | 'landscape'
    children:    React.ReactNode
}) {
    return (
        <Document>
            <Page size="A4" orientation={orientation ?? 'portrait'} style={s.page}>
                <EnteteRapportPDF
                    boutique={boutique}
                    titre={titre}
                    sousTitre={sousTitre}
                    genereLe={genereLe}
                />
                {children}
                {pied && <Text style={s.pied} fixed>{pied}</Text>}
            </Page>
        </Document>
    )
}

// ── Bandeau de cartes chiffrées ───────────────────────────────
export interface CarteStat {
    label:   string
    valeur:  string
    note?:   string
    couleur?: string
}

export function CartesStats({ cartes }: { cartes: CarteStat[] }) {
    if (cartes.length === 0) return null
    return (
        <View style={s.cartes}>
            {cartes.map((c, i) => (
                <View key={i} style={[s.carte, c.couleur ? { borderLeftColor: c.couleur } : {}]}>
                    <Text style={s.carteLabel}>{c.label}</Text>
                    <Text style={[s.carteVal, c.couleur ? { color: c.couleur } : {}]}>{c.valeur}</Text>
                    {c.note && <Text style={s.carteNote}>{c.note}</Text>}
                </View>
            ))}
        </View>
    )
}

// ── Tableau déclaratif ────────────────────────────────────────
// Une colonne dit où elle se place, ce qu'elle affiche et comment.
// Le composant ne connaît rien du métier.
export interface Colonne<T> {
    entete:    string
    largeur:   string
    align?:    'left' | 'right' | 'center'
    /** Texte principal de la cellule. */
    rendu:     (ligne: T) => string
    /** Seconde ligne, plus discrète (référence, téléphone, unité…). */
    sousTexte?: (ligne: T) => string | null
    gras?:     boolean
    /** Couleur calculée sur la donnée (rouge si négatif, etc.). */
    couleur?:  (ligne: T) => string | undefined
}

export function TableauRapport<T>({
    colonnes, lignes, totaux, vide,
}: {
    colonnes: Colonne<T>[]
    lignes:   T[]
    /** Ligne de totaux : une entrée par colonne, ou vide pour ignorer. */
    totaux?:  string[]
    vide?:    string
}) {
    return (
        <View>
            <View style={s.tableauEntete}>
                {colonnes.map((c, i) => (
                    <View key={i} style={[s.colonne, { width: c.largeur }]}>
                        <Text style={[s.cellEntete, { textAlign: c.align ?? 'left' }]}>
                            {c.entete}
                        </Text>
                    </View>
                ))}
            </View>

            {lignes.length === 0 && (
                <Text style={s.vide}>{vide ?? 'Aucune ligne sur cette période.'}</Text>
            )}

            {lignes.map((ligne, i) => (
                <View key={i} style={[s.ligne, i % 2 !== 0 ? s.ligneAlternee : {}]} wrap={false}>
                    {colonnes.map((c, j) => {
                        const sous = c.sousTexte?.(ligne)
                        const couleur = c.couleur?.(ligne)
                        return (
                            <View key={j} style={[s.colonne, { width: c.largeur }]}>
                                <Text style={[
                                    s.cellule,
                                    { textAlign: c.align ?? 'left' },
                                    c.gras ? { fontFamily: 'Helvetica-Bold' } : {},
                                    couleur ? { color: couleur } : {},
                                ]}>
                                    {c.rendu(ligne)}
                                </Text>
                                {sous && (
                                    <Text style={[s.sousTexte, { textAlign: c.align ?? 'left' }]}>{sous}</Text>
                                )}
                            </View>
                        )
                    })}
                </View>
            ))}

            {totaux && totaux.length > 0 && (
                <View style={s.totaux}>
                    {colonnes.map((c, i) => (
                        <View key={i} style={[s.colonne, { width: c.largeur }]}>
                            <Text style={[s.cellTotal, { textAlign: c.align ?? 'left' }]}>
                                {totaux[i] ?? ''}
                            </Text>
                        </View>
                    ))}
                </View>
            )}
        </View>
    )
}

// ── Éléments de texte ─────────────────────────────────────────
export function SectionTitre({ children }: { children: React.ReactNode }) {
    return <Text style={s.sectionTitre}>{children}</Text>
}

export function NotePDF({ children }: { children: React.ReactNode }) {
    return <Text style={s.note}>{children}</Text>
}

export function Encart({
    titre, texte, ton = 'info',
}: {
    titre: string
    texte?: string
    ton?: 'info' | 'alerte' | 'succes'
}) {
    const tons = {
        info:   { fond: couleurs.fondClair, trait: couleurs.primaire, texte: couleurs.primaire },
        alerte: { fond: '#fef2f2',          trait: couleurs.rouge,    texte: couleurs.rouge    },
        succes: { fond: '#f0fdf4',          trait: couleurs.vert,     texte: couleurs.vert     },
    }[ton]

    return (
        <View style={[s.encart, { backgroundColor: tons.fond, borderLeftColor: tons.trait }]}>
            <Text style={[s.encartTitre, { color: tons.texte }]}>{titre}</Text>
            {texte && <Text style={s.encartTexte}>{texte}</Text>}
        </View>
    )
}

// ── Bloc « informations » en colonnes ─────────────────────────
export function BlocInfos({ infos }: { infos: { label: string; valeur: string }[] }) {
    return (
        <View style={{ flexDirection: 'row', gap: 8, marginBottom: 14 }}>
            {infos.map((info, i) => (
                <View key={i} style={{
                    flex: 1, padding: 8, borderWidth: 1,
                    borderColor: couleurs.bordure, borderRadius: 4,
                }}>
                    <Text style={s.carteLabel}>{info.label}</Text>
                    <Text style={{ fontSize: 9, fontFamily: 'Helvetica-Bold', marginTop: 2 }}>
                        {info.valeur}
                    </Text>
                </View>
            ))}
        </View>
    )
}
