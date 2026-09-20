import React from 'react'
import { Pressable, StyleSheet, Text, View } from 'react-native'
import { Ionicons } from '@expo/vector-icons'

import { colors, radius, spacing, type } from '../theme'

/** The title block at the top of each tab. Tabs have no navigation header, so this
 * is what tells you where you are. */
export function TabHeader({ title, subtitle, right }) {
    return (
        <View style={styles.header}>
            <View style={styles.flex}>
                <Text style={styles.title}>{title}</Text>
                {!!subtitle && <Text style={styles.subtitle}>{subtitle}</Text>}
            </View>
            {right}
        </View>
    )
}

export function ActionRow({ icon, title, subtitle, onPress, tint }) {
    return (
        <Pressable
            onPress={onPress}
            accessibilityRole="button"
            style={({ pressed }) => [styles.actionRow, pressed && styles.pressed]}
        >
            <View style={[styles.actionIcon, !!tint && { backgroundColor: tint }]}>
                <Ionicons name={icon} size={20} color={colors.brandDark} />
            </View>
            <View style={styles.flex}>
                <Text style={styles.actionTitle}>{title}</Text>
                {!!subtitle && <Text style={styles.actionSubtitle}>{subtitle}</Text>}
            </View>
            <Ionicons name="chevron-forward" size={18} color={colors.inkFaint} />
        </Pressable>
    )
}

const styles = StyleSheet.create({
    flex: { flex: 1 },
    pressed: { opacity: 0.7 },

    header: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: spacing.md,
        marginBottom: spacing.xl,
    },
    title: { ...type.title, fontSize: 28 },
    subtitle: { ...type.small, marginTop: 1 },

    actionRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: spacing.md,
        backgroundColor: colors.surface,
        borderWidth: 1,
        borderColor: colors.line,
        borderRadius: radius.lg,
        padding: spacing.lg,
    },
    actionIcon: {
        width: 38,
        height: 38,
        borderRadius: radius.pill,
        backgroundColor: colors.brandSoft,
        alignItems: 'center',
        justifyContent: 'center',
    },
    actionTitle: { ...type.body, fontWeight: '600' },
    actionSubtitle: { ...type.small, fontSize: 12, marginTop: 1 },
})
