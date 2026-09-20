import React from 'react'
import {
    KeyboardAvoidingView, Modal, Platform, Pressable, StyleSheet, Text, View,
} from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { Ionicons } from '@expo/vector-icons'

import { colors, spacing, type } from '../theme'

/**
 * A full-screen modal with a header that clears the notch or Dynamic Island.
 *
 * SafeAreaView cannot be used here: RN's Modal renders into its own native view
 * hierarchy, where safe-area-context's SafeAreaView measures zero and the header
 * ends up underneath the status bar. useSafeAreaInsets reads React context instead,
 * which does reach inside the modal, so the padding is applied by hand.
 */
export default function FullScreenModal({ isVisible, title, onClose, children }) {
    const insets = useSafeAreaInsets()

    return (
        <Modal visible={isVisible} animationType="slide" onRequestClose={onClose}
               presentationStyle="fullScreen">
            <View style={[styles.container, { paddingTop: insets.top }]}>
                <View style={styles.header}>
                    <Text style={styles.title} numberOfLines={1}>{title}</Text>
                    <Pressable
                        onPress={onClose}
                        hitSlop={12}
                        accessibilityRole="button"
                        accessibilityLabel="Close"
                    >
                        <Ionicons name="close" size={26} color={colors.inkMuted} />
                    </Pressable>
                </View>

                <KeyboardAvoidingView
                    style={styles.body}
                    behavior={Platform.OS === 'ios' ? 'padding' : undefined}
                >
                    {children}
                </KeyboardAvoidingView>
            </View>
        </Modal>
    )
}

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: colors.ground },
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: spacing.md,
        paddingHorizontal: spacing.lg,
        paddingTop: spacing.md,
        paddingBottom: spacing.lg,
        borderBottomWidth: 1,
        borderBottomColor: colors.line,
    },
    title: { ...type.heading, flex: 1 },
    body: { flex: 1 },
})
