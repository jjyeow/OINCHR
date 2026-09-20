// OINC green, carried over from OINCRN so the three apps read as one family.
export const colors = {
    brand: '#5EB894',
    brandDark: '#3F8E6E',
    brandSoft: '#E8F5EF',

    ink: '#1C2523',
    inkMuted: '#657069',
    inkFaint: '#949494',

    ground: '#F4F6F5',
    surface: '#FFFFFF',
    line: '#E3E6E4',

    // Leave status. Kept separate from the brand colour so a green button never
    // reads as "approved".
    pending: '#B57A1F',
    pendingSoft: '#FBF1DF',
    approved: '#2C7A55',
    approvedSoft: '#E4F2EA',
    rejected: '#B3402F',
    rejectedSoft: '#FAE8E5',
    cancelled: '#7A8380',
    cancelledSoft: '#EDEFEE',
}

export const spacing = {
    xs: 4,
    sm: 8,
    md: 12,
    lg: 16,
    xl: 24,
    xxl: 32,
}

export const radius = {
    sm: 6,
    md: 10,
    lg: 14,
    pill: 999,
}

export const type = {
    title: { fontSize: 26, fontWeight: '700', color: colors.ink },
    heading: { fontSize: 19, fontWeight: '700', color: colors.ink },
    subheading: { fontSize: 16, fontWeight: '600', color: colors.ink },
    body: { fontSize: 15, color: colors.ink },
    small: { fontSize: 13, color: colors.inkMuted },
    label: { fontSize: 12, fontWeight: '600', color: colors.inkMuted, letterSpacing: 0.6 },
}

export const STATUS_STYLE = {
    PENDING: { label: 'Pending', color: colors.pending, background: colors.pendingSoft },
    APPROVED: { label: 'Approved', color: colors.approved, background: colors.approvedSoft },
    REJECTED: { label: 'Rejected', color: colors.rejected, background: colors.rejectedSoft },
    CANCELLED: { label: 'Cancelled', color: colors.cancelled, background: colors.cancelledSoft },
}
