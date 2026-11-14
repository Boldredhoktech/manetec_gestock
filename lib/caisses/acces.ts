// Caisses POS (mig 044) : qui vend sur quelle caisse.
//   • une caissière est affectée à UNE caisse (caisse_utilisateurs) ;
//   • les administrateurs, et qui a « Choisir sa caisse », prennent
//     n'importe quelle caisse POS active ;
//   • un vendeur sans caisse ne vend pas au POS.

import type { createAdminClient } from '@/lib/supabase/admin'
import { aPermission } from '@/lib/auth/permissions-serveur'
import { PERMISSIONS } from '@/lib/constants/permissions'

type Db = ReturnType<typeof createAdminClient>
type UserLike = Parameters<typeof aPermission>[0]

export interface CaissePOS {
    id:           string
    nom:          string
    public_id:    string
    warehouse_id: string
    entrepot:     string
}

export interface AccesCaisses {
    /** Caisses que l'utilisateur peut utiliser au POS. */
    caisses:     CaissePOS[]
    /** Sa caisse affectée, si elle est active. */
    maCaisseId:  string | null
    peutChoisir: boolean
}

export async function accesCaisses(db: Db, shopId: string, user: UserLike): Promise<AccesCaisses> {
    const userId = (user?.user_metadata as { user_id?: string } | undefined)?.user_id ?? ''
    const [{ data: comptes }, { data: affectation }] = await Promise.all([
        db.from('comptes_tresorerie')
            .select('id, nom, public_id, warehouse_id, warehouse:warehouses(nom)')
            .eq('shop_id', shopId).eq('type', 'caisse').eq('est_actif', true)
            .not('warehouse_id', 'is', null)
            .order('nom'),
        db.from('caisse_utilisateurs').select('compte_id').eq('user_id', userId).maybeSingle(),
    ])
    const toutes: CaissePOS[] = (comptes ?? []).map(c => {
        const w = c.warehouse as unknown as { nom: string } | { nom: string }[] | null
        return {
            id: c.id, nom: c.nom, public_id: c.public_id, warehouse_id: c.warehouse_id as string,
            entrepot: (Array.isArray(w) ? w[0]?.nom : w?.nom) ?? '',
        }
    })
    const peutChoisir = aPermission(user, PERMISSIONS.POS_CHOISIR_CAISSE)
    const maCaisseId = toutes.some(c => c.id === affectation?.compte_id) ? affectation!.compte_id : null
    return {
        caisses: peutChoisir ? toutes : toutes.filter(c => c.id === maCaisseId),
        maCaisseId,
        peutChoisir,
    }
}

/** La caisse demandée, si l'utilisateur a le droit de s'en servir. */
export async function caisseAutorisee(db: Db, shopId: string, user: UserLike, caisseId: string): Promise<CaissePOS | null> {
    const acces = await accesCaisses(db, shopId, user)
    return acces.caisses.find(c => c.id === caisseId) ?? null
}

export const MESSAGE_SANS_CAISSE =
    'Aucune caisse ne vous est affectée : demandez à votre responsable de vous en attribuer une (Trésorerie → la caisse → Caissières).'
