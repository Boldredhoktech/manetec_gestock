// ═══════════════════════════════════════════════════════════════
// Lecture d'un fichier Excel d'import (mig 042) — côté serveur.
//
// On ne suppose pas que le fichier vient intact du modèle : la ligne
// d'en-tête est cherchée dans les 15 premières lignes, les colonnes sont
// reconnues par leur intitulé (accents, casse et * ignorés, alias admis),
// et les nombres saisis « 150 000 » ou « 1 250,50 » sont compris.
// ═══════════════════════════════════════════════════════════════

import ExcelJS from 'exceljs'
import {
    COLONNES, colonneDepuisEntete, MAX_LIGNES_IMPORT,
    type Colonne, type LigneImport, type TypeImport,
} from '@/lib/import/colonnes'

export interface FichierLu {
    lignes:            LigneImport[]
    colonnesTrouvees:  string[]
    enteteInconnues:   string[]
    erreurFichier?:    string
}

function texteCellule(v: ExcelJS.CellValue): string {
    if (v === null || v === undefined) return ''
    if (typeof v === 'object') {
        if (v instanceof Date) return v.toISOString().slice(0, 10)
        if ('result' in v) return texteCellule((v as ExcelJS.CellFormulaValue).result as ExcelJS.CellValue)
        if ('richText' in v) return (v as ExcelJS.CellRichTextValue).richText.map(r => r.text).join('')
        if ('text' in v) return String((v as ExcelJS.CellHyperlinkValue).text)
        if ('error' in v) return ''
    }
    return String(v)
}

/** « 150 000 », « 1 250,50 », « 2 500 F » → nombre ; NaN si illisible. */
export function lireNombre(brut: string): number {
    const s = brut.replace(/[\s  ]/g, '').replace(/(fcfa|cfa|xof|f)$/i, '')
    if (!s) return NaN
    const normal = /,\d{1,2}$/.test(s) ? s.replace(/\./g, '').replace(',', '.') : s.replace(/,/g, '')
    return /^-?\d+(\.\d+)?$/.test(normal) ? Number(normal) : NaN
}

function lireOuiNon(brut: string): boolean | null {
    const k = brut.trim().toLowerCase()
    if (!k) return null
    if (['oui', 'o', 'yes', 'y', 'x', '1', 'vrai', 'true'].includes(k)) return true
    if (['non', 'n', 'no', '0', 'faux', 'false'].includes(k)) return false
    return null
}

export async function lireFichierImport(type: TypeImport, contenu: ArrayBuffer): Promise<FichierLu> {
    const classeur = new ExcelJS.Workbook()
    try {
        await classeur.xlsx.load(contenu)
    } catch {
        return { lignes: [], colonnesTrouvees: [], enteteInconnues: [], erreurFichier: 'Fichier illisible : enregistrez-le au format Excel (.xlsx).' }
    }
    const feuille = classeur.getWorksheet('Données') ?? classeur.worksheets[0]
    if (!feuille) return { lignes: [], colonnesTrouvees: [], enteteInconnues: [], erreurFichier: 'Le fichier ne contient aucune feuille.' }

    // Ligne d'en-tête : la première qui contient la colonne obligatoire « nom ».
    let ligneEntete = 0
    const parColonne = new Map<number, Colonne>()
    const inconnues: string[] = []
    for (let r = 1; r <= Math.min(15, feuille.rowCount); r++) {
        const row = feuille.getRow(r)
        const trouvees = new Map<number, Colonne>()
        row.eachCell((cell, col) => {
            const c = colonneDepuisEntete(type, texteCellule(cell.value))
            if (c) trouvees.set(col, c)
        })
        if ([...trouvees.values()].some(c => c.cle === 'nom')) {
            ligneEntete = r
            trouvees.forEach((c, col) => parColonne.set(col, c))
            row.eachCell((cell, col) => {
                const t = texteCellule(cell.value).trim()
                if (t && !trouvees.has(col) && !/motif du rejet/i.test(t)) inconnues.push(t)
            })
            break
        }
    }
    if (!ligneEntete) {
        const attendu = COLONNES[type].filter(c => c.obligatoire).map(c => `« ${c.titre} »`).join(' et ')
        return { lignes: [], colonnesTrouvees: [], enteteInconnues: [], erreurFichier: `Ligne d'en-tête introuvable : le fichier doit avoir une colonne ${attendu}. Partez du modèle téléchargeable.` }
    }

    const lignes: LigneImport[] = []
    for (let r = ligneEntete + 1; r <= feuille.rowCount; r++) {
        const row = feuille.getRow(r)
        const valeurs: LigneImport = { ligne: r }
        let vide = true
        parColonne.forEach((c, col) => {
            const brut = texteCellule(row.getCell(col).value).trim()
            if (!brut) { valeurs[c.cle] = null; return }
            vide = false
            if (c.genre === 'nombre') {
                const n = lireNombre(brut)
                valeurs[c.cle] = Number.isNaN(n) ? `!${brut}` : n
            } else if (c.genre === 'ouinon') {
                const b = lireOuiNon(brut)
                valeurs[c.cle] = b === null ? `!${brut}` : b
            } else {
                valeurs[c.cle] = brut
            }
        })
        if (!vide) lignes.push(valeurs)
        if (lignes.length > MAX_LIGNES_IMPORT) {
            return { lignes: [], colonnesTrouvees: [], enteteInconnues: [], erreurFichier: `Trop de lignes : ${MAX_LIGNES_IMPORT} au maximum par fichier. Découpez-le.` }
        }
    }

    return {
        lignes,
        colonnesTrouvees: [...new Set([...parColonne.values()].map(c => c.cle))],
        enteteInconnues: inconnues,
    }
}
