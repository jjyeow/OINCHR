import React, { useCallback, useState } from 'react'
import {
    Pressable, RefreshControl, ScrollView, StyleSheet, Text, View,
} from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { useFocusEffect } from '@react-navigation/native'
import { Ionicons } from '@expo/vector-icons'

import { useAuth } from '../context/AuthContext'
import { PERMISSION } from '../permissions'
import * as leaveApi from '../api/leave'
import { describeError } from '../api/client'
import { ActionRow, TabHeader } from '../components/tabs'
import { Card, ErrorBanner, SectionLabel, StatusPill } from '../components/ui'
import { formatDateRange, formatDays } from '../lib/dates'
import { colors, spacing, type } from '../theme'

/**
 * The Leave tab opens on what the person came to find out: how many days they have
 * left. Everything else on the screen is one tap from there.
 */
export default function LeaveTabScreen({ navigation }) {
    const { user, can } = useAuth()
    const [balanceList, setBalanceList] = useState([])
    const [recentList, setRecentList] = useState([])
    const [errorMessage, setErrorMessage] = useState('')
    const [isRefreshing, setIsRefreshing] = useState(false)

    const canKeyIn = can(PERMISSION.SUBMIT_ON_BEHALF)
    const canViewAll = can(PERMISSION.VIEW_ALL_LEAVE)
    const canManageLeaveType = can(PERMISSION.MANAGE_LEAVE_TYPE)

    const load = useCallback(async () => {
        setErrorMessage('')
        try {
            const [balanceResult, recentResult] = await Promise.all([
                leaveApi.getMyLeaveBalance(),
                leaveApi.getMyLeaveRequestList({ pageSize: 3 }),
            ])
            setBalanceList(balanceResult.data || [])
            setRecentList(recentResult.data || [])
        } catch (error) {
            setErrorMessage(describeError(error, 'Could not load your leave.'))
        }
    }, [])

    useFocusEffect(useCallback(() => { load() }, [load]))

    const onRefresh = async () => {
        setIsRefreshing(true)
        await load()
        setIsRefreshing(false)
    }

    return (
        <SafeAreaView style={styles.safe} edges={['top']}>
            <ScrollView
                contentContainerStyle={styles.scroll}
                refreshControl={<RefreshControl refreshing={isRefreshing} onRefresh={onRefresh} />}
            >
                <TabHeader title="Leave" subtitle={user?.name} />

                <ErrorBanner message={errorMessage} onRetry={load} />

                {balanceList.length === 0 && canManageLeaveType && (
                    <Card
                        style={styles.setupCard}
                        onPress={() => navigation.navigate('LeaveTypeList')}
                    >
                        <View style={styles.setupRow}>
                            <Ionicons name="construct-outline" size={20} color={colors.brandDark} />
                            <View style={styles.flex}>
                                <Text style={styles.setupTitle}>Set up leave types first</Text>
                                <Text style={styles.setupSubtitle}>
                                    Nobody can apply until at least one exists
                                </Text>
                            </View>
                            <Ionicons name="chevron-forward" size={20} color={colors.brandDark} />
                        </View>
                    </Card>
                )}

                <View style={styles.balanceGrid}>
                    {balanceList.length === 0 && !canManageLeaveType && (
                        <Card style={styles.flex}>
                            <Text style={type.small}>
                                No leave types have been set up yet. Ask HR to add them.
                            </Text>
                        </Card>
                    )}
                    {balanceList.map((balance) => (
                        <Card key={balance.id} style={styles.balanceCard}>
                            <Text style={styles.balanceType} numberOfLines={1}>
                                {balance.leaveType.title}
                            </Text>
                            <Text style={styles.balanceDays}>{Number(balance.availableDays)}</Text>
                            <Text style={styles.balanceCaption}>
                                of {Number(balance.totalDays)} days left
                            </Text>
                            {Number(balance.pendingDays) > 0 && (
                                <Text style={styles.balancePending}>
                                    {formatDays(balance.pendingDays)} awaiting approval
                                </Text>
                            )}
                        </Card>
                    ))}
                </View>

                <View style={styles.actionList}>
                    <ActionRow
                        icon="add-circle-outline"
                        title="Apply for leave"
                        subtitle="Annual, medical or unpaid"
                        onPress={() => navigation.navigate('ApplyLeave')}
                    />
                    <ActionRow
                        icon="time-outline"
                        title="My leave history"
                        subtitle="Everything you have applied for"
                        onPress={() => navigation.navigate('MyLeave')}
                    />
                </View>

                {(canKeyIn || canViewAll) && (
                    <>
                        <SectionLabel style={styles.sectionSpacing}>Managing leave</SectionLabel>
                        <View style={styles.actionList}>
                            {canKeyIn && (
                                <ActionRow
                                    icon="person-add-outline"
                                    title="Key in for a staff member"
                                    subtitle="For anyone who messaged you instead"
                                    onPress={() => navigation.navigate('KeyInLeave')}
                                />
                            )}
                            {canViewAll && (
                                <ActionRow
                                    icon="list-outline"
                                    title="Leave register"
                                    subtitle="Every request across the farm"
                                    onPress={() => navigation.navigate('LeaveRegister')}
                                />
                            )}
                        </View>
                    </>
                )}

                {recentList.length > 0 && (
                    <>
                        <SectionLabel style={styles.sectionSpacing}>Your recent requests</SectionLabel>
                        <View style={styles.actionList}>
                            {recentList.map((leaveRequest) => (
                                <Card
                                    key={leaveRequest.id}
                                    onPress={() => navigation.navigate('LeaveDetail', {
                                        leaveRequestID: leaveRequest.id,
                                    })}
                                >
                                    <View style={styles.recentRow}>
                                        <View style={styles.flex}>
                                            <Text style={styles.recentType}>
                                                {leaveRequest.leaveType.title}
                                            </Text>
                                            <Text style={styles.recentDates}>
                                                {formatDateRange(
                                                    leaveRequest.startDate,
                                                    leaveRequest.endDate,
                                                    leaveRequest.dayPortion,
                                                )}
                                            </Text>
                                        </View>
                                        <StatusPill status={leaveRequest.status} />
                                    </View>
                                </Card>
                            ))}
                        </View>
                    </>
                )}
            </ScrollView>
        </SafeAreaView>
    )
}

const styles = StyleSheet.create({
    safe: { flex: 1, backgroundColor: colors.ground },
    scroll: { padding: spacing.lg, paddingBottom: spacing.xxl },
    flex: { flex: 1 },
    sectionSpacing: { marginTop: spacing.xl },

    setupCard: { backgroundColor: colors.brandSoft, borderColor: colors.brand },
    setupRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
    setupTitle: { ...type.subheading, color: colors.brandDark },
    setupSubtitle: { ...type.small, color: colors.brandDark, opacity: 0.85 },

    balanceGrid: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: spacing.md,
        marginBottom: spacing.xl,
    },
    balanceCard: { flexGrow: 1, flexBasis: '46%', paddingVertical: spacing.lg },
    balanceType: { ...type.small, fontWeight: '600' },
    balanceDays: { fontSize: 30, fontWeight: '800', color: colors.ink, marginTop: spacing.xs },
    balanceCaption: { ...type.small, fontSize: 12 },
    balancePending: { ...type.small, fontSize: 12, color: colors.pending, marginTop: spacing.xs },

    actionList: { gap: spacing.sm },
    recentRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
    recentType: { ...type.body, fontWeight: '600' },
    recentDates: { ...type.small, marginTop: 1 },
})
