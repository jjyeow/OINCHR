import React, { useCallback, useState } from 'react'
import {
    Alert, Image, Modal, Pressable, RefreshControl, ScrollView, StyleSheet, Text, View,
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
import {
    Card, ErrorBanner, LoadingView, PrimaryButton, Row, SectionLabel,
} from '../components/ui'
import { formatTimestamp } from '../lib/dates'
import * as WebBrowser from 'expo-web-browser'

import { isPdf, displayNameFor, fileNameFromUrl, saveAttachment } from '../lib/download'
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
    // The whole attachment, not just its url: saving needs the file name to save
    // it under, and its id to mint a fresh url when the one on the page has expired.
    const [preview, setPreview] = useState(null)
    const [isSavingReceipt, setIsSavingReceipt] = useState(false)
    const [isOpeningReceipt, setIsOpeningReceipt] = useState(false)

    const [isRejecting, setIsRejecting] = useState(false)
    const [rejectionReason, setRejectionReason] = useState('')
    const [isPaying, setIsPaying] = useState(false)
    const [paymentReference, setPaymentReference] = useState('')
    // Which person's reimbursement the pay panel is for. A shared claim settles one
    // person at a time, so this is never implicit.

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
    // A claim is one person's single expense, so ownership is a property of the claim
    // itself again - there are no lines inside it to scope anything to.
    const isOwner = claim.staff?.id === user?.id
    const canAdminister = can(PERMISSION.SUBMIT_CLAIM_ON_BEHALF)
    const isOpen = claim.status !== 'PAID' && claim.status !== 'CANCELLED'

    const canDecide = can(PERMISSION.APPROVE_CLAIM) && claim.status === 'PENDING'
    const canEdit = isOpen && (isOwner || canAdminister)
    // Stricter than canEdit, which only governs attaching a receipt: the figures can
    // only be corrected while nobody has acted on them. The server refuses otherwise.
    const canEditFields = claim.status === 'PENDING'
        && ((isOwner && can(PERMISSION.EDIT_CLAIM)) || canAdminister)
    // Only an approved claim can be paid, which the server enforces too.
    const canPay = can(PERMISSION.MARK_CLAIM_PAID) && claim.status === 'APPROVED'
    const canCancel = isOpen
        && ((claim.status === 'PENDING' && (isOwner || canAdminister)) || canAdminister)
    const attachmentList = claim.attachmentList || []

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
            setPreview({
                url: attachment.imageUrl,
                // The url carries the object key, so a server that does not send
                // fileName still yields the extension a PDF is recognised by.
                fileName: attachment.fileName || fileNameFromUrl(attachment.imageUrl),
                id: attachment.id,
            })
            return
        }
        // Falls back to minting one, in case the page has been open long enough for
        // the URL that came with it to expire.
        try {
            const result = await claimApi.getClaimAttachmentUrl(attachment.id)
            setPreview({
                url: result.url,
                fileName: result.fileName || attachment.fileName
                    || fileNameFromUrl(result.url),
                id: attachment.id,
            })
        } catch (error) {
            Toast.show({ type: 'error', text1: 'Could not open', text2: describeError(error) })
        }
    }

    /**
     * Reads the receipt in the system's own browser sheet - SFSafariViewController on
     * iOS, Custom Tabs on Android - which renders a PDF properly and keeps the person
     * inside the app. An Image cannot show a PDF at all, which is what the blank
     * square was.
     */
    const onViewReceipt = async () => {
        if (!preview || isOpeningReceipt) return
        setIsOpeningReceipt(true)
        try {
            // Minted fresh: the url on screen is only good for five minutes.
            const result = await claimApi.getClaimAttachmentUrl(preview.id)
            await WebBrowser.openBrowserAsync(result.url)
        } catch (error) {
            Toast.show({
                type: 'error',
                text1: 'Could not open',
                text2: error?.message || describeError(error),
            })
        }
        setIsOpeningReceipt(false)
    }

    const onSaveReceipt = async () => {
        if (!preview || isSavingReceipt) return
        setIsSavingReceipt(true)
        try {
            // Always mint a fresh url rather than reusing the one on screen: it is
            // only good for five minutes, and the preview may have been open longer.
            const result = await claimApi.getClaimAttachmentUrl(preview.id)
            await saveAttachment({
                url: result.url,
                fileName: result.fileName || preview.fileName
                    || fileNameFromUrl(result.url),
                attachmentID: preview.id,
            })
        } catch (error) {
            Toast.show({
                type: 'error',
                text1: 'Could not save',
                text2: error?.message || describeError(error),
            })
        }
        setIsSavingReceipt(false)
    }

    const onAttach = async () => {
        const pickedList = await pickAttachment()
        if (pickedList.length === 0) return
        await runAction(async () => {
            for (const asset of pickedList) {
                await claimApi.uploadClaimAttachment({ claimID, asset })
            }
        }, 'Receipt attached')
    }

    const onRemoveReceipt = (attachment) => {
        Alert.alert(
            'Remove this receipt?',
            'The file is deleted, so it would have to be uploaded again.',
            [
                { text: 'Keep', style: 'cancel' },
                {
                    text: 'Remove',
                    style: 'destructive',
                    onPress: () => runAction(
                        () => claimApi.removeClaimAttachment(attachment.id),
                        'Receipt removed'),
                },
            ])
    }

    const onApprove = () => {
        Alert.alert('Approve this claim?', `${claim.title} · ${formatMoney(claim.amount)}`, [
            { text: 'Cancel', style: 'cancel' },
            {
                text: 'Approve',
                onPress: () => runAction(
                    () => claimApi.approveClaim({ claimID }),
                    'Claim approved'),
            },
        ])
    }

    const onConfirmReject = async () => {
        const reason = rejectionReason.trim()
        if (!reason) return
        setIsRejecting(false)
        await runAction(
            () => claimApi.rejectClaim({ claimID, rejectionReason: reason }),
            'Claim rejected')
    }

    const onMarkPaid = async () => {
        await runAction(
            () => claimApi.markClaimPaid({
                claimID,
                paymentReference: paymentReference.trim(),
            }),
            'Claim marked as paid',
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
                                {isOwner ? 'Your claim' : claim.staff?.name || 'Unknown'}
                                {claim.roleTitle ? ` · ${claim.roleTitle}` : ''}
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
                            <Text style={styles.amountLabel}>AMOUNT</Text>
                            <Text style={styles.amountValue}>{formatMoney(claim.amount)}</Text>
                        </View>
                    </View>

                    <View style={styles.divider} />

                    <Row label="Category" value={claim.claimType?.title || 'Not recorded'} />
                    <Row label="Date of expense" value={claim.expenseDate || 'Not recorded'} />
                    <Row label="Location" value={claim.location?.title || 'Not recorded'} />
                    <Row label="Submitted" value={formatTimestamp(claim.createDate)} />
                    {!!claim.description && (
                        <Row label="Notes" value={claim.description} />
                    )}
                    {!!claim.rejectionReason && (
                        <Row label="Reason" value={claim.rejectionReason} />
                    )}
                    {claim.status === 'PAID' && (
                        <Row
                            label="Paid"
                            value={`${formatTimestamp(claim.paidDate)}`
                                + (claim.paymentReference ? ` · ${claim.paymentReference}` : '')}
                        />
                    )}

                    {claim.needsReceipt && (
                        <View style={styles.note}>
                            <Ionicons name="alert-circle-outline" size={16} color={colors.pending} />
                            <Text style={[styles.noteText, { color: colors.pending }]}>
                                {claim.claimType?.title} needs a receipt before it can be approved
                            </Text>
                        </View>
                    )}

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

                {canDecide && (
                    <View style={[styles.actionRow, styles.sectionSpacing]}>
                        <PrimaryButton title="Approve" onPress={onApprove}
                                       disabled={isWorking} style={styles.flex} />
                        <PrimaryButton title="Reject" variant="danger"
                                       onPress={() => { setIsRejecting(true); setRejectionReason('') }}
                                       disabled={isWorking} style={styles.flex} />
                    </View>
                )}

                {(canEditFields || canEdit) && (
                    <View style={[styles.actionRow, styles.sectionSpacing]}>
                        {canEditFields && (
                            <PrimaryButton
                                title={isOwner ? 'Edit' : `Edit for ${claim.staff?.name}`}
                                variant="ghost"
                                onPress={() => navigation.navigate('EditClaim', { claim })}
                                disabled={isWorking}
                                style={styles.flex}
                            />
                        )}
                        {canEdit && (
                            <PrimaryButton
                                title="Attach a receipt"
                                variant="ghost"
                                onPress={onAttach}
                                disabled={isWorking}
                                style={styles.flex}
                            />
                        )}
                    </View>
                )}

                {attachmentList.length > 0 && (
                    <>
                        <SectionLabel style={styles.sectionSpacing}>
                            Receipts ({attachmentList.length})
                        </SectionLabel>
                        <Card>
                            {attachmentList.map((attachment) => (
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
                                    {/* Same rule as editing the claim, so it appears
                                        and disappears with the Edit button. */}
                                    {canEditFields && (
                                        <Pressable
                                            onPress={() => onRemoveReceipt(attachment)}
                                            hitSlop={8}
                                            disabled={isWorking}
                                            accessibilityLabel="Remove this receipt"
                                        >
                                            <Ionicons name="trash-outline" size={18}
                                                      color={colors.rejected} />
                                        </Pressable>
                                    )}
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

                {canPay && !isPaying && (
                    <PrimaryButton
                        title="Mark paid"
                        onPress={() => { setPaymentReference(''); setIsPaying(true) }}
                        disabled={isWorking}
                        style={styles.sectionSpacing}
                    />
                )}

                {canPay && isPaying && (
                    <Card style={styles.sectionSpacing}>
                        <Text style={styles.payIntro}>
                            Paying {claim.staff?.name} for {claim.title}.{' '}
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
                                           onPress={() => setIsPaying(false)}
                                           disabled={isWorking} style={styles.flex} />
                        </View>
                    </Card>
                )}

                {can(PERMISSION.MARK_CLAIM_PAID) && claim.status === 'PENDING' && (
                    <Text style={styles.payBlocked}>
                        Awaiting a decision - this cannot be paid yet.
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

            <Modal visible={isRejecting} transparent animationType="fade"
                   onRequestClose={() => setIsRejecting(false)}>
                <View style={styles.rejectBackdrop}>
                    <Card style={styles.rejectCard}>
                        <Text style={styles.rejectTitle}>Reject "{claim.title}"</Text>
                        <Text style={styles.rejectAmount}>
                            {formatMoney(claim.amount || 0)}
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
                                           onPress={onConfirmReject}
                                           loading={isWorking}
                                           disabled={rejectionReason.trim().length === 0}
                                           style={styles.flex} />
                            <PrimaryButton title="Back" variant="ghost"
                                           onPress={() => setIsRejecting(false)}
                                           disabled={isWorking} style={styles.flex} />
                        </View>
                    </Card>
                </View>
            </Modal>

            <Modal visible={!!preview} transparent animationType="fade"
                   onRequestClose={() => setPreview(null)}>
                <View style={styles.previewBackdrop}>
                    <Pressable
                        style={[styles.previewClose, { top: insets.top + spacing.md }]}
                        onPress={() => setPreview(null)}
                    >
                        <Ionicons name="close" size={28} color="#FFFFFF" />
                    </Pressable>

                    {/* A PDF cannot render through Image, so it is named and read
                        in the browser sheet instead. Photos still show inline. */}
                    {!!preview && (isPdf(preview.fileName) ? (
                        <Pressable style={styles.previewDoc} onPress={onViewReceipt}>
                            <Ionicons name="document-text-outline" size={64} color="#FFFFFF" />
                            <Text style={styles.previewDocName} numberOfLines={2}>
                                {displayNameFor(preview.fileName, preview.id)}
                            </Text>
                            <Text style={styles.previewOpen}>Tap to read</Text>
                        </Pressable>
                    ) : (
                        <Image source={{ uri: preview.url }} style={styles.previewImage}
                               resizeMode="contain" />
                    ))}

                    <View style={styles.previewActions}>
                        <View style={styles.previewButtonRow}>
                            <Pressable
                                onPress={onViewReceipt}
                                disabled={isOpeningReceipt}
                                style={({ pressed }) => [
                                    styles.previewSave,
                                    (pressed || isOpeningReceipt) && styles.pressed,
                                ]}
                            >
                                <Ionicons name="eye-outline" size={18} color="#FFFFFF" />
                                <Text style={styles.previewSaveText}>
                                    {isOpeningReceipt ? 'Opening...' : 'Open'}
                                </Text>
                            </Pressable>
                            <Pressable
                                onPress={onSaveReceipt}
                                disabled={isSavingReceipt}
                                style={({ pressed }) => [
                                    styles.previewSave,
                                    (pressed || isSavingReceipt) && styles.pressed,
                                ]}
                            >
                                <Ionicons name="download-outline" size={18} color="#FFFFFF" />
                                <Text style={styles.previewSaveText}>
                                    {isSavingReceipt ? 'Preparing...' : 'Save'}
                                </Text>
                            </Pressable>
                        </View>
                    </View>
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
    addExpense: { marginTop: spacing.md, marginBottom: spacing.sm },

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
    previewDoc: { alignItems: 'center', gap: spacing.md, paddingHorizontal: spacing.xl },
    previewDocName: { ...type.body, color: '#FFFFFF', textAlign: 'center' },
    previewActions: { alignItems: 'center', gap: spacing.md },
    previewButtonRow: { flexDirection: 'row', gap: spacing.md },
    previewSave: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: spacing.sm,
        paddingVertical: spacing.md,
        paddingHorizontal: spacing.xl,
        borderRadius: radius.pill,
        borderWidth: 1,
        borderColor: '#FFFFFF',
    },
    previewSaveText: { ...type.body, color: '#FFFFFF', fontWeight: '600' },
    previewOpen: { ...type.small, color: '#FFFFFF' },
})
