// lib/excel/modele-import.ts
// ═══════════════════════════════════════════════════════════════
// Modèle Excel d'import (mig 042), même mise en page que les exports
// (lib/excel/liste-produits.ts) : tout centré, bordures, en-tête figé et
// répété à l'impression.
//   • feuille « Données » : bloc de titre, puis l'en-tête (ligne 5) et
//     les lignes à remplir. Colonnes obligatoires en jaune, marquées * ;
//   • listes déroulantes : Oui/Non, entrepôts de la boutique ;
//   • feuille « Mode d'emploi » : chaque colonne, son rôle, un exemple ;
//   • `lignes` (facultatif) pré-remplit les données — c'est ainsi qu'on
//     rend les lignes rejetées, avec une colonne « Motif du rejet ».
// ═══════════════════════════════════════════════════════════════

import ExcelJS from 'exceljs'
import { COLONNES, LIBELLES_IMPORT, type TypeImport } from '@/lib/import/colonnes'

const C = {
    bleu:      'FF1D4ED8',
    marine:    'FF0B1F4D',
    jaune:     'FFFACC15',
    jauneDoux: 'FFFEF6C7',
    rougeDoux: 'FFFDE6E6',
    rouge:     'FFB01C1C',
    bordure:   'FFC9D2DE',
    gris:      'FF566079',
    alterne:   'FFF6F8FB',
    blanc:     'FFFFFFFF',
    texte:     'FF0E1630',
}
const FIN   = { style: 'thin' as const, color: { argb: C.bordure } }
const CADRE = { top: FIN, left: FIN, bottom: FIN, right: FIN }
export const LIGNE_ENTETE_IMPORT = 5

export async function genererModeleImport(opts: {
    type:       TypeImport
    boutique:   string
    entrepots:  string[]
    lignes?:    { valeurs: Record<string, unknown>; motif?: string }[]
}): Promise<Buffer> {
    const colonnes = COLONNES[opts.type]
    const avecMotif = !!opts.lignes?.some(l => l.motif)
    const nbCol = colonnes.length + (avecMotif ? 1 : 0)
    const nbVides = Math.max(200, (opts.lignes?.length ?? 0) + 50)
    const premiere = LIGNE_ENTETE_IMPORT + 1
    const derniere = LIGNE_ENTETE_IMPORT + nbVides

    const classeur = new ExcelJS.Workbook()
    classeur.creator = 'Manetec Gestock'
    classeur.created = new Date()

    // ── Feuille Données ────────────────────────────────────────
    const f = classeur.addWorksheet('Données', {
        properties: { defaultRowHeight: 18 },
        views: [{ state: 'frozen', ySplit: LIGNE_ENTETE_IMPORT, showGridLines: false }],
        pageSetup: {
            paperSize: 9, orientation: 'landscape', fitToPage: true, fitToWidth: 1, fitToHeight: 0,
            horizontalCentered: true,
            margins: { left: 0.3, right: 0.3, top: 0.5, bottom: 0.5, header: 0.25, footer: 0.3 },
            printTitlesRow: `${LIGNE_ENTETE_IMPORT}:${LIGNE_ENTETE_IMPORT}`,
        },
        headerFooter: { oddFooter: `&C&8Page &P / &N` },
    })
    f.columns = [
        ...colonnes.map(c => ({ width: c.largeur })),
        ...(avecMotif ? [{ width: 42 }] : []),
    ]

    const titre = (ligne: number, texte: string, taille: number, gras: boolean, couleur: string, hauteur: number) => {
        f.mergeCells(ligne, 1, ligne, nbCol)
        const c = f.getCell(ligne, 1)
        c.value = texte
        c.font = { name: 'Calibri', size: taille, bold: gras, color: { argb: couleur } }
        c.alignment = { vertical: 'middle', horizontal: 'center', wrapText: true }
        f.getRow(ligne).height = hauteur
    }
    titre(1, opts.boutique.toUpperCase(), 15, true, C.marine, 24)
    titre(2, `Import — ${LIBELLES_IMPORT[opts.type]}${avecMotif ? ' (lignes rejetées à corriger)' : ''}`, 12, true, C.texte, 19)
    titre(3, 'Remplissez une ligne par élément à partir de la ligne 6. Colonnes en jaune (*) obligatoires, les autres facultatives. Voir l\'onglet « Mode d\'emploi ».', 9, false, C.gris, 28)
    f.getRow(4).height = 6

    const entete = f.getRow(LIGNE_ENTETE_IMPORT)
    entete.height = 34
    colonnes.forEach((c, i) => {
        const cell = entete.getCell(i + 1)
        cell.value = c.obligatoire ? `${c.titre} *` : c.titre
        cell.font = { name: 'Calibri', size: 10, bold: true, color: { argb: c.obligatoire ? C.texte : C.blanc } }
        cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: c.obligatoire ? C.jaune : C.bleu } }
        cell.alignment = { vertical: 'middle', horizontal: 'center', wrapText: true }
        cell.border = CADRE
        if (c.aide) cell.note = c.aide
    })
    if (avecMotif) {
        const cell = entete.getCell(nbCol)
        cell.value = 'Motif du rejet (à supprimer ou laisser)'
        cell.font = { name: 'Calibri', size: 10, bold: true, color: { argb: C.rouge } }
        cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: C.rougeDoux } }
        cell.alignment = { vertical: 'middle', horizontal: 'center', wrapText: true }
        cell.border = CADRE
    }

    // Listes déroulantes : Oui/Non, entrepôts (une liste Excel « en dur »
    // est limitée à 255 caractères).
    const listeEntrepots = (() => {
        const l = opts.entrepots.map(e => e.replace(/[",]/g, ' ')).join(',')
        return l && l.length < 250 ? l : null
    })()

    // Lignes : pré-remplies (rejets) puis vides, toutes encadrées.
    for (let r = premiere; r <= derniere; r++) {
        const row = f.getRow(r)
        const donnee = opts.lignes?.[r - premiere]
        colonnes.forEach((c, i) => {
            const cell = row.getCell(i + 1)
            const brut = donnee?.valeurs[c.cle]
            // « !abc » : valeur illisible marquée à la lecture ; on rend ce qui avait été saisi.
            const v = typeof brut === 'string' && brut.startsWith('!') ? brut.slice(1) : brut
            if (v !== undefined && v !== null && v !== '') {
                cell.value = c.genre === 'ouinon' ? (v === true || v === 'true' ? 'Oui' : 'Non')
                    : c.genre === 'nombre' && !Number.isNaN(Number(v)) ? Number(v) : String(v)
            }
            if (c.genre === 'nombre') {
                cell.numFmt = '#,##0.##'
                cell.dataValidation = { type: 'decimal', operator: 'greaterThanOrEqual', allowBlank: true, formulae: [0],
                    showErrorMessage: true, errorTitle: 'Nombre attendu', error: 'Saisissez un nombre positif, sans espace ni devise.' }
            }
            if (c.genre === 'ouinon') {
                cell.dataValidation = { type: 'list', allowBlank: true, formulae: ['"Oui,Non"'],
                    showErrorMessage: true, errorTitle: 'Oui ou Non', error: 'Choisissez Oui ou Non.' }
            }
            if (c.genre === 'entrepot' && listeEntrepots) {
                cell.dataValidation = { type: 'list', allowBlank: true, formulae: [`"${listeEntrepots}"`],
                    showErrorMessage: true, errorTitle: 'Entrepôt inconnu', error: 'Choisissez un entrepôt de la liste.' }
            }
            if (c.genre === 'texte' && (c.cle === 'telephone' || c.cle === 'code_barres' || c.cle === 'ifu')) cell.numFmt = '@'
            cell.alignment = { vertical: 'middle', horizontal: 'center', wrapText: c.cle === 'nom' }
            cell.border = CADRE
            cell.font = { name: 'Calibri', size: 10, color: { argb: C.texte } }
            if ((r - premiere) % 2 === 1) cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: C.alterne } }
        })
        if (avecMotif) {
            const cell = row.getCell(nbCol)
            if (donnee?.motif) cell.value = donnee.motif
            cell.alignment = { vertical: 'middle', horizontal: 'center', wrapText: true }
            cell.border = CADRE
            cell.font = { name: 'Calibri', size: 9, color: { argb: C.rouge } }
        }
    }

    // ── Feuille Mode d'emploi ─────────────────────────────────
    const m = classeur.addWorksheet('Mode d\'emploi', {
        views: [{ showGridLines: false }],
        pageSetup: {
            paperSize: 9, orientation: 'portrait', fitToPage: true, fitToWidth: 1, fitToHeight: 0,
            horizontalCentered: true,
            margins: { left: 0.4, right: 0.4, top: 0.5, bottom: 0.5, header: 0.25, footer: 0.3 },
        },
    })
    m.columns = [{ width: 24 }, { width: 14 }, { width: 70 }, { width: 24 }]
    m.mergeCells(1, 1, 1, 4)
    const t = m.getCell(1, 1)
    t.value = `Mode d'emploi — ${LIBELLES_IMPORT[opts.type]}`
    t.font = { name: 'Calibri', size: 14, bold: true, color: { argb: C.marine } }
    t.alignment = { horizontal: 'center', vertical: 'middle' }
    m.getRow(1).height = 26

    const consignes = [
        'Une ligne par élément, à partir de la ligne 6 de l\'onglet « Données ». Ne modifiez pas la ligne d\'en-tête.',
        opts.type === 'produits'
            ? 'Un même produit présent dans plusieurs entrepôts : une ligne par entrepôt (même désignation).'
            : 'Un élément déjà enregistré dans Manetec est ignoré : il ne sera ni modifié ni dupliqué.',
        'Les montants s\'écrivent sans espace ni devise : 150000 et non « 150 000 F ».',
        'Les soldes d\'ouverture sont datés de la date de démarrage choisie à l\'import ; ils ne comptent ni dans le chiffre d\'affaires ni dans les achats.',
        'Les lignes correctes sont importées ; les autres sont listées avec leur motif et peuvent être retéléchargées pour correction.',
    ]
    consignes.forEach((txt, i) => {
        m.mergeCells(3 + i, 1, 3 + i, 4)
        const c = m.getCell(3 + i, 1)
        c.value = `• ${txt}`
        c.font = { name: 'Calibri', size: 10, color: { argb: C.texte } }
        c.alignment = { horizontal: 'center', vertical: 'middle', wrapText: true }
        m.getRow(3 + i).height = 30
    })

    const ligneTable = 3 + consignes.length + 1
    ;['Colonne', 'Obligatoire', 'À quoi elle sert', 'Exemple'].forEach((h, i) => {
        const c = m.getCell(ligneTable, i + 1)
        c.value = h
        c.font = { name: 'Calibri', size: 10, bold: true, color: { argb: C.blanc } }
        c.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: C.marine } }
        c.alignment = { horizontal: 'center', vertical: 'middle' }
        c.border = CADRE
    })
    colonnes.forEach((col, i) => {
        const r = ligneTable + 1 + i
        const vals = [col.titre, col.obligatoire ? 'Oui' : 'Non', col.aide || '—', String(col.exemple)]
        vals.forEach((v, j) => {
            const c = m.getCell(r, j + 1)
            c.value = v
            c.font = { name: 'Calibri', size: 10, bold: j === 0, color: { argb: C.texte } }
            c.alignment = { horizontal: 'center', vertical: 'middle', wrapText: true }
            c.border = CADRE
            if (col.obligatoire) c.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: C.jauneDoux } }
        })
        m.getRow(r).height = 30
    })

    return Buffer.from(await classeur.xlsx.writeBuffer())
}
