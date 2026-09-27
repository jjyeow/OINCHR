import React, { useCallback, useEffect, useState } from 'react'
import {
    Alert, FlatList, Modal, Pressable, RefreshControl, ScrollView, StyleSheet, Text, View,
} from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { useFocusEffect } from '@react-navigation/native'
import { Ionicons } from '@expo/vector-icons'

import Toast from 'react-native-toast-message'

import * as claimApi from '../api/claims'
import { useAuth } from '../context/AuthContext'
import { pickAttachment } from '../components/attachments'
import { PERMISSION } from '../permissions'
import FullScreenModal from '../components/FullScreenModal'
import { DateField, TextField } from '../components/fields'
import { PrimaryButton, SectionLabel } from '../components/ui'
import { describeError } from '../api/client'
import { Card, EmptyState, ErrorBanner, LoadingView } from '../components/ui'
import { formatTimestamp } from '../lib/dates'
import { formatMoney } from '../lib/money'
import { CLAIM_STATUS_STYLE } from '../lib/claimStatus'
import { colors, radius, spacing, type } from '../theme'

const STATUS_FILTER_LIST = [
    { value: 'ALL', label: 'All' },
    { value: 'PENDING', label: 'Pending' },
    { value: 'APPROVED', label: 'To pay' },
    { value: 'PAID', label: 'Paid' },
    { value: 'REJECTED', label: 'Rejected' },
]

const PAGE_SIZE = 20

export default function ClaimListScreen({ navigation, route }) {
    const isRegister = route?.params?.mode === 'register'

    const [claimList, setClaimList] = useState([])
    const [status, setStatus] = useState(route?.params?.initialStatus || 'ALL')
    const [locationID, setLocationID] = useState(null)
    const [locationList, setLocationList] = useState([])
    const [page, setPage] = useState(1)
    const [total, setTotal] = useState(0)
    const [totalAmount, setTotalAmount] = useState('0')
    const [isLoading, setIsLoading] = useState(true)
    const [isRefreshing, setIsRefreshing] = useState(false)
    const [isLoadingMore, setIsLoadingMore] = useState(false)
    const [errorMessage, setErrorMessage] = useState('')

    // The window is on expenseDate, so a September receipt keyed in during October
    // still belongs to September.
    const [fromDate, setFromDate] = useState(null)
    const [toDate, setToDate] = useState(null)
    const [summary, setSummary] = useState(null)

    const { user, can } = useAuth()
    const canUsePeriods = can(PERMISSION.VIEW_CLAIM_PERIODS)
    const [periodList, setPeriodList] = useState([])
    const [activePeriod, setActivePeriod] = useState(null)
    const [isPickerOpen, setIsPickerOpen] = useState(false)
    const [isEditorOpen, setIsEditorOpen] = useState(false)
    const [draftTitle, setDraftTitle] = useState('')
    const [isSavingPeriod, setIsSavingPeriod] = useState(false)

    // Acting on a claim without leaving the list. The row actions are deliberately
    // icons on the status row rather than a button bar: the row already had empty
    // space on the right, so nothing gets taller.
    const [busyClaimID, setBusyClaimID] = useState(null)
    const [rejectingClaim, setRejectingClaim] = useState(null)
    const [rejectionReason, setRejectionReason] = useState('')

    const canApprove = can(PERMISSION.APPROVE_CLAIM)
    const canPay = can(PERMISSION.MARK_CLAIM_PAID)
    const canAdminister = can(PERMISSION.SUBMIT_CLAIM_ON_BEHALF)

    useEffect(() => {
        navigation.setOptions({ title: isRegister ? 'Claims register' : 'My claims' })
    }, [navigation, isRegister])

    useEffect(() => {
        if (!isRegister) return
        claimApi.getLocationList()
            .then((result) => setLocationList(Array.isArray(result) ? result : []))
            .catch(() => setLocationList([]))
    }, [isRegister])

    const loadPeriodList = useCallback(() => {
        if (!canUsePeriods) return
        claimApi.getClaimViewList()
            .then((result) => setPeriodList(result.data || []))
            .catch(() => setPeriodList([]))
    }, [canUsePeriods])

    useEffect(() => { loadPeriodList() }, [loadPeriodList])

    const fetchPage = useCallback(async (targetPage) => {
        const filters = { page: targetPage, pageSize: PAGE_SIZE }
        if (status !== 'ALL') filters.status = status
        if (locationID) filters.locationID = locationID
        if (fromDate) filters.fromDate = fromDate
        if (toDate) filters.toDate = toDate
        return isRegister ? claimApi.getAllClaimList(filters) : claimApi.getMyClaimList(filters)
    }, [isRegister, status, locationID, fromDate, toDate])

    const load = useCallback(async () => {
        setErrorMessage('')
        try {
            const result = await fetchPage(1)
            setClaimList(result.data || [])
            setTotal(result.total || 0)
            setTotalAmount(result.totalAmount || '0')
            setSummary(result.summary || null)
            setPage(1)
        } catch (error) {
            setErrorMessage(describeError(error, 'Could not load claims.'))
        }
        setIsLoading(false)
    }, [fetchPage])

    useFocusEffect(useCallback(() => { load() }, [load]))

    const onRefresh = async () => {
        setIsRefreshing(true)
        await load()
        setIsRefreshing(false)
    }

    const onEndReached = async () => {
        if (isLoadingMore || claimList.length >= total) return
        setIsLoadingMore(true)
        try {
            const nextPage = page + 1
            const result = await fetchPage(nextPage)
            setClaimList((previous) => [...previous, ...(result.data || [])])
            setPage(nextPage)
        } catch (error) {
            setErrorMessage(describeError(error, 'Could not load more.'))
        }
        setIsLoadingMore(false)
    }

    const applyPeriod = (period) => {
        setActivePeriod(period)
        setFromDate(period.fromDate)
        setToDate(period.toDate)
        setStatus(period.status || 'ALL')
        setLocationID(period.location?.id || null)
        setIsPickerOpen(false)
    }

    const clearPeriod = () => {
        setActivePeriod(null)
        setFromDate(null)
        setToDate(null)
    }

    const onSavePeriod = async (isShared) => {
        const title = draftTitle.trim()
        if (!title || !fromDate || !toDate || isSavingPeriod) return
        setIsSavingPeriod(true)
        try {
            const saved = await claimApi.saveClaimView({
                title,
                fromDate,
                toDate,
                locationID: locationID || undefined,
                status: status === 'ALL' ? undefined : status,
                isShared,
            })
            setDraftTitle('')
            setActivePeriod(saved)
            setIsEditorOpen(false)
            loadPeriodList()
            Toast.show({ type: 'success', text1: `${title} saved` })
        } catch (error) {
            Toast.show({
                type: 'error',
                text1: 'Could not save this period',
                text2: describeError(error),
            })
        }
        setIsSavingPeriod(false)
    }

    const onDeletePeriod = (period) => {
        Alert.alert(
            `Delete "${period.title}"?`,
            'Only the saved window goes - the claims it matched are untouched.',
            [
                { text: 'Keep', style: 'cancel' },
                {
                    text: 'Delete',
                    style: 'destructive',
                    onPress: async () => {
                        try {
                            await claimApi.removeClaimView(period.id)
                            if (activePeriod?.id === period.id) clearPeriod()
                            loadPeriodList()
                        } catch (error) {
                            Toast.show({
                                type: 'error',
                                text1: 'Could not delete',
                                text2: describeError(error),
                            })
                        }
                    },
                },
            ])
    }

    const runRowAction = async (claim, action, successMessage) => {
        if (busyClaimID) return
        setBusyClaimID(claim.id)
        try {
            await action()
            Toast.show({ type: 'success', text1: successMessage })
            await load()
        } catch (error) {
            Toast.show({
                type: 'error',
                text1: 'That did not go through',
                text2: describeError(error),
            })
        }
        setBusyClaimID(null)
    }

    const onRowAttach = async (claim) => {
        const pickedList = await pickAttachment()
        if (pickedList.length === 0) return
        await runRowAction(claim, async () => {
            for (const asset of pickedList) {
                await claimApi.uploadClaimAttachment({ claimID: claim.id, asset })
            }
        }, 'Receipt attached')
    }

    const onRowApprove = (claim) => {
        // Named and priced in the confirm: approving from a list is one tap, and the
        // whole risk is doing it to the wrong row without looking.
        Alert.alert(
            'Approve this claim?',
            `${claim.title}\n${formatMoney(claim.amount)} · ${claim.staff?.name || ''}`,
            [
                { text: 'Cancel', style: 'cancel' },
                {
                    text: 'Approve',
                    onPress: () => runRowAction(
                        claim,
                        () => claimApi.approveClaim({ claimID: claim.id }),
                        'Claim approved'),
                },
            ])
    }

    const onRowMarkPaid = (claim) => {
        Alert.alert(
            'Mark this paid?',
            `${claim.title}\n${formatMoney(claim.amount)} to ${claim.staff?.name || ''}`
            + '\n\nOnly once the money has actually gone out.',
            [
                { text: 'Cancel', style: 'cancel' },
                {
                    text: 'Mark paid',
                    onPress: () => runRowAction(
                        claim,
                        () => claimApi.markClaimPaid({ claimID: claim.id }),
                        'Marked paid'),
                },
            ])
    }

    const onConfirmRowReject = async () => {
        const reason = rejectionReason.trim()
        const claim = rejectingClaim
        if (!reason || !claim) return
        setRejectingClaim(null)
        await runRowAction(
            claim,
            () => claimApi.rejectClaim({ claimID: claim.id, rejectionReason: reason }),
            'Claim rejected')
    }

    /**
     * What this claim can actually have done to it, in the order they get used.
     * Returned as a list so the bar can split itself evenly - one action fills the
     * width, three take a third each - and so a claim with none renders no bar at all.
     */
    const rowActionList = (claim) => {
        if (!isRegister) return []
        const list = []
        if (claim.status === 'PENDING'
            && (claim.staff?.id === user?.id || canAdminister)) {
            list.push({
                key: 'attach',
                icon: 'attach-outline',
                label: 'Receipt',
                color: colors.inkMuted,
                onPress: () => onRowAttach(claim),
            })
        }
        if (claim.status === 'PENDING' && canApprove) {
            list.push({
                key: 'approve',
                icon: 'checkmark-circle-outline',
                label: 'Approve',
                color: colors.approved,
                onPress: () => onRowApprove(claim),
            })
            list.push({
                key: 'reject',
                icon: 'close-circle-outline',
                label: 'Reject',
                color: colors.rejected,
                onPress: () => { setRejectingClaim(claim); setRejectionReason('') },
            })
        }
        if (claim.status === 'APPROVED' && canPay) {
            list.push({
                key: 'pay',
                icon: 'cash-outline',
                label: 'Mark paid',
                color: colors.brandDark,
                onPress: () => onRowMarkPaid(claim),
            })
        }
        return list
    }

    if (isLoading) return <LoadingView message="Loading claims" />

    return (
        <SafeAreaView style={styles.safe} edges={['bottom']}>
            <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                style={styles.filterScroll}
                contentContainerStyle={styles.filterBar}
            >
                {STATUS_FILTER_LIST.map((filter) => {
                    const isSelected = filter.value === status
                    return (
                        <Pressable
                            key={filter.value}
                            onPress={() => { setStatus(filter.value); setIsLoading(true) }}
                            style={[styles.chip, isSelected && styles.chipSelected]}
                        >
                            <Text style={[styles.chipText, isSelected && styles.chipTextSelected]}>
                                {filter.label}
                            </Text>
                        </Pressable>
                    )
                })}
            </ScrollView>

            {isRegister && locationList.length > 0 && (
                <ScrollView
                    horizontal
                    showsHorizontalScrollIndicator={false}
                    style={styles.filterScroll}
                    contentContainerStyle={styles.locationBar}
                >
                    <Pressable
                        onPress={() => { setLocationID(null); setIsLoading(true) }}
                        style={[styles.chip, styles.chipSmall, !locationID && styles.chipSelected]}
                    >
                        <Text style={[styles.chipText, !locationID && styles.chipTextSelected]}>
                            All locations
                        </Text>
                    </Pressable>
                    {locationList.map((location) => {
                        const isSelected = String(location.id) === String(locationID)
                        return (
                            <Pressable
                                key={location.id}
                                onPress={() => { setLocationID(location.id); setIsLoading(true) }}
                                style={[styles.chip, styles.chipSmall, isSelected && styles.chipSelected]}
                            >
                                <Text style={[styles.chipText, isSelected && styles.chipTextSelected]}>
                                    {location.title}
                                </Text>
                            </Pressable>
                        )
                    })}
                </ScrollView>
            )}

            {(total > 0 || (isRegister && canUsePeriods)) && (
                <View style={styles.summaryBlock}>
                    <View style={styles.summaryBar}>
                        {/* The period lives with the figures it changes rather than
                            taking a row of its own above them. */}
                        {isRegister && canUsePeriods ? (
                            <Pressable
                                onPress={() => setIsPickerOpen(true)}
                                style={({ pressed }) => [styles.periodPick, pressed && styles.pressed]}
                                hitSlop={6}
                            >
                                <Text style={styles.summaryText}>
                                    {total} claim{total === 1 ? '' : 's'} ·{' '}
                                </Text>
                                <Text style={styles.periodName}>
                                    {activePeriod ? activePeriod.title
                                        : (fromDate || toDate ? 'Custom window' : 'All dates')}
                                </Text>
                                <Ionicons name="chevron-down" size={14} color={colors.brandDark} />
                            </Pressable>
                        ) : (
                            <Text style={styles.summaryText}>
                                {total} claim{total === 1 ? '' : 's'}
                            </Text>
                        )}
                        <Text style={styles.summaryAmount}>{formatMoney(totalAmount)}</Text>
                    </View>

                    {/* One number does not answer "what does this period cost me":
                        the split between claimed, approved and paid is the point. */}
                    {isRegister && !!summary && (
                    <View style={styles.breakdown}>
                    <View style={styles.breakdownRow}>
                        <Text style={styles.breakdownLabel}>Approved</Text>
                        <Text style={styles.breakdownValue}>
                            {formatMoney(summary.approvedAmount)}
                        </Text>
                    </View>
                    <View style={styles.breakdownRow}>
                        <Text style={styles.breakdownLabel}>Paid</Text>
                        <Text style={styles.breakdownValue}>
                            {formatMoney(summary.paidAmount)}
                        </Text>
                    </View>
                    <View style={styles.breakdownRow}>
                        <Text style={[styles.breakdownLabel, styles.outstandingLabel]}>
                            Still owed
                        </Text>
                        <Text style={[styles.breakdownValue, styles.outstandingValue]}>
                            {formatMoney(summary.outstandingAmount)}
                        </Text>
                    </View>
                    {(summary.pendingCount > 0 || summary.awaitingPaymentCount > 0) && (
                        <Text style={styles.breakdownNote}>
                            {summary.pendingCount} awaiting approval
                            {' · '}
                            {summary.awaitingPaymentCount} approved, not yet paid
                        </Text>
                    )}
                    </View>
                    )}
                </View>
            )}

            <FlatList
                data={claimList}
                keyExtractor={(item) => String(item.id)}
                contentContainerStyle={styles.listContent}
                refreshControl={<RefreshControl refreshing={isRefreshing} onRefresh={onRefresh} />}
                onEndReached={onEndReached}
                onEndReachedThreshold={0.4}
                ListHeaderComponent={<ErrorBanner message={errorMessage} onRetry={load} />}
                ListEmptyComponent={(
                    <EmptyState
                        icon="receipt-outline"
                        title={status === 'ALL' ? 'No claims yet' : `Nothing ${status.toLowerCase()}`}
                        message={isRegister
                            ? 'Claims appear here as staff submit them.'
                            : 'Submit a claim and it will show up here.'}
                    />
                )}
                ListFooterComponent={isLoadingMore
                    ? <Text style={styles.footer}>Loading more...</Text> : null}
                renderItem={({ item }) => {
                    const statusStyle = CLAIM_STATUS_STYLE[item.status]
                        || CLAIM_STATUS_STYLE.PENDING
                    return (
                        <Card
                            onPress={() => navigation.navigate('ClaimDetail', { claimID: item.id })}
                        >
                            <View style={styles.header}>
                                <View style={styles.flex}>
                                    <Text style={styles.title}>{item.title}</Text>
                                </View>
                                <Text style={styles.amount}>{formatMoney(item.amount)}</Text>
                            </View>

                            <View style={styles.metaRow}>
                                {!!item.location && (
                                    <View style={styles.metaChip}>
                                        <Ionicons name="location-outline" size={12}
                                                  color={colors.inkMuted} />
                                        <Text style={styles.metaText}>{item.location.title}</Text>
                                    </View>
                                )}
                                {!!item.staff && (
                                    <View style={styles.metaChip}>
                                        <Ionicons name="person-outline" size={12}
                                                  color={colors.inkMuted} />
                                        <Text style={styles.metaText}>
                                            {item.staff.name}
                                        </Text>
                                    </View>
                                )}
                                {!!item.claimType && (
                                    <View style={styles.metaChip}>
                                        <Ionicons name="pricetag-outline" size={12}
                                                  color={colors.inkMuted} />
                                        <Text style={styles.metaText}>
                                            {item.claimType.title}
                                        </Text>
                                    </View>
                                )}
                                {!!item.expenseDate && (
                                    <Text style={styles.metaText} numberOfLines={1}>
                                        {item.expenseDate}
                                    </Text>
                                )}
                            </View>

                            <View style={styles.footerRow}>
                                <View style={[styles.pill, { backgroundColor: statusStyle.background }]}>
                                    <Text style={[styles.pillText, { color: statusStyle.color }]}>
                                        {statusStyle.label}
                                    </Text>
                                </View>
                                <Text style={styles.date}>{formatTimestamp(item.createDate)}</Text>
                                {item.onBehalf && (
                                    <Text style={styles.date}>via {item.submittedBy?.name}</Text>
                                )}

                                {/* Back in the corner the action icons vacated. Shown
                                    even at zero, because "no receipt yet" is the useful
                                    state - and tinted when the category requires one and
                                    it is missing, since that is what blocks approval. */}
                                <View style={styles.receiptCount}>
                                    <Text style={[styles.receiptCountText,
                                                  item.needsReceipt && styles.receiptCountWarn]}>
                                        {item.attachmentCount || 0}
                                    </Text>
                                    <Ionicons
                                        name="receipt-outline"
                                        size={14}
                                        color={item.needsReceipt ? colors.pending : colors.inkFaint}
                                    />
                                </View>
                            </View>

                            {(() => {
                                const actionList = rowActionList(item)
                                if (actionList.length === 0) return null
                                // A full-width row of real targets, split evenly. It
                                // costs a line of height, which is the trade for being
                                // reliably tappable on any device.
                                return (
                                    <View style={styles.actionBar}>
                                        {busyClaimID === item.id ? (
                                            <Text style={styles.actionBusy}>Working...</Text>
                                        ) : actionList.map((action, index) => (
                                            <Pressable
                                                key={action.key}
                                                onPress={action.onPress}
                                                style={({ pressed }) => [
                                                    styles.actionCell,
                                                    index > 0 && styles.actionDivided,
                                                    pressed && styles.pressed,
                                                ]}
                                            >
                                                <Ionicons name={action.icon} size={18}
                                                          color={action.color} />
                                                <Text style={[styles.actionLabel,
                                                              { color: action.color }]}>
                                                    {action.label}
                                                </Text>
                                            </Pressable>
                                        ))}
                                    </View>
                                )
                            })()}
                        </Card>
                    )
                }}
            />
            {/* Picking a period is a short list, so it is a popout rather than a
                whole screen. Building one is a form, so that gets the full screen. */}
            <Modal visible={isPickerOpen} transparent animationType="fade"
                   onRequestClose={() => setIsPickerOpen(false)}>
                <Pressable style={styles.pickerBackdrop} onPress={() => setIsPickerOpen(false)}>
                    <Pressable style={styles.pickerCard} onPress={() => {}}>
                        <Text style={styles.pickerTitle}>Claim period</Text>

                        <Pressable
                            onPress={() => { clearPeriod(); setIsPickerOpen(false) }}
                            style={({ pressed }) => [styles.pickerRow, pressed && styles.pressed]}
                        >
                            <Ionicons
                                name={(fromDate || toDate) ? 'ellipse-outline' : 'checkmark-circle'}
                                size={18}
                                color={(fromDate || toDate) ? colors.inkFaint : colors.brandDark}
                            />
                            <Text style={styles.pickerRowText}>All dates</Text>
                        </Pressable>

                        {periodList.map((period) => {
                            const isActive = activePeriod?.id === period.id
                            return (
                                <Pressable
                                    key={period.id}
                                    onPress={() => applyPeriod(period)}
                                    style={({ pressed }) => [styles.pickerRow, pressed && styles.pressed]}
                                >
                                    <Ionicons
                                        name={isActive ? 'checkmark-circle' : 'ellipse-outline'}
                                        size={18}
                                        color={isActive ? colors.brandDark : colors.inkFaint}
                                    />
                                    <View style={styles.flex}>
                                        <Text style={styles.pickerRowText}>{period.title}</Text>
                                        <Text style={styles.pickerRowMeta}>
                                            {period.fromDate} to {period.toDate}
                                            {period.isShared ? ' · shared' : ''}
                                        </Text>
                                    </View>
                                    <Pressable onPress={() => onDeletePeriod(period)} hitSlop={8}>
                                        <Ionicons name="trash-outline" size={16}
                                                  color={colors.rejected} />
                                    </Pressable>
                                </Pressable>
                            )
                        })}

                        <Pressable
                            onPress={() => { setIsPickerOpen(false); setIsEditorOpen(true) }}
                            style={({ pressed }) => [styles.pickerRow, pressed && styles.pressed]}
                        >
                            <Ionicons name="add-circle-outline" size={18} color={colors.brandDark} />
                            <Text style={[styles.pickerRowText, styles.pickerAdd]}>
                                New period...
                            </Text>
                        </Pressable>
                    </Pressable>
                </Pressable>
            </Modal>

            <Modal visible={rejectingClaim !== null} transparent animationType="fade"
                   onRequestClose={() => setRejectingClaim(null)}>
                <View style={styles.pickerBackdrop}>
                    <View style={styles.pickerCard}>
                        <Text style={styles.pickerTitle}>
                            Reject "{rejectingClaim?.title}"
                        </Text>
                        <Text style={styles.sheetHint}>
                            {formatMoney(rejectingClaim?.amount || 0)}
                            {rejectingClaim?.staff?.name ? ` · ${rejectingClaim.staff.name}` : ''}
                        </Text>
                        <TextField
                            label="Why?"
                            hint="The staff member sees this."
                            placeholder="e.g. Buy through the store instead"
                            value={rejectionReason}
                            onChangeText={setRejectionReason}
                            multiline
                        />
                        <View style={styles.sheetRow}>
                            <PrimaryButton
                                title="Reject"
                                variant="danger"
                                onPress={onConfirmRowReject}
                                disabled={rejectionReason.trim().length === 0}
                                style={styles.flex}
                            />
                            <PrimaryButton
                                title="Back"
                                variant="ghost"
                                onPress={() => setRejectingClaim(null)}
                                style={styles.flex}
                            />
                        </View>
                    </View>
                </View>
            </Modal>

            <FullScreenModal
                isVisible={isEditorOpen}
                title="New claim period"
                onClose={() => setIsEditorOpen(false)}
            >
                <ScrollView
                    contentContainerStyle={styles.sheetScroll}
                    keyboardShouldPersistTaps="handled"
                >
                    <Text style={styles.sheetHint}>
                        Dates are matched on when the money was spent, so a September
                        receipt keyed in during October still counts as September.
                    </Text>

                    <DateField label="From" value={fromDate} onChange={setFromDate} />
                    <DateField label="To" value={toDate} onChange={setToDate} />

                    <TextField
                        label="Name"
                        hint="What you will recognise it by."
                        placeholder="September 2026"
                        value={draftTitle}
                        onChangeText={setDraftTitle}
                    />

                    <View style={styles.sheetRow}>
                        <PrimaryButton
                            title="Save for me"
                            variant="ghost"
                            onPress={() => onSavePeriod(false)}
                            loading={isSavingPeriod}
                            disabled={!draftTitle.trim() || !fromDate || !toDate}
                            style={styles.flex}
                        />
                        <PrimaryButton
                            title="Save and share"
                            onPress={() => onSavePeriod(true)}
                            loading={isSavingPeriod}
                            disabled={!draftTitle.trim() || !fromDate || !toDate}
                            style={styles.flex}
                        />
                    </View>
                    <Text style={styles.sheetHint}>
                        Sharing publishes it to everyone who can view all claims - a
                        financial month is usually a company fact, not a personal one.
                    </Text>

                    <PrimaryButton
                        title="Just use these dates, do not save"
                        variant="ghost"
                        onPress={() => {
                            setActivePeriod(null)
                            setIsEditorOpen(false)
                        }}
                        disabled={!fromDate && !toDate}
                        style={styles.sheetSection}
                    />
                </ScrollView>
            </FullScreenModal>

        </SafeAreaView>
    )
}

const styles = StyleSheet.create({
    safe: { flex: 1, backgroundColor: colors.ground },
    flex: { flex: 1 },
    pressed: { opacity: 0.7 },

    filterScroll: { flexGrow: 0, flexShrink: 0 },
    filterBar: {
        paddingHorizontal: spacing.lg,
        paddingTop: spacing.md,
        paddingBottom: spacing.sm,
        gap: spacing.sm,
        alignItems: 'center',
    },
    locationBar: {
        paddingHorizontal: spacing.lg,
        paddingBottom: spacing.md,
        gap: spacing.sm,
        alignItems: 'center',
    },
    chip: {
        paddingHorizontal: spacing.lg,
        height: 34,
        justifyContent: 'center',
        borderRadius: radius.pill,
        borderWidth: 1,
        borderColor: colors.line,
        backgroundColor: colors.surface,
    },
    chipSmall: { height: 30, paddingHorizontal: spacing.md },
    chipSelected: { backgroundColor: colors.ink, borderColor: colors.ink },
    chipText: { ...type.small, fontWeight: '600' },
    chipTextSelected: { color: '#FFFFFF' },

    summaryBlock: {
        paddingHorizontal: spacing.lg,
        paddingBottom: spacing.md,
        borderBottomWidth: 1,
        borderBottomColor: colors.line,
    },
    summaryBar: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
    },
    summaryText: { ...type.small },
    summaryAmount: { ...type.subheading },

    periodPick: { flexDirection: 'row', alignItems: 'center', gap: 2, flexShrink: 1 },
    periodName: { ...type.small, fontWeight: '700', color: colors.brandDark },

    pickerBackdrop: {
        flex: 1,
        backgroundColor: 'rgba(0,0,0,0.35)',
        justifyContent: 'center',
        padding: spacing.xl,
    },
    pickerCard: {
        backgroundColor: colors.surface,
        borderRadius: radius.lg,
        padding: spacing.lg,
        gap: spacing.xs,
        maxHeight: '75%',
    },
    pickerTitle: { ...type.subheading, marginBottom: spacing.sm },
    pickerRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: spacing.md,
        paddingVertical: spacing.md,
        borderBottomWidth: 1,
        borderBottomColor: colors.line,
    },
    pickerRowText: { ...type.body, flexShrink: 1 },
    pickerRowMeta: { ...type.small, fontSize: 11, marginTop: 1 },
    pickerAdd: { color: colors.brandDark, fontWeight: '600' },

    breakdown: { gap: 2, marginTop: spacing.sm },
    breakdownRow: { flexDirection: 'row', justifyContent: 'space-between' },
    breakdownLabel: { ...type.small, fontSize: 12 },
    breakdownValue: { ...type.small, fontSize: 12, fontWeight: '600' },
    outstandingLabel: { color: colors.pending },
    outstandingValue: { color: colors.pending },
    breakdownNote: { ...type.small, fontSize: 11, marginTop: spacing.xs },

    sheetScroll: { padding: spacing.lg, paddingBottom: spacing.xxl },
    sheetHint: { ...type.small, fontSize: 12, marginBottom: spacing.md },
    sheetSection: { marginTop: spacing.xl },
    sheetRow: { flexDirection: 'row', gap: spacing.md, marginBottom: spacing.sm },

    listContent: { padding: spacing.lg, paddingTop: 0, gap: spacing.sm, flexGrow: 1 },
    header: { flexDirection: 'row', alignItems: 'flex-start', gap: spacing.md },
    staffName: { ...type.subheading },
    title: { ...type.body, marginTop: 1 },
    amount: { ...type.subheading, fontWeight: '800' },

    metaRow: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        alignItems: 'center',
        gap: spacing.sm,
        marginTop: spacing.sm,
    },
    metaChip: { flexDirection: 'row', alignItems: 'center', gap: 3 },
    metaText: { ...type.small, fontSize: 12 },

    footerRow: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        alignItems: 'center',
        gap: spacing.md,
        marginTop: spacing.md,
    },
    receiptCount: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 3,
        marginLeft: 'auto',
    },
    receiptCountText: { ...type.small, fontSize: 12, color: colors.inkFaint },
    receiptCountWarn: { color: colors.pending, fontWeight: '700' },

    actionBar: {
        flexDirection: 'row',
        alignItems: 'stretch',
        marginTop: spacing.md,
        borderTopWidth: 1,
        borderTopColor: colors.line,
        minHeight: 44,
    },
    actionCell: {
        flex: 1,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: spacing.xs,
        paddingVertical: spacing.md,
    },
    actionDivided: { borderLeftWidth: 1, borderLeftColor: colors.line },
    actionLabel: { ...type.small, fontSize: 13, fontWeight: '600' },
    actionBusy: { ...type.small, flex: 1, textAlign: 'center', paddingVertical: spacing.md },
    pill: {
        paddingHorizontal: spacing.md,
        paddingVertical: 3,
        borderRadius: radius.pill,
    },
    pillText: { fontSize: 12, fontWeight: '700' },
    date: { ...type.small, fontSize: 11, color: colors.inkFaint },

    footer: { ...type.small, textAlign: 'center', padding: spacing.lg },
})
