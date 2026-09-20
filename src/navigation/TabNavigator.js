import React, { useCallback, useState } from 'react'
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs'
import { useFocusEffect } from '@react-navigation/native'
import { Ionicons } from '@expo/vector-icons'

import { useAuth } from '../context/AuthContext'
import { PERMISSION } from '../permissions'
import * as leaveApi from '../api/leave'
import { colors } from '../theme'

import LeaveTabScreen from '../screens/LeaveTabScreen'
import ClaimTabScreen from '../screens/ClaimTabScreen'
import ApprovalQueueScreen from '../screens/ApprovalQueueScreen'
import MoreTabScreen from '../screens/MoreTabScreen'

const Tab = createBottomTabNavigator()

/**
 * Wraps the approval queue so the tab badge refreshes whenever the tab is focused -
 * a director who approves three things should see the badge drop, not go stale.
 */
function ApprovalsTab(props) {
    return <ApprovalQueueScreen {...props} />
}

export default function TabNavigator() {
    const { can } = useAuth()
    const [pendingCount, setPendingCount] = useState(0)

    const canApproveLeave = can(PERMISSION.APPROVE_LEAVE)
    const canApproveClaim = can(PERMISSION.APPROVE_CLAIM)
    const showApprovals = canApproveLeave || canApproveClaim
    // Claims are only a tab for people who can actually file one.
    const showClaims = can(PERMISSION.SUBMIT_CLAIM) || can(PERMISSION.VIEW_ALL_CLAIMS)

    const refreshBadge = useCallback(async () => {
        if (!showApprovals) return
        try {
            const result = await leaveApi.getPendingApprovalCount()
            setPendingCount(result.totalCount || 0)
        } catch (error) {
            // A badge is not worth surfacing an error over.
        }
    }, [showApprovals])

    useFocusEffect(useCallback(() => { refreshBadge() }, [refreshBadge]))

    return (
        <Tab.Navigator
            screenOptions={{
                headerShown: false,
                tabBarActiveTintColor: colors.brandDark,
                tabBarInactiveTintColor: colors.inkFaint,
                tabBarStyle: {
                    backgroundColor: colors.surface,
                    borderTopColor: colors.line,
                },
                tabBarLabelStyle: { fontSize: 11, fontWeight: '600' },
                tabBarBadgeStyle: { backgroundColor: colors.rejected, fontSize: 11 },
            }}
        >
            <Tab.Screen
                name="LeaveTab"
                component={LeaveTabScreen}
                listeners={{ focus: refreshBadge }}
                options={{
                    title: 'Leave',
                    tabBarIcon: ({ color, size }) => (
                        <Ionicons name="calendar-outline" size={size} color={color} />
                    ),
                }}
            />

            {showClaims && (
                <Tab.Screen
                    name="ClaimTab"
                    component={ClaimTabScreen}
                    listeners={{ focus: refreshBadge }}
                    options={{
                        title: 'Claims',
                        tabBarIcon: ({ color, size }) => (
                            <Ionicons name="receipt-outline" size={size} color={color} />
                        ),
                    }}
                />
            )}

            {showApprovals && (
                <Tab.Screen
                    name="ApprovalsTab"
                    component={ApprovalsTab}
                    listeners={{ focus: refreshBadge }}
                    options={{
                        title: 'Approve',
                        tabBarBadge: pendingCount > 0 ? pendingCount : undefined,
                        tabBarIcon: ({ color, size }) => (
                            <Ionicons name="checkmark-circle-outline" size={size} color={color} />
                        ),
                    }}
                />
            )}

            <Tab.Screen
                name="MoreTab"
                component={MoreTabScreen}
                options={{
                    title: 'More',
                    tabBarIcon: ({ color, size }) => (
                        <Ionicons name="ellipsis-horizontal-circle-outline" size={size} color={color} />
                    ),
                }}
            />
        </Tab.Navigator>
    )
}
