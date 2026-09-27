import React, { useCallback, useEffect, useState } from 'react'
import { KeyboardAvoidingView, Platform, ScrollView, StyleSheet } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import Toast from 'react-native-toast-message'

import * as claimApi from '../api/claims'
import * as leaveApi from '../api/leave'
import { describeError } from '../api/client'
import { useAuth } from '../context/AuthContext'
import { PERMISSION } from '../permissions'
import { DateField, SelectField, TextField } from '../components/fields'
import { AttachmentStrip, pickAttachment } from '../components/attachments'
import { ErrorBanner, LoadingView, PrimaryButton } from '../components/ui'
import { today } from '../lib/dates'
import { colors, spacing } from '../theme'

/**
 * Submits a claim, which is to say one expense. There is no folder to open first and
 * nothing to add afterwards - the form is the whole act.
 *
 * Also where a receipt handed over in person gets keyed in: whoever holds Submit
 * Claim On Behalf picks the staff member it belongs to.
 */
export default function ClaimFormScreen({ navigation, route }) {
    const { can } = useAuth()
    const canFileForOthers = can(PERMISSION.SUBMIT_CLAIM_ON_BEHALF)

    // Editing reuses this form rather than duplicating it: the fields are the same,
    // and the only differences are that they start filled and the claimant is fixed.
    const editingClaim = route.params?.claim || null
    const isEditing = !!editingClaim

    const [claimTypeList, setClaimTypeList] = useState([])
    const [locationList, setLocationList] = useState([])
    const [staffList, setStaffList] = useState([])
    const [isLoading, setIsLoading] = useState(true)
    const [loadError, setLoadError] = useState('')

    // Blank means the expense is the caller's own, which is the common case.
    const [staffID, setStaffID] = useState(null)

    const [claimTypeID, setClaimTypeID] = useState(editingClaim?.claimType?.id ?? null)
    const [locationID, setLocationID] = useState(editingClaim?.location?.id ?? null)
    const [title, setTitle] = useState(editingClaim?.title || '')
    const [amount, setAmount] = useState(
        editingClaim ? String(editingClaim.amount ?? '') : '')
    const [expenseDate, setExpenseDate] = useState(editingClaim?.expenseDate || today())
    const [description, setDescription] = useState(editingClaim?.description || '')
    const [assetList, setAssetList] = useState([])

    const [isSubmitting, setIsSubmitting] = useState(false)
    const [uploadStatus, setUploadStatus] = useState('')
    const [submitError, setSubmitError] = useState('')

    const load = useCallback(async () => {
        setIsLoading(true)
        setLoadError('')
        try {
            const requestList = [claimApi.getClaimTypeList(), claimApi.getLocationList()]
            if (canFileForOthers && !isEditing) requestList.push(leaveApi.getStaffList())
            const [typeResult, locationResult, staffResult] = await Promise.all(requestList)
            setClaimTypeList(typeResult.data || [])
            // container/getlocationlist answers with a bare array, not {data}, unlike
            // the hr endpoints next to it. Both shapes are accepted rather than
            // depending on which app the endpoint happens to live in.
            setLocationList(Array.isArray(locationResult)
                ? locationResult
                : (locationResult?.data || []))
            if (staffResult) setStaffList(staffResult.data || [])
        } catch (error) {
            setLoadError(describeError(error, 'Could not load claim categories.'))
        }
        setIsLoading(false)
    }, [canFileForOthers, isEditing])

    useEffect(() => { load() }, [load])

    const claimType = claimTypeList.find((item) => String(item.id) === String(claimTypeID))
    const selectedStaff = staffList.find((staff) => String(staff.id) === String(staffID))
    const amountValue = Number(amount)
    const amountIsValid = amount !== '' && !Number.isNaN(amountValue) && amountValue > 0
    const canSubmit = !!claimTypeID && !!locationID && amountIsValid
        && title.trim().length > 0

    const onSubmit = async () => {
        if (!canSubmit || isSubmitting) return
        setIsSubmitting(true)
        setSubmitError('')
        try {
            const payload = {
                title: title.trim(),
                locationID,
                claimTypeID,
                amount: amountValue.toFixed(2),
                expenseDate,
                description: description.trim(),
            }
            // The claim has to exist before a receipt can hang off it, so the upload
            // is a second step rather than part of the same request.
            let claim
            if (isEditing) {
                claim = await claimApi.editClaim({ ...payload, claimID: editingClaim.id })
            } else if (staffID) {
                claim = await claimApi.submitClaimOnBehalf({ ...payload, staffID })
            } else {
                claim = await claimApi.submitClaim(payload)
            }

            let failedCount = 0
            for (let index = 0; index < assetList.length; index += 1) {
                setUploadStatus(`Uploading ${index + 1} of ${assetList.length}...`)
                try {
                    await claimApi.uploadClaimAttachment({
                        claimID: claim.id,
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
                    text1: isEditing
                        ? 'Claim saved, but some receipts did not upload'
                        : 'Claim submitted, but some receipts did not upload',
                    text2: `${failedCount} failed. Attach them again from the claim.`,
                }
                : {
                    type: 'success',
                    text1: `${title.trim()} ${isEditing ? 'saved' : 'submitted'}`,
                })
            navigation.goBack()
        } catch (error) {
            setSubmitError(describeError(error, isEditing
                ? 'Could not save this claim.'
                : 'Could not submit this claim.'))
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

                    {canFileForOthers && !isEditing && (
                        <SelectField
                            label="Whose expense is this?"
                            hint="Leave blank if it is your own."
                            placeholder="Mine"
                            value={staffID}
                            onChange={setStaffID}
                            options={staffList.map((staff) => ({
                                value: staff.id,
                                label: staff.name,
                                subtitle: [staff.position, staff.department]
                                    .filter(Boolean).join(' - ') || undefined,
                            }))}
                        />
                    )}

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

                    <SelectField
                        label="Location"
                        placeholder="Which farm was this for?"
                        value={locationID}
                        onChange={setLocationID}
                        options={locationList.map((item) => ({
                            value: item.id,
                            label: item.title,
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
                        title={uploadStatus
                            || (isEditing ? 'Save changes'
                                : (selectedStaff ? `Submit for ${selectedStaff.name}` : 'Submit claim'))}
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
