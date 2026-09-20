import React, { useCallback, useState } from 'react'
import {
    Alert, Image, Linking, Modal, Pressable, RefreshControl, ScrollView, StyleSheet, Text, View,
} from 'react-native'
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context'
import { useFocusEffect } from '@react-navigation/native'
import { Ionicons } from '@expo/vector-icons'
import Toast from 'react-native-toast-message'

import { useAuth } from '../context/AuthContext'
import { PERMISSION } from '../permissions'
import * as claimApi from '../api/claims'
import { describeError } from '../api/client'
import { TextField } from '../components/fields'
import { pickAttachment } from '../components/attachments'
import ExpenseRow from '../components/ExpenseRow'
import {
    Card, ErrorBanner, LoadingView, PrimaryButton, Row, SectionLabel,
} from '../components/ui'
import { formatTimestamp } from '../lib/dates'
import { formatMoney } from '../lib/money'
import { CLAIM_STATUS_STYLE } from '../lib/claimStatus'
import { colors, radius, spacing, type } from '../theme'

const ACTION_LABEL = {
    SUBMITTED: 'Submitted',
    APPROVED: 'Approved',
    REJECTED: 'Rejected',
    CANCELLED: 'Cancelled',
    PAID: 'Marked paid',
}

/**
 * The master layout: every expense in the claim on one page, each with its own
 * receipts and its own approve/reject. Nothing here needs a second screen.
 */
export default function ClaimDetailScreen({ navigation, route }) {
    const { claimID } = route.params
    const { user, can } = useAuth()
    const insets = useSafeAreaInsets()

    const [claim, setClaim] = useState(null)
    const [logList, setLogList] = useState([])
    const [isLoading, setIsLoading] = useState(true)
    const [isRefreshing, setIsRefreshing] = useState(false)
    const [errorMessage, setErrorMessage] = useState('')
    const [isWorking, setIsWorking] = useState(false)

    // Signed receipt URLs arrive with the claim and expire in five minutes, so they
    // are used straight from the response and never cached.
    const [previewUrl, setPreviewUrl] = useState(null)

    const [rejectingItem, setRejectingItem] = useState(null)
    const [rejectionReason, setRejectionReason] = useState('')
    const [isPaying, setIsPaying] = useState(false)
    const [paymentReference, setPaymentReference] = useState('')
    // Which person's reimbursement the pay panel is for. A shared claim settles one
    // person at a time, so this is never implicit.
    const [payingStaff, setPayingStaff] = useState(null)

    const load = useCallback(async () => {
        setErrorMessage('')
        try {
            const result = await claimApi.getClaimDetail(claimID)
            setClaim(result.data)
            setLogList(result.logList || [])
        } catch (error) {
            setErrorMessage(describeError(error, 'Could not load this claim.'))
        }
        setIsLoading(false)
    }, [claimID])

    useFocusEffect(useCallback(() => { load() }, [load]))

    const onRefresh = async () => {
        setIsRefreshing(true)
        await load()
        setIsRefreshing(false)
    }

    if (isLoading) return <LoadingView message="Loading claim" />

    if (!claim) {
        return (
            <SafeAreaView style={styles.safe}>
                <View style={styles.padded}>
                    <ErrorBanner message={errorMessage || 'This claim could not be found.'}
                                 onRetry={load} />
                </View>
            </SafeAreaView>
        )
    }

    const statusStyle = CLAIM_STATUS_STYLE[claim.status] || CLAIM_STATUS_STYLE.PENDING
    const summary = claim.itemStatusSummary || {}
    // A claim is a shared folder: "mine" is no longer a property of the claim but of
    // the expenses inside it, and anyone may add their own.
    const isCreator = claim.createdBy?.id === user?.id
    const seesEveryone = !!claim.canSeeEveryone
    const staffSummaryList = claim.staffSummaryList || []
    const canAdminister = can(PERMISSION.SUBMIT_CLAIM_ON_BEHALF)
    const isOpen = claim.status !== 'PAID' && claim.status !== 'CANCELLED'

    const canDecide = can(PERMISSION.APPROVE_CLAIM) && isOpen
    const canEdit = isOpen
    const canPay = can(PERMISSION.MARK_CLAIM_PAID) && isOpen
    const canCancel = isOpen
        && ((claim.status === 'PENDING' && (isCreator || canAdminister)) || canAdminister)
    const liveItemList = (claim.itemList || []).filter((item) => item.status !== 'CANCELLED')
    const claimLevelAttachmentList = (claim.attachmentList || [])
        .filter((attachment) => !attachment.claimItem)

    const runAction = async (action, successMessage) => {
        setIsWorking(true)
        try {
            await action()
            if (successMessage) Toast.show({ type: 'success', text1: successMessage })
            await load()
        } catch (error) {
            Toast.show({
                type: 'error',
                text1: 'That did not go through',
                text2: describeError(error),
            })
        }
        setIsWorking(false)
    }

    const onOpenReceipt = async (attachment) => {
        if (attachment?.imageUrl) {
            setPreviewUrl(attachment.imageUrl)
            return
        }
        // Falls back to minting one, in case the page has been open long enough for
        // the URL that came with it to expire.
        try {
            const result = await claimApi.getClaimAttachmentUrl(attachment.id)
            setPreviewUrl(result.url)
        } catch (error) {
            Toast.show({ type: 'error', text1: 'Could not open', text2: describeError(error) })
        }
    }

    const onAttachToItem = async (item) => {
        const pickedList = await pickAttachment()
        if (pickedList.length === 0) return
        await runAction(async () => {
            for (const asset of pickedList) {
                await claimApi.uploadClaimAttachment({
                    claimID, claimItemID: item.id, asset,
                })
            }
        }, 'Receipt attached')
    }

    const onApproveItem = (item) => {
        Alert.alert('Approve this expense?', `${item.title} - ${formatMoney(item.amount)}`, [
            { text: 'Not now', style: 'cancel' },
            {
                text: 'Approve',
                onPress: () => runAction(
                    () => claimApi.approveClaimItem({ claimItemID: item.id }),
                    'Expense approved',
                ),
            },
        ])
    }

    const onConfirmRejectItem = async () => {
        if (rejectionReason.trim().length === 0) return
        await runAction(
            () => claimApi.rejectClaimItem({
                claimItemID: rejectingItem.id,
                rejectionReason: rejectionReason.trim(),
            }),
            'Expense rejected',
        )
        setRejectingItem(null)
        setRejectionReason('')
    }

    const onRemoveItem = (item) => {
        Alert.alert('Remove this expense?', `${item.title} comes off the claim.`, [
            { text: 'Keep it', style: 'cancel' },
            {
                text: 'Remove',
                style: 'destructive',
                onPress: () => runAction(
                    () => claimApi.removeClaimItem(item.id),
                    'Expense removed',
                ),
            },
        ])
    }

    const onApproveAll = () => {
        const pendingCount = summary.PENDING || 0
        Alert.alert(
            `Approve all ${pendingCount} remaining?`,
            'Every expense still pending gets approved. Ones you already rejected stay rejected.',
            [
                { text: 'Not now', style: 'cancel' },
                {
                    text: 'Approve all',
                    onPress: () => runAction(
                        () => claimApi.approveClaim({ claimID }),
                        'Expenses approved',
                    ),
                },
            ],
        )
    }

    const onMarkPaid = async () => {
        await runAction(
            () => claimApi.markClaimPaid({
                claimID,
                staffID: payingStaff?.id,
                paymentReference: paymentReference.trim(),
            }),
            `${payingStaff?.name || 'Claim'} marked as paid`,
        )
        setIsPaying(false)
        setPayingStaff(null)
        setPaymentReference('')
    }

    const onCancelClaim = () => {
        Alert.alert('Cancel this whole claim?', 'Every expense on it is withdrawn.', [
            { text: 'Keep it', style: 'cancel' },
            {
                text: 'Cancel claim',
                style: 'destructive',
                onPress: () => runAction(() => claimApi.cancelClaim({ claimID }), 'Claim cancelled'),
            },
        ])
    }

    return (
        <SafeAreaView style={styles.safe} edges={['bottom']}>
            <ScrollView
                contentContainerStyle={styles.scroll}
                refreshControl={<RefreshControl refreshing={isRefreshing} onRefresh={onRefresh} />}
            >
                <ErrorBanner message={errorMessage} onRetry={load} />

                <Card>
                    <View style={styles.headerRow}>
                        <View style={styles.flex}>
                            <Text style={styles.claimTitle}>{claim.title}</Text>
                            <Text style={styles.staffName}>
                                {seesEveryone
                                    ? `Opened by ${claim.createdBy?.name || 'someone'}`
                                    : 'Your expenses in this claim'}
                            </Text>
                        </View>
                        <View style={[styles.pill, { backgroundColor: statusStyle.background }]}>
                            <Text style={[styles.pillText, { color: statusStyle.color }]}>
                                {statusStyle.label}
                            </Text>
                        </View>
                    </View>

                    <View style={styles.amountRow}>
                        <View style={styles.flex}>
                            <Text style={styles.amountLabel}>
                                {seesEveryone ? 'CLAIMED (EVERYONE)' : 'YOU CLAIMED'}
                            </Text>
                            <Text style={styles.amountValue}>{formatMoney(claim.totalAmount)}</Text>
                        </View>
                        {claim.isPartiallyApproved && (
                            <View style={styles.flex}>
                                <Text style={[styles.amountLabel, styles.approvedLabel]}>
                                    TO BE PAID
                                </Text>
                                <Text style={[styles.amountValue, styles.approvedValue]}>
                                    {formatMoney(claim.approvedAmount)}
                                </Text>
                            </View>
                        )}
                    </View>

                    {claim.isPartiallyApproved && (
                        <View style={styles.partialNote}>
                            <Ionicons name="alert-circle-outline" size={16} color={colors.pending} />
                            <Text style={styles.partialText}>
                                {summary.APPROVED} approved, {summary.REJECTED} rejected
                            </Text>
                        </View>
                    )}

                    <View style={styles.divider} />

                    <Row label="Location" value={claim.location?.title || 'Not recorded'} />
                    <Row label="Opened" value={formatTimestamp(claim.createDate)} />
                    {(claim.payoutList || []).map((payout) => (
                        <Row
                            key={payout.id}
                            label={seesEveryone ? `Paid ${payout.staff?.name}` : 'You were paid'}
                            value={`${formatMoney(payout.amount)} · `
                                + `${formatTimestamp(payout.paidDate)}`
                                + (payout.note ? ` · ${payout.note}` : '')}
                        />
                    ))}

                    {claim.onBehalf && (
                        <View style={styles.note}>
                            <Ionicons name="information-circle-outline" size={16}
                                      color={colors.inkMuted} />
                            <Text style={styles.noteText}>
                                Entered by {claim.submittedBy?.name} on their behalf
                            </Text>
                        </View>
                    )}
                </Card>

                <View style={styles.expenseHeader}>
                    <SectionLabel>
                        {seesEveryone ? 'All expenses' : 'Your expenses'} ({liveItemList.length})
                    </SectionLabel>
                    {canDecide && (summary.PENDING || 0) > 1 && (
                        <Pressable onPress={onApproveAll} disabled={isWorking} hitSlop={8}>
                            <Text style={styles.approveAll}>
                                Approve all {summary.PENDING}
                            </Text>
                        </Pressable>
                    )}
                </View>

                <View style={styles.expenseList}>
                    {liveItemList.map((item) => (
                        <ExpenseRow
                            key={item.id}
                            item={item}
                            // Shown only when looking at everybody's, where it is the
                            // only thing distinguishing one row from another.
                            showOwner={seesEveryone}
                            canDecide={canDecide}
                            canAttach={canEdit && item.status === 'PENDING'
                                && (item.staff?.id === user?.id || canAdminister)}
                            canRemove={canEdit && item.status === 'PENDING'
                                && (item.staff?.id === user?.id || canAdminister)}
                            isBusy={isWorking}
                            onAttach={() => onAttachToItem(item)}
                            onOpenReceipt={onOpenReceipt}
                            onApprove={() => onApproveItem(item)}
                            onReject={() => { setRejectingItem(item); setRejectionReason('') }}
                            onRemove={() => onRemoveItem(item)}
                        />
                    ))}
                </View>

                {canEdit && (
                    <PrimaryButton
                        title="Add an expense"
                        variant="ghost"
                        onPress={() => navigation.navigate('AddExpense', { claimID })}
                        disabled={isWorking}
                        style={styles.addExpense}
                    />
                )}

                {claimLevelAttachmentList.length > 0 && (
                    <>
                        <SectionLabel style={styles.sectionSpacing}>
                            Documents for the whole claim
                        </SectionLabel>
                        <Card>
                            {claimLevelAttachmentList.map((attachment) => (
                                <Pressable
                                    key={attachment.id}
                                    onPress={() => onOpenReceipt(attachment)}
                                    style={({ pressed }) => [styles.docRow, pressed && styles.pressed]}
                                >
                                    <Ionicons name="document-attach-outline" size={20}
                                              color={colors.brandDark} />
                                    <View style={styles.flex}>
                                        <Text style={styles.docTitle}>
                                            Uploaded by {attachment.uploadedBy?.name || 'unknown'}
                                        </Text>
                                        <Text style={styles.docDate}>
                                            {formatTimestamp(attachment.createDate)}
                                        </Text>
                                    </View>
                                    <Ionicons name="eye-outline" size={18} color={colors.inkFaint} />
                                </Pressable>
                            ))}
                        </Card>
                    </>
                )}

                {logList.length > 0 && (
                    <>
                        <SectionLabel style={styles.sectionSpacing}>History</SectionLabel>
                        <Card>
                            {logList.map((log, index) => (
                                <View key={log.id} style={[styles.logRow, index > 0 && styles.logDivided]}>
                                    <Text style={styles.logAction}>
                                        {ACTION_LABEL[log.action] || log.action}
                                    </Text>
                                    <Text style={styles.logMeta}>
                                        {log.actor?.name || 'System'} · {formatTimestamp(log.createDate)}
                                    </Text>
                                    {!!log.note && <Text style={styles.logNote}>{log.note}</Text>}
                                </View>
                            ))}
                        </Card>
                    </>
                )}

                {canPay && !isPaying && seesEveryone && staffSummaryList.length > 0 && (
                    <>
                        <SectionLabel style={styles.sectionSpacing}>Reimbursements</SectionLabel>
                        <Card>
                            {staffSummaryList.map((row, index) => {
                                const approved = Number(row.approvedAmount || 0)
                                return (
                                    <View
                                        key={row.staff?.id}
                                        style={[styles.payRow, index > 0 && styles.payDivided]}
                                    >
                                        <View style={styles.flex}>
                                            <Text style={styles.payName}>{row.staff?.name}</Text>
                                            <Text style={styles.payMeta}>
                                                {formatMoney(row.approvedAmount)} approved
                                                {' of '}{formatMoney(row.totalAmount)}
                                            </Text>
                                        </View>
                                        {row.isPaid ? (
                                            <Text style={styles.paidTag}>PAID</Text>
                                        ) : (
                                            <PrimaryButton
                                                title="Mark paid"
                                                variant="ghost"
                                                disabled={isWorking || approved <= 0}
                                                onPress={() => {
                                                    setPayingStaff(row.staff)
                                                    setPaymentReference('')
                                                    setIsPaying(true)
                                                }}
                                            />
                                        )}
                                    </View>
                                )
                            })}
                        </Card>
                    </>
                )}

                {canPay && isPaying && (
                    <Card style={styles.sectionSpacing}>
                        <Text style={styles.payIntro}>
                            {payingStaff
                                ? `Paying ${payingStaff.name} for ${claim.title}. `
                                : ''}
                            Only mark this paid once the money has actually gone out. Payroll
                            happens outside this app, so nothing here moves it.
                        </Text>
                        <TextField
                            label="Payment reference"
                            hint="Optional - a transfer number makes this findable later."
                            placeholder="TRF-8891"
                            value={paymentReference}
                            onChangeText={setPaymentReference}
                        />
                        <View style={styles.actionRow}>
                            <PrimaryButton title="Confirm paid" onPress={onMarkPaid}
                                           loading={isWorking} style={styles.flex} />
                            <PrimaryButton title="Back" variant="ghost"
                                           onPress={() => { setIsPaying(false); setPayingStaff(null) }}
                                           disabled={isWorking} style={styles.flex} />
                        </View>
                    </Card>
                )}

                {can(PERMISSION.MARK_CLAIM_PAID) && claim.status === 'PENDING' && (
                    <Text style={styles.payBlocked}>
                        {summary.PENDING} expense{summary.PENDING === 1 ? '' : 's'} still
                        awaiting a decision - this cannot be paid yet.
                    </Text>
                )}

                {canCancel && (
                    <PrimaryButton
                        title="Cancel this claim"
                        variant="ghost"
                        onPress={onCancelClaim}
                        disabled={isWorking}
                        style={styles.sectionSpacing}
                    />
                )}
            </ScrollView>

            <Modal visible={rejectingItem !== null} transparent animationType="fade"
                   onRequestClose={() => setRejectingItem(null)}>
                <View style={styles.rejectBackdrop}>
                    <Card style={styles.rejectCard}>
                        <Text style={styles.rejectTitle}>Reject "{rejectingItem?.title}"</Text>
                        <Text style={styles.rejectAmount}>
                            {formatMoney(rejectingItem?.amount || 0)}
                        </Text>
                        <TextField
                            label="Why?"
                            hint="The staff member sees this."
                            placeholder="e.g. Buy through the store instead"
                            value={rejectionReason}
                            onChangeText={setRejectionReason}
                            multiline
                        />
                        <View style={styles.actionRow}>
                            <PrimaryButton title="Reject" variant="danger"
                                           onPress={onConfirmRejectItem}
                                           loading={isWorking}
                                           disabled={rejectionReason.trim().length === 0}
                                           style={styles.flex} />
                            <PrimaryButton title="Back" variant="ghost"
                                           onPress={() => setRejectingItem(null)}
                                           disabled={isWorking} style={styles.flex} />
                        </View>
                    </Card>
                </View>
            </Modal>

            <Modal visible={!!previewUrl} transparent animationType="fade"
                   onRequestClose={() => setPreviewUrl(null)}>
                <View style={styles.previewBackdrop}>
                    <Pressable
                        style={[styles.previewClose, { top: insets.top + spacing.md }]}
                        onPress={() => setPreviewUrl(null)}
                    >
                        <Ionicons name="close" size={28} color="#FFFFFF" />
                    </Pressable>
                    {!!previewUrl && (
                        <Image source={{ uri: previewUrl }} style={styles.previewImage}
                               resizeMode="contain" />
                    )}
                    <Pressable onPress={() => previewUrl && Linking.openURL(previewUrl)}>
                        <Text style={styles.previewOpen}>Open in browser</Text>
                    </Pressable>
                </View>
            </Modal>
        </SafeAreaView>
    )
}

const styles = StyleSheet.create({
    safe: { flex: 1, backgroundColor: colors.ground },
    scroll: { padding: spacing.lg, paddingBottom: spacing.xxl },
    padded: { padding: spacing.lg },
    flex: { flex: 1 },
    pressed: { opacity: 0.7 },
    payRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: spacing.md,
        paddingVertical: spacing.md,
    },
    payDivided: { borderTopWidth: 1, borderTopColor: colors.line },
    payName: { ...type.body, fontSize: 14, fontWeight: '600' },
    payMeta: { ...type.small, fontSize: 12, marginTop: 1 },
    paidTag: { ...type.small, fontSize: 11, fontWeight: '800', color: colors.approved },

    sectionSpacing: { marginTop: spacing.lg },

    headerRow: { flexDirection: 'row', alignItems: 'flex-start', gap: spacing.md },
    claimTitle: { ...type.heading },
    staffName: { ...type.small, marginTop: 1 },
    pill: { paddingHorizontal: spacing.md, paddingVertical: 3, borderRadius: radius.pill },
    pillText: { fontSize: 12, fontWeight: '700' },

    amountRow: { flexDirection: 'row', gap: spacing.lg, marginTop: spacing.lg },
    amountLabel: { ...type.label, fontSize: 10 },
    amountValue: { fontSize: 26, fontWeight: '800', color: colors.ink, marginTop: 2 },
    approvedLabel: { color: colors.approved },
    approvedValue: { color: colors.approved },

    partialNote: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: spacing.sm,
        marginTop: spacing.md,
        padding: spacing.md,
        backgroundColor: colors.pendingSoft,
        borderRadius: radius.md,
    },
    partialText: { ...type.small, fontSize: 12, color: colors.pending, fontWeight: '600' },

    divider: { height: 1, backgroundColor: colors.line, marginVertical: spacing.md },

    note: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: spacing.sm,
        marginTop: spacing.md,
        padding: spacing.md,
        backgroundColor: colors.ground,
        borderRadius: radius.md,
    },
    noteText: { ...type.small, fontSize: 12, flex: 1 },

    expenseHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        marginTop: spacing.xl,
    },
    approveAll: { ...type.small, fontWeight: '700', color: colors.brandDark },
    expenseList: { gap: spacing.sm },
    addExpense: { marginTop: spacing.md },

    docRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, paddingVertical: spacing.md },
    docTitle: { ...type.body, fontSize: 14 },
    docDate: { ...type.small, fontSize: 12 },

    logRow: { paddingVertical: spacing.md },
    logDivided: { borderTopWidth: 1, borderTopColor: colors.line },
    logAction: { ...type.body, fontWeight: '600' },
    logMeta: { ...type.small, fontSize: 12, marginTop: 1 },
    logNote: { ...type.small, marginTop: spacing.xs, fontStyle: 'italic' },

    actionRow: { flexDirection: 'row', gap: spacing.md },
    payIntro: { ...type.small, marginBottom: spacing.lg },
    payBlocked: {
        ...type.small,
        fontSize: 12,
        color: colors.pending,
        textAlign: 'center',
        marginTop: spacing.lg,
    },

    rejectBackdrop: {
        flex: 1,
        backgroundColor: 'rgba(0,0,0,0.45)',
        justifyContent: 'center',
        padding: spacing.lg,
    },
    rejectCard: { gap: spacing.xs },
    rejectTitle: { ...type.subheading },
    rejectAmount: { ...type.body, fontWeight: '700', marginBottom: spacing.md },

    previewBackdrop: {
        flex: 1,
        backgroundColor: 'rgba(0,0,0,0.92)',
        alignItems: 'center',
        justifyContent: 'center',
        gap: spacing.lg,
    },
    previewClose: { position: 'absolute', right: spacing.xl, zIndex: 2 },
    previewImage: { width: '92%', height: '72%' },
    previewOpen: { ...type.small, color: '#FFFFFF' },
})
