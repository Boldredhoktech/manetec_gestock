import React from 'react'
import { Text, View, Image, StyleSheet } from '@react-pdf/renderer'
import { couleurs } from '@/lib/pdf/styles'

const s = StyleSheet.create({
    entete: {
        flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start',
        paddingBottom: 12, marginBottom: 16, borderBottomWidth: 2, borderBottomColor: couleurs.primaire,
    },
    logo: { width: 92, height: 46, objectFit: 'contain', marginBottom: 4 },
    nom: { fontSize: 14, fontFamily: 'Helvetica-Bold', color: couleurs.primaire },
    info: { fontSize: 8, color: couleurs.texteFaible, marginTop: 1.5 },
    droite: { alignItems: 'flex-end', maxWidth: 240 },
    titre: { fontSize: 16, fontFamily: 'Helvetica-Bold', color: couleurs.primaire, textAlign: 'right' },
    sousTitre: { fontSize: 9, color: couleurs.texte, textAlign: 'right', marginTop: 2 },
    date: { fontSize: 8, color: couleurs.texteFaible, textAlign: 'right', marginTop: 2 },
})

export interface BoutiqueEntete {
    nom: string
    adresse?: string | null
    ville?: string | null
    telephone_1?: string | null
    ifu?: string | null
    logo_url?: string | null
}

export function EnteteRapportPDF({
    boutique, titre, sousTitre, genereLe,
}: {
    boutique: BoutiqueEntete
    titre: string
    sousTitre?: string
    genereLe: string
}) {
    return (
        <View style={s.entete}>
            <View style={{ maxWidth: 300 }}>
                {boutique.logo_url
                    ? <Image src={boutique.logo_url} style={s.logo} />
                    : <Text style={s.nom}>{boutique.nom}</Text>}
                {boutique.logo_url && (
                    <Text style={[s.info, { fontFamily: 'Helvetica-Bold', color: couleurs.texte, fontSize: 9.5 }]}>
                        {boutique.nom}
                    </Text>
                )}
                {boutique.adresse && (
                    <Text style={s.info}>{boutique.adresse}{boutique.ville ? `, ${boutique.ville}` : ''}</Text>
                )}
                {boutique.telephone_1 && <Text style={s.info}>Tél : {boutique.telephone_1}</Text>}
                {boutique.ifu && <Text style={s.info}>IFU : {boutique.ifu}</Text>}
            </View>
            <View style={s.droite}>
                <Text style={s.titre}>{titre}</Text>
                {sousTitre ? <Text style={s.sousTitre}>{sousTitre}</Text> : null}
                <Text style={s.date}>Généré le {genereLe}</Text>
            </View>
        </View>
    )
}
