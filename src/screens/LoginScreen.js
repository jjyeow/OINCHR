import React, { useState } from 'react'
import {
    Image, KeyboardAvoidingView, Platform, ScrollView, StyleSheet, Text, TextInput, View,
} from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'

import { useAuth } from '../context/AuthContext'
import { describeError } from '../api/client'
import { registerForPushNotifications } from '../lib/push'
import { ErrorBanner, PrimaryButton } from '../components/ui'
import { colors, radius, spacing, type } from '../theme'

export default function LoginScreen() {
    const { signIn } = useAuth()
    const [username, setUsername] = useState('')
    const [password, setPassword] = useState('')
    const [isSubmitting, setIsSubmitting] = useState(false)
    const [errorMessage, setErrorMessage] = useState('')

    const canSubmit = username.trim().length > 0 && password.length > 0

    const onSubmit = async () => {
        if (!canSubmit || isSubmitting) return
        setIsSubmitting(true)
        setErrorMessage('')
        try {
            // Registering the push token at login is what lets the server notify this
            // device later. A device that refuses permission still signs in fine.
            const expoPushToken = await registerForPushNotifications()
            await signIn({ username: username.trim(), password, expoPushToken })
        } catch (error) {
            if (error?.response?.status === 401) {
                setErrorMessage('That username or password is not right.')
            } else {
                setErrorMessage(describeError(error, 'Could not sign in. Try again.'))
            }
            setIsSubmitting(false)
        }
    }

    return (
        <SafeAreaView style={styles.safe}>
            <KeyboardAvoidingView
                style={styles.flex}
                behavior={Platform.OS === 'ios' ? 'padding' : undefined}
            >
                <ScrollView
                    contentContainerStyle={styles.scroll}
                    keyboardShouldPersistTaps="handled"
                >
                    <View style={styles.brandMark}>
                        <Text style={styles.brandMarkText}>HR</Text>
                    </View>
                    <Text style={styles.title}>OINCHR</Text>
                    <Text style={styles.subtitle}>Leave and claims for OINC staff</Text>

                    <View style={styles.form}>
                        <ErrorBanner message={errorMessage} />

                        <Text style={styles.label}>USERNAME</Text>
                        <TextInput
                            style={styles.input}
                            value={username}
                            onChangeText={setUsername}
                            autoCapitalize="none"
                            autoCorrect={false}
                            autoComplete="username"
                            returnKeyType="next"
                            placeholder="Your username"
                            placeholderTextColor={colors.inkFaint}
                        />

                        <Text style={styles.label}>PASSWORD</Text>
                        <TextInput
                            style={styles.input}
                            value={password}
                            onChangeText={setPassword}
                            secureTextEntry
                            autoCapitalize="none"
                            autoComplete="password"
                            returnKeyType="go"
                            onSubmitEditing={onSubmit}
                            placeholder="Your password"
                            placeholderTextColor={colors.inkFaint}
                        />

                        <PrimaryButton
                            title="Sign in"
                            onPress={onSubmit}
                            loading={isSubmitting}
                            disabled={!canSubmit}
                            style={styles.submit}
                        />
                    </View>

                    <Text style={styles.footnote}>
                        Forgotten your password? Ask HR to reset it for you.
                    </Text>
                </ScrollView>
            </KeyboardAvoidingView>
        </SafeAreaView>
    )
}

const styles = StyleSheet.create({
    safe: { flex: 1, backgroundColor: colors.ground },
    flex: { flex: 1 },
    scroll: { flexGrow: 1, justifyContent: 'center', padding: spacing.xl },

    brandMark: {
        alignSelf: 'center',
        width: 64,
        height: 64,
        borderRadius: radius.lg,
        backgroundColor: colors.brand,
        alignItems: 'center',
        justifyContent: 'center',
    },
    brandMarkText: { color: '#FFFFFF', fontSize: 24, fontWeight: '800', letterSpacing: 1 },

    title: { ...type.title, textAlign: 'center', marginTop: spacing.lg },
    subtitle: { ...type.small, textAlign: 'center', marginTop: spacing.xs },

    form: {
        backgroundColor: colors.surface,
        borderRadius: radius.lg,
        borderWidth: 1,
        borderColor: colors.line,
        padding: spacing.xl,
        marginTop: spacing.xxl,
    },
    label: { ...type.label, marginBottom: spacing.sm },
    input: {
        backgroundColor: colors.ground,
        borderWidth: 1,
        borderColor: colors.line,
        borderRadius: radius.md,
        paddingHorizontal: spacing.lg,
        minHeight: 48,
        fontSize: 15,
        color: colors.ink,
        marginBottom: spacing.lg,
    },
    submit: { marginTop: spacing.sm },

    footnote: { ...type.small, textAlign: 'center', marginTop: spacing.xl },
})
