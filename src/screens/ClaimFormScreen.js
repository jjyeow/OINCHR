import React, { useCallback, useEffect, useMemo, useState } from 'react'
import {
    Image, KeyboardAvoidingView, Modal, Platform, Pressable, ScrollView, StyleSheet, Text, View,
} from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { Ionicons } from '@expo/vector-icons'
import Toast from 'react-native-toast-message'

import { useAuth } from '../context/AuthContext'
import * as claimApi from '../api/claims'
import * as leaveApi from '../api/leave'
import { describeError } from '../api/client'
import { DateField, SelectField, TextField } from '../components/fields'
import { AttachmentStrip, pickAttachment } from '../components/attachments'
import FullScreenModal from '../components/FullScreenModal'
import {
    Card, ErrorBanner, LoadingView, PrimaryButton, SectionLabel,
} from '../components/ui'
import { formatDisplayDate, today } from '../lib/dates'
import { formatMoney } from '../lib/money'
import { colors, radius, spacing, type } from '../theme'

/**
 * Backs both a staff member claiming for themselves and HR keying one in. A claim is
 * a title, a location, and one or more lines - the total is the sum of the lines and
 * is never typed by hand.
 */
export default function ClaimFormScreen({ navigation, route }) {
    const isOnBehalf = route?.params?.mode === 'onBehalf'
    const { user } = useAuth()

    const [isLoading, setIsLoading] = useState(true)
    const [loadError, setLoadError] = useState('')
    const [claimTypeList, setClaimTypeList] = useState([])
    const [locationList, setLocationList] = useState([])
    const [staffList, setStaffList] = useState([])

    const [staffID, setStaffID] = useState(null)
    const [title, setTitle] = useState('')
    const [locationID, setLocationID] = useState(null)
    const [itemList, setItemList] = useState([])

    const [isAddingLine, setIsAddingLine] = useState(false)
    const [isSubmitting, setIsSubmitting] = useState(false)
    const [submitError, setSubmitError] = useState('')
    const [assetList, setAssetList] = useState([])
    const [uploadStatus, setUploadStatus] = useState('')

    useEffect(() => {
        navigation.setOptions({ title: isOnBehalf ? 'Key in a claim' : 'New claim' })
    }, [navigation, isOnBehalf])

    const load = useCallback(async () => {
        setIsLoading(true)
        setLoadError('')
        try {
            const requestList = [claimApi.getClaimTypeList(), claimApi.getLocationList()]
            if (isOnBehalf) requestList.push(leaveApi.getStaffList())
            const [typeResult, locationResult, staffResult] = await Promise.all(requestList)

            setClaimTypeList(typeResult.data || [])
            setLocationList(Array.isArray(locationResult) ? locationResult : [])
            if (staffResult) setStaffList(staffResult.data || [])
        } catch (error) {
            setLoadError(describeError(error, 'Could not load the form.'))
        }
        setIsLoading(false)
    }, [isOnBehalf])

    useEffect(() => { load() }, [load])

    const totalAmount = useMemo(
        () => itemList.reduce((sum, item) => sum + Number(item.amount || 0), 0),
        [itemList],
    )
    const anyLineNeedsReceipt = itemList.some((item) => item.requiresReceipt)

    const selectedStaff = staffList.find((staff) => String(staff.id) === String(staffID))
    // The claim is filed under the claimant's role, not the person keying it in.
    const roleLabel = isOnBehalf
        ? (selectedStaff ? 'their role at submission' : null)
        : (user?.systemRole?.title || null)

    const validationMessage = useMemo(() => {
        if (isOnBehalf && !staffID) return 'Choose who this claim is for.'
        if (title.trim().length === 0) return 'Give the claim a short title.'
        if (!locationID) return 'Choose which location this claim is from.'
        if (itemList.length === 0) return 'Add at least one expense.'
        return ''
    }, [isOnBehalf, staffID, title, locationID, itemList])

    const onSubmit = async () => {
        if (validationMessage !== '' || isSubmitting) return
        setIsSubmitting(true)
        setSubmitError('')
        try {
            const payload = {
                title: title.trim(),
                locationID,
                itemList: itemList.map((item) => ({
                    claimTypeID: item.claimTypeID,
                    title: item.title,
                    amount: String(item.amount),
                    expenseDate: item.expenseDate,
                    description: item.description || '',
                })),
            }
            const created = isOnBehalf
                ? await claimApi.submitClaimOnBehalf({ ...payload, staffID })
                : await claimApi.submitClaim(payload)

            // Receipts attach by id, so they can only go up once the claim exists.
            // The server returns its expenses in the order they were sent, which is
            // how each local receipt finds the expense it belongs to.
            const uploadList = []
            const createdItemList = created.itemList || []
            itemList.forEach((item, index) => {
                const createdItem = createdItemList[index]
                ;(item.assetList || []).forEach((asset) => {
                    uploadList.push({ asset, claimItemID: createdItem?.id })
                })
            })
            assetList.forEach((asset) => uploadList.push({ asset, claimItemID: undefined }))

            let failedCount = 0
            for (let index = 0; index < uploadList.length; index += 1) {
                setUploadStatus(`Uploading ${index + 1} of ${uploadList.length}...`)
                try {
                    await claimApi.uploadClaimAttachment({
                        claimID: created.id,
                        claimItemID: uploadList[index].claimItemID,
                        asset: uploadList[index].asset,
                    })
                } catch (error) {
                    failedCount += 1
                }
            }
            setUploadStatus('')

            const needsReceipt = itemList.some(
                (item) => item.requiresReceipt && !(item.assetList || []).length)
            if (failedCount > 0) {
                Toast.show({
                    type: 'error',
                    text1: 'Claim saved, but some receipts did not upload',
                    text2: `${failedCount} failed. Attach them again from the claim.`,
                })
            } else {
                Toast.show({
                    type: 'success',
                    text1: isOnBehalf ? 'Claim keyed in' : 'Claim submitted',
                    text2: needsReceipt && assetList.length === 0
                        ? 'Attach a receipt before it can be approved.'
                        : 'It is now waiting for approval.',
                })
            }
            navigation.replace('ClaimDetail', { claimID: created.id })
        } catch (error) {
            setSubmitError(describeError(error, 'Could not submit this claim.'))
            setUploadStatus('')
            setIsSubmitting(false)
        }
    }

    if (isLoading) return <LoadingView message="Loading the form" />

    if (loadError) {
        return (
            <SafeAreaView style={styles.safe}>
                <View style={styles.scroll}>
                    <ErrorBanner message={loadError} onRetry={load} />
                </View>
            </SafeAreaView>
        )
    }

    return (
        <SafeAreaView style={styles.safe} edges={['bottom']}>
            <KeyboardAvoidingView
                style={styles.flex}
                behavior={Platform.OS === 'ios' ? 'padding' : undefined}
                keyboardVerticalOffset={90}
            >
                <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
                    <ErrorBanner message={submitError} />

                    {isOnBehalf && (
                        <SelectField
                            label="Staff member"
                            placeholder="Who is this claim for?"
                            value={staffID}
                            onChange={setStaffID}
                            hint="The claim is filed under their role, and shows you as the person who entered it."
                            options={staffList.map((staff) => ({
                                value: staff.id,
                                label: staff.name,
                                subtitle: [staff.position, staff.department]
                                    .filter(Boolean).join(' - '),
                            }))}
                        />
                    )}

                    <TextField
                        label="Claim title"
                        hint="Usually the period it covers, e.g. September 2026."
                        placeholder="September 2026"
                        value={title}
                        onChangeText={setTitle}
                    />

                    <SelectField
                        label="Location"
                        placeholder="Which farm is this spend from?"
                        value={locationID}
                        onChange={setLocationID}
                        options={locationList.map((location) => ({
                            value: location.id,
                            label: location.title,
                        }))}
                    />

                    {!!roleLabel && !isOnBehalf && (
                        <View style={styles.roleNote}>
                            <Ionicons name="person-outline" size={15} color={colors.inkMuted} />
                            <Text style={styles.roleNoteText}>
                                Filed as <Text style={styles.roleNoteStrong}>{roleLabel}</Text>
                            </Text>
                        </View>
                    )}

                    <SectionLabel style={styles.sectionSpacing}>
                        Expenses ({itemList.length})
                    </SectionLabel>

                    {itemList.length === 0 && (
                        <Card style={styles.emptyLines}>
                            <Text style={type.small}>
                                Nothing added yet. Add one expense for each receipt - a claim
                                like "September 2026" holds a whole month of them.
                            </Text>
                        </Card>
                    )}

                    <View style={styles.lineList}>
                        {itemList.map((item, index) => (
                            <Card key={index} style={styles.lineCard}>
                                <View style={styles.lineTop}>
                                    <View style={styles.flex}>
                                        <Text style={styles.lineTitle}>{item.title}</Text>
                                        <Text style={styles.lineMeta}>
                                            {item.claimTypeTitle} - {formatDisplayDate(item.expenseDate)}
                                            {item.description ? ` - ${item.description}` : ''}
                                        </Text>
                                    </View>
                                    <Text style={styles.lineAmount}>{formatMoney(item.amount)}</Text>
                                    <Pressable
                                        onPress={() => setItemList(
                                            itemList.filter((_, position) => position !== index),
                                        )}
                                        hitSlop={10}
                                        accessibilityLabel={`Remove ${item.title}`}
                                    >
                                        <Ionicons name="close-circle" size={20} color={colors.inkFaint} />
                                    </Pressable>
                                </View>

                                <View style={styles.lineReceiptRow}>
                                    {(item.assetList || []).map((asset, assetIndex) => (
                                        <Image
                                            key={`${asset.uri}-${assetIndex}`}
                                            source={{ uri: asset.uri }}
                                            style={styles.lineThumb}
                                        />
                                    ))}
                                    <Pressable
                                        onPress={async () => {
                                            const picked = await pickAttachment()
                                            if (!picked.length) return
                                            setItemList(itemList.map((row, position) => (
                                                position === index
                                                    ? { ...row, assetList: [...(row.assetList || []), ...picked] }
                                                    : row
                                            )))
                                        }}
                                        style={styles.lineAddReceipt}
                                    >
                                        <Ionicons name="camera-outline" size={15}
                                                  color={item.requiresReceipt && !(item.assetList || []).length
                                                      ? colors.pending : colors.brandDark} />
                                        <Text style={[
                                            styles.lineAddReceiptText,
                                            item.requiresReceipt && !(item.assetList || []).length
                                                && styles.lineAddReceiptRequired,
                                        ]}>
                                            {(item.assetList || []).length > 0
                                                ? 'Add another receipt'
                                                : item.requiresReceipt
                                                    ? 'Receipt required' : 'Add receipt'}
                                        </Text>
                                    </Pressable>
                                </View>
                            </Card>
                        ))}
                    </View>

                    <PrimaryButton
                        title="Add an expense"
                        variant="ghost"
                        onPress={() => setIsAddingLine(true)}
                        style={styles.addLine}
                    />

                    <Card style={styles.totalCard}>
                        <Text style={styles.totalLabel}>CLAIM TOTAL</Text>
                        <Text style={styles.totalValue}>{formatMoney(totalAmount)}</Text>
                        <Text style={styles.totalCaption}>
                            Added up from the expenses - you never type this yourself.
                        </Text>
                    </Card>

                    <AttachmentStrip
                        label="Documents for the whole claim"
                        hint="Optional. Receipts for individual expenses go on the expense itself, above."
                        required={false}
                        assetList={assetList}
                        onAdd={async () => {
                            const picked = await pickAttachment()
                            if (picked.length) setAssetList([...assetList, ...picked])
                        }}
                        onRemove={(index) => setAssetList(
                            assetList.filter((_, position) => position !== index),
                        )}
                    />

                    {!!validationMessage && (
                        <Text style={styles.validation}>{validationMessage}</Text>
                    )}

                    <PrimaryButton
                        title={uploadStatus || (isOnBehalf
                            ? 'Submit for this staff member' : 'Submit claim')}
                        onPress={onSubmit}
                        loading={isSubmitting}
                        disabled={validationMessage !== ''}
                    />
                </ScrollView>
            </KeyboardAvoidingView>

            <AddLineModal
                isVisible={isAddingLine}
                claimTypeList={claimTypeList}
                onClose={() => setIsAddingLine(false)}
                onAdd={(line) => { setItemList([...itemList, line]); setIsAddingLine(false) }}
            />
        </SafeAreaView>
    )
}

function AddLineModal({ isVisible, claimTypeList, onClose, onAdd }) {
    const [claimTypeID, setClaimTypeID] = useState(null)
    const [title, setTitle] = useState('')
    const [amount, setAmount] = useState('')
    const [expenseDate, setExpenseDate] = useState(today())
    const [description, setDescription] = useState('')
    const [lineAssetList, setLineAssetList] = useState([])

    useEffect(() => {
        if (isVisible) {
            setClaimTypeID(null)
            setTitle('')
            setAmount('')
            setExpenseDate(today())
            setDescription('')
            setLineAssetList([])
        }
    }, [isVisible])

    const claimType = claimTypeList.find(
        (item) => String(item.id) === String(claimTypeID),
    )
    const amountValue = Number(amount)
    const amountIsValid = amount !== '' && !Number.isNaN(amountValue) && amountValue > 0
    const canAdd = !!claimTypeID && amountIsValid

    return (
        <FullScreenModal isVisible={isVisible} title="Add an expense" onClose={onClose}>
                    <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
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
                            assetList={lineAssetList}
                            onAdd={async () => {
                                const picked = await pickAttachment()
                                if (picked.length) setLineAssetList([...lineAssetList, ...picked])
                            }}
                            onRemove={(index) => setLineAssetList(
                                lineAssetList.filter((_, position) => position !== index),
                            )}
                        />

                        <PrimaryButton
                            title="Add to claim"
                            onPress={() => onAdd({
                                claimTypeID,
                                claimTypeTitle: claimType?.title,
                                title: title.trim() || claimType?.title,
                                requiresReceipt: !!claimType?.requiresReceipt,
                                amount: amountValue.toFixed(2),
                                expenseDate,
                                description: description.trim(),
                                assetList: lineAssetList,
                            })}
                            disabled={!canAdd}
                        />
                    </ScrollView>
        </FullScreenModal>
    )
}

const styles = StyleSheet.create({
    safe: { flex: 1, backgroundColor: colors.ground },
    flex: { flex: 1 },
    scroll: { padding: spacing.lg, paddingBottom: spacing.xxl },
    sectionSpacing: { marginTop: spacing.sm },

    roleNote: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: spacing.sm,
        padding: spacing.md,
        backgroundColor: colors.surface,
        borderRadius: radius.md,
        borderWidth: 1,
        borderColor: colors.line,
        marginBottom: spacing.lg,
    },
    roleNoteText: { ...type.small, flex: 1 },
    roleNoteStrong: { fontWeight: '700', color: colors.ink },

    emptyLines: { marginBottom: spacing.sm },
    lineList: { gap: spacing.sm },
    lineCard: { gap: spacing.md },
    lineTop: { flexDirection: 'row', alignItems: 'flex-start', gap: spacing.md },
    lineTitle: { ...type.body, fontWeight: '600' },
    lineMeta: { ...type.small, fontSize: 12, marginTop: 1 },
    lineAmount: { ...type.body, fontWeight: '700' },
    lineReceiptRow: { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: spacing.sm },
    lineThumb: { width: 40, height: 40, borderRadius: radius.sm },
    lineAddReceipt: { flexDirection: 'row', alignItems: 'center', gap: 4 },
    lineAddReceiptText: { fontSize: 12, fontWeight: '600', color: colors.brandDark },
    lineAddReceiptRequired: { color: colors.pending },
    addLine: { marginTop: spacing.md },

    totalCard: {
        backgroundColor: colors.brandSoft,
        borderColor: colors.brand,
        marginTop: spacing.lg,
        marginBottom: spacing.lg,
    },
    totalLabel: { ...type.label, color: colors.brandDark },
    totalValue: {
        fontSize: 28,
        fontWeight: '800',
        color: colors.brandDark,
        marginVertical: spacing.xs,
    },
    totalCaption: { ...type.small, fontSize: 12, color: colors.brandDark, opacity: 0.8 },

    validation: { ...type.small, color: colors.pending, marginBottom: spacing.md },

    modalHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: spacing.lg,
        borderBottomWidth: 1,
        borderBottomColor: colors.line,
    },
    modalTitle: { ...type.heading },
})
