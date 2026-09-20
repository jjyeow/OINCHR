const MONTH_LIST = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
    'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']

/**
 * The server takes and returns YYYY-MM-DD. Building it from local date parts rather
 * than toISOString() matters - toISOString converts to UTC first, which in Malaysia
 * (UTC+8) turns any date into the previous day for the first 8 hours of the morning.
 */
export function toServerDate(date) {
    const year = date.getFullYear()
    const month = String(date.getMonth() + 1).padStart(2, '0')
    const day = String(date.getDate()).padStart(2, '0')
    return `${year}-${month}-${day}`
}

export function today() {
    return toServerDate(new Date())
}

export function parseServerDate(value) {
    if (!value) return null
    const [year, month, day] = String(value).slice(0, 10).split('-').map(Number)
    if (!year || !month || !day) return null
    return new Date(year, month - 1, day)
}

export function formatDisplayDate(value) {
    const date = parseServerDate(value)
    if (!date) return ''
    return `${date.getDate()} ${MONTH_LIST[date.getMonth()]} ${date.getFullYear()}`
}

export function formatDateRange(startDate, endDate, dayPortion = 'FULL') {
    if (startDate === endDate) {
        const suffix = dayPortion === 'AM' ? ' (morning)'
            : dayPortion === 'PM' ? ' (afternoon)' : ''
        return `${formatDisplayDate(startDate)}${suffix}`
    }
    return `${formatDisplayDate(startDate)} - ${formatDisplayDate(endDate)}`
}

export function formatTimestamp(value) {
    if (!value) return ''
    const date = new Date(value)
    if (Number.isNaN(date.getTime())) return ''
    const hours = String(date.getHours()).padStart(2, '0')
    const minutes = String(date.getMinutes()).padStart(2, '0')
    return `${date.getDate()} ${MONTH_LIST[date.getMonth()]} ${date.getFullYear()}, ${hours}:${minutes}`
}

/** "1 day" / "2.5 days" - Number() drops the trailing .0 the server sends. */
export function formatDays(value) {
    const days = Number(value)
    if (Number.isNaN(days)) return String(value)
    return `${days} ${days === 1 ? 'day' : 'days'}`
}
