// scripts/avis-nouveaux-identifiants.mjs
// ═══════════════════════════════════════════════════════════════
// Avis aux boutiques après la mig 040 (connexion sans ShopId).
// Un e-mail par boutique ayant une adresse : au propriétaire, la liste
// de tous les comptes renommés (ancien → nouvel identifiant).
//
// PAR DÉFAUT RIEN N'EST ENVOYÉ : le script écrit un aperçu HTML par
// boutique dans ./avis-identifiants-apercu/ et affiche le récapitulatif.
//
//   Aperçu (prod)   : node --env-file=.env.local scripts/avis-nouveaux-identifiants.mjs
//   Test sur 1 adresse, 1 boutique :
//       … --boutique SHOP-00008 --a vous@exemple.com --envoyer
//   Envoi réel      : … --envoyer
//
// L'envoi est IDEMPOTENT : chaque envoi réussi est tracé dans audit_logs
// (AVIS_NOUVEAUX_IDENTIFIANTS_ENVOYE) et une boutique déjà avisée est
// sautée. Un envoi de test (--a) n'est pas tracé.
// ═══════════════════════════════════════════════════════════════

import { createJiti } from 'jiti'
import { createClient } from '@supabase/supabase-js'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'
import { mkdirSync, writeFileSync } from 'node:fs'

const RACINE = join(dirname(fileURLToPath(import.meta.url)), '..')
const jiti = createJiti(import.meta.url, { alias: { '@': RACINE }, jsx: true })

const args = process.argv.slice(2)
const option = (nom) => { const i = args.indexOf(nom); return i >= 0 ? args[i + 1] : undefined }
const ENVOYER = args.includes('--envoyer')
const SEULE_BOUTIQUE = option('--boutique')?.toUpperCase()
const ADRESSE_TEST = option('--a')

const URL_CONNEXION = 'https://www.manetec.app/login'
const FIN_TRANSITION = '31 janvier 2027'
const EVENEMENT = 'AVIS_NOUVEAUX_IDENTIFIANTS_ENVOYE'

const url = process.env.NEXT_PUBLIC_SUPABASE_URL
const cle = process.env.SUPABASE_SERVICE_ROLE_KEY
if (!url || !cle) {
    console.error('NEXT_PUBLIC_SUPABASE_URL et SUPABASE_SERVICE_ROLE_KEY sont requis (--env-file=.env.local).')
    process.exit(1)
}
const db = createClient(url, cle, { auth: { persistSession: false, autoRefreshToken: false } })
console.log(`Base : ${url}${url.includes('127.0.0.1') ? '  (LOCALE)' : '  (PROD)'}`)
console.log(ENVOYER ? (ADRESSE_TEST ? `Mode : ENVOI DE TEST vers ${ADRESSE_TEST}` : 'Mode : ENVOI RÉEL') : 'Mode : aperçu, rien n\'est envoyé')

const { EmailNouveauxIdentifiants } = await jiti.import('@/lib/resend/templates/nouveaux-identifiants.tsx')
const { createElement } = await import('react')
const { renderToStaticMarkup } = await import('react-dom/server')

// ── Données ────────────────────────────────────────────────────
let req = db.from('shops').select('id, public_id, nom, email').order('public_id')
if (SEULE_BOUTIQUE) req = req.eq('public_id', SEULE_BOUTIQUE)
const { data: boutiques, error: e1 } = await req
if (e1) { console.error(e1.message); process.exit(1) }

const { data: comptes, error: e2 } = await db
    .from('shop_users')
    .select('shop_id, nom_complet, role, identifiant, identifiant_ancien')
    .not('identifiant_ancien', 'is', null)
if (e2) { console.error('Lecture des comptes :', e2.message, '\n→ La mig 040 est-elle appliquée sur cette base ?'); process.exit(1) }

const { data: dejaAvises } = await db
    .from('audit_logs').select('shop_id').eq('event_type', EVENEMENT)
const avisees = new Set((dejaAvises ?? []).map(l => l.shop_id))

const ORDRE = { super_admin_boutique: 0, admin_boutique: 1, comptable: 2, stock_manager: 3, vendeur: 4 }
const DOSSIER = join(RACINE, 'avis-identifiants-apercu')
mkdirSync(DOSSIER, { recursive: true })

let ok = 0, sautees = 0, echecs = 0
const resend = ENVOYER ? new (await import('resend')).Resend(process.env.RESEND_API_KEY) : null
const EXPEDITEUR = `${process.env.RESEND_FROM_NAME ?? 'Manetec Gestock'} <${process.env.RESEND_FROM_EMAIL ?? 'noreply@manetec.app'}>`

for (const b of boutiques) {
    const liste = comptes
        .filter(c => c.shop_id === b.id)
        .sort((x, y) => (ORDRE[x.role] ?? 9) - (ORDRE[y.role] ?? 9))
    const etiquette = `${b.public_id} ${b.nom}`.padEnd(32)

    if (liste.length === 0) { console.log(`${etiquette} — aucun compte renommé, sauté`); sautees++; continue }
    const destinataire = ADRESSE_TEST ?? b.email
    if (!destinataire) { console.log(`${etiquette} — PAS D'E-MAIL : à prévenir autrement (${liste.length} compte(s))`); sautees++; continue }
    if (ENVOYER && !ADRESSE_TEST && avisees.has(b.id)) { console.log(`${etiquette} — déjà avisée, sautée`); sautees++; continue }

    const proprietaire = liste.find(c => c.role === 'super_admin_boutique')?.nom_complet ?? 'Madame, Monsieur'
    const props = {
        nomBoutique: b.nom, nomProprietaire: proprietaire, urlConnexion: URL_CONNEXION, finTransition: FIN_TRANSITION,
        comptes: liste.map(c => ({ nomComplet: c.nom_complet, role: c.role, ancien: c.identifiant_ancien, nouveau: c.identifiant })),
    }
    const element = createElement(EmailNouveauxIdentifiants, props)
    const sujet = `Manetec Gestock — vos nouveaux identifiants de connexion (${b.nom})`

    writeFileSync(join(DOSSIER, `${b.public_id}.html`), '<!doctype html>' + renderToStaticMarkup(element))

    if (!ENVOYER) {
        console.log(`${etiquette} → ${destinataire}  (${liste.map(c => c.identifiant).join(', ')})`)
        ok++
        continue
    }

    const { data, error } = await resend.emails.send({ from: EXPEDITEUR, to: [destinataire], subject: sujet, react: element })
    if (error) { console.log(`${etiquette} — ÉCHEC : ${error.message}`); echecs++; continue }
    ok++
    console.log(`${etiquette} → envoyé à ${destinataire} (id ${data?.id})`)

    if (!ADRESSE_TEST) {
        await db.from('audit_logs').insert({
            shop_id: b.id, type_acteur: 'platform', event_type: EVENEMENT,
            reference_type: 'shop', reference_id: b.id, reference_public_id: b.public_id,
            user_nom: 'Script avis-nouveaux-identifiants',
            details_json: { destinataire, comptes: props.comptes.map(c => c.nouveau), resend_id: data?.id },
        })
    }
}

console.log(`\n${ENVOYER ? 'Envoyés' : 'Prêts'} : ${ok} · sautés : ${sautees} · échecs : ${echecs}`)
console.log(`Aperçus HTML : ${DOSSIER}`)
