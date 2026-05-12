// scripts/test-resend.ts
// Exécutez avec : npx tsx scripts/test-resend.ts
// (ou: npx ts-node scripts/test-resend.ts)

import { Resend } from 'resend'
import * as dotenv from 'dotenv'

dotenv.config({ path: '.env.local' })

const resend    = new Resend(process.env.RESEND_API_KEY)
const expediteur = `${process.env.RESEND_FROM_NAME} <${process.env.RESEND_FROM_EMAIL}>`

async function testerResend() {
    console.log('═══════════════════════════════════════════')
    console.log('[RESEND TEST] Début du test')
    console.log('[RESEND TEST] Expéditeur :', expediteur)
    console.log('[RESEND TEST] API Key présente :', !!process.env.RESEND_API_KEY)
    console.log('═══════════════════════════════════════════')

    // ── Test 1 : Email simple HTML ────────────────────────────
    console.log('\n[TEST 1] Envoi email HTML simple...')
    const { data, error } = await resend.emails.send({
        from:    expediteur,
        // ⚠️ Remplacez par votre email personnel pour recevoir le test
        to:      ['ruph@manetec.app'],
        subject: '✅ Test Manetec Gestock — Resend fonctionne',
        html: `
            <div style="font-family: sans-serif; max-width: 500px; margin: 0 auto; padding: 24px;">
                <div style="background: #1a56db; padding: 20px; border-radius: 12px; text-align: center;">
                    <h1 style="color: white; margin: 0; font-size: 20px;">Manetec Gestock</h1>
                    <p style="color: rgba(255,255,255,0.8); margin: 8px 0 0; font-size: 14px;">
                        par Bold Redhok Tech
                    </p>
                </div>
                <div style="padding: 24px 0;">
                    <h2 style="color: #0f172a; font-size: 18px;">✅ Configuration Resend validée !</h2>
                    <p style="color: #64748b; font-size: 14px; line-height: 1.6;">
                        Si vous recevez cet email, cela signifie que votre configuration
                        Resend avec le domaine <strong>manetec.app</strong> est correcte
                        et que les emails automatiques fonctionneront en production.
                    </p>
                    <div style="background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; padding: 16px; margin-top: 16px;">
                        <p style="margin: 0 0 8px; font-size: 12px; color: #94a3b8; font-weight: 600; text-transform: uppercase;">
                            Informations de test
                        </p>
                        <p style="margin: 0; font-size: 13px; color: #334155;">
                            Expéditeur : ${expediteur}<br>
                            Timestamp  : ${new Date().toISOString()}<br>
                            Environnement : local (DB Supabase)
                        </p>
                    </div>
                </div>
                <div style="border-top: 1px solid #e2e8f0; padding-top: 16px; text-align: center;">
                    <p style="color: #94a3b8; font-size: 12px; margin: 0;">
                        Bold Redhok Tech — Manetec Gestock
                    </p>
                </div>
            </div>
        `,
    })

    if (error) {
        console.error('[TEST 1] ❌ ÉCHEC :', error)
        console.error('[TEST 1] Message :', error.message)
        console.error('\n💡 Causes possibles :')
        console.error('   1. Domaine manetec.app non vérifié dans Resend')
        console.error('   2. API Key incorrecte ou révoquée')
        console.error('   3. Email destinataire invalide')
        console.error('\n   → Allez sur https://resend.com/domains et vérifiez que manetec.app est "Verified"')
    } else {
        console.log('[TEST 1] ✅ SUCCÈS — Email ID :', data?.id)
        console.log('[TEST 1] Vérifiez votre boîte email !')
    }

    // ── Test 2 : Vérifier le domaine dans Resend API ──────────
    console.log('\n[TEST 2] Vérification domaines enregistrés...')
    try {
        const domains = await resend.domains.list()
        console.log('[TEST 2] Domaines :', JSON.stringify(domains.data, null, 2))
    } catch (e: any) {
        console.error('[TEST 2] Impossible de lister les domaines :', e.message)
    }

    console.log('\n═══════════════════════════════════════════')
    console.log('[RESEND TEST] Terminé')
    console.log('═══════════════════════════════════════════')
}

testerResend().catch(console.error)