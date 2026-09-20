import React, { useCallback, useEffect, useState } from 'react'
import {
    FlatList, Pressable, RefreshControl, ScrollView, StyleSheet, Text, View,
} from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { useFocusEffect } from '@react-navigation/native'
import { Ionicons } from '@expo/vector-icons'

import * as claimApi from '../api/claims'
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

    useEffect(() => {
        navigation.setOptions({ title: isRegister ? 'Claims register' : 'My claims' })
    }, [navigation, isRegister])

    useEffect(() => {
        if (!isRegister) return
        claimApi.getLocationList()
            .then((result) => setLocationList(Array.isArray(result) ? result : []))
            .catch(() => setLocationList([]))
    }, [isRegister])

    const fetchPage = useCallback(async (targetPage) => {
        const filters = { page: targetPage, pageSize: PAGE_SIZE }
        if (status !== 'ALL') filters.status = status
        if (locationID) filters.locationID = locationID
        return isRegister ? claimApi.getAllClaimList(filters) : claimApi.getMyClaimList(filters)
    }, [isRegister, status, locationID])

    const load = useCallback(async () => {
        setErrorMessage('')
        try {
            const result = await fetchPage(1)
            setClaimList(result.data || [])
            setTotal(result.total || 0)
            setTotalAmount(result.totalAmount || '0')
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

            {total > 0 && (
                <View style={styles.summaryBar}>
                    <Text style={styles.summaryText}>
                        {total} claim{total === 1 ? '' : 's'}
                    </Text>
                    <Text style={styles.summaryAmount}>{formatMoney(totalAmount)}</Text>
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
                                <Text style={styles.amount}>{formatMoney(item.totalAmount)}</Text>
                            </View>

                            <View style={styles.metaRow}>
                                {!!item.location && (
                                    <View style={styles.metaChip}>
                                        <Ionicons name="location-outline" size={12}
                                                  color={colors.inkMuted} />
                                        <Text style={styles.metaText}>{item.location.title}</Text>
                                    </View>
                                )}
                                {!!item.createdBy && (
                                    <View style={styles.metaChip}>
                                        <Ionicons name="person-outline" size={12}
                                                  color={colors.inkMuted} />
                                        <Text style={styles.metaText}>
                                            {item.createdBy.name}
                                        </Text>
                                    </View>
                                )}
                                {/* A shared claim shows your own subtotal, so say so
                                    rather than letting it read as the claim's total. */}
                                {!item.canSeeEveryone && item.itemCount > 0 && (
                                    <View style={styles.metaChip}>
                                        <Ionicons name="wallet-outline" size={12}
                                                  color={colors.inkMuted} />
                                        <Text style={styles.metaText}>
                                            yours: {item.itemCount} expense(s)
                                        </Text>
                                    </View>
                                )}
                                {!!item.categorySummary && (
                                    <Text style={styles.metaText} numberOfLines={1}>
                                        {item.categorySummary}
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
    flex: { flex: 1 },

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

    summaryBar: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        paddingHorizontal: spacing.lg,
        paddingBottom: spacing.md,
    },
    summaryText: { ...type.small },
    summaryAmount: { ...type.subheading },

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
    pill: {
        paddingHorizontal: spacing.md,
        paddingVertical: 3,
        borderRadius: radius.pill,
    },
    pillText: { fontSize: 12, fontWeight: '700' },
    date: { ...type.small, fontSize: 11, color: colors.inkFaint },

    footer: { ...type.small, textAlign: 'center', padding: spacing.lg },
})
