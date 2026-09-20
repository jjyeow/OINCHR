import React, { useCallback, useState } from 'react'
import { RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { useFocusEffect } from '@react-navigation/native'
import { Ionicons } from '@expo/vector-icons'

import { useAuth } from '../context/AuthContext'
import { PERMISSION } from '../permissions'
import * as claimApi from '../api/claims'
import { describeError } from '../api/client'
import { ActionRow, TabHeader } from '../components/tabs'
import { Card, ErrorBanner, SectionLabel } from '../components/ui'
import { formatTimestamp } from '../lib/dates'
import { formatMoney } from '../lib/money'
import { CLAIM_STATUS_STYLE } from '../lib/claimStatus'
import { colors, radius, spacing, type } from '../theme'

export default function ClaimTabScreen({ navigation }) {
    const { user, can } = useAuth()
    const [recentList, setRecentList] = useState([])
    const [awaitingPayment, setAwaitingPayment] = useState(null)
    const [unpaidCount, setUnpaidCount] = useState(0)
    const [errorMessage, setErrorMessage] = useState('')
    const [isRefreshing, setIsRefreshing] = useState(false)

    const canKeyIn = can(PERMISSION.SUBMIT_CLAIM_ON_BEHALF)
    const canCreateClaim = can(PERMISSION.CREATE_CLAIM)
    const canViewAll = can(PERMISSION.VIEW_ALL_CLAIMS)
    const canMarkPaid = can(PERMISSION.MARK_CLAIM_PAID)
    const canManageClaimType = can(PERMISSION.MANAGE_CLAIM_TYPE)

    const load = useCallback(async () => {
        setErrorMessage('')
        try {
            const [mineResult, approvedResult] = await Promise.all([
                claimApi.getMyClaimList({ pageSize: 3 }),
                // What this person is personally still owed.
                claimApi.getMyClaimList({ status: 'APPROVED', pageSize: 1 }),
            ])
            setRecentList(mineResult.data || [])
            setAwaitingPayment(approvedResult.totalAmount || '0')

            if (canMarkPaid) {
                const allApproved = await claimApi.getAllClaimList({
                    status: 'APPROVED', pageSize: 1,
                })
                setUnpaidCount(allApproved.total || 0)
            }
        } catch (error) {
            setErrorMessage(describeError(error, 'Could not load your claims.'))
        }
    }, [canMarkPaid])

    useFocusEffect(useCallback(() => { load() }, [load]))

    const onRefresh = async () => {
        setIsRefreshing(true)
        await load()
        setIsRefreshing(false)
    }

    const owedToMe = Number(awaitingPayment || 0)

    return (
        <SafeAreaView style={styles.safe} edges={['top']}>
            <ScrollView
                contentContainerStyle={styles.scroll}
                refreshControl={<RefreshControl refreshing={isRefreshing} onRefresh={onRefresh} />}
            >
                <TabHeader title="Claims" subtitle={user?.name} />

                <ErrorBanner message={errorMessage} onRetry={load} />

                {canMarkPaid && unpaidCount > 0 && (
                    <Card
                        style={styles.unpaidCard}
                        onPress={() => navigation.navigate('ClaimRegister', {
                            initialStatus: 'APPROVED',
                        })}
                    >
                        <View style={styles.cardRow}>
                            <View style={styles.unpaidBadge}>
                                <Text style={styles.unpaidBadgeText}>{unpaidCount}</Text>
                            </View>
                            <View style={styles.flex}>
                                <Text style={styles.unpaidTitle}>
                                    Approved claim{unpaidCount === 1 ? '' : 's'} awaiting payment
                                </Text>
                                <Text style={styles.unpaidSubtitle}>
                                    Mark paid once the money has gone out
                                </Text>
                            </View>
                            <Ionicons name="chevron-forward" size={20} color={colors.pending} />
                        </View>
                    </Card>
                )}

                {owedToMe > 0 && (
                    <Card style={styles.owedCard}>
                        <Text style={styles.owedLabel}>APPROVED, AWAITING PAYMENT TO YOU</Text>
                        <Text style={styles.owedValue}>{formatMoney(owedToMe)}</Text>
                    </Card>
                )}

                <View style={styles.actionList}>
                    <ActionRow
                        icon="add-circle-outline"
                        title="Submit a claim"
                        subtitle="Petrol, meals, tools and the rest"
                        onPress={() => navigation.navigate('SubmitClaim')}
                    />
                    <ActionRow
                        icon="wallet-outline"
                        title="My claims"
                        subtitle="What you have claimed and what has been paid"
                        onPress={() => navigation.navigate('MyClaims')}
                    />
                </View>

                {(canKeyIn || canViewAll || canManageClaimType || canCreateClaim) && (
                    <>
                        <SectionLabel style={styles.sectionSpacing}>Managing claims</SectionLabel>
                        <View style={styles.actionList}>
                            {canCreateClaim && (
                                <ActionRow
                                    icon="folder-open-outline"
                                    title="Open a shared claim"
                                    subtitle="A folder like September 2026 for the team to file into"
                                    onPress={() => navigation.navigate('OpenClaim')}
                                />
                            )}
                            {canKeyIn && (
                                <ActionRow
                                    icon="documents-outline"
                                    title="Key in for a staff member"
                                    subtitle="For receipts handed over in person"
                                    onPress={() => navigation.navigate('KeyInClaim')}
                                />
                            )}
                            {canViewAll && (
                                <ActionRow
                                    icon="albums-outline"
                                    title="Claims register"
                                    subtitle="Every claim, by location and role"
                                    onPress={() => navigation.navigate('ClaimRegister')}
                                />
                            )}
                            {canManageClaimType && (
                                <ActionRow
                                    icon="pricetags-outline"
                                    title="Claim categories"
                                    subtitle="Petrol, meals and which need receipts"
                                    onPress={() => navigation.navigate('ClaimTypeList')}
                                />
                            )}
                        </View>
                    </>
                )}

                {recentList.length > 0 && (
                    <>
                        <SectionLabel style={styles.sectionSpacing}>Your recent claims</SectionLabel>
                        <View style={styles.actionList}>
                            {recentList.map((claim) => {
                                const statusStyle = CLAIM_STATUS_STYLE[claim.status]
                                    || CLAIM_STATUS_STYLE.PENDING
                                return (
                                    <Card
                                        key={claim.id}
                                        onPress={() => navigation.navigate('ClaimDetail', {
                                            claimID: claim.id,
                                        })}
                                    >
                                        <View style={styles.cardRow}>
                                            <View style={styles.flex}>
                                                <Text style={styles.recentTitle}>{claim.title}</Text>
                                                <Text style={styles.recentMeta}>
                                                    {[claim.location?.title,
                                                        formatTimestamp(claim.createDate)]
                                                        .filter(Boolean).join(' - ')}
                                                </Text>
                                            </View>
                                            <View style={styles.recentRight}>
                                                <Text style={styles.recentAmount}>
                                                    {formatMoney(claim.totalAmount)}
                                                </Text>
                                                <View style={[styles.pill, {
                                                    backgroundColor: statusStyle.background,
                                                }]}>
                                                    <Text style={[styles.pillText, {
                                                        color: statusStyle.color,
                                                    }]}>
                                                        {statusStyle.label}
                                                    </Text>
                                                </View>
                                            </View>
                                        </View>
                                    </Card>
                                )
                            })}
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
    cardRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },

    unpaidCard: {
        backgroundColor: colors.pendingSoft,
        borderColor: colors.pending,
        marginBottom: spacing.md,
    },
    unpaidBadge: {
        width: 38,
        height: 38,
        borderRadius: radius.pill,
        backgroundColor: colors.pending,
        alignItems: 'center',
        justifyContent: 'center',
    },
    unpaidBadgeText: { color: '#FFFFFF', fontSize: 17, fontWeight: '800' },
    unpaidTitle: { ...type.subheading, color: colors.pending },
    unpaidSubtitle: { ...type.small, color: colors.pending, opacity: 0.85 },

    owedCard: {
        backgroundColor: colors.brandSoft,
        borderColor: colors.brand,
        marginBottom: spacing.xl,
    },
    owedLabel: { ...type.label, color: colors.brandDark },
    owedValue: {
        fontSize: 28,
        fontWeight: '800',
        color: colors.brandDark,
        marginTop: spacing.xs,
    },

    actionList: { gap: spacing.sm },
    recentTitle: { ...type.body, fontWeight: '600' },
    recentMeta: { ...type.small, fontSize: 12, marginTop: 1 },
    recentRight: { alignItems: 'flex-end', gap: spacing.xs },
    recentAmount: { ...type.body, fontWeight: '700' },
    pill: { paddingHorizontal: spacing.md, paddingVertical: 2, borderRadius: radius.pill },
    pillText: { fontSize: 11, fontWeight: '700' },
})
