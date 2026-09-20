import React, { useCallback, useEffect, useState } from 'react'
import { KeyboardAvoidingView, Platform, ScrollView, StyleSheet } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import Toast from 'react-native-toast-message'

import * as claimApi from '../api/claims'
import { describeError } from '../api/client'
import { DateField, SelectField, TextField } from '../components/fields'
import { AttachmentStrip, pickAttachment } from '../components/attachments'
import { ErrorBanner, LoadingView, PrimaryButton } from '../components/ui'
import { today } from '../lib/dates'
import { colors, spacing } from '../theme'

/**
 * Adds one expense to a claim that is already open, so "September 2026" can be built
 * up as receipts arrive rather than in one sitting.
 */
export default function AddExpenseScreen({ navigation, route }) {
    const { claimID } = route.params

    const [claimTypeList, setClaimTypeList] = useState([])
    const [isLoading, setIsLoading] = useState(true)
    const [loadError, setLoadError] = useState('')

    const [claimTypeID, setClaimTypeID] = useState(null)
    const [title, setTitle] = useState('')
    const [amount, setAmount] = useState('')
    const [expenseDate, setExpenseDate] = useState(today())
    const [description, setDescription] = useState('')
    const [assetList, setAssetList] = useState([])

    const [isSubmitting, setIsSubmitting] = useState(false)
    const [uploadStatus, setUploadStatus] = useState('')
    const [submitError, setSubmitError] = useState('')

    const load = useCallback(async () => {
        setIsLoading(true)
        setLoadError('')
        try {
            const result = await claimApi.getClaimTypeList()
            setClaimTypeList(result.data || [])
        } catch (error) {
            setLoadError(describeError(error, 'Could not load claim categories.'))
        }
        setIsLoading(false)
    }, [])

    useEffect(() => { load() }, [load])

    const claimType = claimTypeList.find((item) => String(item.id) === String(claimTypeID))
    const amountValue = Number(amount)
    const amountIsValid = amount !== '' && !Number.isNaN(amountValue) && amountValue > 0
    const canSubmit = !!claimTypeID && amountIsValid && title.trim().length > 0

    const onSubmit = async () => {
        if (!canSubmit || isSubmitting) return
        setIsSubmitting(true)
        setSubmitError('')
        try {
            const updated = await claimApi.addClaimItem({
                claimID,
                claimTypeID,
                title: title.trim(),
                amount: amountValue.toFixed(2),
                expenseDate,
                description: description.trim(),
            })

            // The expense we just added is the newest one on the claim, and that is
            // what the receipts belong to.
            const createdItem = (updated.itemList || [])
                .filter((item) => item.status !== 'CANCELLED')
                .reduce((newest, item) => (!newest || item.id > newest.id ? item : newest), null)

            let failedCount = 0
            for (let index = 0; index < assetList.length; index += 1) {
                setUploadStatus(`Uploading ${index + 1} of ${assetList.length}...`)
                try {
                    await claimApi.uploadClaimAttachment({
                        claimID,
                        claimItemID: createdItem?.id,
                        asset: assetList[index],
                    })
                } catch (error) {
                    failedCount += 1
                }
            }
            setUploadStatus('')

            Toast.show(failedCount > 0
                ? {
                    type: 'error',
                    text1: 'Expense added, but some receipts did not upload',
                    text2: `${failedCount} failed. Attach them again from the claim.`,
                }
                : { type: 'success', text1: `${title.trim()} added` })
            navigation.goBack()
        } catch (error) {
            setSubmitError(describeError(error, 'Could not add this expense.'))
            setUploadStatus('')
            setIsSubmitting(false)
        }
    }

    if (isLoading) return <LoadingView message="Loading categories" />

    return (
        <SafeAreaView style={styles.safe} edges={['bottom']}>
            <KeyboardAvoidingView
                style={styles.flex}
                behavior={Platform.OS === 'ios' ? 'padding' : undefined}
                keyboardVerticalOffset={90}
            >
                <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
                    <ErrorBanner message={submitError || loadError} onRetry={loadError ? load : undefined} />

                    <TextField
                        label="Expense title"
                        hint="A short name you will recognise in the list."
                        placeholder="Petrol to the Miri site"
                        value={title}
                        onChangeText={setTitle}
                    />

                    <SelectField
                        label="Category"
                        placeholder="What kind of expense?"
                        value={claimTypeID}
                        onChange={setClaimTypeID}
                        options={claimTypeList.map((item) => ({
                            value: item.id,
                            label: item.title,
                            subtitle: item.requiresReceipt ? 'Receipt required' : undefined,
                        }))}
                    />

                    <TextField
                        label="Amount (RM)"
                        placeholder="45.50"
                        value={amount}
                        onChangeText={setAmount}
                        keyboardType="decimal-pad"
                        error={amount !== '' && !amountIsValid
                            ? 'Enter an amount greater than zero.' : ''}
                    />

                    <DateField
                        label="Date of the expense"
                        hint="When the money was spent, not today."
                        value={expenseDate}
                        onChange={setExpenseDate}
                        maximumDate={new Date()}
                    />

                    <TextField
                        label="Notes"
                        placeholder="Optional"
                        value={description}
                        onChangeText={setDescription}
                    />

                    <AttachmentStrip
                        label={claimType?.requiresReceipt ? 'Receipt (required)' : 'Receipt'}
                        hint={claimType?.requiresReceipt
                            ? 'This category needs its own receipt before it can be approved.'
                            : 'Optional for this category.'}
                        required={!!claimType?.requiresReceipt}
                        assetList={assetList}
                        onAdd={async () => {
                            const picked = await pickAttachment()
                            if (picked.length) setAssetList([...assetList, ...picked])
                        }}
                        onRemove={(index) => setAssetList(
                            assetList.filter((_, position) => position !== index),
                        )}
                    />

                    <PrimaryButton
                        title={uploadStatus || 'Add to claim'}
                        onPress={onSubmit}
                        loading={isSubmitting}
                        disabled={!canSubmit}
                    />
                </ScrollView>
            </KeyboardAvoidingView>
        </SafeAreaView>
    )
}

const styles = StyleSheet.create({
    safe: { flex: 1, backgroundColor: colors.ground },
    flex: { flex: 1 },
    scroll: { padding: spacing.lg, paddingBottom: spacing.xxl },
})
