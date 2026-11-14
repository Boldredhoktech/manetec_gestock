// app/(shop)/layout.tsx

import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { cookies } from 'next/headers'
import { COOKIE_NOUVEL_IDENTIFIANT } from '@/lib/auth/identifiant'
import BandeauNouvelIdentifiant from '@/components/shop/BandeauNouvelIdentifiant'
import RechercheGlobale from '@/components/shop/RechercheGlobale'
import { COOKIE_THEME, ID_RACINE_APP, SCRIPT_THEME_SYSTEME, estTheme } from '@/lib/theme'
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

    const magasin = await cookies()
    const nouvelIdentifiant = magasin.get(COOKIE_NOUVEL_IDENTIFIANT)?.value
    const brut = magasin.get(COOKIE_THEME)?.value
    const theme = estTheme(brut) ? brut : 'systeme'

    // Nouveau design (lot 1) : tout le logiciel vit sous .app-manetec, qui
    // porte la palette, les polices et le thème clair / sombre.
    return (
        <div id={ID_RACINE_APP} data-theme={theme}
             className={`app-manetec min-h-screen ${theme === 'sombre' ? 'dark' : ''}`}>
            <script dangerouslySetInnerHTML={{ __html: SCRIPT_THEME_SYSTEME }} />
            {nouvelIdentifiant && <BandeauNouvelIdentifiant identifiant={nouvelIdentifiant} />}
            {children}
            <RechercheGlobale />
        </div>
    )
}
