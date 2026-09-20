import React from 'react'
import { Image, Pressable, StyleSheet, Text, View } from 'react-native'
import { Ionicons } from '@expo/vector-icons'

import { Card, PrimaryButton } from './ui'
import { formatDisplayDate, formatTimestamp } from '../lib/dates'
import { formatMoney } from '../lib/money'
import { colors, radius, spacing, type } from '../theme'

const ITEM_STATUS_STYLE = {
    PENDING: { label: 'Pending', color: colors.pending, background: colors.pendingSoft },
    APPROVED: { label: 'Approved', color: colors.approved, background: colors.approvedSoft },
    REJECTED: { label: 'Rejected', color: colors.rejected, background: colors.rejectedSoft },
    CANCELLED: { label: 'Removed', color: colors.cancelled, background: colors.cancelledSoft },
}

/**
 * One expense in the master layout: what it was, what it cost, its receipts listed
 * out by name, and its own approve/reject. Receipts are a labelled list rather than
 * a strip of thumbnails - a row of anonymous images does not read as "these are the
 * receipts", and the card can afford the height.
 */
export default function ExpenseRow({
    item,
    showOwner,
    canDecide,
    canAttach,
    canRemove,
    isBusy,
    onAttach,
    onOpenReceipt,
    onApprove,
    onReject,
    onRemove,
}) {
    const statusStyle = ITEM_STATUS_STYLE[item.status] || ITEM_STATUS_STYLE.PENDING
    const attachmentList = item.attachmentList || []
    const isDecided = item.status !== 'PENDING'

    return (
        <Card style={[styles.card, item.status === 'CANCELLED' && styles.cancelled]}>
            <View style={styles.top}>
                <View style={styles.flex}>
                    <Text style={styles.title}>{item.title}</Text>
                    <Text style={styles.meta}>
                        {/* On a shared claim the owner is what tells two rows apart,
                            so it leads the line when everybody's are on screen. */}
                        {showOwner && !!item.staff?.name && `${item.staff.name} · `}
                        {item.claimType?.title} · {formatDisplayDate(item.expenseDate)}
                    </Text>
                    {!!item.description && (
                        <Text style={styles.description}>{item.description}</Text>
                    )}
                </View>
                <View style={styles.topRight}>
                    <Text style={styles.amount}>{formatMoney(item.amount)}</Text>
                    <View style={[styles.pill, { backgroundColor: statusStyle.background }]}>
                        <Text style={[styles.pillText, { color: statusStyle.color }]}>
                            {statusStyle.label}
                        </Text>
                    </View>
                </View>
            </View>

            {item.status === 'REJECTED' && !!item.rejectionReason && (
                <View style={styles.rejectionNote}>
                    <Text style={styles.rejectionLabel}>REJECTED BECAUSE</Text>
                    <Text style={styles.rejectionText}>{item.rejectionReason}</Text>
                </View>
            )}

            <View style={styles.receiptSection}>
                <Text style={styles.receiptHeading}>
                    {attachmentList.length > 0
                        ? `RECEIPTS (${attachmentList.length})`
                        : 'RECEIPTS'}
                </Text>

                {attachmentList.length === 0 && (
                    <View style={[styles.emptyReceipt, item.needsReceipt && styles.emptyRequired]}>
                        <Ionicons
                            name={item.needsReceipt ? 'alert-circle-outline' : 'document-outline'}
                            size={16}
                            color={item.needsReceipt ? colors.pending : colors.inkFaint}
                        />
                        <Text style={[
                            styles.emptyReceiptText,
                            item.needsReceipt && styles.emptyReceiptRequired,
                        ]}>
                            {item.needsReceipt
                                ? 'Required — this expense cannot be approved without one'
                                : 'None attached'}
                        </Text>
                    </View>
                )}

                {attachmentList.map((attachment, index) => (
                    <Pressable
                        key={attachment.id}
                        onPress={() => onOpenReceipt(attachment)}
                        accessibilityRole="button"
                        accessibilityLabel={`Open receipt ${index + 1}`}
                        style={({ pressed }) => [styles.receiptRow, pressed && styles.pressed]}
                    >
                        {attachment.imageUrl ? (
                            <Image source={{ uri: attachment.imageUrl }} style={styles.thumb} />
                        ) : (
                            <View style={[styles.thumb, styles.thumbPlaceholder]}>
                                <Ionicons name="receipt-outline" size={20} color={colors.brandDark} />
                            </View>
                        )}
                        <View style={styles.flex}>
                            <Text style={styles.receiptName}>Receipt {index + 1}</Text>
                            <Text style={styles.receiptMeta}>
                                {attachment.uploadedBy?.name || 'Unknown'} ·{' '}
                                {formatTimestamp(attachment.createDate)}
                            </Text>
                        </View>
                        <View style={styles.viewTag}>
                            <Ionicons name="eye-outline" size={14} color={colors.brandDark} />
                            <Text style={styles.viewText}>View</Text>
                        </View>
                    </Pressable>
                ))}

                {canAttach && (
                    <Pressable
                        onPress={onAttach}
                        disabled={isBusy}
                        style={({ pressed }) => [styles.addRow, pressed && styles.pressed]}
                    >
                        <Ionicons
                            name="camera-outline"
                            size={18}
                            color={item.needsReceipt ? colors.pending : colors.brandDark}
                        />
                        <Text style={[styles.addText, item.needsReceipt && styles.addTextRequired]}>
                            {attachmentList.length > 0 ? 'Add another receipt' : 'Add a receipt'}
                        </Text>
                    </Pressable>
                )}
            </View>

            {(canDecide && !isDecided) || canRemove ? (
                <View style={styles.footer}>
                    {canDecide && !isDecided && (
                        <>
                            <PrimaryButton
                                title="Approve"
                                onPress={onApprove}
                                disabled={isBusy || item.needsReceipt}
                                style={styles.decideButton}
                            />
                            <PrimaryButton
                                title="Reject"
                                variant="ghost"
                                onPress={onReject}
                                disabled={isBusy}
                                style={styles.decideButton}
                            />
                        </>
                    )}
                    {canRemove && (
                        <Pressable onPress={onRemove} disabled={isBusy} hitSlop={8}
                                   style={styles.removeButton}>
                            <Ionicons name="trash-outline" size={16} color={colors.inkFaint} />
                            <Text style={styles.removeText}>Remove</Text>
                        </Pressable>
                    )}
                </View>
            ) : null}
        </Card>
    )
}

const styles = StyleSheet.create({
    card: { gap: spacing.md },
    cancelled: { opacity: 0.5 },
    flex: { flex: 1 },
    pressed: { opacity: 0.6 },

    top: { flexDirection: 'row', alignItems: 'flex-start', gap: spacing.md },
    topRight: { alignItems: 'flex-end', gap: spacing.xs },
    title: { ...type.body, fontWeight: '700' },
    meta: { ...type.small, fontSize: 12, marginTop: 1 },
    description: { ...type.small, fontSize: 12, fontStyle: 'italic', marginTop: 2 },
    amount: { ...type.subheading, fontWeight: '800' },
    pill: { paddingHorizontal: spacing.sm, paddingVertical: 2, borderRadius: radius.pill },
    pillText: { fontSize: 11, fontWeight: '700' },

    rejectionNote: {
        backgroundColor: colors.rejectedSoft,
        borderRadius: radius.md,
        padding: spacing.md,
    },
    rejectionLabel: { ...type.label, fontSize: 10, color: colors.rejected, marginBottom: 2 },
    rejectionText: { ...type.small, fontSize: 12, color: colors.rejected },

    receiptSection: {
        borderTopWidth: 1,
        borderTopColor: colors.line,
        paddingTop: spacing.md,
        gap: spacing.sm,
    },
    receiptHeading: { ...type.label, fontSize: 10 },

    emptyReceipt: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: spacing.sm,
        paddingVertical: spacing.sm,
    },
    emptyRequired: {
        backgroundColor: colors.pendingSoft,
        borderRadius: radius.md,
        paddingHorizontal: spacing.md,
    },
    emptyReceiptText: { ...type.small, fontSize: 12, flex: 1 },
    emptyReceiptRequired: { color: colors.pending, fontWeight: '600' },

    receiptRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: spacing.md,
        paddingVertical: spacing.sm,
        borderBottomWidth: 1,
        borderBottomColor: colors.line,
    },
    thumb: { width: 46, height: 46, borderRadius: radius.sm, backgroundColor: colors.ground },
    thumbPlaceholder: {
        backgroundColor: colors.brandSoft,
        alignItems: 'center',
        justifyContent: 'center',
    },
    receiptName: { ...type.body, fontSize: 14, fontWeight: '600' },
    receiptMeta: { ...type.small, fontSize: 11, marginTop: 1 },
    viewTag: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 3,
        backgroundColor: colors.brandSoft,
        paddingHorizontal: spacing.sm,
        paddingVertical: 3,
        borderRadius: radius.pill,
    },
    viewText: { fontSize: 11, fontWeight: '700', color: colors.brandDark },

    addRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: spacing.sm,
        paddingVertical: spacing.sm,
    },
    addText: { ...type.body, fontSize: 14, fontWeight: '600', color: colors.brandDark },
    addTextRequired: { color: colors.pending },

    footer: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: spacing.sm,
        borderTopWidth: 1,
        borderTopColor: colors.line,
        paddingTop: spacing.md,
    },
    decideButton: { flex: 1, minHeight: 42 },
    removeButton: { flexDirection: 'row', alignItems: 'center', gap: 4, marginLeft: 'auto' },
    removeText: { fontSize: 12, fontWeight: '600', color: colors.inkFaint },
})
