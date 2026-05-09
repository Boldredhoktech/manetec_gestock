'use server'

import { createAdminClient } from '@/lib/supabase/admin'
import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import * as argon2 from 'argon2'

export async function creerAgent(formData: FormData) {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user || user.user_metadata?.role !== 'super_platform_admin') {
        return { erreur: 'Réservé au Super Admin Plateforme.' }
    }

    const adminClient = createAdminClient()

    const nomComplet  = (formData.get('nomComplet') as string)?.trim()
    const email       = (formData.get('email') as string)?.trim().toLowerCase()
    const motDePasse  = (formData.get('motDePasse') as string)

    if (!nomComplet || !email || !motDePasse) {
        return { erreur: 'Tous les champs sont requis.' }
    }

    if (motDePasse.length < 8) {
        return { erreur: 'Le mot de passe doit contenir au moins 8 caractères.' }
    }

    // Vérifier unicité email
    const { data: existant } = await adminClient
        .from('platform_admins')
        .select('id')
        .eq('email', email)
        .single()

    if (existant) {
        return { erreur: 'Cet email est déjà utilisé.' }
    }

    // Générer public_id
    const { data: idData } = await adminClient
        .rpc('generate_platform_id', { p_prefix: 'PLAT' })

    if (!idData) {
        return { erreur: 'Erreur lors de la génération de l\'identifiant.' }
    }

    const passwordHash = await argon2.hash(motDePasse, {
        type: argon2.argon2id,
        memoryCost: 65536,
        timeCost: 3,
        parallelism: 1,
    })

    const { error } = await adminClient
        .from('platform_admins')
        .insert({
            public_id:     idData,
            nom_complet:   nomComplet,
            email,
            password_hash: passwordHash,
            role:          'platform_agent',
            est_actif:     true,
        })

    if (error) {
        return { erreur: 'Erreur lors de la création de l\'agent.' }
    }

    await adminClient.from('audit_logs').insert({
        user_id:      user.user_metadata.admin_id,
        user_nom:     user.user_metadata.nom_complet ?? 'Admin Plateforme',
        type_acteur:  'platform',
        event_type:   'AGENT_CREATED',
        details_json: { email, nom: nomComplet },
    })

    revalidatePath('/redhok/agents')
    redirect('/redhok/agents')
}

export async function toggleActivationAgent(
    agentId: string,
    estActif: boolean
) {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user || user.user_metadata?.role !== 'super_platform_admin') {
        return { erreur: 'Réservé au Super Admin Plateforme.' }
    }

    const adminClient = createAdminClient()

    const { error } = await adminClient
        .from('platform_admins')
        .update({ est_actif: estActif })
        .eq('id', agentId)

    if (error) return { erreur: 'Erreur lors de la mise à jour.' }

    revalidatePath('/redhok/agents')
    return { succes: true }
}