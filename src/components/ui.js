import React from 'react'
import {
    ActivityIndicator, Pressable, StyleSheet, Text, View,
} from 'react-native'
import { Ionicons } from '@expo/vector-icons'

import { colors, radius, spacing, STATUS_STYLE, type } from '../theme'

export function Card({ children, style, onPress }) {
    const content = <View style={[styles.card, style]}>{children}</View>
    if (!onPress) return content
    return (
        <Pressable onPress={onPress} style={({ pressed }) => pressed && styles.pressed}>
            {content}
        </Pressable>
    )
}

export function StatusPill({ status }) {
    const style = STATUS_STYLE[status] || STATUS_STYLE.PENDING
    return (
        <View style={[styles.pill, { backgroundColor: style.background }]}>
            <Text style={[styles.pillText, { color: style.color }]}>{style.label}</Text>
        </View>
    )
}

export function PrimaryButton({ title, onPress, loading, disabled, variant = 'primary', style }) {
    const isDisabled = disabled || loading
    const variantStyle = variant === 'danger' ? styles.buttonDanger
        : variant === 'ghost' ? styles.buttonGhost
            : styles.buttonPrimary
    const textStyle = variant === 'ghost' ? styles.buttonGhostText : styles.buttonText

    return (
        <Pressable
            onPress={onPress}
            disabled={isDisabled}
            accessibilityRole="button"
            accessibilityState={{ disabled: isDisabled, busy: !!loading }}
            style={({ pressed }) => [
                styles.button,
                variantStyle,
                isDisabled && styles.buttonDisabled,
                pressed && !isDisabled && styles.pressed,
                style,
            ]}
        >
            {loading
                ? <ActivityIndicator color={variant === 'ghost' ? colors.brandDark : '#FFFFFF'} />
                : <Text style={textStyle}>{title}</Text>}
        </Pressable>
    )
}

export function SectionLabel({ children, style }) {
    return <Text style={[styles.sectionLabel, style]}>{String(children).toUpperCase()}</Text>
}

export function LoadingView({ message = 'Loading' }) {
    return (
        <View style={styles.centered}>
            <ActivityIndicator color={colors.brand} size="large" />
            <Text style={styles.centeredText}>{message}</Text>
        </View>
    )
}

export function EmptyState({ icon = 'file-tray-outline', title, message, action }) {
    return (
        <View style={styles.centered}>
            <Ionicons name={icon} size={44} color={colors.inkFaint} />
            <Text style={styles.emptyTitle}>{title}</Text>
            {!!message && <Text style={styles.centeredText}>{message}</Text>}
            {action}
        </View>
    )
}

export function ErrorBanner({ message, onRetry }) {
    if (!message) return null
    return (
        <View style={styles.errorBanner}>
            <Ionicons name="alert-circle-outline" size={18} color={colors.rejected} />
            <Text style={styles.errorText}>{message}</Text>
            {!!onRetry && (
                <Pressable onPress={onRetry} hitSlop={8}>
                    <Text style={styles.errorRetry}>Retry</Text>
                </Pressable>
            )}
        </View>
    )
}

export function Row({ label, value, valueStyle }) {
    return (
        <View style={styles.row}>
            <Text style={styles.rowLabel}>{label}</Text>
            <Text style={[styles.rowValue, valueStyle]}>{value}</Text>
        </View>
    )
}

const styles = StyleSheet.create({
    card: {
        backgroundColor: colors.surface,
        borderRadius: radius.lg,
        borderWidth: 1,
        borderColor: colors.line,
        padding: spacing.lg,
    },
    pressed: { opacity: 0.7 },

    pill: {
        alignSelf: 'flex-start',
        paddingHorizontal: spacing.md,
        paddingVertical: 3,
        borderRadius: radius.pill,
    },
    pillText: { fontSize: 12, fontWeight: '700' },

    button: {
        minHeight: 50,
        borderRadius: radius.md,
        alignItems: 'center',
        justifyContent: 'center',
        paddingHorizontal: spacing.lg,
    },
    buttonPrimary: { backgroundColor: colors.brand },
    buttonDanger: { backgroundColor: colors.rejected },
    buttonGhost: { backgroundColor: 'transparent', borderWidth: 1, borderColor: colors.line },
    buttonDisabled: { opacity: 0.45 },
    buttonText: { color: '#FFFFFF', fontSize: 16, fontWeight: '700' },
    buttonGhostText: { color: colors.ink, fontSize: 16, fontWeight: '600' },

    sectionLabel: { ...type.label, marginBottom: spacing.sm },

    centered: {
        flex: 1,
        alignItems: 'center',
        justifyContent: 'center',
        padding: spacing.xl,
        gap: spacing.md,
    },
    centeredText: { ...type.small, textAlign: 'center' },
    emptyTitle: { ...type.subheading, textAlign: 'center' },

    errorBanner: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: spacing.sm,
        backgroundColor: colors.rejectedSoft,
        borderRadius: radius.md,
        padding: spacing.md,
        marginBottom: spacing.md,
    },
    errorText: { ...type.small, color: colors.rejected, flex: 1 },
    errorRetry: { ...type.small, color: colors.rejected, fontWeight: '700' },

    row: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'flex-start',
        gap: spacing.lg,
        paddingVertical: spacing.sm,
    },
    rowLabel: { ...type.small },
    rowValue: { ...type.body, flexShrink: 1, textAlign: 'right', fontWeight: '500' },
})
