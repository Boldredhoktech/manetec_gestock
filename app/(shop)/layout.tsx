// app/(shop)/layout.tsx

import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { etatAbonnementBoutique, peutEntrerBoutiqueExpiree } from '@/lib/abonnement/etat'

export default async function LayoutShop({
                                             children,
                                         }: {
    children: React.ReactNode
}) {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user || user.user_metadata?.type_acteur !== 'shop') {
        redirect('/login')
    }

    // Filet de sécurité : la licence est appliquée par le middleware à
    // chaque requête (y compris la redirection de l'administrateur d'une
    // boutique expirée vers la page Abonnement, D3). Un layout n'étant pas
    // réexécuté à chaque navigation, il ne peut pas en être le garant.
    const etat = await etatAbonnementBoutique(user.user_metadata.shop_id)

    if (etat === 'desactive') {
        redirect('/login?suspendu=desactive')
    }
    if (etat === 'expire' && !peutEntrerBoutiqueExpiree(user.user_metadata.role)) {
        redirect('/login?suspendu=expire')
    }

    return <>{children}</>
}
