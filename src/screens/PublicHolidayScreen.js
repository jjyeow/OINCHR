import React, { useCallback, useEffect, useState } from 'react'
import {
    KeyboardAvoidingView, Modal, Platform, Pressable, ScrollView, StyleSheet, Text, View,
} from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { Ionicons } from '@expo/vector-icons'
import Toast from 'react-native-toast-message'

import * as leaveApi from '../api/leave'
import { describeError } from '../api/client'
import { DateField, SwitchField, TextField } from '../components/fields'
import {
    Card, EmptyState, ErrorBanner, LoadingView, PrimaryButton, SectionLabel,
} from '../components/ui'
import FullScreenModal from '../components/FullScreenModal'
import { formatDisplayDate, toServerDate } from '../lib/dates'
import { colors, radius, spacing, type } from '../theme'

// Only the ones that land on the same date every year. Chinese New Year, Hari Raya,
// Deepavali, Wesak and Thaipusam move with the lunar and Islamic calendars, so they
// are added by hand from the gazetted list rather than guessed at here.
const FIXED_HOLIDAY_LIST = [
    { title: "New Year's Day", month: 1, day: 1 },
    { title: 'Labour Day', month: 5, day: 1 },
    { title: 'National Day (Merdeka)', month: 8, day: 31 },
    { title: 'Malaysia Day', month: 9, day: 16 },
    { title: 'Christmas Day', month: 12, day: 25 },
]

export default function PublicHolidayScreen() {
    const [year, setYear] = useState(() => new Date().getFullYear())
    const [holidayList, setHolidayList] = useState([])
    const [isLoading, setIsLoading] = useState(true)
    const [errorMessage, setErrorMessage] = useState('')
    const [isAdding, setIsAdding] = useState(false)
    const [isSeeding, setIsSeeding] = useState(false)

    const load = useCallback(async () => {
        setIsLoading(true)
        setErrorMessage('')
        try {
            const result = await leaveApi.getPublicHolidayList({ year, includeInactive: true })
            setHolidayList(result.data || [])
        } catch (error) {
            setErrorMessage(describeError(error, 'Could not load public holidays.'))
        }
        setIsLoading(false)
    }, [year])

    useEffect(() => { load() }, [load])

    const existingTitleSet = new Set(holidayList.map((holiday) => holiday.title))
    const missingFixedList = FIXED_HOLIDAY_LIST.filter(
        (holiday) => !existingTitleSet.has(holiday.title),
    )

    const onAddFixed = async () => {
        setIsSeeding(true)
        let addedCount = 0
        for (const holiday of missingFixedList) {
            try {
                await leaveApi.savePublicHoliday({
                    title: holiday.title,
                    date: toServerDate(new Date(year, holiday.month - 1, holiday.day)),
                    active: true,
                })
                addedCount += 1
            } catch (error) {
                // Keep going - one failure should not block the rest.
            }
        }
        setIsSeeding(false)
        Toast.show({
            type: addedCount > 0 ? 'success' : 'error',
            text1: addedCount > 0 ? `Added ${addedCount} holidays` : 'Nothing was added',
            text2: addedCount > 0
                ? 'Now add the ones that move each year.'
                : 'Check your connection and try again.',
        })
        await load()
    }

    const onToggleActive = async (holiday) => {
        try {
            await leaveApi.savePublicHoliday({
                holidayID: holiday.id,
                active: !holiday.active,
            })
            await load()
        } catch (error) {
            Toast.show({ type: 'error', text1: 'Could not update', text2: describeError(error) })
        }
    }

    return (
        <SafeAreaView style={styles.safe} edges={['bottom']}>
            <ScrollView contentContainerStyle={styles.scroll}>
                <View style={styles.yearBar}>
                    <Pressable onPress={() => setYear(year - 1)} hitSlop={12}
                               accessibilityLabel="Previous year">
                        <Ionicons name="chevron-back" size={22} color={colors.ink} />
                    </Pressable>
                    <Text style={styles.yearTitle}>{year}</Text>
                    <Pressable onPress={() => setYear(year + 1)} hitSlop={12}
                               accessibilityLabel="Next year">
                        <Ionicons name="chevron-forward" size={22} color={colors.ink} />
                    </Pressable>
                </View>

                <Text style={styles.intro}>
                    Holidays are skipped when a leave request is counted, so a week
                    covering Merdeka costs one day less.
                </Text>

                <ErrorBanner message={errorMessage} onRetry={load} />

                {isLoading ? <LoadingView message="Loading holidays" /> : (
                    <>
                        {missingFixedList.length > 0 && (
                            <Card style={styles.suggestCard}>
                                <Text style={styles.suggestTitle}>
                                    {missingFixedList.length} fixed-date holiday
                                    {missingFixedList.length === 1 ? '' : 's'} missing
                                </Text>
                                <Text style={styles.suggestBody}>
                                    {missingFixedList.map((holiday) => holiday.title).join(', ')}
                                </Text>
                                <PrimaryButton
                                    title={`Add all ${missingFixedList.length} to ${year}`}
                                    onPress={onAddFixed}
                                    loading={isSeeding}
                                    style={styles.suggestButton}
                                />
                                <Text style={styles.suggestNote}>
                                    Chinese New Year, Hari Raya, Deepavali, Wesak and Thaipusam
                                    shift each year, so add those yourself from the gazetted list.
                                </Text>
                            </Card>
                        )}

                        <SectionLabel style={styles.sectionSpacing}>
                            {holidayList.length} holiday{holidayList.length === 1 ? '' : 's'} in {year}
                        </SectionLabel>

                        {holidayList.length === 0 ? (
                            <EmptyState
                                icon="calendar-outline"
                                title={`Nothing set for ${year}`}
                                message="Without holidays, leave spanning one is counted as a normal working day."
                            />
                        ) : (
                            <View style={styles.list}>
                                {holidayList.map((holiday) => (
                                    <Card
                                        key={holiday.id}
                                        style={[styles.item, !holiday.active && styles.itemInactive]}
                                        onPress={() => onToggleActive(holiday)}
                                    >
                                        <View style={styles.flex}>
                                            <Text style={[
                                                styles.itemTitle,
                                                !holiday.active && styles.itemTitleInactive,
                                            ]}>
                                                {holiday.title}
                                            </Text>
                                            <Text style={styles.itemDate}>
                                                {formatDisplayDate(holiday.date)}
                                                {holiday.state ? ` - ${holiday.state} only` : ''}
                                            </Text>
                                        </View>
                                        <Ionicons
                                            name={holiday.active ? 'checkmark-circle' : 'ellipse-outline'}
                                            size={22}
                                            color={holiday.active ? colors.brand : colors.inkFaint}
                                        />
                                    </Card>
                                ))}
                            </View>
                        )}
                    </>
                )}
            </ScrollView>

            <View style={styles.footer}>
                <PrimaryButton title="Add a holiday" onPress={() => setIsAdding(true)} />
            </View>

            <AddHolidayModal
                isVisible={isAdding}
                year={year}
                onClose={() => setIsAdding(false)}
                onSaved={async () => { setIsAdding(false); await load() }}
            />
        </SafeAreaView>
    )
}

function AddHolidayModal({ isVisible, year, onClose, onSaved }) {
    const [title, setTitle] = useState('')
    const [holidayDate, setHolidayDate] = useState(toServerDate(new Date(year, 0, 1)))
    const [isStateOnly, setIsStateOnly] = useState(false)
    const [state, setState] = useState('')
    const [isSubmitting, setIsSubmitting] = useState(false)
    const [errorMessage, setErrorMessage] = useState('')

    useEffect(() => {
        if (isVisible) {
            setTitle('')
            setHolidayDate(toServerDate(new Date(year, 0, 1)))
            setIsStateOnly(false)
            setState('')
            setErrorMessage('')
        }
    }, [isVisible, year])

    const canSubmit = title.trim().length > 0 && (!isStateOnly || state.trim().length > 0)

    const onSubmit = async () => {
        if (!canSubmit || isSubmitting) return
        setIsSubmitting(true)
        setErrorMessage('')
        try {
            await leaveApi.savePublicHoliday({
                title: title.trim(),
                date: holidayDate,
                state: isStateOnly ? state.trim() : '',
                active: true,
            })
            Toast.show({ type: 'success', text1: `${title.trim()} added` })
            await onSaved()
        } catch (error) {
            setErrorMessage(describeError(error, 'Could not add this holiday.'))
        }
        setIsSubmitting(false)
    }

    return (
        <FullScreenModal isVisible={isVisible} title="Add a holiday" onClose={onClose}>
                    <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
                        <ErrorBanner message={errorMessage} />

                        <TextField
                            label="Name"
                            placeholder="Hari Raya Aidilfitri"
                            value={title}
                            onChangeText={setTitle}
                        />

                        <DateField
                            label="Date"
                            value={holidayDate}
                            onChange={setHolidayDate}
                        />

                        <Card style={styles.switchCard}>
                            <SwitchField
                                label="One state only"
                                hint="Leave off for a nationwide holiday."
                                value={isStateOnly}
                                onChange={setIsStateOnly}
                            />
                        </Card>

                        {isStateOnly && (
                            <TextField
                                label="State"
                                hint={'Must match the hr.state system setting exactly, '
                                    + 'or it will not be counted.'}
                                placeholder="Selangor"
                                value={state}
                                onChangeText={setState}
                            />
                        )}

                        <PrimaryButton
                            title="Add holiday"
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
    scroll: { padding: spacing.lg, paddingBottom: spacing.xxl },
    sectionSpacing: { marginTop: spacing.xl },

    yearBar: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        marginBottom: spacing.md,
    },
    yearTitle: { ...type.heading },
    intro: { ...type.small, marginBottom: spacing.lg },

    suggestCard: { backgroundColor: colors.brandSoft, borderColor: colors.brand },
    suggestTitle: { ...type.subheading, color: colors.brandDark },
    suggestBody: { ...type.small, color: colors.brandDark, marginTop: spacing.xs },
    suggestButton: { marginTop: spacing.md },
    suggestNote: {
        ...type.small,
        fontSize: 12,
        color: colors.brandDark,
        opacity: 0.85,
        marginTop: spacing.md,
    },

    list: { gap: spacing.sm },
    item: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
    itemInactive: { opacity: 0.55 },
    itemTitle: { ...type.body, fontWeight: '600' },
    itemTitleInactive: { textDecorationLine: 'line-through' },
    itemDate: { ...type.small, fontSize: 12, marginTop: 1 },

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
    switchCard: { marginBottom: spacing.lg, paddingVertical: spacing.sm },
})
