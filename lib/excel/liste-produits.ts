// lib/excel/liste-produits.ts
// ═══════════════════════════════════════════════════════════════
// Export Excel de la liste des produits.
//
// Un fichier prêt à imprimer, pas un vidage de tableau :
//   - bloc d'en-tête (boutique, titre, date, filtre appliqué) ;
//   - colonnes : code article, désignation, prix unitaire de vente,
//     une quantité par entrepôt (s'il y en a plusieurs), quantité
//     totale, total = quantité × prix ;
//   - bordures sur tout le tableau, lignes alternées, en-tête répété
//     sur chaque page imprimée, volets figés, filtre automatique ;
//   - zone d'impression posée, A4 ajusté à une page de large,
//     pied de page « Page x / y » ;
//   - totaux et montants en FORMULES : le fichier reste juste si
//     l'utilisateur corrige une quantité.
// ═══════════════════════════════════════════════════════════════

import ExcelJS from 'exceljs'

export interface ProduitExcel {
    public_id:  string
    nom:        string
    unite:      string
    prix_vente: number
    /** Quantité par entrepôt (id → quantité). */
    stocks:     Record<string, number>
}

export interface DonneesListeProduits {
    boutique:   { nom: string; devise: string }
    entrepots:  { id: string; nom: string }[]
    produits:   ProduitExcel[]
    filtre:     string | null
    edite_le:   string
}

const COULEURS = {
    marque:    'FF15335A',
    marqueClr: 'FFE8EEF6',
    alterne:   'FFF6F8FB',
    bordure:   'FFC9D2DE',
    texte:     'FF1F2937',
    gris:      'FF6B7280',
    blanc:     'FFFFFFFF',
}

const FIN    = { style: 'thin'   as const, color: { argb: COULEURS.bordure } }
const EPAIS  = { style: 'medium' as const, color: { argb: COULEURS.marque } }
const CADRE  = { top: FIN, left: FIN, bottom: FIN, right: FIN }

const FORMAT_MONTANT = '#,##0'

/**
 * Format de quantité portant l'unité : « 12 pièce », « 2,5 kg ».
 * Choisi CELLULE par cellule : un format à décimales afficherait
 * « 15. kg » pour une quantité entière.
 */
function formatQuantite(unite: string, valeur: number): string {
    const u = unite.replace(/"/g, '').trim()
    const base = Number.isInteger(valeur) ? '#,##0' : '#,##0.0##'
    return u ? `${base}" ${u}"` : base
}

function lettre(col: number): string {
    let s = ''
    for (let n = col; n > 0; n = Math.floor((n - 1) / 26)) s = String.fromCharCode(65 + ((n - 1) % 26)) + s
    return s
}

export async function genererListeProduitsExcel(d: DonneesListeProduits): Promise<Buffer> {
    const multi = d.entrepots.length > 1

    // ── Colonnes ───────────────────────────────────────────────
    type Col = { titre: string; largeur: number; type: 'texte' | 'designation' | 'montant' | 'quantite'; entrepot?: string }
    const colonnes: Col[] = [
        { titre: 'Code article',                       largeur: 14, type: 'texte' },
        { titre: 'Désignation',                        largeur: 42, type: 'designation' },
        { titre: `Prix unitaire\n(${d.boutique.devise})`, largeur: 15, type: 'montant' },
        ...(multi ? d.entrepots.map(e => ({ titre: `Qté\n${e.nom}`, largeur: 13, type: 'quantite' as const, entrepot: e.id })) : []),
        { titre: multi ? 'Qté totale' : 'Qté en stock', largeur: 14, type: 'quantite' },
        { titre: `Total\n(${d.boutique.devise})`,      largeur: 17, type: 'montant' },
    ]
    const nbCol      = colonnes.length
    const colPrix    = 3
    const colQteTot  = nbCol - 1
    const colTotal   = nbCol
    const derniere   = lettre(nbCol)

    const LIGNE_ENTETE = 5
    const premiere     = LIGNE_ENTETE + 1
    const ligneTotaux  = premiere + d.produits.length

    // ── Classeur et mise en page d'impression ──────────────────
    const classeur = new ExcelJS.Workbook()
    classeur.creator = 'Manetec Gestock'
    classeur.created = new Date()

    const feuille = classeur.addWorksheet('Produits', {
        properties: { defaultRowHeight: 18 },
        views: [{ state: 'frozen', ySplit: LIGNE_ENTETE, showGridLines: false }],
        pageSetup: {
            paperSize:          9,                       // A4
            orientation:        nbCol > 6 ? 'landscape' : 'portrait',
            fitToPage:          true,
            fitToWidth:         1,
            fitToHeight:        0,                       // autant de pages que nécessaire en hauteur
            horizontalCentered: true,
            margins: { left: 0.4, right: 0.4, top: 0.55, bottom: 0.6, header: 0.25, footer: 0.3 },
            printTitlesRow:     `${LIGNE_ENTETE}:${LIGNE_ENTETE}`, // en-tête du tableau répété sur chaque page
            printArea:          `A1:${derniere}${ligneTotaux}`,
        },
        headerFooter: {
            oddFooter: `&L&8${d.boutique.nom.replace(/&/g, '&&')}&C&8Page &P / &N&R&8Édité le ${d.edite_le}`,
        },
    })

    feuille.columns = colonnes.map(c => ({ width: c.largeur }))

    // ── Bloc d'en-tête ─────────────────────────────────────────
    const titre = (ligne: number, texte: string, taille: number, gras: boolean, couleur: string, hauteur: number) => {
        feuille.mergeCells(ligne, 1, ligne, nbCol)
        const c = feuille.getCell(ligne, 1)
        c.value = texte
        c.font = { name: 'Calibri', size: taille, bold: gras, color: { argb: couleur } }
        c.alignment = { vertical: 'middle', horizontal: 'center' }
        feuille.getRow(ligne).height = hauteur
    }
    titre(1, d.boutique.nom.toUpperCase(), 15, true, COULEURS.marque, 24)
    titre(2, 'Liste des produits et état du stock', 12, true, COULEURS.texte, 19)
    titre(3, [
        `Édité le ${d.edite_le}`,
        `${d.produits.length} article${d.produits.length > 1 ? 's' : ''}`,
        'valeurs au prix de vente',
        d.filtre ? `filtre : ${d.filtre}` : null,
    ].filter(Boolean).join('  ·  '), 9, false, COULEURS.gris, 16)
    feuille.getRow(4).height = 8
    for (let col = 1; col <= nbCol; col++) feuille.getCell(3, col).border = { bottom: EPAIS }

    // ── En-tête du tableau ─────────────────────────────────────
    const entete = feuille.getRow(LIGNE_ENTETE)
    // Assez haut pour trois lignes : « Qté » + un nom d'entrepôt sur deux lignes.
    entete.height = multi ? 46 : 32
    colonnes.forEach((c, i) => {
        const cell = entete.getCell(i + 1)
        cell.value = c.titre
        cell.font = { name: 'Calibri', size: 10, bold: true, color: { argb: COULEURS.blanc } }
        cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: COULEURS.marque } }
        cell.alignment = {
            vertical: 'middle', wrapText: true,
            horizontal: 'center',
        }
        cell.border = CADRE
    })

    // ── Lignes produits ────────────────────────────────────────
    d.produits.forEach((p, i) => {
        const n     = premiere + i
        const ligne = feuille.getRow(n)
        const quantites = d.entrepots.map(e => p.stocks[e.id] ?? 0)
        const qteTotale = quantites.reduce((s, q) => s + q, 0)

        colonnes.forEach((c, j) => {
            const cell = ligne.getCell(j + 1)
            const col  = j + 1

            if (col === 1) cell.value = p.public_id
            else if (col === 2) cell.value = p.nom
            else if (col === colPrix) cell.value = Number(p.prix_vente)
            else if (c.entrepot) cell.value = p.stocks[c.entrepot] ?? 0
            else if (col === colQteTot) {
                cell.value = multi
                    ? { formula: `SUM(${lettre(colPrix + 1)}${n}:${lettre(colQteTot - 1)}${n})`, result: qteTotale }
                    : qteTotale
            } else if (col === colTotal) {
                cell.value = { formula: `${lettre(colPrix)}${n}*${lettre(colQteTot)}${n}`, result: Number(p.prix_vente) * qteTotale }
            }

            cell.font = {
                name: 'Calibri', size: 10,
                bold: col === colTotal || col === colQteTot,
                color: { argb: c.type === 'quantite' && Number((cell.value as { result?: number })?.result ?? cell.value) < 0 ? 'FFB42318' : COULEURS.texte },
            }
            if (c.type === 'montant')  cell.numFmt = FORMAT_MONTANT
            if (c.type === 'quantite') {
                const v = c.entrepot ? (p.stocks[c.entrepot] ?? 0) : qteTotale
                cell.numFmt = formatQuantite(p.unite, v)
            }
            cell.alignment = {
                vertical: 'middle',
                // Demande de l'utilisateur : tout le contenu du tableau est centré.
                horizontal: 'center',
                wrapText: c.type === 'designation',
            }
            cell.border = CADRE
            if (i % 2 === 1) cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: COULEURS.alterne } }
        })
        // Une désignation longue passe sur deux lignes plutôt que d'être coupée.
        ligne.height = p.nom.length > 46 ? 30 : 18
    })

    // ── Ligne de totaux ────────────────────────────────────────
    const totaux = feuille.getRow(ligneTotaux)
    totaux.height = 22
    feuille.mergeCells(ligneTotaux, 1, ligneTotaux, colPrix)
    const libelle = totaux.getCell(1)
    libelle.value = `TOTAL — ${d.produits.length} article${d.produits.length > 1 ? 's' : ''}`
    const valeurTotale = d.produits.reduce((s, p) =>
        s + Number(p.prix_vente) * d.entrepots.reduce((q, e) => q + (p.stocks[e.id] ?? 0), 0), 0)
    const cellTotal = totaux.getCell(colTotal)
    cellTotal.value = d.produits.length
        ? { formula: `SUM(${lettre(colTotal)}${premiere}:${lettre(colTotal)}${ligneTotaux - 1})`, result: valeurTotale }
        : 0
    cellTotal.numFmt = FORMAT_MONTANT

    for (let col = 1; col <= nbCol; col++) {
        const cell = totaux.getCell(col)
        cell.font = { name: 'Calibri', size: 11, bold: true, color: { argb: COULEURS.marque } }
        cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: COULEURS.marqueClr } }
        // Centré comme le reste du tableau (cellules 1 à colPrix fusionnées).
        cell.alignment = { vertical: 'middle', horizontal: 'center' }
        // Les quantités ne s'additionnent pas entre unités différentes
        // (pièces et kilos) : seule la valeur est totalisée.
        cell.border = { top: EPAIS, left: FIN, bottom: EPAIS, right: FIN }
    }

    // Le filtre couvre les produits SEULEMENT : un tri ne doit jamais
    // déplacer la ligne de totaux au milieu du tableau.
    feuille.autoFilter = {
        from: { row: LIGNE_ENTETE, column: 1 },
        to:   { row: Math.max(LIGNE_ENTETE, ligneTotaux - 1), column: nbCol },
    }

    return Buffer.from(await classeur.xlsx.writeBuffer())
}
