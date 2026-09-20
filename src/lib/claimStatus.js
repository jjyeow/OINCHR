import { colors } from '../theme'

/**
 * Claims have one state leave does not: PAID. It gets the brand colour rather than
 * the approved green, so "approved but the money has not moved yet" and "done" are
 * never mistaken for each other at a glance.
 */
export const CLAIM_STATUS_STYLE = {
    PENDING: { label: 'Pending', color: colors.pending, background: colors.pendingSoft },
    APPROVED: { label: 'To pay', color: colors.approved, background: colors.approvedSoft },
    PAID: { label: 'Paid', color: colors.brandDark, background: colors.brandSoft },
    REJECTED: { label: 'Rejected', color: colors.rejected, background: colors.rejectedSoft },
    CANCELLED: { label: 'Cancelled', color: colors.cancelled, background: colors.cancelledSoft },
}
