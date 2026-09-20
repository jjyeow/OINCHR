import React, { useCallback, useEffect, useState } from 'react'
import {
    FlatList, KeyboardAvoidingView, Modal, Platform, Pressable, RefreshControl,
    ScrollView, StyleSheet, Text, View,
} from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { useFocusEffect } from '@react-navigation/native'
import { Ionicons } from '@expo/vector-icons'
import Toast from 'react-native-toast-message'

import * as claimApi from '../api/claims'
import { describeError } from '../api/client'
import { SwitchField, TextField } from '../components/fields'
import { Card, EmptyState, ErrorBanner, LoadingView, PrimaryButton } from '../components/ui'
import FullScreenModal from '../components/FullScreenModal'
import { colors, radius, spacing, type } from '../theme'

// Offered on a blank form so the list does not have to be invented from nothing.
const PRESET_LIST = [
    { title: 'Petrol', code: 'PET', requiresReceipt: true },
    { title: 'Meals', code: 'MEAL', requiresReceipt: true },
    { title: 'Tools & Supplies', code: 'TOOL', requiresReceipt: true },
    { title: 'Travel', code: 'TRV', requiresReceipt: true },
    { title: 'Medical', code: 'MED', requiresReceipt: true },
    { title: 'Other', code: 'OTH', requiresReceipt: false },
]

export default function ClaimTypeListScreen() {
    const [claimTypeList, setClaimTypeList] = useState([])
    const [isLoading, setIsLoading] = useState(true)
    const [isRefreshing, setIsRefreshing] = useState(false)
    const [errorMessage, setErrorMessage] = useState('')
    const [editing, setEditing] = useState(null)

    const load = useCallback(async () => {
        setErrorMessage('')
        try {
            const result = await claimApi.getClaimTypeList({ includeInactive: true })
            setClaimTypeList(result.data || [])
        } catch (error) {
            setErrorMessage(describeError(error, 'Could not load claim categories.'))
        }
        setIsLoading(false)
    }, [])

    useFocusEffect(useCallback(() => { load() }, [load]))

    const onRefresh = async () => {
        setIsRefreshing(true)
        await load()
        setIsRefreshing(false)
    }

    if (isLoading) return <LoadingView message="Loading categories" />

    return (
        <SafeAreaView style={styles.safe} edges={['bottom']}>
            <FlatList
                data={claimTypeList}
                keyExtractor={(item) => String(item.id)}
                contentContainerStyle={styles.listContent}
                refreshControl={<RefreshControl refreshing={isRefreshing} onRefresh={onRefresh} />}
                ListHeaderComponent={(
                    <>
                        <ErrorBanner message={errorMessage} onRetry={load} />
                        {claimTypeList.length > 0 && (
                            <Text style={styles.intro}>
                                What staff pick from on each line of a claim. Tap one to change it.
                            </Text>
                        )}
                    </>
                )}
                ListEmptyComponent={(
                    <EmptyState
                        icon="pricetags-outline"
                        title="No claim categories yet"
                        message="Until you add one, nobody can submit a claim. Petrol and Meals are the usual starting pair."
                    />
                )}
                renderItem={({ item }) => (
                    <Card
                        style={!item.active && styles.inactiveCard}
                        onPress={() => setEditing(item)}
                    >
                        <View style={styles.header}>
                            <View style={styles.flex}>
                                <Text style={[styles.title, !item.active && styles.inactiveText]}>
                                    {item.title}
                                </Text>
                                <Text style={styles.code}>{item.code}</Text>
                            </View>
                            {item.requiresReceipt && (
                                <View style={styles.tag}>
                                    <Ionicons name="receipt-outline" size={12}
                                              color={colors.brandDark} />
                                    <Text style={styles.tagText}>Receipt required</Text>
                                </View>
                            )}
                            {!item.active && (
                                <View style={[styles.tag, styles.tagMuted]}>
                                    <Text style={styles.tagTextMuted}>Retired</Text>
                                </View>
                            )}
                        </View>
                    </Card>
                )}
            />

            <View style={styles.footer}>
                <PrimaryButton title="Add a category" onPress={() => setEditing({})} />
            </View>

            <ClaimTypeModal
                editing={editing}
                onClose={() => setEditing(null)}
                onSaved={async () => { setEditing(null); await load() }}
            />
        </SafeAreaView>
    )
}

function ClaimTypeModal({ editing, onClose, onSaved }) {
    const isVisible = editing !== null
    const isEditing = !!editing?.id

    const [title, setTitle] = useState('')
    const [code, setCode] = useState('')
    const [requiresReceipt, setRequiresReceipt] = useState(true)
    const [active, setActive] = useState(true)
    const [isSubmitting, setIsSubmitting] = useState(false)
    const [errorMessage, setErrorMessage] = useState('')

    useEffect(() => {
        if (!isVisible) return
        setTitle(editing.title || '')
        setCode(editing.code || '')
        setRequiresReceipt(editing.requiresReceipt !== undefined ? editing.requiresReceipt : true)
        setActive(editing.active !== undefined ? editing.active : true)
        setErrorMessage('')
    }, [isVisible, editing])

    const canSubmit = title.trim().length > 0 && code.trim().length > 0

    const applyPreset = (preset) => {
        setTitle(preset.title)
        setCode(preset.code)
        setRequiresReceipt(preset.requiresReceipt)
    }

    const onSubmit = async () => {
        if (!canSubmit || isSubmitting) return
        setIsSubmitting(true)
        setErrorMessage('')
        try {
            await claimApi.saveClaimType({
                claimTypeID: editing?.id,
                title: title.trim(),
                code: code.trim().toUpperCase(),
                requiresReceipt,
                active,
            })
            Toast.show({
                type: 'success',
                text1: isEditing ? 'Category updated' : `${title.trim()} added`,
            })
            await onSaved()
        } catch (error) {
            setErrorMessage(describeError(error, 'Could not save this category.'))
        }
        setIsSubmitting(false)
    }

    return (
        <FullScreenModal
            isVisible={isVisible}
            title={isEditing ? editing.title : 'New category'}
            onClose={onClose}
        >
                    <ScrollView contentContainerStyle={styles.modalScroll}
                                keyboardShouldPersistTaps="handled">
                        <ErrorBanner message={errorMessage} />

                        {!isEditing && (
                            <View style={styles.presetRow}>
                                {PRESET_LIST.map((preset) => (
                                    <PrimaryButton
                                        key={preset.code}
                                        title={preset.title}
                                        variant="ghost"
                                        onPress={() => applyPreset(preset)}
                                        style={styles.presetButton}
                                    />
                                ))}
                            </View>
                        )}

                        <TextField
                            label="Name"
                            placeholder="Petrol"
                            value={title}
                            onChangeText={setTitle}
                        />
                        <TextField
                            label="Short code"
                            hint="A unique tag, usually three or four letters."
                            placeholder="PET"
                            value={code}
                            onChangeText={setCode}
                            autoCapitalize="characters"
                            maxLength={20}
                        />

                        <Card style={styles.switchCard}>
                            <SwitchField
                                label="Needs a receipt"
                                hint="A claim with a line in this category cannot be approved until a receipt is attached."
                                value={requiresReceipt}
                                onChange={setRequiresReceipt}
                            />
                            {isEditing && (
                                <SwitchField
                                    label="Available to staff"
                                    hint="Turn off to retire it. Past claims keep their history."
                                    value={active}
                                    onChange={setActive}
                                />
                            )}
                        </Card>

                        <PrimaryButton
                            title={isEditing ? 'Save changes' : 'Add category'}
                            onPress={onSubmit}
                            loading={isSubmitting}
                            disabled={!canSubmit}
                        />
                    </ScrollView>
        </FullScreenModal>
    )
}

const styles = StyleSheet.create({
    safe: { flex: 1, backgroundColor: colors.ground },
    flex: { flex: 1 },
    listContent: { padding: spacing.lg, gap: spacing.sm, flexGrow: 1 },
    intro: { ...type.small, marginBottom: spacing.md },

    inactiveCard: { opacity: 0.6 },
    inactiveText: { textDecorationLine: 'line-through' },
    header: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
    title: { ...type.subheading },
    code: { ...type.small, fontSize: 12, marginTop: 1 },

    tag: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 4,
        backgroundColor: colors.brandSoft,
        paddingHorizontal: spacing.sm,
        paddingVertical: 3,
        borderRadius: radius.pill,
    },
    tagMuted: { backgroundColor: colors.ground },
    tagText: { fontSize: 11, fontWeight: '600', color: colors.brandDark },
    tagTextMuted: { fontSize: 11, fontWeight: '600', color: colors.inkFaint },

    footer: {
        padding: spacing.lg,
        borderTopWidth: 1,
        borderTopColor: colors.line,
        backgroundColor: colors.surface,
    },

    modalHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: spacing.lg,
        borderBottomWidth: 1,
        borderBottomColor: colors.line,
    },
    modalTitle: { ...type.heading },
    modalScroll: { padding: spacing.lg, paddingBottom: spacing.xxl },

    presetRow: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: spacing.sm,
        marginBottom: spacing.xl,
    },
    presetButton: { flexGrow: 1, flexBasis: '30%', minHeight: 42 },
    switchCard: { marginBottom: spacing.lg, paddingVertical: spacing.sm },
})
