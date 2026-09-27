import React, { useCallback, useState } from 'react'
import { Alert, FlatList, RefreshControl, StyleSheet, Text, View } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { useFocusEffect } from '@react-navigation/native'
import Toast from 'react-native-toast-message'

import * as leaveApi from '../api/leave'
import * as claimApi from '../api/claims'
import { describeError } from '../api/client'
import { useAuth } from '../context/AuthContext'
import { PERMISSION } from '../permissions'
import { Card, EmptyState, ErrorBanner, LoadingView, PrimaryButton } from '../components/ui'
import { TabHeader } from '../components/tabs'
import { formatDateRange, formatDays, formatTimestamp } from '../lib/dates'
import { formatMoney } from '../lib/money'
import { colors, radius, spacing, type } from '../theme'

/**
 * The director's daily minute. Everything pending, oldest first, with enough detail
 * to decide without opening each one - and a tap through when there is not.
 */
export default function ApprovalQueueScreen({ navigation }) {
    const { can } = useAuth()
    const canApproveClaim = can(PERMISSION.APPROVE_CLAIM)
    const [requestList, setRequestList] = useState([])
    const [isLoading, setIsLoading] = useState(true)
    const [isRefreshing, setIsRefreshing] = useState(false)
    const [workingID, setWorkingID] = useState(null)
    const [errorMessage, setErrorMessage] = useState('')

    const load = useCallback(async () => {
        setErrorMessage('')
        try {
            // Leave and claims share one queue - the director should not have to
            // remember there are two places to look.
            const [leaveResult, claimResult] = await Promise.all([
                leaveApi.getAllLeaveRequestList({ status: 'PENDING', pageSize: 50 }),
                canApproveClaim
                    ? claimApi.getAllClaimList({ status: 'PENDING', pageSize: 50 })
                    : Promise.resolve({ data: [] }),
            ])

            const combinedList = [
                ...(leaveResult.data || []).map((item) => ({ ...item, kind: 'LEAVE' })),
                ...(claimResult.data || []).map((item) => ({ ...item, kind: 'CLAIM' })),
            ]
            // Oldest first - whatever has waited longest deserves attention.
            combinedList.sort((a, b) => new Date(a.createDate) - new Date(b.createDate))
            setRequestList(combinedList)
        } catch (error) {
            setErrorMessage(describeError(error, 'Could not load the approval queue.'))
        }
        setIsLoading(false)
    }, [canApproveClaim])

    useFocusEffect(useCallback(() => { load() }, [load]))

    const onRefresh = async () => {
        setIsRefreshing(true)
        await load()
        setIsRefreshing(false)
    }

    const rowKey = (item) => `${item.kind}-${item.id}`

    const onApprove = (item) => {
        const isLeave = item.kind === 'LEAVE'
        const summary = isLeave
            ? `${item.staff?.name} - ${item.leaveType?.title}, ${formatDays(item.totalDays)}.`
            : `${formatMoney(item.amount)} to ${item.staff?.name}.`

        Alert.alert(
            isLeave ? 'Approve this leave?' : 'Approve this claim?',
            summary,
            [
                { text: 'Not now', style: 'cancel' },
                {
                    text: 'Approve',
                    onPress: async () => {
                        setWorkingID(rowKey(item))
                        try {
                            if (isLeave) {
                                await leaveApi.approveLeaveRequest({ leaveRequestID: item.id })
                            } else {
                                await claimApi.approveClaim({ claimID: item.id })
                            }
                            Toast.show({
                                type: 'success',
                                text1: 'Approved',
                                text2: `${item.staff?.name} has been notified.`,
                            })
                            setRequestList((previous) =>
                                previous.filter((row) => rowKey(row) !== rowKey(item)))
                        } catch (error) {
                            Toast.show({
                                type: 'error',
                                text1: 'Could not approve',
                                text2: describeError(error),
                            })
                        }
                        setWorkingID(null)
                    },
                },
            ],
        )
    }

    if (isLoading) return <LoadingView message="Loading approvals" />

    return (
        <SafeAreaView style={styles.safe} edges={['top']}>
            <FlatList
                data={requestList}
                keyExtractor={rowKey}
                contentContainerStyle={styles.listContent}
                refreshControl={<RefreshControl refreshing={isRefreshing} onRefresh={onRefresh} />}
                ListHeaderComponent={(
                    <>
                        <TabHeader
                            title="Approve"
                            subtitle={requestList.length > 0
                                ? `${requestList.length} waiting on you`
                                : 'Nothing waiting'}
                        />
                        <ErrorBanner message={errorMessage} onRetry={load} />
                    </>
                )}
                ListEmptyComponent={(
                    <EmptyState
                        icon="checkmark-done-outline"
                        title="Nothing waiting"
                        message="Every leave request and claim has been dealt with."
                    />
                )}
                renderItem={({ item }) => {
                    const isLeave = item.kind === 'LEAVE'
                    const openDetail = () => navigation.navigate(
                        isLeave ? 'LeaveDetail' : 'ClaimDetail',
                        isLeave ? { leaveRequestID: item.id } : { claimID: item.id },
                    )
                    return (
                        <Card onPress={openDetail}>
                            <View style={styles.header}>
                                <View style={styles.flex}>
                                    <Text style={styles.staffName}>{item.staff?.name}</Text>
                                    <Text style={styles.subject}>
                                        {isLeave ? item.leaveType?.title : item.title}
                                    </Text>
                                </View>
                                <View style={styles.headerRight}>
                                    <View style={[styles.kindTag, !isLeave && styles.kindTagClaim]}>
                                        <Text style={[styles.kindText, !isLeave && styles.kindTextClaim]}>
                                            {isLeave ? 'LEAVE' : 'CLAIM'}
                                        </Text>
                                    </View>
                                    <Text style={styles.headline}>
                                        {isLeave
                                            ? formatDays(item.totalDays)
                                            : formatMoney(item.amount)}
                                    </Text>
                                </View>
                            </View>

                            <Text style={styles.dates}>
                                {isLeave
                                    ? formatDateRange(item.startDate, item.endDate, item.dayPortion)
                                    : [item.location?.title, item.roleTitle, item.claimType?.title]
                                        .filter(Boolean).join(' - ')}
                            </Text>

                            {isLeave && !!item.reason && (
                                <Text style={styles.reason} numberOfLines={2}>{item.reason}</Text>
                            )}

                            <View style={styles.metaRow}>
                                <Text style={styles.meta}>
                                    Submitted {formatTimestamp(item.createDate)}
                                </Text>
                                {item.onBehalf && (
                                    <Text style={styles.meta}>via {item.submittedBy?.name}</Text>
                                )}
                                {item.attachmentCount > 0 && (
                                    <Text style={styles.meta}>
                                        {item.attachmentCount} attachment{item.attachmentCount === 1 ? '' : 's'}
                                    </Text>
                                )}
                            </View>

                            <View style={styles.actionRow}>
                                <PrimaryButton
                                    title="Approve"
                                    onPress={() => onApprove(item)}
                                    loading={workingID === rowKey(item)}
                                    disabled={workingID !== null && workingID !== rowKey(item)}
                                    style={styles.flex}
                                />
                                <PrimaryButton
                                    title="Review"
                                    variant="ghost"
                                    onPress={openDetail}
                                    disabled={workingID !== null}
                                    style={styles.flex}
                                />
                            </View>
                        </Card>
                    )
                }}
            />
        </SafeAreaView>
    )
}

const styles = StyleSheet.create({
    safe: { flex: 1, backgroundColor: colors.ground },
    listContent: { padding: spacing.lg, gap: spacing.md, flexGrow: 1 },
    flex: { flex: 1 },

    header: { flexDirection: 'row', alignItems: 'flex-start', gap: spacing.md },
    headerRight: { alignItems: 'flex-end', gap: spacing.xs },
    staffName: { ...type.subheading },
    subject: { ...type.small, marginTop: 1 },
    headline: { ...type.body, fontWeight: '700' },
    kindTag: {
        paddingHorizontal: spacing.sm,
        paddingVertical: 2,
        borderRadius: radius.sm,
        backgroundColor: colors.brandSoft,
    },
    kindTagClaim: { backgroundColor: colors.pendingSoft },
    kindText: { fontSize: 10, fontWeight: '800', letterSpacing: 0.6, color: colors.brandDark },
    kindTextClaim: { color: colors.pending },

    dates: { ...type.body, marginTop: spacing.sm },
    reason: { ...type.small, marginTop: spacing.xs, fontStyle: 'italic' },

    metaRow: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: spacing.md,
        marginTop: spacing.sm,
    },
    meta: { ...type.small, fontSize: 12, color: colors.inkFaint },

    actionRow: { flexDirection: 'row', gap: spacing.md, marginTop: spacing.lg },
})
