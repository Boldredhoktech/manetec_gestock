// lib/pdf/reponse.ts
// ═══════════════════════════════════════════════════════════════
// Le rendu d'un document PDF, au même endroit pour toutes les routes.
//
// Pourquoi ce fichier existe : les seize routes PDF appelaient
// `getDonnees…()` puis `renderToBuffer()` sans jamais rien entourer.
// Une lecture qui échoue ne remonte pas — les fonctions de rapport
// écrivent `const { data } = await …` et jettent l'erreur — si bien
// qu'un rapport pouvait sortir intégralement VIDE en annonçant zéro
// vente, sans qu'une ligne ne signale que la requête n'avait jamais
// abouti.
//
// C'est exactement ce qui s'était produit : la migration 029 a donné
// à `sales` une deuxième clé étrangère vers `shop_users`
// (`annule_par`, en plus de `vendeur_id`). PostgREST refuse alors
// d'embarquer `shop_users(...)` sans dire laquelle, et rend une
// erreur PGRST201. Le rapport de ventes, le reçu client et les deux
// écrans de ventes lisaient donc `undefined` depuis ce jour-là, et
// affichaient « Aucune vente sur la période » sur une boutique qui
// en avait quatre.
//
// Ici, une erreur devient une réponse 500 qui PORTE son message, et
// le centre de rapports l'affiche sous le bouton depuis RAP-12.
// ═══════════════════════════════════════════════════════════════

import { NextResponse } from 'next/server'
import { renderToBuffer } from '@react-pdf/renderer'
import type React from 'react'

/**
 * Un refus explicite levé DANS le constructeur : la pièce existe mais
 * ne doit pas être servie (droit manquant, inventaire pas encore
 * validé…). Il porte son propre code HTTP, contrairement à une panne.
 */
export class RefusPDF extends Error {
    constructor(message: string, readonly statut: number) {
        super(message)
        this.name = 'RefusPDF'
    }
}

/**
 * Rend un document et l'envoie. `construire` peut rendre `null` pour
 * signifier « la pièce demandée n'existe pas » (404), ou bien un couple
 * { element, nomFichier } quand le nom du fichier dépend des données
 * lues (le numéro de la vente, celui de la facture…).
 */
export type RenduPDF =
    | React.ReactElement
    | { element: React.ReactElement; nomFichier?: string }
    | null

export async function reponsePDF(
    nomParDefaut: string,
    construire: () => Promise<RenduPDF>,
    introuvable = 'Document introuvable.',
): Promise<NextResponse> {
    let rendu: RenduPDF
    let nomFichier = nomParDefaut

    try {
        rendu = await construire()
    } catch (erreur) {
        if (erreur instanceof RefusPDF) {
            return new NextResponse(erreur.message, { status: erreur.statut })
        }
        return echec(nomFichier, 'la lecture des données', erreur)
    }

    if (!rendu) return new NextResponse(introuvable, { status: 404 })

    const element = 'element' in rendu ? rendu.element : rendu
    if ('element' in rendu && rendu.nomFichier) nomFichier = rendu.nomFichier

    try {
        const buffer = await renderToBuffer(element as React.ReactElement<any>)
        return new NextResponse(new Uint8Array(buffer), {
            headers: {
                'Content-Type':        'application/pdf',
                'Content-Disposition': `inline; filename="${nomFichier}"`,
            },
        })
    } catch (erreur) {
        return echec(nomFichier, 'la mise en page du document', erreur)
    }
}

function echec(nomFichier: string, etape: string, erreur: unknown): NextResponse {
    const detail = erreur instanceof Error ? erreur.message : String(erreur)

    // Tracé côté serveur avec le nom du document, pour retrouver
    // laquelle des seize routes a échoué.
    console.error(`[PDF] ${nomFichier} — échec à ${etape} :`, erreur)

    return new NextResponse(
        `Le document n'a pas pu être produit (${etape}). ${detail}`,
        { status: 500 },
    )
}
