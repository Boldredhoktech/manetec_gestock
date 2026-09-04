import React from 'react'
import { Text, View } from '@react-pdf/renderer'
import { couleurs } from '@/lib/pdf/styles'
import { formatMontantPDF } from '@/lib/pdf/utils-pdf'
import type { BoutiqueEntete } from '@/lib/pdf/entete-rapport'
import {
    DocumentRapport, CartesStats, TableauRapport, SectionTitre, NotePDF,
    type Colonne,
} from '@/lib/pdf/template'
import { MOYENS_PAIEMENT } from '@/lib/constants/moyens-paiement'

// ══════════════════════════════════════════════════════════════
// Rapport de caisse — RAP-06, décision D4.
//
// Un seul document, deux niveaux : le récapitulatif du mois en tête,
// puis le détail de chaque journée à la suite. On l'ouvre pour la
// synthèse, on descend pour comprendre une ligne. C'est le même geste
// que le relevé de compte fournisseur.
//
// L'écart est CONSTATÉ, jamais corrigé : c'est la règle posée au
// Lot 4 POS, et un rapport qui le lisserait la trahirait.
// ══════════════════════════════════════════════════════════════

const LIBELLE_MOYEN: Record<string, string> = Object.fromEntries(
    MOYENS_PAIEMENT.map(m => [m.code, m.label]),
)

interface JourneeCaisse {
    public_id:        string
    jour:             string
    jour_iso:         string
    entrepot:         string
    statut:           string
    fond_initial:     number
    attendu:          number | null
    compte:           number | null
    ecart:            number | null
    ouverte_par:      string
    fermee_par:       string | null
    note_ouverture:   string | null
    note_fermeture:   string | null
    encaisse_especes: number
    encaisse_autres:  number
    sorties_especes:  number
    nb_ventes:        number
}

interface MouvementJour { moyen: string; entrees: number; sorties: number }

interface DonneesRapportCaisse {
    boutique: BoutiqueEntete & { devise: string }
    periode:         string
    genere_le:       string
    nb_journees:     number
    nb_fermees:      number
    nb_ouvertes:     number
    nb_avec_ecart:   number
    total_attendu:   number
    total_compte:    number
    total_ecart:     number
    total_manques:   number
    total_excedents: number
    journees:        JourneeCaisse[]
    detail_par_jour: Record<string, MouvementJour[]>
}

export function RapportCaissePDF({ donnees }: { donnees: DonneesRapportCaisse }) {
    const d   = donnees.boutique.devise
    const fmt = (n: number) => formatMontantPDF(n, d)

    // Un écart signé se lit d'un coup d'œil : ce qui manque en rouge,
    // ce qui dépasse en orange. Zéro n'est pas une couleur.
    const teinteEcart = (e: number | null) =>
        e === null || e === 0 ? undefined : e < 0 ? couleurs.rouge : couleurs.orange

    const colonnes: Colonne<JourneeCaisse>[] = [
        { entete: 'Journée', largeur: '14%', gras: true,
          rendu: j => j.jour, sousTexte: j => j.entrepot },
        { entete: 'Caisse', largeur: '14%',
          rendu: j => j.public_id, sousTexte: j => j.ouverte_par },
        { entete: 'Ventes', largeur: '8%', align: 'center',
          rendu: j => String(j.nb_ventes) },
        { entete: 'Fond', largeur: '13%', align: 'right',
          rendu: j => fmt(j.fond_initial) },
        { entete: 'Attendu', largeur: '15%', align: 'right',
          rendu: j => j.attendu === null ? 'en cours' : fmt(j.attendu),
          couleur: j => j.attendu === null ? couleurs.texteFaible : undefined },
        { entete: 'Compté', largeur: '15%', align: 'right',
          rendu: j => j.compte === null ? '—' : fmt(j.compte) },
        { entete: 'Écart', largeur: '21%', align: 'right', gras: true,
          rendu: j => j.ecart === null ? '—'
                    : j.ecart === 0 ? 'juste'
                    : `${j.ecart > 0 ? '+' : '-'}${fmt(Math.abs(j.ecart))}`,
          couleur: j => teinteEcart(j.ecart) ?? couleurs.vert },
    ]

    return (
        <DocumentRapport
            boutique={donnees.boutique}
            titre="RAPPORT DE CAISSE"
            sousTitre={donnees.periode}
            genereLe={donnees.genere_le}
            pied={`${donnees.boutique.nom} — Rapport de caisse — ${donnees.genere_le} — Manetec Gestock`}
        >
            <CartesStats cartes={[
                { label: 'Journées', valeur: String(donnees.nb_journees),
                  note: donnees.nb_ouvertes > 0 ? `dont ${donnees.nb_ouvertes} encore ouverte(s)` : undefined },
                { label: 'Journées avec écart', valeur: String(donnees.nb_avec_ecart),
                  couleur: donnees.nb_avec_ecart > 0 ? couleurs.rouge : couleurs.vert,
                  note: `sur ${donnees.nb_fermees} fermée(s)` },
                { label: 'Manques cumulés', valeur: fmt(Math.abs(donnees.total_manques)),
                  couleur: donnees.total_manques < 0 ? couleurs.rouge : couleurs.texteFaible },
                { label: 'Excédents cumulés', valeur: fmt(donnees.total_excedents),
                  couleur: donnees.total_excedents > 0 ? couleurs.orange : couleurs.texteFaible },
            ]} />

            <SectionTitre>Récapitulatif de la période</SectionTitre>
            <TableauRapport
                colonnes={colonnes}
                lignes={donnees.journees}
                vide="Aucune caisse ouverte sur cette période."
                totaux={['TOTAL', '', '', '', fmt(donnees.total_attendu), fmt(donnees.total_compte),
                         donnees.total_ecart === 0 ? 'juste'
                           : `${donnees.total_ecart > 0 ? '+' : '-'}${fmt(Math.abs(donnees.total_ecart))}`]}
            />

            {donnees.nb_avec_ecart > 0 && (
                <NotePDF>
                    Un écart cumulé proche de zéro peut cacher un manque et un excédent qui
                    se compensent : les deux sont donnés séparément ci-dessus. L&apos;écart
                    est constaté tel qu&apos;il a été relevé à la fermeture, jamais recalculé.
                </NotePDF>
            )}

            {/* ── Le détail, journée par journée ────────────── */}
            {donnees.journees.length > 0 && (
                <SectionTitre>Détail de chaque journée</SectionTitre>
            )}

            {donnees.journees.map(j => {
                const detail = donnees.detail_par_jour[j.jour_iso] ?? []

                return (
                    <View key={j.public_id} style={{
                        marginBottom: 10, paddingTop: 6,
                        borderTopWidth: 1, borderTopColor: couleurs.bordure,
                    }} wrap={false}>
                        <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 4 }}>
                            <Text style={{ fontSize: 9, fontFamily: 'Helvetica-Bold', color: couleurs.primaire }}>
                                {j.jour} — {j.entrepot} ({j.public_id})
                            </Text>
                            <Text style={{
                                fontSize: 9, fontFamily: 'Helvetica-Bold',
                                color: teinteEcart(j.ecart) ?? couleurs.vert,
                            }}>
                                {j.statut === 'ouverte' ? 'Caisse encore ouverte'
                                  : j.ecart === 0 ? 'Compte juste'
                                  : `Écart ${j.ecart! > 0 ? '+' : '-'}${fmt(Math.abs(j.ecart!))}`}
                            </Text>
                        </View>

                        <Text style={{ fontSize: 7.5, color: couleurs.texteFaible, marginBottom: 4 }}>
                            Ouverte par {j.ouverte_par} avec {fmt(j.fond_initial)} de fond
                            {j.note_ouverture ? ` — « ${j.note_ouverture} »` : ''}
                            {j.fermee_par ? ` · Fermée par ${j.fermee_par}` : ''}
                            {j.note_fermeture ? ` — « ${j.note_fermeture} »` : ''}
                        </Text>

                        {/* Deux colonnes de chiffres sans titre ne disent
                            pas ce qu'elles comptent. Le rappel est par
                            journee : un bloc peut basculer sur la page
                            suivante et emporter sa legende avec lui. */}
                        {detail.length > 0 && (
                            <View style={{ flexDirection: 'row', paddingBottom: 2 }}>
                                <Text style={{ width: '40%', fontSize: 7, color: couleurs.texteFaible }}>
                                    Moyen de paiement
                                </Text>
                                <Text style={{ width: '30%', fontSize: 7, textAlign: 'right', color: couleurs.texteFaible }}>
                                    Entrées
                                </Text>
                                <Text style={{ width: '30%', fontSize: 7, textAlign: 'right', color: couleurs.texteFaible }}>
                                    Sorties
                                </Text>
                            </View>
                        )}

                        {detail.length === 0 ? (
                            <Text style={{ fontSize: 8, color: couleurs.texteFaible }}>
                                Aucun mouvement ce jour-là.
                            </Text>
                        ) : (
                            detail.map((m, i) => (
                                <View key={i} style={{
                                    flexDirection: 'row', paddingVertical: 2,
                                    backgroundColor: i % 2 !== 0 ? couleurs.fondClair : undefined,
                                }}>
                                    <Text style={{ width: '40%', fontSize: 8 }}>
                                        {LIBELLE_MOYEN[m.moyen] ?? m.moyen}
                                    </Text>
                                    <Text style={{ width: '30%', fontSize: 8, textAlign: 'right', color: couleurs.vert }}>
                                        {m.entrees > 0 ? `+${fmt(m.entrees)}` : '—'}
                                    </Text>
                                    <Text style={{ width: '30%', fontSize: 8, textAlign: 'right', color: couleurs.rouge }}>
                                        {m.sorties > 0 ? `-${fmt(m.sorties)}` : '—'}
                                    </Text>
                                </View>
                            ))
                        )}
                    </View>
                )
            })}
        </DocumentRapport>
    )
}
