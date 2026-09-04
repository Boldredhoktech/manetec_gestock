'use client'

import { useEffect, useRef, useState } from 'react'

// ═══════════════════════════════════════════════════════════════
// Panier persistant — décision D4 du module POS.
//
// Le panier vivait dans l'état React de la page : un rafraîchissement,
// un onglet fermé, une coupure de courant — fréquente — et tout était
// perdu. Il n'existait pas non plus de mise en attente, alors que
// mettre de côté un client qui cherche sa monnaie pour servir le
// suivant est le geste le plus courant d'un comptoir.
//
// DANS LE NAVIGATEUR, jamais en base : le panier n'engage rien tant
// qu'il n'est pas encaissé. Le conserver localement le protège des
// coupures sans encombrer la base de brouillons abandonnés.
//
// `localStorage` peut lever (navigation privée, site data bloqué) ou
// revenir vide : chaque accès est protégé et le comptoir fonctionne
// exactement comme avant si rien n'est disponible.
// ═══════════════════════════════════════════════════════════════

function lire<T>(cle: string, defaut: T): T {
    if (typeof window === 'undefined') return defaut
    try {
        const brut = window.localStorage.getItem(cle)
        return brut ? (JSON.parse(brut) as T) : defaut
    } catch {
        return defaut
    }
}

function ecrire(cle: string, valeur: unknown) {
    if (typeof window === 'undefined') return
    try {
        window.localStorage.setItem(cle, JSON.stringify(valeur))
    } catch {
        // Quota plein ou stockage refusé : le comptoir continue, sans
        // persistance. Ce n'est pas une erreur à remonter au caissier.
    }
}

function effacer(cle: string) {
    if (typeof window === 'undefined') return
    try {
        window.localStorage.removeItem(cle)
    } catch { /* voir ci-dessus */ }
}

/**
 * État persisté dans le navigateur, restauré au montage.
 * La clé porte la boutique : deux boutiques sur le même poste ne
 * partagent pas leur comptoir.
 */
export function useEtatPersistant<T>(cle: string, defaut: T) {
    const [valeur, setValeur] = useState<T>(defaut)
    // Le rendu serveur ne connaît pas localStorage : on restaure après
    // le montage pour que les deux rendus coïncident.
    const monte = useRef(false)

    useEffect(() => {
        setValeur(lire(cle, defaut))
        monte.current = true
        // On ne relit qu'au changement de clé, jamais sur `defaut`.
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [cle])

    useEffect(() => {
        if (!monte.current) return
        ecrire(cle, valeur)
    }, [cle, valeur])

    function vider() {
        setValeur(defaut)
        effacer(cle)
    }

    return [valeur, setValeur, vider] as const
}

export interface PanierEnAttente<L> {
    id:         string
    libelle:    string
    lignes:     L[]
    clientId:   string | null
    clientNom:  string | null
    remisePct:  number
    note:       string
    misEnAttenteLe: string
}

/** Les paniers mis de côté, pour servir un second client. */
export function usePaniersEnAttente<L>(shopId: string) {
    const cle = `manetec:pos:attente:${shopId}`
    const [paniers, setPaniers, vider] = useEtatPersistant<PanierEnAttente<L>[]>(cle, [])

    function mettreEnAttente(p: Omit<PanierEnAttente<L>, 'id' | 'misEnAttenteLe'>) {
        setPaniers(prev => [
            ...prev,
            {
                ...p,
                id: `${Date.now()}`,
                misEnAttenteLe: new Date().toISOString(),
            },
        ])
    }

    function reprendre(id: string): PanierEnAttente<L> | null {
        const trouve = paniers.find(p => p.id === id) ?? null
        if (trouve) setPaniers(prev => prev.filter(p => p.id !== id))
        return trouve
    }

    function retirer(id: string) {
        setPaniers(prev => prev.filter(p => p.id !== id))
    }

    return { paniers, mettreEnAttente, reprendre, retirer, viderTout: vider }
}
