import React, { useCallback, useEffect, useState } from 'react'
import {
    FlatList, Pressable, RefreshControl, ScrollView, StyleSheet, Text, View,
} from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { useFocusEffect } from '@react-navigation/native'

import * as leaveApi from '../api/leave'
import { describeError } from '../api/client'
import { Card, EmptyState, ErrorBanner, LoadingView, StatusPill } from '../components/ui'
import { formatDateRange, formatDays } from '../lib/dates'
import { colors, radius, spacing, type } from '../theme'

const STATUS_FILTER_LIST = [
    { value: 'ALL', label: 'All' },
    { value: 'PENDING', label: 'Pending' },
    { value: 'APPROVED', label: 'Approved' },
    { value: 'REJECTED', label: 'Rejected' },
    { value: 'CANCELLED', label: 'Cancelled' },
]

const PAGE_SIZE = 20

/**
 * Serves both "my leave history" and the HR-wide register. The register shows whose
 * leave it is; the personal list does not need to.
 */
export default function LeaveListScreen({ navigation, route }) {
    const isRegister = route?.params?.mode === 'register'

    const [requestList, setRequestList] = useState([])
    const [status, setStatus] = useState('ALL')
    const [page, setPage] = useState(1)
    const [total, setTotal] = useState(0)
    const [isLoading, setIsLoading] = useState(true)
    const [isRefreshing, setIsRefreshing] = useState(false)
    const [isLoadingMore, setIsLoadingMore] = useState(false)
    const [errorMessage, setErrorMessage] = useState('')

    useEffect(() => {
        navigation.setOptions({ title: isRegister ? 'Leave register' : 'My leave' })
    }, [navigation, isRegister])

    const fetchPage = useCallback(async (targetPage) => {
        const filters = { page: targetPage, pageSize: PAGE_SIZE }
        if (status !== 'ALL') filters.status = status
        return isRegister
            ? leaveApi.getAllLeaveRequestList(filters)
            : leaveApi.getMyLeaveRequestList(filters)
    }, [isRegister, status])

    const load = useCallback(async () => {
        setErrorMessage('')
        try {
            const result = await fetchPage(1)
            setRequestList(result.data || [])
            setTotal(result.total || 0)
            setPage(1)
        } catch (error) {
            setErrorMessage(describeError(error, 'Could not load leave requests.'))
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
        if (isLoadingMore || requestList.length >= total) return
        setIsLoadingMore(true)
        try {
            const nextPage = page + 1
            const result = await fetchPage(nextPage)
            setRequestList((previous) => [...previous, ...(result.data || [])])
            setPage(nextPage)
        } catch (error) {
            setErrorMessage(describeError(error, 'Could not load more.'))
        }
        setIsLoadingMore(false)
    }

    if (isLoading) return <LoadingView message="Loading leave" />

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

            <FlatList
                data={requestList}
                keyExtractor={(item) => String(item.id)}
                contentContainerStyle={styles.listContent}
                refreshControl={<RefreshControl refreshing={isRefreshing} onRefresh={onRefresh} />}
                onEndReached={onEndReached}
                onEndReachedThreshold={0.4}
                ListHeaderComponent={<ErrorBanner message={errorMessage} onRetry={load} />}
                ListEmptyComponent={(
                    <EmptyState
                        icon="calendar-clear-outline"
                        title={status === 'ALL' ? 'No leave requests yet' : `Nothing ${status.toLowerCase()}`}
                        message={isRegister
                            ? 'Requests will appear here as staff apply.'
                            : 'Apply for leave and it will show up here.'}
                    />
                )}
                ListFooterComponent={isLoadingMore
                    ? <Text style={styles.footer}>Loading more...</Text>
                    : requestList.length > 0 && requestList.length >= total
                        ? <Text style={styles.footer}>{total} request{total === 1 ? '' : 's'}</Text>
                        : null}
                renderItem={({ item }) => (
                    <Card
                        style={styles.item}
                        onPress={() => navigation.navigate('LeaveDetail', { leaveRequestID: item.id })}
                    >
                        <View style={styles.itemHeader}>
                            <View style={styles.flex}>
                                {isRegister && (
                                    <Text style={styles.staffName}>{item.staff?.name}</Text>
                                )}
                                <Text style={styles.leaveType}>{item.leaveType?.title}</Text>
                            </View>
                            <StatusPill status={item.status} />
                        </View>

                        <Text style={styles.dates}>
                            {formatDateRange(item.startDate, item.endDate, item.dayPortion)}
                        </Text>

                        <View style={styles.itemFooter}>
                            <Text style={styles.days}>{formatDays(item.totalDays)}</Text>
                            {item.onBehalf && (
                                <Text style={styles.onBehalf}>
                                    Entered by {item.submittedBy?.name}
                                </Text>
                            )}
                            {item.attachmentCount > 0 && (
                                <Text style={styles.attachment}>
                                    {item.attachmentCount} attachment{item.attachmentCount === 1 ? '' : 's'}
                                </Text>
                            )}
                        </View>
                    </Card>
                )}
            />
        </SafeAreaView>
    )
}

const styles = StyleSheet.create({
    safe: { flex: 1, backgroundColor: colors.ground },
    flex: { flex: 1 },

    // flexGrow: 0 stops the row eating the screen's spare height, and alignItems
    // stops the chips stretching to fill whatever height it does take - a horizontal
    // scroll view's content container aligns 'stretch' on the cross axis by default.
    filterScroll: { flexGrow: 0, flexShrink: 0 },
    filterBar: {
        paddingHorizontal: spacing.lg,
        paddingVertical: spacing.md,
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
    chipSelected: { backgroundColor: colors.ink, borderColor: colors.ink },
    chipText: { ...type.small, fontWeight: '600' },
    chipTextSelected: { color: '#FFFFFF' },

    listContent: { padding: spacing.lg, paddingTop: 0, gap: spacing.sm, flexGrow: 1 },
    item: { gap: spacing.xs },
    itemHeader: { flexDirection: 'row', alignItems: 'flex-start', gap: spacing.md },
    staffName: { ...type.subheading },
    leaveType: { ...type.small, fontWeight: '600' },
    dates: { ...type.body },
    itemFooter: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        alignItems: 'center',
        gap: spacing.md,
        marginTop: spacing.xs,
    },
    days: { ...type.small, fontWeight: '600' },
    onBehalf: { ...type.small, fontSize: 12, color: colors.inkFaint },
    attachment: { ...type.small, fontSize: 12, color: colors.inkFaint },

    footer: { ...type.small, textAlign: 'center', padding: spacing.lg },
})
