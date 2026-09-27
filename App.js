import React from 'react'
import { StatusBar } from 'expo-status-bar'
import { NavigationContainer } from '@react-navigation/native'
import { createNativeStackNavigator } from '@react-navigation/native-stack'
import { SafeAreaProvider } from 'react-native-safe-area-context'
import Toast from 'react-native-toast-message'

import { AuthProvider, useAuth } from './src/context/AuthContext'
import { LoadingView } from './src/components/ui'
import { colors } from './src/theme'

import TabNavigator from './src/navigation/TabNavigator'
import LoginScreen from './src/screens/LoginScreen'
import LeaveFormScreen from './src/screens/LeaveFormScreen'
import LeaveListScreen from './src/screens/LeaveListScreen'
import LeaveDetailScreen from './src/screens/LeaveDetailScreen'
import ApprovalQueueScreen from './src/screens/ApprovalQueueScreen'
import TeamCalendarScreen from './src/screens/TeamCalendarScreen'
import LeaveTypeListScreen from './src/screens/LeaveTypeListScreen'
import LeaveTypeFormScreen from './src/screens/LeaveTypeFormScreen'
import PublicHolidayScreen from './src/screens/PublicHolidayScreen'
import ClaimListScreen from './src/screens/ClaimListScreen'
import ClaimDetailScreen from './src/screens/ClaimDetailScreen'
import ClaimTypeListScreen from './src/screens/ClaimTypeListScreen'
import ClaimFormScreen from './src/screens/ClaimFormScreen'
import UserPermissionScreen from './src/screens/UserPermissionScreen'

const Stack = createNativeStackNavigator()

const screenOptions = {
    headerStyle: { backgroundColor: colors.ground },
    headerTitleStyle: { color: colors.ink, fontSize: 17, fontWeight: '700' },
    headerTintColor: colors.brandDark,
    headerShadowVisible: false,
    contentStyle: { backgroundColor: colors.ground },
}

/**
 * Which actions a person sees is decided by the server, not the app: the home screen
 * shows a route only when the role holds the matching permission, and the server
 * enforces the same rule again on every request.
 */
function RootNavigator() {
    const { isStarting, isSignedIn } = useAuth()

    if (isStarting) return <LoadingView message="Starting OINCHR" />

    return (
        <Stack.Navigator screenOptions={screenOptions}>
            {!isSignedIn ? (
                <Stack.Screen
                    name="Login"
                    component={LoginScreen}
                    options={{ headerShown: false }}
                />
            ) : (
                <>
                    {/* The tab bar is the app; everything else pushes over it as a
                        stack screen with a back button. */}
                    <Stack.Screen
                        name="Tabs"
                        component={TabNavigator}
                        options={{ headerShown: false }}
                    />
                    <Stack.Screen
                        name="ApplyLeave"
                        component={LeaveFormScreen}
                        options={{ title: 'Apply for leave' }}
                    />
                    <Stack.Screen
                        name="KeyInLeave"
                        component={LeaveFormScreen}
                        initialParams={{ mode: 'onBehalf' }}
                        options={{ title: 'Key in leave' }}
                    />
                    <Stack.Screen
                        name="MyLeave"
                        component={LeaveListScreen}
                        options={{ title: 'My leave' }}
                    />
                    <Stack.Screen
                        name="LeaveRegister"
                        component={LeaveListScreen}
                        initialParams={{ mode: 'register' }}
                        options={{ title: 'Leave register' }}
                    />
                    <Stack.Screen
                        name="LeaveDetail"
                        component={LeaveDetailScreen}
                        options={{ title: 'Leave request' }}
                    />
                    <Stack.Screen
                        name="ApprovalQueue"
                        component={ApprovalQueueScreen}
                        options={{ title: 'Awaiting approval' }}
                    />
                    <Stack.Screen
                        name="TeamCalendar"
                        component={TeamCalendarScreen}
                        options={{ title: 'Team calendar' }}
                    />
                    <Stack.Screen
                        name="LeaveTypeList"
                        component={LeaveTypeListScreen}
                        options={{ title: 'Leave types' }}
                    />
                    <Stack.Screen
                        name="LeaveTypeForm"
                        component={LeaveTypeFormScreen}
                        options={{ title: 'Leave type' }}
                    />
                    <Stack.Screen
                        name="PublicHoliday"
                        component={PublicHolidayScreen}
                        options={{ title: 'Public holidays' }}
                    />
                    <Stack.Screen
                        name="SubmitClaim"
                        component={ClaimFormScreen}
                        options={{ title: 'Submit a claim' }}
                    />
                    <Stack.Screen
                        name="KeyInClaim"
                        component={ClaimFormScreen}
                        options={{ title: 'Key in a claim' }}
                    />
                    <Stack.Screen
                        name="EditClaim"
                        component={ClaimFormScreen}
                        options={{ title: 'Edit claim' }}
                    />
                    <Stack.Screen
                        name="MyClaims"
                        component={ClaimListScreen}
                        options={{ title: 'My claims' }}
                    />
                    <Stack.Screen
                        name="ClaimRegister"
                        component={ClaimListScreen}
                        initialParams={{ mode: 'register' }}
                        options={{ title: 'Claims register' }}
                    />
                    <Stack.Screen
                        name="ClaimDetail"
                        component={ClaimDetailScreen}
                        options={{ title: 'Claim' }}
                    />
                    <Stack.Screen
                        name="ClaimTypeList"
                        component={ClaimTypeListScreen}
                        options={{ title: 'Claim categories' }}
                    />
                    <Stack.Screen
                        name="UserPermission"
                        component={UserPermissionScreen}
                        options={{ title: 'Access control' }}
                    />
                </>
            )}
        </Stack.Navigator>
    )
}

export default function App() {
    return (
        <SafeAreaProvider>
            <AuthProvider>
                <NavigationContainer>
                    <StatusBar style="dark" />
                    <RootNavigator />
                </NavigationContainer>
                <Toast />
            </AuthProvider>
        </SafeAreaProvider>
    )
}
