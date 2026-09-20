import React, { useCallback, useEffect, useMemo, useState } from 'react'
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { Ionicons } from '@expo/vector-icons'

import * as leaveApi from '../api/leave'
import { describeError } from '../api/client'
import { Card, ErrorBanner, LoadingView, SectionLabel, StatusPill } from '../components/ui'
import { toServerDate } from '../lib/dates'
import { colors, radius, spacing, type } from '../theme'

const MONTH_NAME_LIST = ['January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December']
const WEEKDAY_LIST = ['M', 'T', 'W', 'T', 'F', 'S', 'S']

/**
 * A month grid on a phone can only carry so much, so the grid answers "how many
 * people are off that day" and tapping a day answers "who".
 */
export default function TeamCalendarScreen() {
    const [anchorDate, setAnchorDate] = useState(() => {
        const now = new Date()
        return new Date(now.getFullYear(), now.getMonth(), 1)
    })
    const [dayMap, setDayMap] = useState({})
    const [holidaySet, setHolidaySet] = useState(new Set())
    const [selectedDate, setSelectedDate] = useState(null)
    const [isLoading, setIsLoading] = useState(true)
    const [errorMessage, setErrorMessage] = useState('')

    const year = anchorDate.getFullYear()
    const month = anchorDate.getMonth()

    const load = useCallback(async () => {
        setIsLoading(true)
        setErrorMessage('')
        try {
            const fromDate = toServerDate(new Date(year, month, 1))
            const toDate = toServerDate(new Date(year, month + 1, 0))
            const result = await leaveApi.getTeamCalendar({ fromDate, toDate })
            setDayMap(result.data || {})
            setHolidaySet(new Set(result.holidayList || []))
        } catch (error) {
            setErrorMessage(describeError(error, 'Could not load the calendar.'))
        }
        setIsLoading(false)
    }, [year, month])

    useEffect(() => { load() }, [load])
    useEffect(() => { setSelectedDate(null) }, [year, month])

    /** Weeks starting Monday, padded so the first day lands in the right column. */
    const weekList = useMemo(() => {
        const firstDay = new Date(year, month, 1)
        const daysInMonth = new Date(year, month + 1, 0).getDate()
        // getDay() is Sunday-based; shift so Monday is 0.
        const leadingBlanks = (firstDay.getDay() + 6) % 7

        const cellList = Array(leadingBlanks).fill(null)
        for (let day = 1; day <= daysInMonth; day += 1) {
            cellList.push(toServerDate(new Date(year, month, day)))
        }
        while (cellList.length % 7 !== 0) cellList.push(null)

        const weeks = []
        for (let index = 0; index < cellList.length; index += 7) {
            weeks.push(cellList.slice(index, index + 7))
        }
        return weeks
    }, [year, month])

    const selectedList = selectedDate ? (dayMap[selectedDate] || []) : []

    return (
        <SafeAreaView style={styles.safe} edges={['bottom']}>
            <ScrollView contentContainerStyle={styles.scroll}>
                <View style={styles.monthBar}>
                    <Pressable
                        onPress={() => setAnchorDate(new Date(year, month - 1, 1))}
                        hitSlop={12}
                        accessibilityLabel="Previous month"
                    >
                        <Ionicons name="chevron-back" size={22} color={colors.ink} />
                    </Pressable>
                    <Text style={styles.monthTitle}>{MONTH_NAME_LIST[month]} {year}</Text>
                    <Pressable
                        onPress={() => setAnchorDate(new Date(year, month + 1, 1))}
                        hitSlop={12}
                        accessibilityLabel="Next month"
                    >
                        <Ionicons name="chevron-forward" size={22} color={colors.ink} />
                    </Pressable>
                </View>

                <ErrorBanner message={errorMessage} onRetry={load} />

                {isLoading ? <LoadingView message="Loading calendar" /> : (
                    <>
                        <Card style={styles.calendarCard}>
                            <View style={styles.weekHeader}>
                                {WEEKDAY_LIST.map((weekday, index) => (
                                    <Text key={index} style={styles.weekHeaderText}>{weekday}</Text>
                                ))}
                            </View>

                            {weekList.map((week, weekIndex) => (
                                <View key={weekIndex} style={styles.week}>
                                    {week.map((dateString, dayIndex) => {
                                        if (!dateString) {
                                            return <View key={dayIndex} style={styles.day} />
                                        }
                                        const peopleList = dayMap[dateString] || []
                                        const isHoliday = holidaySet.has(dateString)
                                        const isSelected = dateString === selectedDate
                                        const dayNumber = Number(dateString.slice(8, 10))

                                        return (
                                            <Pressable
                                                key={dayIndex}
                                                onPress={() => setSelectedDate(
                                                    isSelected ? null : dateString,
                                                )}
                                                style={[
                                                    styles.day,
                                                    isHoliday && styles.dayHoliday,
                                                    isSelected && styles.daySelected,
                                                ]}
                                            >
                                                <Text style={[
                                                    styles.dayNumber,
                                                    isSelected && styles.dayNumberSelected,
                                                ]}>
                                                    {dayNumber}
                                                </Text>
                                                {peopleList.length > 0 && (
                                                    <View style={[
                                                        styles.dayCount,
                                                        isSelected && styles.dayCountSelected,
                                                    ]}>
                                                        <Text style={[
                                                            styles.dayCountText,
                                                            isSelected && styles.dayCountTextSelected,
                                                        ]}>
                                                            {peopleList.length}
                                                        </Text>
                                                    </View>
                                                )}
                                            </Pressable>
                                        )
                                    })}
                                </View>
                            ))}

                            <View style={styles.legend}>
                                <View style={styles.legendItem}>
                                    <View style={styles.legendDot} />
                                    <Text style={styles.legendText}>people off</Text>
                                </View>
                                <View style={styles.legendItem}>
                                    <View style={[styles.legendSwatch, styles.dayHoliday]} />
                                    <Text style={styles.legendText}>public holiday</Text>
                                </View>
                            </View>
                        </Card>

                        {!!selectedDate && (
                            <>
                                <SectionLabel style={styles.sectionSpacing}>
                                    {selectedDate}
                                </SectionLabel>
                                {selectedList.length === 0 ? (
                                    <Card><Text style={type.small}>Nobody is off this day.</Text></Card>
                                ) : (
                                    <View style={styles.personList}>
                                        {selectedList.map((person) => (
                                            <Card key={person.leaveRequestID} style={styles.personCard}>
                                                <View style={styles.flex}>
                                                    <Text style={styles.personName}>
                                                        {person.staffName}
                                                    </Text>
                                                    <Text style={styles.personType}>
                                                        {person.leaveType}
                                                        {person.dayPortion === 'AM' ? ' - morning'
                                                            : person.dayPortion === 'PM' ? ' - afternoon'
                                                                : ''}
                                                    </Text>
                                                </View>
                                                <StatusPill status={person.status} />
                                            </Card>
                                        ))}
                                    </View>
                                )}
                            </>
                        )}
                    </>
                )}
            </ScrollView>
        </SafeAreaView>
    )
}

const styles = StyleSheet.create({
    safe: { flex: 1, backgroundColor: colors.ground },
    scroll: { padding: spacing.lg, paddingBottom: spacing.xxl },
    flex: { flex: 1 },
    sectionSpacing: { marginTop: spacing.xl },

    monthBar: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        marginBottom: spacing.lg,
    },
    monthTitle: { ...type.heading },

    calendarCard: { padding: spacing.md },
    weekHeader: { flexDirection: 'row', marginBottom: spacing.sm },
    weekHeaderText: {
        flex: 1,
        textAlign: 'center',
        ...type.label,
        fontSize: 11,
    },
    week: { flexDirection: 'row' },
    day: {
        flex: 1,
        aspectRatio: 1,
        alignItems: 'center',
        justifyContent: 'center',
        borderRadius: radius.sm,
        margin: 1,
        gap: 2,
    },
    dayHoliday: { backgroundColor: colors.pendingSoft },
    daySelected: { backgroundColor: colors.ink },
    dayNumber: { ...type.small, fontSize: 13, color: colors.ink },
    dayNumberSelected: { color: '#FFFFFF', fontWeight: '700' },
    dayCount: {
        minWidth: 16,
        height: 16,
        borderRadius: radius.pill,
        backgroundColor: colors.brand,
        alignItems: 'center',
        justifyContent: 'center',
        paddingHorizontal: 3,
    },
    dayCountSelected: { backgroundColor: '#FFFFFF' },
    dayCountText: { color: '#FFFFFF', fontSize: 10, fontWeight: '700' },
    dayCountTextSelected: { color: colors.ink },

    legend: {
        flexDirection: 'row',
        gap: spacing.lg,
        marginTop: spacing.md,
        paddingTop: spacing.md,
        borderTopWidth: 1,
        borderTopColor: colors.line,
    },
    legendItem: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs },
    legendDot: {
        width: 12, height: 12, borderRadius: radius.pill, backgroundColor: colors.brand,
    },
    legendSwatch: { width: 12, height: 12, borderRadius: 3 },
    legendText: { ...type.small, fontSize: 11 },

    personList: { gap: spacing.sm },
    personCard: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
    personName: { ...type.body, fontWeight: '600' },
    personType: { ...type.small, fontSize: 12 },
})
