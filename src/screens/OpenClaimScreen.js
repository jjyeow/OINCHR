import React, { useEffect, useState } from 'react'
import { ScrollView, StyleSheet, Text } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import Toast from 'react-native-toast-message'

import * as claimApi from '../api/claims'
import { describeError } from '../api/client'
import { SelectField, TextField } from '../components/fields'
import { ErrorBanner, LoadingView, PrimaryButton } from '../components/ui'
import { colors, spacing, type } from '../theme'

/**
 * Opens an empty shared claim for the team to file into - "September 2026".
 *
 * Deliberately not the submit form: a manager opening a folder has no expenses of
 * their own to add yet, and asking for one would put their money in everybody's
 * claim. Expenses are added afterwards, by whoever is claiming them.
 */
export default function OpenClaimScreen({ navigation }) {
    const [locationList, setLocationList] = useState([])
    const [title, setTitle] = useState('')
    const [locationID, setLocationID] = useState(null)
    const [isLoading, setIsLoading] = useState(true)
    const [isSaving, setIsSaving] = useState(false)
    const [errorMessage, setErrorMessage] = useState('')

    useEffect(() => {
        claimApi.getLocationList()
            .then((result) => setLocationList(Array.isArray(result) ? result : []))
            .catch((error) => setErrorMessage(describeError(error, 'Could not load locations.')))
            .finally(() => setIsLoading(false))
    }, [])

    const onCreate = async () => {
        setIsSaving(true)
        try {
            const claim = await claimApi.createClaim({ title: title.trim(), locationID })
            Toast.show({
                type: 'success',
                text1: `${claim.title} opened`,
                text2: 'Anyone can now add their own expenses to it.',
            })
            navigation.replace('ClaimDetail', { claimID: claim.id })
        } catch (error) {
            Toast.show({ type: 'error', text1: 'Could not open', text2: describeError(error) })
        }
        setIsSaving(false)
    }

    if (isLoading) return <LoadingView message="Loading" />

    return (
        <SafeAreaView style={styles.safe} edges={['bottom']}>
            <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
                <ErrorBanner message={errorMessage} />

                <Text style={styles.intro}>
                    A shared claim is a folder everyone files into. Each person sees only
                    their own expenses inside it; you see all of them and reimburse each
                    person separately.
                </Text>

                <TextField
                    label="Title"
                    hint="What period or purpose this covers."
                    placeholder="September 2026"
                    value={title}
                    onChangeText={setTitle}
                />

                <SelectField
                    label="Location"
                    placeholder="Which farm is this for?"
                    value={locationID}
                    onChange={setLocationID}
                    options={locationList.map((location) => ({
                        value: location.id,
                        label: location.title,
                    }))}
                />

                <PrimaryButton
                    title="Open claim"
                    onPress={onCreate}
                    loading={isSaving}
                    disabled={!title.trim() || !locationID}
                    style={styles.button}
                />
            </ScrollView>
        </SafeAreaView>
    )
}

const styles = StyleSheet.create({
    safe: { flex: 1, backgroundColor: colors.ground },
    scroll: { padding: spacing.lg, paddingBottom: spacing.xxl },
    intro: { ...type.small, marginBottom: spacing.lg },
    button: { marginTop: spacing.xl },
})
