// Thème du logiciel (nouveau design, lot 1) : clair, sombre ou celui de
// l'appareil. Enregistré sur le compte (shop_users.preference_theme) et
// recopié dans un cookie pour que le serveur rende directement le bon
// thème, sans éclair blanc au chargement.

export const THEMES = ['clair', 'sombre', 'systeme'] as const
export type Theme = typeof THEMES[number]
export const COOKIE_THEME = 'manetec_theme'
export const ID_RACINE_APP = 'app-manetec'

export function estTheme(v: unknown): v is Theme {
    return typeof v === 'string' && (THEMES as readonly string[]).includes(v)
}

/** Script exécuté avant le premier affichage pour le thème « systeme ». */
// + impression : tout s'imprime en clair (reçus, factures), puis le
// thème sombre revient.
export const SCRIPT_THEME_SYSTEME =
    `(function(){try{var r=document.getElementById('${ID_RACINE_APP}');if(!r)return;` +
    `if(r.dataset.theme==='systeme'&&matchMedia('(prefers-color-scheme: dark)').matches)r.classList.add('dark');` +
    `addEventListener('beforeprint',function(){r.dataset.sombreAvantImpression=r.classList.contains('dark')?'1':'';r.classList.remove('dark')});` +
    `addEventListener('afterprint',function(){if(r.dataset.sombreAvantImpression==='1')r.classList.add('dark')})` +
    `}catch(e){}})()`
