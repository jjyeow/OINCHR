/**
 * Ringgit, always to two decimal places. The server sends amounts as strings so the
 * decimal survives the trip intact; Number() here is only for display.
 */
export function formatMoney(value) {
    const amount = Number(value)
    if (Number.isNaN(amount)) return 'RM0.00'
    return `RM${amount.toFixed(2)}`
}
