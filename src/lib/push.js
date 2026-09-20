import { Platform } from 'react-native'
import * as Device from 'expo-device'
import * as Notifications from 'expo-notifications'
import Constants from 'expo-constants'

Notifications.setNotificationHandler({
    handleNotification: async () => ({
        shouldShowBanner: true,
        shouldShowList: true,
        shouldPlaySound: false,
        shouldSetBadge: false,
    }),
})

/**
 * Returns an Expo push token, or '' when we cannot get one.
 *
 * Deliberately never throws: a staff member who declined notifications, or is on a
 * simulator, must still be able to sign in and apply for leave.
 */
export async function registerForPushNotifications() {
    try {
        if (Platform.OS === 'android') {
            await Notifications.setNotificationChannelAsync('default', {
                name: 'default',
                importance: Notifications.AndroidImportance.DEFAULT,
                vibrationPattern: [0, 250, 250, 250],
            })
        }

        if (!Device.isDevice) return ''

        const existing = await Notifications.getPermissionsAsync()
        let status = existing.status
        if (status !== 'granted') {
            const requested = await Notifications.requestPermissionsAsync()
            status = requested.status
        }
        if (status !== 'granted') return ''

        const projectId = Constants?.expoConfig?.extra?.eas?.projectId
            ?? Constants?.easConfig?.projectId
        if (!projectId) return ''

        const token = await Notifications.getExpoPushTokenAsync({ projectId })
        return token?.data ?? ''
    } catch (error) {
        return ''
    }
}
