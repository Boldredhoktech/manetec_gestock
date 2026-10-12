// lib/produits/filtre-liste.ts
// Le filtre de la liste des produits, partagé par l'écran et l'export
// Excel : le fichier contient exactement ce que l'utilisateur voit, sans
// que le serveur ait à croire une liste envoyée par le navigateur.

export type FiltreProduits = { recherche: string; type: string }

type ProduitFiltrable = {
    nom:          string
    sku:          string | null
    public_id:    string
    type_produit: string
}

export const TYPES_PRODUIT: Record<string, string> = {
    simple:   'Simple',
    ponderal: 'Pondéral',
    kit:      'Kit',
}

export function filtrerProduits<T extends ProduitFiltrable>(produits: T[], filtre: FiltreProduits): T[] {
    const terme = filtre.recherche.trim().toLowerCase()
    return produits.filter(p => {
        const matchR = !terme
            || p.nom.toLowerCase().includes(terme)
            || (p.sku ?? '').toLowerCase().includes(terme)
            || p.public_id.toLowerCase().includes(terme)
        const matchT = filtre.type === 'tous' || p.type_produit === filtre.type
        return matchR && matchT
    })
}
