import React, { useState } from 'react'
import {
    Modal, Pressable, ScrollView, StyleSheet, Switch, Text, TextInput, View,
} from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import DateTimePickerModal from 'react-native-modal-datetime-picker'

import { colors, radius, spacing, type } from '../theme'
import { formatDisplayDate, toServerDate } from '../lib/dates'

export function Field({ label, hint, children, error }) {
    return (
        <View style={styles.field}>
            <Text style={styles.label}>{label}</Text>
            {children}
            {!!error && <Text style={styles.error}>{error}</Text>}
            {!error && !!hint && <Text style={styles.hint}>{hint}</Text>}
        </View>
    )
}

export function TextField({ label, hint, error, multiline, ...inputProps }) {
    return (
        <Field label={label} hint={hint} error={error}>
            <TextInput
                style={[styles.input, multiline && styles.inputMultiline, !!error && styles.inputError]}
                placeholderTextColor={colors.inkFaint}
                multiline={multiline}
                {...inputProps}
            />
        </Field>
    )
}

export function DateField({ label, hint, error, value, onChange, minimumDate, maximumDate }) {
    const [isOpen, setIsOpen] = useState(false)

    return (
        <Field label={label} hint={hint} error={error}>
            <Pressable
                onPress={() => setIsOpen(true)}
                style={[styles.input, styles.inputRow, !!error && styles.inputError]}
            >
                <Text style={value ? styles.inputText : styles.placeholder}>
                    {value ? formatDisplayDate(value) : 'Select a date'}
                </Text>
                <Ionicons name="calendar-outline" size={19} color={colors.inkMuted} />
            </Pressable>
            <DateTimePickerModal
                isVisible={isOpen}
                mode="date"
                date={value ? new Date(value) : new Date()}
                minimumDate={minimumDate}
                maximumDate={maximumDate}
                onConfirm={(selected) => {
                    setIsOpen(false)
                    onChange(toServerDate(selected))
                }}
                onCancel={() => setIsOpen(false)}
            />
        </Field>
    )
}

/**
 * A bottom-sheet picker. Used instead of a native picker so the same control works
 * identically on both platforms and can show a subtitle per option - the staff
 * picker needs to show a department under each name.
 */
export function SelectField({ label, hint, error, value, options, onChange, placeholder = 'Select' }) {
    const [isOpen, setIsOpen] = useState(false)
    const selected = options.find((option) => String(option.value) === String(value))

    return (
        <Field label={label} hint={hint} error={error}>
            <Pressable
                onPress={() => setIsOpen(true)}
                style={[styles.input, styles.inputRow, !!error && styles.inputError]}
            >
                <Text style={selected ? styles.inputText : styles.placeholder} numberOfLines={1}>
                    {selected ? selected.label : placeholder}
                </Text>
                <Ionicons name="chevron-down" size={19} color={colors.inkMuted} />
            </Pressable>

            <Modal visible={isOpen} transparent animationType="slide"
                   onRequestClose={() => setIsOpen(false)}>
                <Pressable style={styles.backdrop} onPress={() => setIsOpen(false)} />
                <View style={styles.sheet}>
                    <View style={styles.sheetHandle} />
                    <Text style={styles.sheetTitle}>{label}</Text>
                    <ScrollView style={styles.sheetScroll}>
                        {options.length === 0 && (
                            <Text style={styles.sheetEmpty}>Nothing to choose from yet.</Text>
                        )}
                        {options.map((option) => {
                            const isSelected = String(option.value) === String(value)
                            return (
                                <Pressable
                                    key={String(option.value)}
                                    onPress={() => { onChange(option.value); setIsOpen(false) }}
                                    style={({ pressed }) => [styles.option, pressed && styles.optionPressed]}
                                >
                                    <View style={styles.optionText}>
                                        <Text style={styles.optionLabel}>{option.label}</Text>
                                        {!!option.subtitle && (
                                            <Text style={styles.optionSubtitle}>{option.subtitle}</Text>
                                        )}
                                    </View>
                                    {isSelected && (
                                        <Ionicons name="checkmark" size={20} color={colors.brandDark} />
                                    )}
                                </Pressable>
                            )
                        })}
                    </ScrollView>
                </View>
            </Modal>
        </Field>
    )
}

export function SwitchField({ label, hint, value, onChange }) {
    return (
        <Pressable
            onPress={() => onChange(!value)}
            accessibilityRole="switch"
            accessibilityState={{ checked: !!value }}
            style={styles.switchRow}
        >
            <View style={styles.switchText}>
                <Text style={styles.switchLabel}>{label}</Text>
                {!!hint && <Text style={styles.switchHint}>{hint}</Text>}
            </View>
            <Switch
                value={!!value}
                onValueChange={onChange}
                trackColor={{ true: colors.brand, false: colors.line }}
                thumbColor="#FFFFFF"
            />
        </Pressable>
    )
}

export function SegmentedField({ label, hint, value, options, onChange }) {
    return (
        <Field label={label} hint={hint}>
            <View style={styles.segmented}>
                {options.map((option) => {
                    const isSelected = option.value === value
                    return (
                        <Pressable
                            key={option.value}
                            onPress={() => onChange(option.value)}
                            style={[styles.segment, isSelected && styles.segmentSelected]}
                        >
                            <Text style={[styles.segmentText, isSelected && styles.segmentTextSelected]}>
                                {option.label}
                            </Text>
                        </Pressable>
                    )
                })}
            </View>
        </Field>
    )
}

const styles = StyleSheet.create({
    field: { marginBottom: spacing.lg },
    label: { ...type.label, marginBottom: spacing.sm },
    hint: { ...type.small, marginTop: spacing.xs, fontSize: 12 },
    error: { ...type.small, marginTop: spacing.xs, fontSize: 12, color: colors.rejected },

    input: {
        backgroundColor: colors.surface,
        borderWidth: 1,
        borderColor: colors.line,
        borderRadius: radius.md,
        paddingHorizontal: spacing.lg,
        paddingVertical: spacing.md,
        minHeight: 48,
        fontSize: 15,
        color: colors.ink,
    },
    inputMultiline: { minHeight: 96, textAlignVertical: 'top' },
    inputError: { borderColor: colors.rejected },
    inputRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
    inputText: { ...type.body, flex: 1 },
    placeholder: { ...type.body, color: colors.inkFaint, flex: 1 },

    backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.35)' },
    sheet: {
        backgroundColor: colors.surface,
        borderTopLeftRadius: radius.lg,
        borderTopRightRadius: radius.lg,
        paddingBottom: spacing.xxl,
        maxHeight: '65%',
    },
    sheetHandle: {
        alignSelf: 'center',
        width: 38,
        height: 4,
        borderRadius: radius.pill,
        backgroundColor: colors.line,
        marginTop: spacing.md,
    },
    sheetTitle: { ...type.subheading, padding: spacing.lg, paddingBottom: spacing.sm },
    sheetScroll: { paddingHorizontal: spacing.sm },
    sheetEmpty: { ...type.small, padding: spacing.lg },
    option: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingVertical: spacing.md,
        paddingHorizontal: spacing.md,
        borderRadius: radius.md,
        gap: spacing.md,
    },
    optionPressed: { backgroundColor: colors.ground },
    optionText: { flex: 1 },
    optionLabel: { ...type.body },
    optionSubtitle: { ...type.small, fontSize: 12, marginTop: 1 },

    switchRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: spacing.lg,
        paddingVertical: spacing.md,
        marginBottom: spacing.sm,
    },
    switchText: { flex: 1 },
    switchLabel: { ...type.body, fontWeight: '600' },
    switchHint: { ...type.small, fontSize: 12, marginTop: 1 },

    segmented: {
        flexDirection: 'row',
        backgroundColor: colors.ground,
        borderRadius: radius.md,
        padding: 3,
        gap: 3,
    },
    segment: {
        flex: 1,
        paddingVertical: spacing.md - 2,
        borderRadius: radius.sm,
        alignItems: 'center',
    },
    segmentSelected: { backgroundColor: colors.surface },
    segmentText: { ...type.small, fontWeight: '600' },
    segmentTextSelected: { color: colors.ink },
})
