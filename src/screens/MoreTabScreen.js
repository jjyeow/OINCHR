import React from 'react'
import { Alert, ScrollView, StyleSheet, Text, View } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'

import { useAuth } from '../context/AuthContext'
import { PERMISSION } from '../permissions'
import { ActionRow, TabHeader } from '../components/tabs'
import { Card, PrimaryButton, SectionLabel } from '../components/ui'
import { colors, spacing, type } from '../theme'

export default function MoreTabScreen({ navigation }) {
    const { user, can, signOut } = useAuth()

    const canViewCalendar = can(PERMISSION.VIEW_TEAM_CALENDAR)
    const canManageLeaveType = can(PERMISSION.MANAGE_LEAVE_TYPE)
    const canManageHoliday = can(PERMISSION.MANAGE_HOLIDAY)
    const canManageClaimType = can(PERMISSION.MANAGE_CLAIM_TYPE)
    // Either scope is enough to open the screen; it hides the tab you cannot see.
    const canViewPermissions = can(PERMISSION.VIEW_USER_PERMISSIONS)
        || can(PERMISSION.VIEW_CONTAINER_PERMISSIONS)
        || can(PERMISSION.MANAGE_CONTAINER_PERMISSIONS)
    const hasSetup = canManageLeaveType || canManageHoliday || canManageClaimType

    const onSignOut = () => {
        Alert.alert('Sign out?', 'You will need your username and password to get back in.', [
            { text: 'Stay signed in', style: 'cancel' },
            { text: 'Sign out', style: 'destructive', onPress: signOut },
        ])
    }

    return (
        <SafeAreaView style={styles.safe} edges={['top']}>
            <ScrollView contentContainerStyle={styles.scroll}>
                <TabHeader title="More" />

                <Card style={styles.profileCard}>
                    <View style={styles.avatar}>
                        <Text style={styles.avatarText}>
                            {(user?.name || '?').slice(0, 1).toUpperCase()}
                        </Text>
                    </View>
                    <View style={styles.flex}>
                        <Text style={styles.profileName}>{user?.name}</Text>
                        <Text style={styles.profileRole}>
                            {user?.systemRole?.title || 'No role assigned'}
                        </Text>
                        {!!user?.email && (
                            <Text style={styles.profileMeta}>{user.email}</Text>
                        )}
                    </View>
                </Card>

                {canViewCalendar && (
                    <>
                        <SectionLabel style={styles.sectionSpacing}>Team</SectionLabel>
                        <View style={styles.actionList}>
                            <ActionRow
                                icon="calendar-outline"
                                title="Team calendar"
                                subtitle="Who is off, and when"
                                onPress={() => navigation.navigate('TeamCalendar')}
                            />
                        </View>
                    </>
                )}

                {hasSetup && (
                    <>
                        <SectionLabel style={styles.sectionSpacing}>Setup</SectionLabel>
                        <View style={styles.actionList}>
                            {canManageLeaveType && (
                                <ActionRow
                                    icon="albums-outline"
                                    title="Leave types"
                                    subtitle="Annual, medical, unpaid and the rest"
                                    onPress={() => navigation.navigate('LeaveTypeList')}
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
                            {canManageHoliday && (
                                <ActionRow
                                    icon="flag-outline"
                                    title="Public holidays"
                                    subtitle="Days that are never counted as leave"
                                    onPress={() => navigation.navigate('PublicHoliday')}
                                />
                            )}
                        </View>
                    </>
                )}

                {canViewPermissions && (
                    <>
                        <SectionLabel style={styles.sectionSpacing}>Access control</SectionLabel>
                        <View style={styles.actionList}>
                            <ActionRow
                                icon="key-outline"
                                title="Who can do what"
                                subtitle="System and container access, set per person"
                                onPress={() => navigation.navigate('UserPermission')}
                            />
                        </View>
                    </>
                )}

                <PrimaryButton
                    title="Sign out"
                    variant="ghost"
                    onPress={onSignOut}
                    style={styles.signOut}
                />

                <Text style={styles.version}>OINCHR 1.0.0</Text>
            </ScrollView>
        </SafeAreaView>
    )
}

const styles = StyleSheet.create({
    safe: { flex: 1, backgroundColor: colors.ground },
    scroll: { padding: spacing.lg, paddingBottom: spacing.xxl },
    flex: { flex: 1 },
    sectionSpacing: { marginTop: spacing.xl },

    profileCard: { flexDirection: 'row', alignItems: 'center', gap: spacing.lg },
    avatar: {
        width: 52,
        height: 52,
        borderRadius: 26,
        backgroundColor: colors.brand,
        alignItems: 'center',
        justifyContent: 'center',
    },
    avatarText: { color: '#FFFFFF', fontSize: 22, fontWeight: '800' },
    profileName: { ...type.heading },
    profileRole: { ...type.small, marginTop: 1 },
    profileMeta: { ...type.small, fontSize: 12, color: colors.inkFaint, marginTop: 1 },

    actionList: { gap: spacing.sm },
    signOut: { marginTop: spacing.xxl },
    version: {
        ...type.small,
        fontSize: 11,
        color: colors.inkFaint,
        textAlign: 'center',
        marginTop: spacing.lg,
    },
})
