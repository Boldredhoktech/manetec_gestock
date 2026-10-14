// lib/ventes/identifiants.ts
// IMEI et numéros de série des appareils vendus.
//
// Constaté le 2026-10-14 (FAVEUR INFORMATIQUE) : le POS ne contrôlait
// que l'IMEI, et seulement dans le navigateur ; « numéro de série
// obligatoire » n'était vérifié nulle part. La règle vit ici et sert au
// comptoir comme au serveur. Un numéro par appareil vendu : deux
// ordinateurs sur une ligne = deux numéros, séparés par une virgule.
// Les deux identifiants partagent la colonne sale_items.imei.

export interface ExigenceIdentifiant {
    necessite_imei:  boolean
    necessite_serie: boolean
}

export function exigeIdentifiant(p: ExigenceIdentifiant): boolean {
    return p.necessite_imei || p.necessite_serie
}

/** « IMEI », « N° de série », ou les deux. */
export function libelleIdentifiant(p: ExigenceIdentifiant): string {
    if (p.necessite_imei && p.necessite_serie) return 'IMEI / N° de série'
    return p.necessite_imei ? 'IMEI' : 'N° de série'
}

/** Les numéros saisis, un par appareil (virgule, point-virgule ou retour à la ligne). */
export function identifiantsSaisis(texte: string | null | undefined): string[] {
    return (texte ?? '').split(/[,;\n]+/).map(n => n.trim()).filter(Boolean)
}

/** Message d'erreur si la ligne n'a pas un numéro distinct par appareil, sinon null. */
export function controleIdentifiants(
    ligne: { nom: string; quantite: number; imei: string | null | undefined },
    produit: ExigenceIdentifiant,
): string | null {
    if (!exigeIdentifiant(produit)) return null

    const libelle  = libelleIdentifiant(produit)
    const numeros  = identifiantsSaisis(ligne.imei)
    const attendus = Math.ceil(Number(ligne.quantite))

    if (numeros.length === 0) {
        return `${libelle} manquant pour « ${ligne.nom} ». Saisissez-le avant d'encaisser.`
    }
    if (numeros.length !== attendus) {
        return `« ${ligne.nom} » : ${attendus} appareil(s) vendu(s), ${numeros.length} ${libelle} saisi(s). Il en faut un par appareil, séparés par une virgule.`
    }
    if (new Set(numeros.map(n => n.toUpperCase())).size !== numeros.length) {
        return `« ${ligne.nom} » : le même ${libelle} est saisi deux fois.`
    }
    return null
}
