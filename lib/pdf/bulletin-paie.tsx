import React from 'react'
import { Text, View } from '@react-pdf/renderer'
import { couleurs } from '@/lib/pdf/styles'
import {
    formatMontantPDF, formatDatePDF, nombreEnLettresPDF, deviseEnLettresPDF,
} from '@/lib/pdf/utils-pdf'
import {
    DocumentRapport, TableauRapport, BlocInfos, SectionTitre, NotePDF, Encart,
    type Colonne,
} from '@/lib/pdf/template'

// Le bulletin de paie est le deuxième document écrit sur le gabarit
// commun (après le bon de commande) : on déclare ses colonnes et ses
// blocs, la mise en page vient de lib/pdf/template.tsx.
//
// Jusqu'ici le seul PDF de paie était un récapitulatif de tous les
// employés d'un mois : la boutique ne pouvait remettre à personne le
// justificatif de son propre versement.

interface LigneBulletin {
    libelle: string
    montant: number
    signe:   '+' | '-'
}

export interface DonneesBulletinPaie {
    boutique: {
        nom: string; adresse?: string | null; ville?: string | null
        telephone_1?: string | null; email?: string | null
        ifu?: string | null; logo_url?: string | null; devise: string
    }
    employe: {
        nom_complet: string
        poste:        string | null
        telephone:    string | null
        date_embauche: string | null
    }
    versement: {
        public_id:      string
        au_titre_de:    string
        date_paiement:  string
        salaire_base:   number
        bonus:          number
        deductions:     number
        montant_net:    number
        moyen:          string
        reference:      string | null
        note:           string | null
        est_annule:     boolean
        motif_annulation: string | null
    }
    // Ce que l'employé a reçu en tout pour ce mois travaillé, versements
    // annulés exclus : avec les acomptes, un bulletin seul ne dit pas
    // tout.
    cumul_periode: {
        nb_versements: number
        total_verse:   number
    }
    genere_le: string
}

const MOYENS: Record<string, string> = {
    cash: 'Espèces', wave: 'Wave', mtn_momo: 'MTN Mobile Money',
    celtiis_cash: 'Celtiis Cash', moov_money: 'Moov Africa Money',
    other_mobile: 'Autre Mobile Money',
    bank_transfer: 'Virement bancaire', bank_card: 'Carte bancaire',
}

export function BulletinPaiePDF({ donnees }: { donnees: DonneesBulletinPaie }) {
    const d   = donnees.boutique.devise
    const fmt = (n: number) => formatMontantPDF(n, d)
    const v   = donnees.versement
    const e   = donnees.employe

    const lignes: LigneBulletin[] = [
        { libelle: 'Salaire de base', montant: v.salaire_base, signe: '+' },
    ]
    if (v.bonus > 0)      lignes.push({ libelle: 'Prime / bonus', montant: v.bonus, signe: '+' })
    if (v.deductions > 0) lignes.push({ libelle: 'Retenues', montant: v.deductions, signe: '-' })

    const colonnes: Colonne<LigneBulletin>[] = [
        { entete: 'Élément', largeur: '60%', rendu: l => l.libelle },
        { entete: 'Sens',    largeur: '15%', align: 'center',
          rendu: l => (l.signe === '+' ? 'Gain' : 'Retenue'),
          couleur: l => (l.signe === '+' ? couleurs.vert : couleurs.rouge) },
        { entete: 'Montant', largeur: '25%', align: 'right', gras: true,
          rendu: l => `${l.signe === '-' ? '-' : ''}${fmt(l.montant)}` },
    ]

    // Le cumul n'a d'intérêt que si ce bulletin ne raconte pas tout le mois.
    const montrerCumul = donnees.cumul_periode.nb_versements > 1

    return (
        <DocumentRapport
            boutique={donnees.boutique}
            titre="BULLETIN DE PAIE"
            sousTitre={`${e.nom_complet} — au titre de ${v.au_titre_de}`}
            genereLe={donnees.genere_le}
            pied={`${donnees.boutique.nom} — Bulletin ${v.public_id} — Manetec Gestock`}
        >
            {v.est_annule && (
                <Encart
                    ton="alerte"
                    titre="Versement annulé"
                    texte={
                        (v.motif_annulation ? `Motif : ${v.motif_annulation}. ` : '') +
                        'Ce bulletin est conservé pour mémoire : le versement ne compte dans aucun total.'
                    }
                />
            )}

            <BlocInfos infos={[
                { label: 'Employé',       valeur: e.nom_complet },
                { label: 'Poste',         valeur: e.poste ?? '—' },
                { label: 'Embauché le',   valeur: e.date_embauche ? formatDatePDF(e.date_embauche) : '—' },
            ]} />

            <BlocInfos infos={[
                { label: 'Au titre de',   valeur: v.au_titre_de },
                { label: 'Versé le',      valeur: formatDatePDF(v.date_paiement) },
                { label: 'Moyen',         valeur: MOYENS[v.moyen] ?? v.moyen },
                { label: 'Référence',     valeur: v.reference ?? '—' },
            ]} />

            <SectionTitre>Détail du versement</SectionTitre>

            <TableauRapport
                colonnes={colonnes}
                lignes={lignes}
                totaux={['NET VERSÉ', '', fmt(v.montant_net)]}
            />

            <View style={{
                marginTop: 12, padding: 10, borderRadius: 4,
                backgroundColor: couleurs.fondClair,
                borderLeftWidth: 3, borderLeftColor: couleurs.primaire,
            }}>
                <Text style={{ fontSize: 7, color: couleurs.texteFaible }}>
                    Net versé, en toutes lettres
                </Text>
                <Text style={{ fontSize: 9, fontFamily: 'Helvetica-Bold', marginTop: 2 }}>
                    {nombreEnLettresPDF(v.montant_net)} {deviseEnLettresPDF(d)}
                </Text>
            </View>

            {montrerCumul && (
                <>
                    <SectionTitre>Cumul pour {v.au_titre_de}</SectionTitre>
                    <BlocInfos infos={[
                        { label: 'Versements',  valeur: String(donnees.cumul_periode.nb_versements) },
                        { label: 'Total reçu',  valeur: fmt(donnees.cumul_periode.total_verse) },
                        { label: 'Dont ce bulletin', valeur: fmt(v.montant_net) },
                    ]} />
                    <NotePDF>
                        Ce mois a fait l&apos;objet de plusieurs versements (acompte puis solde).
                        Le présent bulletin ne couvre que celui du {formatDatePDF(v.date_paiement)}.
                    </NotePDF>
                </>
            )}

            {v.note && <NotePDF>Note : {v.note}</NotePDF>}

            {/* Signatures : un bulletin se remet en main propre. */}
            <View style={{ flexDirection: 'row', gap: 40, marginTop: 28 }}>
                <View style={{ flex: 1 }}>
                    <Text style={{ fontSize: 8, color: couleurs.texteFaible }}>
                        Pour {donnees.boutique.nom}
                    </Text>
                    <View style={{
                        marginTop: 26, borderTopWidth: 1, borderTopColor: couleurs.bordure,
                    }} />
                </View>
                <View style={{ flex: 1 }}>
                    <Text style={{ fontSize: 8, color: couleurs.texteFaible }}>
                        Signature de l&apos;employé
                    </Text>
                    <View style={{
                        marginTop: 26, borderTopWidth: 1, borderTopColor: couleurs.bordure,
                    }} />
                </View>
            </View>
        </DocumentRapport>
    )
}
