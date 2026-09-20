import React, { useEffect, useState } from 'react'
import {
    KeyboardAvoidingView, Platform, ScrollView, StyleSheet, Text, View,
} from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import Toast from 'react-native-toast-message'

import * as leaveApi from '../api/leave'
import { describeError } from '../api/client'
import { SwitchField, TextField } from '../components/fields'
import { Card, ErrorBanner, PrimaryButton, SectionLabel } from '../components/ui'
import { colors, spacing, type } from '../theme'

// Offered on a blank form so nobody has to invent the whole list from scratch.
// Numbers are a starting point to edit, not a policy - the handbook decides.
const PRESET_LIST = [
    {
        title: 'Annual Leave', code: 'AL', daysPerYear: '12',
        deductFromBalance: true, allowHalfDay: true, requiresAttachment: false,
    },
    {
        title: 'Medical Leave', code: 'ML', daysPerYear: '14',
        deductFromBalance: true, allowHalfDay: true, requiresAttachment: true,
    },
    {
        title: 'Emergency Leave', code: 'EL', daysPerYear: '3',
        deductFromBalance: true, allowHalfDay: true, requiresAttachment: false,
    },
    {
        title: 'Unpaid Leave', code: 'UL', daysPerYear: '0',
        deductFromBalance: false, allowHalfDay: true, requiresAttachment: false,
    },
]

export default function LeaveTypeFormScreen({ navigation, route }) {
    const existing = route?.params?.leaveType || null
    const isEditing = existing !== null

    const [title, setTitle] = useState(existing?.title || '')
    const [code, setCode] = useState(existing?.code || '')
    const [daysPerYear, setDaysPerYear] = useState(
        existing ? String(Number(existing.daysPerYear)) : '',
    )
    const [deductFromBalance, setDeductFromBalance] = useState(
        existing ? existing.deductFromBalance : true,
    )
    const [allowHalfDay, setAllowHalfDay] = useState(existing ? existing.allowHalfDay : true)
    const [requiresAttachment, setRequiresAttachment] = useState(
        existing ? existing.requiresAttachment : false,
    )
    const [carryForward, setCarryForward] = useState(existing ? existing.carryForward : false)
    const [carryForwardMaxDays, setCarryForwardMaxDays] = useState(
        existing ? String(Number(existing.carryForwardMaxDays)) : '0',
    )
    const [active, setActive] = useState(existing ? existing.active : true)

    const [isSubmitting, setIsSubmitting] = useState(false)
    const [errorMessage, setErrorMessage] = useState('')

    useEffect(() => {
        navigation.setOptions({ title: isEditing ? existing.title : 'New leave type' })
    }, [navigation, isEditing, existing])

    const applyPreset = (preset) => {
        setTitle(preset.title)
        setCode(preset.code)
        setDaysPerYear(preset.daysPerYear)
        setDeductFromBalance(preset.deductFromBalance)
        setAllowHalfDay(preset.allowHalfDay)
        setRequiresAttachment(preset.requiresAttachment)
    }

    const daysAreValid = daysPerYear === '' || !Number.isNaN(Number(daysPerYear))
    const canSubmit = title.trim().length > 0 && code.trim().length > 0 && daysAreValid

    const onSubmit = async () => {
        if (!canSubmit || isSubmitting) return
        setIsSubmitting(true)
        setErrorMessage('')
        try {
            await leaveApi.saveLeaveType({
                leaveTypeID: existing?.id,
                title: title.trim(),
                code: code.trim().toUpperCase(),
                daysPerYear: daysPerYear === '' ? '0' : daysPerYear,
                deductFromBalance,
                allowHalfDay,
                requiresAttachment,
                carryForward,
                carryForwardMaxDays: carryForward ? (carryForwardMaxDays || '0') : '0',
                active,
            })
            Toast.show({
                type: 'success',
                text1: isEditing ? 'Leave type updated' : `${title.trim()} added`,
                text2: isEditing ? undefined : 'Staff can apply for it straight away.',
            })
            navigation.goBack()
        } catch (error) {
            setErrorMessage(describeError(error, 'Could not save this leave type.'))
            setIsSubmitting(false)
        }
    }

    return (
        <SafeAreaView style={styles.safe} edges={['bottom']}>
            <KeyboardAvoidingView
                style={styles.flex}
                behavior={Platform.OS === 'ios' ? 'padding' : undefined}
                keyboardVerticalOffset={90}
            >
                <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
                    <ErrorBanner message={errorMessage} />

                    {!isEditing && (
                        <>
                            <SectionLabel>Start from a common one</SectionLabel>
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
                            <Text style={styles.presetHint}>
                                These fill the form in for you. Change any of it before saving -
                                your staff handbook decides the numbers, not the preset.
                            </Text>
                        </>
                    )}

                    <TextField
                        label="Name"
                        hint="What staff see in the dropdown."
                        placeholder="Annual Leave"
                        value={title}
                        onChangeText={setTitle}
                    />

                    <TextField
                        label="Short code"
                        hint="A unique tag, usually two letters."
                        placeholder="AL"
                        value={code}
                        onChangeText={setCode}
                        autoCapitalize="characters"
                        maxLength={20}
                    />

                    <TextField
                        label="Days per year"
                        hint="The default entitlement. You can override it per person later."
                        placeholder="12"
                        value={daysPerYear}
                        onChangeText={setDaysPerYear}
                        keyboardType="decimal-pad"
                        error={daysAreValid ? '' : 'Enter a number, for example 12 or 12.5.'}
                    />

                    <Card style={styles.switchCard}>
                        <SwitchField
                            label="Draws down a balance"
                            hint="Turn this off for unpaid leave - it gets recorded but costs no days."
                            value={deductFromBalance}
                            onChange={setDeductFromBalance}
                        />
                        <SwitchField
                            label="Can be taken as a half day"
                            hint="Shows a morning/afternoon choice on single-day requests."
                            value={allowHalfDay}
                            onChange={setAllowHalfDay}
                        />
                        <SwitchField
                            label="Needs a supporting document"
                            hint="Turn this on for medical leave. It cannot be approved without an MC attached."
                            value={requiresAttachment}
                            onChange={setRequiresAttachment}
                        />
                        <SwitchField
                            label="Unused days carry forward"
                            hint="Leftover days roll into next year instead of expiring."
                            value={carryForward}
                            onChange={setCarryForward}
                        />
                    </Card>

                    {carryForward && (
                        <TextField
                            label="Most days that can carry forward"
                            hint="Use 0 for no limit."
                            placeholder="0"
                            value={carryForwardMaxDays}
                            onChangeText={setCarryForwardMaxDays}
                            keyboardType="decimal-pad"
                        />
                    )}

                    {isEditing && (
                        <Card style={styles.switchCard}>
                            <SwitchField
                                label="Available to staff"
                                hint={'Turn this off to retire it. Past requests keep their '
                                    + 'history; nobody can pick it for anything new.'}
                                value={active}
                                onChange={setActive}
                            />
                        </Card>
                    )}

                    <PrimaryButton
                        title={isEditing ? 'Save changes' : 'Add leave type'}
                        onPress={onSubmit}
                        loading={isSubmitting}
                        disabled={!canSubmit}
                        style={styles.submit}
                    />
                </ScrollView>
            </KeyboardAvoidingView>
        </SafeAreaView>
    )
}

const styles = StyleSheet.create({
    safe: { flex: 1, backgroundColor: colors.ground },
    flex: { flex: 1 },
    scroll: { padding: spacing.lg, paddingBottom: spacing.xxl },

    presetRow: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
    presetButton: { flexGrow: 1, flexBasis: '46%', minHeight: 44 },
    presetHint: { ...type.small, fontSize: 12, marginTop: spacing.sm, marginBottom: spacing.xl },

    switchCard: { marginBottom: spacing.lg, paddingVertical: spacing.sm },
    submit: { marginTop: spacing.sm },
})
