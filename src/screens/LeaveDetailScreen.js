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
import * as leaveApi from '../api/leave'
import { describeError } from '../api/client'
import { TextField } from '../components/fields'
import { pickAttachment } from '../components/attachments'
import {
    Card, ErrorBanner, LoadingView, PrimaryButton, Row, SectionLabel, StatusPill,
} from '../components/ui'
import { formatDateRange, formatDays, formatTimestamp } from '../lib/dates'
import { colors, radius, spacing, type } from '../theme'

const ACTION_LABEL = {
    SUBMITTED: 'Submitted',
    APPROVED: 'Approved',
    REJECTED: 'Rejected',
    CANCELLED: 'Cancelled',
    PAID: 'Marked paid',
}

export default function LeaveDetailScreen({ navigation, route }) {
    const { leaveRequestID } = route.params
    const { user, can } = useAuth()
    const insets = useSafeAreaInsets()

    const [leaveRequest, setLeaveRequest] = useState(null)
    const [logList, setLogList] = useState([])
    const [isLoading, setIsLoading] = useState(true)
    const [isRefreshing, setIsRefreshing] = useState(false)
    const [errorMessage, setErrorMessage] = useState('')
    const [isWorking, setIsWorking] = useState(false)

    const [isRejecting, setIsRejecting] = useState(false)
    const [rejectionReason, setRejectionReason] = useState('')
    const [previewUrl, setPreviewUrl] = useState(null)

    const load = useCallback(async () => {
        setErrorMessage('')
        try {
            const result = await leaveApi.getLeaveRequestDetail(leaveRequestID)
            setLeaveRequest(result.data)
            setLogList(result.logList || [])
        } catch (error) {
            setErrorMessage(describeError(error, 'Could not load this request.'))
        }
        setIsLoading(false)
    }, [leaveRequestID])

    useFocusEffect(useCallback(() => { load() }, [load]))

    const onRefresh = async () => {
        setIsRefreshing(true)
        await load()
        setIsRefreshing(false)
    }

    if (isLoading) return <LoadingView message="Loading request" />

    if (!leaveRequest) {
        return (
            <SafeAreaView style={styles.safe}>
                <View style={styles.padded}>
                    <ErrorBanner message={errorMessage || 'This request could not be found.'} onRetry={load} />
                </View>
            </SafeAreaView>
        )
    }

    const isPending = leaveRequest.status === 'PENDING'
    const isMine = leaveRequest.staff?.id === user?.id
    const canApprove = can(PERMISSION.APPROVE_LEAVE) && isPending
    const canKeyIn = can(PERMISSION.SUBMIT_ON_BEHALF)
    // Staff may withdraw their own pending request; only HR can unwind an approved one.
    const canCancel = (isPending && (isMine || canKeyIn))
        || (leaveRequest.status === 'APPROVED' && canKeyIn)
    const canAttach = isPending && (isMine || canKeyIn)

    const runAction = async (action, successMessage) => {
        setIsWorking(true)
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
        setIsWorking(false)
    }

    const onApprove = () => {
        Alert.alert(
            'Approve this leave?',
            `${leaveRequest.staff?.name} will be away for ${formatDays(leaveRequest.totalDays)}.`,
            [
                { text: 'Not now', style: 'cancel' },
                {
                    text: 'Approve',
                    onPress: () => runAction(
                        () => leaveApi.approveLeaveRequest({ leaveRequestID }),
                        'Leave approved',
                    ),
                },
            ],
        )
    }

    const onReject = async () => {
        if (rejectionReason.trim().length === 0) return
        await runAction(
            () => leaveApi.rejectLeaveRequest({
                leaveRequestID,
                rejectionReason: rejectionReason.trim(),
            }),
            'Leave rejected',
        )
        setIsRejecting(false)
        setRejectionReason('')
    }

    const onCancel = () => {
        Alert.alert(
            'Cancel this leave?',
            leaveRequest.status === 'APPROVED'
                ? 'The days will be added back to the balance.'
                : 'This withdraws the application.',
            [
                { text: 'Keep it', style: 'cancel' },
                {
                    text: 'Cancel leave',
                    style: 'destructive',
                    onPress: () => runAction(
                        () => leaveApi.cancelLeaveRequest({ leaveRequestID }),
                        'Leave cancelled',
                    ),
                },
            ],
        )
    }

    const onAttach = async () => {
        const pickedList = await pickAttachment()
        if (pickedList.length === 0) return

        await runAction(async () => {
            for (const asset of pickedList) {
                await leaveApi.uploadLeaveAttachment({ leaveRequestID, asset })
            }
        }, pickedList.length === 1 ? 'Document attached' : `${pickedList.length} documents attached`)
    }

    const onOpenAttachment = async (attachmentID) => {
        try {
            const result = await leaveApi.getLeaveAttachmentUrl(attachmentID)
            setPreviewUrl(result.url)
        } catch (error) {
            Toast.show({ type: 'error', text1: 'Could not open', text2: describeError(error) })
        }
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
                            <Text style={styles.staffName}>{leaveRequest.staff?.name}</Text>
                            <Text style={styles.leaveType}>{leaveRequest.leaveType?.title}</Text>
                        </View>
                        <StatusPill status={leaveRequest.status} />
                    </View>

                    <View style={styles.divider} />

                    <Row
                        label="Dates"
                        value={formatDateRange(leaveRequest.startDate, leaveRequest.endDate,
                            leaveRequest.dayPortion)}
                    />
                    <Row label="Length" value={formatDays(leaveRequest.totalDays)} />
                    {!!leaveRequest.reason && <Row label="Reason" value={leaveRequest.reason} />}
                    <Row label="Applied" value={formatTimestamp(leaveRequest.createDate)} />

                    {leaveRequest.onBehalf && (
                        <View style={styles.onBehalfNote}>
                            <Ionicons name="information-circle-outline" size={16}
                                      color={colors.inkMuted} />
                            <Text style={styles.onBehalfText}>
                                Entered by {leaveRequest.submittedBy?.name} on their behalf
                            </Text>
                        </View>
                    )}

                    {leaveRequest.status === 'REJECTED' && !!leaveRequest.rejectionReason && (
                        <View style={styles.rejectionNote}>
                            <Text style={styles.rejectionLabel}>WHY IT WAS REJECTED</Text>
                            <Text style={styles.rejectionText}>{leaveRequest.rejectionReason}</Text>
                        </View>
                    )}
                </Card>

                <SectionLabel style={styles.sectionSpacing}>Supporting documents</SectionLabel>
                <Card>
                    {(leaveRequest.attachmentList || []).length === 0 && (
                        <Text style={styles.emptyText}>
                            {leaveRequest.leaveType?.requiresAttachment
                                ? 'This leave type needs a document before it can be approved.'
                                : 'None attached.'}
                        </Text>
                    )}
                    {(leaveRequest.attachmentList || []).map((attachment) => (
                        <Pressable
                            key={attachment.id}
                            onPress={() => onOpenAttachment(attachment.id)}
                            style={({ pressed }) => [styles.attachmentRow, pressed && styles.pressed]}
                        >
                            <Ionicons name="document-attach-outline" size={20} color={colors.brandDark} />
                            <View style={styles.flex}>
                                <Text style={styles.attachmentTitle}>
                                    Uploaded by {attachment.uploadedBy?.name || 'unknown'}
                                </Text>
                                <Text style={styles.attachmentDate}>
                                    {formatTimestamp(attachment.createDate)}
                                </Text>
                            </View>
                            <Ionicons name="eye-outline" size={18} color={colors.inkFaint} />
                        </Pressable>
                    ))}

                    {canAttach && (
                        <PrimaryButton
                            title="Attach a photo"
                            variant="ghost"
                            onPress={onAttach}
                            disabled={isWorking}
                            style={styles.attachButton}
                        />
                    )}
                </Card>

                {logList.length > 0 && (
                    <>
                        <SectionLabel style={styles.sectionSpacing}>History</SectionLabel>
                        <Card>
                            {logList.map((log, index) => (
                                <View
                                    key={log.id}
                                    style={[styles.logRow, index > 0 && styles.logRowDivided]}
                                >
                                    <Text style={styles.logAction}>
                                        {ACTION_LABEL[log.action] || log.action}
                                    </Text>
                                    <Text style={styles.logMeta}>
                                        {log.actor?.name || 'System'} - {formatTimestamp(log.createDate)}
                                    </Text>
                                    {!!log.note && <Text style={styles.logNote}>{log.note}</Text>}
                                </View>
                            ))}
                        </Card>
                    </>
                )}

                {canApprove && !isRejecting && (
                    <View style={styles.actionBar}>
                        <PrimaryButton
                            title="Approve"
                            onPress={onApprove}
                            loading={isWorking}
                            style={styles.flex}
                        />
                        <PrimaryButton
                            title="Reject"
                            variant="ghost"
                            onPress={() => setIsRejecting(true)}
                            disabled={isWorking}
                            style={styles.flex}
                        />
                    </View>
                )}

                {canApprove && isRejecting && (
                    <Card style={styles.sectionSpacing}>
                        <TextField
                            label="Why are you rejecting this?"
                            hint="The staff member sees this, so make it useful."
                            placeholder="e.g. Peak harvest week, please pick another date"
                            value={rejectionReason}
                            onChangeText={setRejectionReason}
                            multiline
                        />
                        <View style={styles.actionRow}>
                            <PrimaryButton
                                title="Confirm rejection"
                                variant="danger"
                                onPress={onReject}
                                loading={isWorking}
                                disabled={rejectionReason.trim().length === 0}
                                style={styles.flex}
                            />
                            <PrimaryButton
                                title="Back"
                                variant="ghost"
                                onPress={() => { setIsRejecting(false); setRejectionReason('') }}
                                disabled={isWorking}
                                style={styles.flex}
                            />
                        </View>
                    </Card>
                )}

                {canCancel && (
                    <PrimaryButton
                        title="Cancel this leave"
                        variant="ghost"
                        onPress={onCancel}
                        disabled={isWorking}
                        style={styles.sectionSpacing}
                    />
                )}
            </ScrollView>

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
    sectionSpacing: { marginTop: spacing.lg },

    headerRow: { flexDirection: 'row', alignItems: 'flex-start', gap: spacing.md },
    staffName: { ...type.heading },
    leaveType: { ...type.small, marginTop: 1 },
    divider: {
        height: 1,
        backgroundColor: colors.line,
        marginVertical: spacing.md,
    },

    onBehalfNote: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: spacing.sm,
        marginTop: spacing.md,
        padding: spacing.md,
        backgroundColor: colors.ground,
        borderRadius: radius.md,
    },
    onBehalfText: { ...type.small, fontSize: 12, flex: 1 },

    rejectionNote: {
        marginTop: spacing.md,
        padding: spacing.md,
        backgroundColor: colors.rejectedSoft,
        borderRadius: radius.md,
    },
    rejectionLabel: { ...type.label, color: colors.rejected, marginBottom: spacing.xs },
    rejectionText: { ...type.small, color: colors.rejected },

    emptyText: { ...type.small },
    attachmentRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: spacing.md,
        paddingVertical: spacing.md,
    },
    attachmentTitle: { ...type.body, fontSize: 14 },
    attachmentDate: { ...type.small, fontSize: 12 },
    attachButton: { marginTop: spacing.md },

    logRow: { paddingVertical: spacing.md },
    logRowDivided: { borderTopWidth: 1, borderTopColor: colors.line },
    logAction: { ...type.body, fontWeight: '600' },
    logMeta: { ...type.small, fontSize: 12, marginTop: 1 },
    logNote: { ...type.small, marginTop: spacing.xs, fontStyle: 'italic' },

    actionBar: { flexDirection: 'row', gap: spacing.md, marginTop: spacing.xl },
    actionRow: { flexDirection: 'row', gap: spacing.md },

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
