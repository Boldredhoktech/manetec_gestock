// lib/facturation/calcul.ts
// Les montants d'une facture, calculés au même endroit à la création et
// à la modification : deux calculs auraient fini par diverger.

export interface LigneACalculer {
    product_id:    string | null
    designation:   string
    quantite:      number
    prix_unitaire: number
    remise_pct?:   number
    tva_pct:       number
}

/** Facture client : remise par ligne, puis remise globale sur le HT. */
export function calculerFactureClient(lignes: LigneACalculer[], remisePct: number) {
    let montantHT = 0, montantTVA = 0

    const lignesCalc = lignes.map((l, i) => {
        const remisePctLigne = l.remise_pct ?? 0
        const remiseVal = l.prix_unitaire * l.quantite * remisePctLigne / 100
        const ht        = l.prix_unitaire * l.quantite - remiseVal
        const tva       = ht * l.tva_pct / 100
        montantHT  += ht
        montantTVA += tva
        return {
            ...l, remise_pct: remisePctLigne, remise_val: remiseVal,
            montant_ht: ht, montant_tva: tva, montant_ttc: ht + tva, ordre: i,
        }
    })

    const remiseGlobaleVal = montantHT * remisePct / 100
    const montantHTFinal   = montantHT - remiseGlobaleVal

    return {
        lignes: lignesCalc,
        totaux: {
            remise_pct:  remisePct,
            remise_val:  remiseGlobaleVal,
            montant_ht:  montantHTFinal,
            montant_tva: montantTVA,
            montant_ttc: montantHTFinal + montantTVA,
        },
    }
}

/** Facture fournisseur : ni remise de ligne ni remise globale. */
export function calculerFactureFournisseur(lignes: LigneACalculer[]) {
    let montantHT = 0, montantTVA = 0

    const lignesCalc = lignes.map((l, i) => {
        const ht  = l.quantite * l.prix_unitaire
        const tva = ht * l.tva_pct / 100
        montantHT  += ht
        montantTVA += tva
        return { ...l, montant_ht: ht, montant_tva: tva, montant_ttc: ht + tva, ordre: i }
    })

    return {
        lignes: lignesCalc,
        totaux: { montant_ht: montantHT, montant_tva: montantTVA, montant_ttc: montantHT + montantTVA },
    }
}
