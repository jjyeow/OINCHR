import React, { useCallback, useEffect, useMemo, useState } from 'react'
import {
    KeyboardAvoidingView, Platform, ScrollView, StyleSheet, Text, View,
} from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import Toast from 'react-native-toast-message'

import * as leaveApi from '../api/leave'
import { describeError } from '../api/client'
import { DateField, SegmentedField, SelectField, TextField } from '../components/fields'
import { AttachmentStrip, pickAttachment } from '../components/attachments'
import { Card, ErrorBanner, LoadingView, PrimaryButton } from '../components/ui'
import { formatDays, today } from '../lib/dates'
import { colors, radius, spacing, type } from '../theme'

const PORTION_OPTIONS = [
    { value: 'FULL', label: 'Full day' },
    { value: 'AM', label: 'Morning' },
    { value: 'PM', label: 'Afternoon' },
]

/**
 * Backs two screens: a staff member applying for themselves, and HR keying in on
 * someone else's behalf. The only difference is the staff picker at the top and
 * which endpoint it posts to, so they share everything else.
 */
export default function LeaveFormScreen({ navigation, route }) {
    const isOnBehalf = route?.params?.mode === 'onBehalf'

    const [isLoading, setIsLoading] = useState(true)
    const [loadError, setLoadError] = useState('')
    const [leaveTypeList, setLeaveTypeList] = useState([])
    const [staffList, setStaffList] = useState([])

    const [staffID, setStaffID] = useState(null)
    const [leaveTypeID, setLeaveTypeID] = useState(null)
    const [startDate, setStartDate] = useState(today())
    const [endDate, setEndDate] = useState(today())
    const [dayPortion, setDayPortion] = useState('FULL')
    const [reason, setReason] = useState('')

    const [totalDays, setTotalDays] = useState(null)
    const [isCounting, setIsCounting] = useState(false)
    const [isSubmitting, setIsSubmitting] = useState(false)
    const [submitError, setSubmitError] = useState('')
    const [assetList, setAssetList] = useState([])
    const [uploadStatus, setUploadStatus] = useState('')

    const selectedLeaveType = useMemo(
        () => leaveTypeList.find((leaveType) => String(leaveType.id) === String(leaveTypeID)),
        [leaveTypeList, leaveTypeID],
    )
    const isSingleDay = startDate === endDate
    const canPickHalfDay = isSingleDay && !!selectedLeaveType?.allowHalfDay

    useEffect(() => {
        navigation.setOptions({
            title: isOnBehalf ? 'Key in leave' : 'Apply for leave',
        })
    }, [navigation, isOnBehalf])

    const load = useCallback(async () => {
        setIsLoading(true)
        setLoadError('')
        try {
            const requestList = [leaveApi.getLeaveTypeList()]
            if (isOnBehalf) requestList.push(leaveApi.getStaffList())
            const [leaveTypeResult, staffResult] = await Promise.all(requestList)

            setLeaveTypeList(leaveTypeResult.data || [])
            if (staffResult) setStaffList(staffResult.data || [])
        } catch (error) {
            setLoadError(describeError(error, 'Could not load the form.'))
        }
        setIsLoading(false)
    }, [isOnBehalf])

    useEffect(() => { load() }, [load])

    // Keep the end date from drifting behind the start date.
    useEffect(() => {
        if (endDate < startDate) setEndDate(startDate)
    }, [startDate, endDate])

    // Half day only makes sense on a single day, so reset it when the range grows.
    useEffect(() => {
        if (!canPickHalfDay && dayPortion !== 'FULL') setDayPortion('FULL')
    }, [canPickHalfDay, dayPortion])

    /**
     * The day count comes from the server rather than being worked out here - it is
     * the side that knows the public holidays and which weekdays the farm works.
     */
    useEffect(() => {
        let isCurrent = true
        const count = async () => {
            if (!startDate || !endDate || endDate < startDate) {
                setTotalDays(null)
                return
            }
            setIsCounting(true)
            try {
                const result = await leaveApi.calculateLeaveDays({ startDate, endDate, dayPortion })
                if (isCurrent) setTotalDays(Number(result.totalDays))
            } catch (error) {
                if (isCurrent) setTotalDays(null)
            }
            if (isCurrent) setIsCounting(false)
        }
        count()
        return () => { isCurrent = false }
    }, [startDate, endDate, dayPortion])

    const validationMessage = useMemo(() => {
        if (isOnBehalf && !staffID) return 'Choose who this leave is for.'
        if (!leaveTypeID) return 'Choose a leave type.'
        if (totalDays === 0) return 'Those dates are all weekends or public holidays.'
        return ''
    }, [isOnBehalf, staffID, leaveTypeID, totalDays])

    const canSubmit = validationMessage === '' && totalDays !== null && !isCounting

    const onSubmit = async () => {
        if (!canSubmit || isSubmitting) return
        setIsSubmitting(true)
        setSubmitError('')
        try {
            const payload = { leaveTypeID, startDate, endDate, dayPortion, reason: reason.trim() }
            const created = isOnBehalf
                ? await leaveApi.applyLeaveOnBehalf({ ...payload, staffID })
                : await leaveApi.applyLeave(payload)

            // Documents can only be uploaded once the request exists - the server
            // attaches them by id - so they go up now, before anyone sees the screen.
            let failedCount = 0
            for (let index = 0; index < assetList.length; index += 1) {
                setUploadStatus(`Uploading ${index + 1} of ${assetList.length}...`)
                try {
                    await leaveApi.uploadLeaveAttachment({
                        leaveRequestID: created.id,
                        asset: assetList[index],
                    })
                } catch (error) {
                    failedCount += 1
                }
            }
            setUploadStatus('')

            if (failedCount > 0) {
                Toast.show({
                    type: 'error',
                    text1: 'Leave saved, but some photos did not upload',
                    text2: `${failedCount} failed. Attach them again from the request.`,
                })
            } else {
                Toast.show({
                    type: 'success',
                    text1: isOnBehalf ? 'Leave keyed in' : 'Leave submitted',
                    text2: selectedLeaveType?.requiresAttachment && assetList.length === 0
                        ? 'Attach the MC before it can be approved.'
                        : 'It is now waiting for approval.',
                })
            }
            navigation.replace('LeaveDetail', { leaveRequestID: created.id })
        } catch (error) {
            setSubmitError(describeError(error, 'Could not submit this request.'))
            setUploadStatus('')
            setIsSubmitting(false)
        }
    }

    if (isLoading) return <LoadingView message="Loading the form" />

    if (loadError) {
        return (
            <SafeAreaView style={styles.safe}>
                <View style={styles.scroll}>
                    <ErrorBanner message={loadError} onRetry={load} />
                </View>
            </SafeAreaView>
        )
    }

    return (
        <SafeAreaView style={styles.safe} edges={['bottom']}>
            <KeyboardAvoidingView
                style={styles.flex}
                behavior={Platform.OS === 'ios' ? 'padding' : undefined}
                keyboardVerticalOffset={90}
            >
                <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
                    <ErrorBanner message={submitError} />

                    {isOnBehalf && (
                        <SelectField
                            label="Staff member"
                            placeholder="Who is this leave for?"
                            value={staffID}
                            onChange={setStaffID}
                            hint="The record will show it was entered by you."
                            options={staffList.map((staff) => ({
                                value: staff.id,
                                label: staff.name,
                                subtitle: [staff.position, staff.department]
                                    .filter(Boolean).join(' - '),
                            }))}
                        />
                    )}

                    <SelectField
                        label="Leave type"
                        placeholder="Choose a leave type"
                        value={leaveTypeID}
                        onChange={setLeaveTypeID}
                        options={leaveTypeList.map((leaveType) => ({
                            value: leaveType.id,
                            label: leaveType.title,
                            subtitle: leaveType.requiresAttachment
                                ? 'Needs a supporting document' : undefined,
                        }))}
                    />

                    <DateField label="First day" value={startDate} onChange={setStartDate} />
                    <DateField
                        label="Last day"
                        value={endDate}
                        onChange={setEndDate}
                        minimumDate={startDate ? new Date(startDate) : undefined}
                    />

                    {canPickHalfDay && (
                        <SegmentedField
                            label="How much of the day"
                            value={dayPortion}
                            options={PORTION_OPTIONS}
                            onChange={setDayPortion}
                        />
                    )}

                    <Card style={styles.countCard}>
                        <Text style={styles.countLabel}>THIS REQUEST COUNTS AS</Text>
                        <Text style={styles.countValue}>
                            {isCounting ? 'Working it out...'
                                : totalDays === null ? '-'
                                    : formatDays(totalDays)}
                        </Text>
                        <Text style={styles.countCaption}>
                            Weekends and public holidays are not counted.
                        </Text>
                    </Card>

                    <TextField
                        label="Reason"
                        placeholder={selectedLeaveType?.requiresAttachment
                            ? 'Briefly, what happened?' : 'Optional'}
                        value={reason}
                        onChangeText={setReason}
                        multiline
                        style={styles.reason}
                    />

                    <AttachmentStrip
                        label={selectedLeaveType?.requiresAttachment
                            ? 'Supporting document (required)' : 'Supporting document'}
                        hint={selectedLeaveType?.requiresAttachment
                            ? 'This leave type cannot be approved without one. Photograph the MC now.'
                            : 'Optional - attach anything that supports the request.'}
                        required={selectedLeaveType?.requiresAttachment}
                        assetList={assetList}
                        onAdd={async () => {
                            const picked = await pickAttachment()
                            if (picked.length) setAssetList([...assetList, ...picked])
                        }}
                        onRemove={(index) => setAssetList(
                            assetList.filter((_, position) => position !== index),
                        )}
                    />

                    {!!validationMessage && (
                        <Text style={styles.validation}>{validationMessage}</Text>
                    )}

                    <PrimaryButton
                        title={uploadStatus || (isOnBehalf
                            ? 'Submit for this staff member' : 'Submit application')}
                        onPress={onSubmit}
                        loading={isSubmitting}
                        disabled={!canSubmit}
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

    countCard: {
        backgroundColor: colors.brandSoft,
        borderColor: colors.brand,
        marginBottom: spacing.lg,
    },
    countLabel: { ...type.label, color: colors.brandDark },
    countValue: {
        fontSize: 24,
        fontWeight: '800',
        color: colors.brandDark,
        marginVertical: spacing.xs,
    },
    countCaption: { ...type.small, fontSize: 12, color: colors.brandDark, opacity: 0.8 },

    reason: { minHeight: 96 },
    validation: { ...type.small, color: colors.pending, marginBottom: spacing.md },
})
