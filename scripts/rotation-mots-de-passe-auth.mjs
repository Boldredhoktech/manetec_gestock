// scripts/rotation-mots-de-passe-auth.mjs
// ═══════════════════════════════════════════════════════════════
// À lancer UNE fois après le déploiement du Lot 1 Abonnement.
//
// Jusqu'ici, le mot de passe Supabase Auth de chaque compte interne
// (shop_<uuid>@internal.manetec.app, platform_<uuid>@…) était son UUID.
// La connexion le remplace désormais par un secret jetable — mais un
// compte qui ne se reconnecte plus garderait l'ancien. Ce script le
// remplace partout, sans toucher aux métadonnées ni aux sessions.
//
//   node --env-file=.env.local scripts/rotation-mots-de-passe-auth.mjs
// ═══════════════════════════════════════════════════════════════

import { randomBytes } from 'node:crypto'
import { createClient } from '@supabase/supabase-js'

const url = process.env.NEXT_PUBLIC_SUPABASE_URL
const cle = process.env.SUPABASE_SERVICE_ROLE_KEY
if (!url || !cle) {
    console.error('NEXT_PUBLIC_SUPABASE_URL et SUPABASE_SERVICE_ROLE_KEY sont requis.')
    process.exit(1)
}

const admin = createClient(url, cle, { auth: { persistSession: false, autoRefreshToken: false } })
const INTERNE = /^(shop|platform)_[0-9a-f-]{36}@internal\.manetec\.app$/

let page = 1, traites = 0, echecs = 0
for (;;) {
    const { data, error } = await admin.auth.admin.listUsers({ page, perPage: 200 })
    if (error) { console.error(error.message); process.exit(1) }
    for (const u of data.users) {
        if (!INTERNE.test(u.email ?? '')) continue
        const { error: e } = await admin.auth.admin.updateUserById(u.id, {
            password: randomBytes(32).toString('base64url'),
        })
        if (e) { echecs++; console.error(u.email, e.message) } else traites++
    }
    if (data.users.length < 200) break
    page++
}

console.log(`${traites} compte(s) Auth sécurisé(s), ${echecs} échec(s).`)
