// lib/csv/serialiser.ts
// ═══════════════════════════════════════════════════════════════
// Un CSV qui s'ouvre correctement dans le tableur du gérant.
//
// Décision D3 : l'export ne concerne que les rapports qui SONT des
// listes — ventes, mouvements, clients, impayés, retours. Un compte
// de résultat ou un bulletin de paie sont des documents mis en page ;
// les aplatir en colonnes n'aurait aucun sens.
//
// Deux choix qui paraissent des détails et n'en sont pas :
//
// · Le séparateur est le POINT-VIRGULE. Excel en configuration
//   française attend celui-là ; avec une virgule, tout le fichier
//   arrive dans une seule colonne et le gérant conclut que l'export
//   est cassé.
//
// · Le fichier commence par un BOM UTF-8. Sans lui, Excel lit les
//   accents en ANSI et « Dépôt » devient « DÃ©pÃ´t ».
//
// Les nombres sortent avec une VIRGULE décimale et sans séparateur
// de milliers : c'est ce qu'un tableur français reconnaît comme un
// nombre. Un montant format é « 1 200 000 FCFA » serait du texte.
// ═══════════════════════════════════════════════════════════════

export const BOM_UTF8 = '﻿'

export type ValeurCSV = string | number | boolean | null | undefined

export interface ColonneCSV<T> {
    entete: string
    valeur: (ligne: T) => ValeurCSV
}

/** Un champ CSV : guillemets doublés, et entouré dès qu'il en a besoin. */
function echapper(valeur: ValeurCSV): string {
    if (valeur === null || valeur === undefined) return ''

    if (typeof valeur === 'number') {
        if (!Number.isFinite(valeur)) return ''
        // Virgule décimale, pas de séparateur de milliers.
        return String(valeur).replace('.', ',')
    }

    if (typeof valeur === 'boolean') return valeur ? 'oui' : 'non'

    const texte = String(valeur)
    // Un texte qui commence par =, +, - ou @ est interprété comme une
    // formule par les tableurs : on le neutralise avec une apostrophe.
    const sur = /^[=+\-@]/.test(texte) ? `'${texte}` : texte

    return /[";\r\n]/.test(sur) ? `"${sur.replace(/"/g, '""')}"` : sur
}

export function versCSV<T>(colonnes: ColonneCSV<T>[], lignes: T[]): string {
    const entete = colonnes.map(c => echapper(c.entete)).join(';')
    const corps  = lignes.map(l => colonnes.map(c => echapper(c.valeur(l))).join(';'))

    // CRLF : la fin de ligne que les tableurs Windows attendent.
    return BOM_UTF8 + [entete, ...corps].join('\r\n') + '\r\n'
}

/** Réponse HTTP prête à télécharger. */
export function reponseCSV(contenu: string, nomFichier: string): Response {
    return new Response(contenu, {
        headers: {
            'Content-Type':        'text/csv; charset=utf-8',
            'Content-Disposition': `attachment; filename="${nomFichier}"`,
        },
    })
}
