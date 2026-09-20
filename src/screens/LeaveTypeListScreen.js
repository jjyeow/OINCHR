import React, { useCallback, useState } from 'react'
import { FlatList, RefreshControl, StyleSheet, Text, View } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { useFocusEffect } from '@react-navigation/native'
import { Ionicons } from '@expo/vector-icons'

import * as leaveApi from '../api/leave'
import { describeError } from '../api/client'
import { Card, EmptyState, ErrorBanner, LoadingView, PrimaryButton } from '../components/ui'
import { colors, radius, spacing, type } from '../theme'

/**
 * The first screen anyone touches on a fresh install: with no leave types nobody can
 * apply for anything, so the empty state has to explain that rather than just say
 * "nothing here".
 */
export default function LeaveTypeListScreen({ navigation }) {
    const [leaveTypeList, setLeaveTypeList] = useState([])
    const [isLoading, setIsLoading] = useState(true)
    const [isRefreshing, setIsRefreshing] = useState(false)
    const [errorMessage, setErrorMessage] = useState('')

    const load = useCallback(async () => {
        setErrorMessage('')
        try {
            const result = await leaveApi.getLeaveTypeList({ includeInactive: true })
            setLeaveTypeList(result.data || [])
        } catch (error) {
            setErrorMessage(describeError(error, 'Could not load leave types.'))
        }
        setIsLoading(false)
    }, [])

    useFocusEffect(useCallback(() => { load() }, [load]))

    const onRefresh = async () => {
        setIsRefreshing(true)
        await load()
        setIsRefreshing(false)
    }

    if (isLoading) return <LoadingView message="Loading leave types" />

    return (
        <SafeAreaView style={styles.safe} edges={['bottom']}>
            <FlatList
                data={leaveTypeList}
                keyExtractor={(item) => String(item.id)}
                contentContainerStyle={styles.listContent}
                refreshControl={<RefreshControl refreshing={isRefreshing} onRefresh={onRefresh} />}
                ListHeaderComponent={(
                    <>
                        <ErrorBanner message={errorMessage} onRetry={load} />
                        {leaveTypeList.length > 0 && (
                            <Text style={styles.intro}>
                                These are what staff choose from when they apply. Tap one to change it.
                            </Text>
                        )}
                    </>
                )}
                ListEmptyComponent={(
                    <EmptyState
                        icon="albums-outline"
                        title="No leave types yet"
                        message={'Until you add one, nobody can apply for leave and every '
                            + 'balance shows empty. Most farms start with Annual, Medical '
                            + 'and Unpaid.'}
                    />
                )}
                renderItem={({ item }) => (
                    <Card
                        style={!item.active && styles.inactiveCard}
                        onPress={() => navigation.navigate('LeaveTypeForm', { leaveType: item })}
                    >
                        <View style={styles.header}>
                            <View style={styles.flex}>
                                <Text style={[styles.title, !item.active && styles.inactiveText]}>
                                    {item.title}
                                </Text>
                                <Text style={styles.code}>{item.code}</Text>
                            </View>
                            <View style={styles.daysBox}>
                                <Text style={styles.days}>{Number(item.daysPerYear)}</Text>
                                <Text style={styles.daysCaption}>days/yr</Text>
                            </View>
                        </View>

                        <View style={styles.tagRow}>
                            {!item.active && <Tag icon="eye-off-outline" label="Retired" muted />}
                            {!item.deductFromBalance && (
                                <Tag icon="infinite-outline" label="No balance" />
                            )}
                            {item.requiresAttachment && (
                                <Tag icon="document-attach-outline" label="Needs document" />
                            )}
                            {item.allowHalfDay && <Tag icon="contrast-outline" label="Half day" />}
                            {item.carryForward && (
                                <Tag icon="arrow-forward-outline" label="Carries forward" />
                            )}
                        </View>
                    </Card>
                )}
            />

            <View style={styles.footer}>
                <PrimaryButton
                    title="Add a leave type"
                    onPress={() => navigation.navigate('LeaveTypeForm', {})}
                />
            </View>
        </SafeAreaView>
    )
}

function Tag({ icon, label, muted }) {
    return (
        <View style={[styles.tag, muted && styles.tagMuted]}>
            <Ionicons
                name={icon}
                size={12}
                color={muted ? colors.inkFaint : colors.brandDark}
            />
            <Text style={[styles.tagText, muted && styles.tagTextMuted]}>{label}</Text>
        </View>
    )
}

const styles = StyleSheet.create({
    safe: { flex: 1, backgroundColor: colors.ground },
    flex: { flex: 1 },
    listContent: { padding: spacing.lg, gap: spacing.sm, flexGrow: 1 },
    intro: { ...type.small, marginBottom: spacing.md },

    inactiveCard: { opacity: 0.6 },
    inactiveText: { textDecorationLine: 'line-through' },

    header: { flexDirection: 'row', alignItems: 'flex-start', gap: spacing.md },
    title: { ...type.subheading },
    code: { ...type.small, fontSize: 12, marginTop: 1 },
    daysBox: { alignItems: 'flex-end' },
    days: { fontSize: 22, fontWeight: '800', color: colors.ink },
    daysCaption: { ...type.small, fontSize: 11 },

    tagRow: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm, marginTop: spacing.md },
    tag: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 4,
        backgroundColor: colors.brandSoft,
        paddingHorizontal: spacing.sm,
        paddingVertical: 3,
        borderRadius: radius.pill,
    },
    tagMuted: { backgroundColor: colors.ground },
    tagText: { fontSize: 11, fontWeight: '600', color: colors.brandDark },
    tagTextMuted: { color: colors.inkFaint },

    footer: {
        padding: spacing.lg,
        borderTopWidth: 1,
        borderTopColor: colors.line,
        backgroundColor: colors.surface,
    },
})
