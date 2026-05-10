import { StyleSheet, Font } from '@react-pdf/renderer'

// Styles de base réutilisables dans tous les PDFs
export const couleurs = {
    primaire:    '#1a1a2e',
    secondaire:  '#16213e',
    accent:      '#0f3460',
    texte:       '#1a1a1a',
    texteFaible: '#6b7280',
    bordure:     '#e5e7eb',
    fondClair:   '#f9fafb',
    vert:        '#16a34a',
    rouge:       '#dc2626',
    orange:      '#d97706',
    blanc:       '#ffffff',
}

export const stylesBase = StyleSheet.create({
    page: {
        fontFamily:      'Helvetica',
        fontSize:        10,
        color:           couleurs.texte,
        backgroundColor: couleurs.blanc,
        padding:         0,
    },
    section: {
        marginBottom: 12,
    },
    flexi: {
        display:        'flex',
        flexDirection:  'row',
        alignItems:     'center',
    },
    spaceBetween: {
        display:        'flex',
        flexDirection:  'row',
        justifyContent: 'space-between',
        alignItems:     'flex-start',
    },
    titre: {
        fontSize:    18,
        fontFamily:  'Helvetica-Bold',
        color:       couleurs.primaire,
        marginBottom: 4,
    },
    sousTitre: {
        fontSize:  11,
        fontFamily: 'Helvetica-Bold',
        color:     couleurs.primaire,
        marginBottom: 6,
    },
    label: {
        fontSize: 8,
        color:    couleurs.texteFaible,
        marginBottom: 2,
    },
    valeur: {
        fontSize:   10,
        fontFamily: 'Helvetica-Bold',
        color:      couleurs.texte,
    },
    texteNormal: {
        fontSize: 9,
        color:    couleurs.texte,
    },
    texteFaible: {
        fontSize: 8,
        color:    couleurs.texteFaible,
    },
    separateur: {
        borderBottomWidth: 1,
        borderBottomColor: couleurs.bordure,
        marginVertical:    8,
    },
    badge: {
        paddingHorizontal: 6,
        paddingVertical:   2,
        borderRadius:      4,
        fontSize:          8,
        fontFamily:        'Helvetica-Bold',
    },
})