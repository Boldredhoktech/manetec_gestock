import { resend, EXPEDITEUR } from '@/lib/resend/client'
import { EmailBienvenueBoutions }   from '@/lib/resend/templates/bienvenue-boutique'
import { EmailAlerteAbonnement }    from '@/lib/resend/templates/alerte-abonnement'
import { EmailStatutBoutique }      from '@/lib/resend/templates/statut-boutique'
import { EmailAlerteStock }         from '@/lib/resend/templates/alerte-stock'
import { EmailFactureClient }       from '@/lib/resend/templates/facture-client'
import { EmailPromoBoutique }       from '@/lib/resend/templates/promo-boutique'
import { createElement }            from 'react'
import { format }                   from 'date-fns'
import { fr }                       from 'date-fns/locale'

const URL_APP = process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000'

// ── 1. Email bienvenue boutique ───────────────────────────────
export async function envoyerEmailBienvenueBoutique(params: {
    emailDestinataire: string
    nomBoutique:       string
    shopPublicId:      string
    identifiant:       string
    motDePasse:        string
    nomProprietaire:   string
}) {
    if (!params.emailDestinataire) return { succes: false, erreur: 'Email manquant' }

    try {
        const { data, error } = await resend.emails.send({
            from:    EXPEDITEUR,
            to:      [params.emailDestinataire],
            subject: `🏪 Bienvenue sur Manetec Gestock — ${params.nomBoutique}`,
            react:   createElement(EmailBienvenueBoutions, {
                nomBoutique:      params.nomBoutique,
                shopPublicId:     params.shopPublicId,
                identifiant:      params.identifiant,
                motDePasse:       params.motDePasse,
                nomProprietaire:  params.nomProprietaire,
                urlApp:           URL_APP,
            }),
        })
        if (error) return { succes: false, erreur: error.message }
        return { succes: true, emailId: data?.id }
    } catch (e: any) {
        return { succes: false, erreur: e.message }
    }
}

// ── 2. Alerte abonnement (J-7 ou expiré) ─────────────────────
export async function envoyerAlerteAbonnement(params: {
    emailDestinataire: string
    nomBoutique:       string
    nomProprietaire:   string
    plan:              string
    dateExpiration:    string
    joursRestants:     number
    estExpire:         boolean
}) {
    if (!params.emailDestinataire) return { succes: false, erreur: 'Email manquant' }

    const sujet = params.estExpire
        ? `🔴 Votre abonnement Manetec Gestock a expiré — ${params.nomBoutique}`
        : `⚠️ Abonnement expire dans ${params.joursRestants} jour(s) — ${params.nomBoutique}`

    try {
        const { data, error } = await resend.emails.send({
            from:    EXPEDITEUR,
            to:      [params.emailDestinataire],
            subject: sujet,
            react:   createElement(EmailAlerteAbonnement, {
                ...params,
                urlContact: 'mailto:support@boldredhok.com',
            }),
        })
        if (error) return { succes: false, erreur: error.message }
        return { succes: true, emailId: data?.id }
    } catch (e: any) {
        return { succes: false, erreur: e.message }
    }
}

// ── 3. Statut boutique (activation / désactivation) ──────────
export async function envoyerNotifStatutBoutique(params: {
    emailDestinataire: string
    nomBoutique:       string
    nomProprietaire:   string
    estActive:         boolean
    motif?:            string
}) {
    if (!params.emailDestinataire) return { succes: false, erreur: 'Email manquant' }

    const sujet = params.estActive
        ? `✅ Votre boutique "${params.nomBoutique}" a été réactivée`
        : `🔴 Votre boutique "${params.nomBoutique}" a été désactivée`

    try {
        const { data, error } = await resend.emails.send({
            from:    EXPEDITEUR,
            to:      [params.emailDestinataire],
            subject: sujet,
            react:   createElement(EmailStatutBoutique, {
                ...params,
                urlApp: URL_APP,
            }),
        })
        if (error) return { succes: false, erreur: error.message }
        return { succes: true, emailId: data?.id }
    } catch (e: any) {
        return { succes: false, erreur: e.message }
    }
}

// ── 4. Alerte stock critique ──────────────────────────────────
export async function envoyerAlerteStock(params: {
    emailDestinataire: string
    nomBoutique:       string
    produits: {
        nom: string; public_id: string
        stock: number; seuil_alerte: number
        unite: string; entrepot: string
    }[]
}) {
    if (!params.emailDestinataire) return { succes: false, erreur: 'Email manquant' }
    if (params.produits.length === 0) return { succes: false, erreur: 'Aucun produit en alerte' }

    try {
        const { data, error } = await resend.emails.send({
            from:    EXPEDITEUR,
            to:      [params.emailDestinataire],
            subject: `📦 Alerte stock — ${params.produits.length} produit(s) — ${params.nomBoutique}`,
            react:   createElement(EmailAlerteStock, {
                nomBoutique: params.nomBoutique,
                produits:    params.produits,
                urlApp:      URL_APP,
            }),
        })
        if (error) return { succes: false, erreur: error.message }
        return { succes: true, emailId: data?.id }
    } catch (e: any) {
        return { succes: false, erreur: e.message }
    }
}

// ── 5. Facture envoyée au client entreprise ───────────────────
export async function envoyerFactureClient(params: {
    emailDestinataire: string
    nomBoutique:       string
    nomClient:         string
    factureId:         string
    facturePublicId:   string
    montantTTC:        number
    dateEcheance:      string | null
    devise:            string
    messagePersonnalise?: string
    pdfBuffer?:        Buffer
}) {
    if (!params.emailDestinataire) return { succes: false, erreur: 'Email manquant' }

    const urlFacture = `${URL_APP}/admin/factures/${params.factureId}`

    const emailPayload: any = {
        from:    EXPEDITEUR,
        to:      [params.emailDestinataire],
        subject: `🧾 Facture ${params.facturePublicId} — ${params.nomBoutique}`,
        react:   createElement(EmailFactureClient, {
            nomBoutique:         params.nomBoutique,
            nomClient:           params.nomClient,
            factureId:           params.facturePublicId,
            montantTTC:          params.montantTTC,
            dateEcheance:        params.dateEcheance
                ? format(new Date(params.dateEcheance), 'dd/MM/yyyy', { locale: fr })
                : null,
            urlFacture,
            devise:              params.devise,
            messagePersonnalise: params.messagePersonnalise,
        }),
    }

    // Joindre le PDF si fourni
    if (params.pdfBuffer) {
        emailPayload.attachments = [{
            filename:    `facture-${params.facturePublicId}.pdf`,
            content:     params.pdfBuffer,
            contentType: 'application/pdf',
        }]
    }

    try {
        const { data, error } = await resend.emails.send(emailPayload)
        if (error) return { succes: false, erreur: error.message }
        return { succes: true, emailId: data?.id }
    } catch (e: any) {
        return { succes: false, erreur: e.message }
    }
}

// ── 6. Email promotionnel boutique → clients (Enterprise) ─────
export async function envoyerEmailPromo(params: {
    emailDestinataire: string
    nomClient:         string
    nomBoutique:       string
    titre:             string
    message:           string
    urlApp:            string
}) {
    if (!params.emailDestinataire) return { succes: false, erreur: 'Email manquant' }

    try {
        const { data, error } = await resend.emails.send({
            from:    EXPEDITEUR,
            to:      [params.emailDestinataire],
            subject: `${params.titre} — ${params.nomBoutique}`,
            react:   createElement(EmailPromoBoutique, params),
        })
        if (error) return { succes: false, erreur: error.message }
        return { succes: true, emailId: data?.id }
    } catch (e: any) {
        return { succes: false, erreur: e.message }
    }
}