import React, { useCallback, useEffect, useMemo, useState } from 'react'
import {
    Alert, Pressable, ScrollView, StyleSheet, Switch, Text, View,
} from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { Ionicons } from '@expo/vector-icons'
import Toast from 'react-native-toast-message'

import { useAuth } from '../context/AuthContext'
import { PERMISSION } from '../permissions'
import * as permissionApi from '../api/permissions'
import * as leaveApi from '../api/leave'
import { describeError } from '../api/client'
import { SelectField } from '../components/fields'
import {
    Card, EmptyState, ErrorBanner, LoadingView, PrimaryButton, SectionLabel,
} from '../components/ui'
import { colors, radius, spacing, type } from '../theme'

const SYSTEM_SCOPE = 'system'
const CONTAINER_SCOPE = 'container'

/**
 * Permissions are held per person, so this is where they are set. Roles appear only
 * as templates to seed from - applying one is a copy, and the person can be adjusted
 * freely afterwards without affecting anyone else on the same role.
 *
 * Two scopes share this screen because they answer one question. System permissions
 * are held per user; container permissions are held per membership and are the union
 * of every membership that person has in the container. Both endpoints return the
 * same {groupList, roleList, totalCount} shape, so everything below the picker is
 * common to both.
 */
export default function UserPermissionScreen({ navigation }) {
    const { user, can, refreshSession } = useAuth()

    const canAddMember = can(PERMISSION.ADD_CONTAINER_MEMBER)
    const canSeeSystemScope = can(PERMISSION.VIEW_USER_PERMISSIONS)
        || can(PERMISSION.MANAGE_USER_PERMISSIONS)
    const canSeeContainerScope = can(PERMISSION.VIEW_CONTAINER_PERMISSIONS)
        || can(PERMISSION.MANAGE_CONTAINER_PERMISSIONS)

    // Someone granted only container administration must not open onto the system
    // tab, which would 409 on the first request.
    const [scope, setScope] = useState(
        canSeeSystemScope ? SYSTEM_SCOPE : CONTAINER_SCOPE)
    const isContainerScope = scope === CONTAINER_SCOPE
    const canEdit = isContainerScope
        ? can(PERMISSION.MANAGE_CONTAINER_PERMISSIONS)
        : can(PERMISSION.MANAGE_USER_PERMISSIONS)

    const [staffList, setStaffList] = useState([])
    const [staffID, setStaffID] = useState(null)
    const [containerList, setContainerList] = useState([])
    const [containerID, setContainerID] = useState(null)
    const [matrix, setMatrix] = useState(null)
    const [addRoleID, setAddRoleID] = useState(null)
    const [heldIDSet, setHeldIDSet] = useState(new Set())
    const [collapsedSet, setCollapsedSet] = useState(new Set())

    const [isLoadingStaff, setIsLoadingStaff] = useState(true)
    const [isLoadingMatrix, setIsLoadingMatrix] = useState(false)
    const [isSaving, setIsSaving] = useState(false)
    const [errorMessage, setErrorMessage] = useState('')

    useEffect(() => {
        leaveApi.getStaffList()
            .then((result) => setStaffList(result.data || []))
            .catch((error) => setErrorMessage(describeError(error, 'Could not load staff.')))
            .finally(() => setIsLoadingStaff(false))
    }, [])

    const loadMatrix = useCallback(async (targetID, currentScope, currentContainerID) => {
        if (!targetID) return
        setIsLoadingMatrix(true)
        setErrorMessage('')
        try {
            const result = currentScope === CONTAINER_SCOPE
                ? await permissionApi.getContainerPermissionMatrix(targetID, currentContainerID)
                : await permissionApi.getUserPermissionMatrix(targetID)
            setMatrix(result)
            if (result.containerList) setContainerList(result.containerList)
            const held = new Set()
            ;(result.groupList || []).forEach((group) => {
                group.permissionList.forEach((permission) => {
                    if (permission.held) held.add(permission.id)
                })
            })
            setHeldIDSet(held)
        } catch (error) {
            setErrorMessage(describeError(error, 'Could not load permissions.'))
            setMatrix(null)
        }
        setIsLoadingMatrix(false)
    }, [])

    useEffect(() => {
        loadMatrix(staffID, scope, containerID)
        // A role chosen for one person and container must not carry over to the next.
        setAddRoleID(null)
    }, [staffID, scope, containerID, loadMatrix])

    const originalIDSet = useMemo(() => {
        const original = new Set()
        ;(matrix?.groupList || []).forEach((group) => {
            group.permissionList.forEach((permission) => {
                if (permission.held) original.add(permission.id)
            })
        })
        return original
    }, [matrix])

    const hasChanges = useMemo(() => {
        if (heldIDSet.size !== originalIDSet.size) return true
        for (const id of heldIDSet) {
            if (!originalIDSet.has(id)) return true
        }
        return false
    }, [heldIDSet, originalIDSet])

    const toggle = (permissionID) => {
        setHeldIDSet((previous) => {
            const next = new Set(previous)
            if (next.has(permissionID)) next.delete(permissionID)
            else next.add(permissionID)
            return next
        })
    }

    const toggleGroup = (group, turnOn) => {
        setHeldIDSet((previous) => {
            const next = new Set(previous)
            group.permissionList.forEach((permission) => {
                if (turnOn) next.add(permission.id)
                else next.delete(permission.id)
            })
            return next
        })
    }

    const onSave = async () => {
        setIsSaving(true)
        try {
            if (isContainerScope) {
                await permissionApi.saveContainerPermission({
                    staffID,
                    targetContainerID: containerID,
                    permissionIDList: Array.from(heldIDSet),
                })
            } else {
                await permissionApi.saveUserPermission({
                    staffID,
                    permissionIDList: Array.from(heldIDSet),
                })
            }
            Toast.show({
                type: 'success',
                text1: 'Permissions saved',
                text2: `${matrix?.staff?.name} now has ${heldIDSet.size} permission(s)`
                    + (isContainerScope ? ` in ${matrix?.container?.title}.` : '.'),
            })
            // Changing your own access has to take effect immediately, not next login.
            if (String(staffID) === String(user?.id)) await refreshSession()
            await loadMatrix(staffID, scope, containerID)
        } catch (error) {
            Toast.show({
                type: 'error',
                text1: 'Could not save',
                text2: describeError(error),
            })
        }
        setIsSaving(false)
    }

    const onAddToContainer = async () => {
        setIsSaving(true)
        try {
            const result = await permissionApi.addContainerMembership({
                staffID, targetContainerID: containerID, roleID: addRoleID,
            })
            Toast.show({ type: 'success', text1: 'Added to container', text2: result.message })
            setAddRoleID(null)
            if (String(staffID) === String(user?.id)) await refreshSession()
            await loadMatrix(staffID, scope, containerID)
        } catch (error) {
            Toast.show({
                type: 'error', text1: 'Could not add', text2: describeError(error),
            })
        }
        setIsSaving(false)
    }

    const onApplyTemplate = (role) => {
        Alert.alert(
            `Apply the ${role.title} template?`,
            `This replaces ${matrix?.staff?.name}'s permissions`
            + (isContainerScope ? ` in ${matrix?.container?.title}` : '')
            + ` with the ${role.permissionCount} from ${role.title}. It is a one-time `
            + 'copy — editing the role later will not change them again.',
            [
                { text: 'Cancel', style: 'cancel' },
                {
                    text: 'Apply',
                    onPress: async () => {
                        setIsSaving(true)
                        try {
                            if (isContainerScope) {
                                await permissionApi.applyContainerRoleTemplate({
                                    staffID, targetContainerID: containerID, roleID: role.id,
                                })
                            } else {
                                await permissionApi.applyRoleTemplate({ staffID, roleID: role.id })
                            }
                            Toast.show({ type: 'success', text1: `${role.title} template applied` })
                            if (String(staffID) === String(user?.id)) await refreshSession()
                            await loadMatrix(staffID, scope, containerID)
                        } catch (error) {
                            Toast.show({
                                type: 'error',
                                text1: 'Could not apply',
                                text2: describeError(error),
                            })
                        }
                        setIsSaving(false)
                    },
                },
            ],
        )
    }

    // Saving to a container the person is not a member of is refused by the server,
    // so the screen says why rather than letting an edit be composed and bounced.
    const isMemberHere = !isContainerScope || matrix?.isMember !== false
    const canEditNow = canEdit && isMemberHere
    const isInheriting = isContainerScope
        ? (matrix?.membershipList || []).some((m) => !m.usesDirectPermissions)
        : matrix && !matrix.usesDirectPermissions

    if (isLoadingStaff) return <LoadingView message="Loading staff" />

    return (
        <SafeAreaView style={styles.safe} edges={['bottom']}>
            <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
                <ErrorBanner message={errorMessage} />

                <SelectField
                    label="Staff member"
                    placeholder="Whose permissions?"
                    value={staffID}
                    onChange={setStaffID}
                    options={staffList.map((staff) => ({
                        value: staff.id,
                        label: staff.name,
                        subtitle: [staff.position, staff.department].filter(Boolean).join(' - '),
                    }))}
                />

                {canSeeSystemScope && canSeeContainerScope && (
                    <View style={styles.scopeRow}>
                        {[
                            { key: SYSTEM_SCOPE, label: 'Everywhere', icon: 'key-outline' },
                            { key: CONTAINER_SCOPE, label: 'Per container', icon: 'cube-outline' },
                        ].map((tab) => {
                            const isActive = scope === tab.key
                            return (
                                <Pressable
                                    key={tab.key}
                                    onPress={() => setScope(tab.key)}
                                    style={[styles.scopeTab, isActive && styles.scopeTabActive]}
                                >
                                    <Ionicons
                                        name={tab.icon}
                                        size={15}
                                        color={isActive ? colors.brandDark : colors.inkMuted}
                                    />
                                    <Text style={[
                                        styles.scopeLabel, isActive && styles.scopeLabelActive,
                                    ]}>
                                        {tab.label}
                                    </Text>
                                </Pressable>
                            )
                        })}
                    </View>
                )}

                {!!staffID && (
                    <View style={styles.ruleNote}>
                        <Ionicons name="information-circle-outline" size={15}
                                  color={colors.inkMuted} />
                        <Text style={styles.ruleText}>
                            {isContainerScope
                                ? 'Membership decides which containers someone can reach. '
                                  + 'A permission set under Everywhere does not open a '
                                  + 'container they are not a member of.'
                                : 'Set here, these apply wherever the person works. What they '
                                  + 'may do inside one particular container is set under '
                                  + 'Per container.'}
                        </Text>
                    </View>
                )}

                {isContainerScope && !!staffID && (
                    <SelectField
                        label="Container"
                        placeholder="Which container?"
                        value={containerID}
                        onChange={setContainerID}
                        options={containerList.map((container) => ({
                            value: container.id,
                            label: container.title,
                            subtitle: [
                                container.status,
                                container.test ? 'test' : null,
                            ].filter(Boolean).join(' - '),
                        }))}
                    />
                )}

                {!staffID && (
                    <EmptyState
                        icon="key-outline"
                        title="Pick someone to begin"
                        message={isContainerScope
                            ? 'Container permissions are set per person, per container.'
                            : 'Permissions are set per person, so two Operators can have different access.'}
                    />
                )}

                {!!staffID && isContainerScope && !containerID && !isLoadingMatrix && (
                    <EmptyState
                        icon="cube-outline"
                        title="Pick a container"
                        message="Access is granted one container at a time, so somebody can run Sibu without touching Miri."
                    />
                )}

                {isLoadingMatrix && <LoadingView message="Loading permissions" />}

                {!!matrix && !isLoadingMatrix && (!isContainerScope || !!containerID) && (
                    <>
                        <Card style={styles.summaryCard}>
                            <View style={styles.summaryRow}>
                                <View style={styles.flex}>
                                    <Text style={styles.summaryName}>{matrix.staff?.name}</Text>
                                    <Text style={styles.summaryRole}>
                                        {isContainerScope
                                            ? (matrix.isMember
                                                ? `${matrix.container?.title} - `
                                                  + (matrix.membershipList || [])
                                                      .map((m) => m.roleTitle || 'no role')
                                                      .join(', ')
                                                : `Not a member of ${matrix.container?.title}`)
                                            : `Role: ${matrix.staff?.systemRole?.title || 'none'}`}
                                    </Text>
                                </View>
                                <View style={styles.countBox}>
                                    <Text style={styles.countValue}>{heldIDSet.size}</Text>
                                    <Text style={styles.countCaption}>
                                        of {matrix.totalCount}
                                    </Text>
                                </View>
                            </View>
                            {!!isInheriting && (
                                <View style={styles.inheritNote}>
                                    <Ionicons name="information-circle-outline" size={16}
                                              color={colors.pending} />
                                    <Text style={styles.inheritText}>
                                        Still inheriting from the role. Saving here switches
                                        them onto their own permissions.
                                    </Text>
                                </View>
                            )}

                            {isContainerScope && !matrix.isMember && (
                                <View style={styles.addBlock}>
                                    <View style={styles.inheritNote}>
                                        <Ionicons name="alert-circle-outline" size={16}
                                                  color={colors.pending} />
                                        <Text style={styles.inheritText}>
                                            Not in this container yet. Permissions here belong to
                                            a membership, so there is nothing to hold them.
                                        </Text>
                                    </View>

                                    {canAddMember ? (
                                        <>
                                            <SelectField
                                                label="Start them as"
                                                placeholder="Pick a role to copy from"
                                                value={addRoleID}
                                                onChange={setAddRoleID}
                                                options={(matrix.roleList || []).map((role) => ({
                                                    value: role.id,
                                                    label: role.title,
                                                    subtitle: `${role.permissionCount} permission(s)`,
                                                }))}
                                            />
                                            <PrimaryButton
                                                title={`Add to ${matrix.container?.title}`}
                                                onPress={onAddToContainer}
                                                loading={isSaving}
                                                disabled={!addRoleID}
                                            />
                                            <Text style={styles.templateHint}>
                                                The role is copied as a starting point. You can
                                                adjust them individually straight afterwards.
                                            </Text>
                                        </>
                                    ) : (
                                        <Text style={styles.templateHint}>
                                            Ask an administrator to add them, or do it in OINCOps.
                                        </Text>
                                    )}
                                </View>
                            )}

                            {isContainerScope && (matrix.membershipList || []).length > 1 && (
                                <View style={styles.inheritNote}>
                                    <Ionicons name="information-circle-outline" size={16}
                                              color={colors.pending} />
                                    <Text style={styles.inheritText}>
                                        {matrix.membershipList.length} memberships here. What they
                                        may do is the union of all of them, and saving stores it
                                        against the first.
                                    </Text>
                                </View>
                            )}
                        </Card>

                        {canEditNow && (matrix.roleList || []).length > 0 && (
                            <>
                                <SectionLabel style={styles.sectionSpacing}>
                                    Start from a template
                                </SectionLabel>
                                <View style={styles.templateRow}>
                                    {matrix.roleList.map((role) => (
                                        <Pressable
                                            key={role.id}
                                            onPress={() => onApplyTemplate(role)}
                                            disabled={isSaving}
                                            style={({ pressed }) => [
                                                styles.templateChip, pressed && styles.pressed,
                                            ]}
                                        >
                                            <Text style={styles.templateTitle}>{role.title}</Text>
                                            <Text style={styles.templateCount}>
                                                {role.permissionCount}
                                            </Text>
                                        </Pressable>
                                    ))}
                                </View>
                                <Text style={styles.templateHint}>
                                    Applying a template replaces this person's permissions. It is a
                                    copy, so changing the role later will not change them again.
                                </Text>
                            </>
                        )}

                        {(matrix.groupList || []).map((group) => {
                            const grantedCount = group.permissionList
                                .filter((permission) => heldIDSet.has(permission.id)).length
                            const isCollapsed = collapsedSet.has(group.label)
                            const allOn = grantedCount === group.permissionList.length

                            return (
                                <View key={group.label} style={styles.group}>
                                    <Pressable
                                        onPress={() => setCollapsedSet((previous) => {
                                            const next = new Set(previous)
                                            if (next.has(group.label)) next.delete(group.label)
                                            else next.add(group.label)
                                            return next
                                        })}
                                        style={styles.groupHeader}
                                    >
                                        <Ionicons
                                            name={isCollapsed ? 'chevron-forward' : 'chevron-down'}
                                            size={18}
                                            color={colors.inkMuted}
                                        />
                                        <Text style={styles.groupTitle}>{group.label}</Text>
                                        <Text style={styles.groupCount}>
                                            {grantedCount}/{group.permissionList.length}
                                        </Text>
                                        {canEditNow && (
                                            <Pressable
                                                onPress={() => toggleGroup(group, !allOn)}
                                                hitSlop={8}
                                            >
                                                <Text style={styles.groupToggle}>
                                                    {allOn ? 'None' : 'All'}
                                                </Text>
                                            </Pressable>
                                        )}
                                    </Pressable>

                                    {!isCollapsed && (
                                        <Card style={styles.groupCard}>
                                            {group.permissionList.map((permission, index) => (
                                                <View
                                                    key={permission.id}
                                                    style={[
                                                        styles.permissionRow,
                                                        index > 0 && styles.permissionDivided,
                                                    ]}
                                                >
                                                    <View style={styles.flex}>
                                                        <Text style={styles.permissionTitle}>
                                                            {permission.title}
                                                        </Text>
                                                        <Text style={styles.permissionUrl}>
                                                            {permission.url}
                                                        </Text>
                                                        {(permission.alsoPerContainer
                                                          || permission.alsoSystemWide) && (
                                                            <Text style={styles.dualBadge}>
                                                                {permission.alsoPerContainer
                                                                    ? 'Also set per container — '
                                                                      + 'the container answer wins '
                                                                      + 'inside a container'
                                                                    : 'Also set under Everywhere — '
                                                                      + 'this answer wins inside '
                                                                      + 'this container'}
                                                            </Text>
                                                        )}
                                                    </View>
                                                    <Switch
                                                        value={heldIDSet.has(permission.id)}
                                                        onValueChange={() => toggle(permission.id)}
                                                        disabled={!canEditNow || isSaving}
                                                        trackColor={{
                                                            true: colors.brand, false: colors.line,
                                                        }}
                                                        thumbColor="#FFFFFF"
                                                    />
                                                </View>
                                            ))}
                                        </Card>
                                    )}
                                </View>
                            )
                        })}

                        {canEditNow && (
                            <PrimaryButton
                                title={hasChanges
                                    ? `Save ${heldIDSet.size} permission(s)`
                                    : 'No changes to save'}
                                onPress={onSave}
                                loading={isSaving}
                                disabled={!hasChanges}
                                style={styles.saveButton}
                            />
                        )}

                        {!canEditNow && (
                            <Text style={styles.readOnlyNote}>
                                {canEdit
                                    ? 'Add them to this container before setting permissions.'
                                    : 'You can see permissions but not change them.'}
                            </Text>
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
    pressed: { opacity: 0.7 },
    sectionSpacing: { marginTop: spacing.lg },

    scopeRow: {
        flexDirection: 'row',
        gap: spacing.xs,
        backgroundColor: colors.line,
        borderRadius: radius.pill,
        padding: 3,
        marginBottom: spacing.md,
    },
    scopeTab: {
        flex: 1,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: spacing.xs,
        paddingVertical: spacing.sm,
        borderRadius: radius.pill,
    },
    scopeTabActive: { backgroundColor: colors.surface },
    scopeLabel: { ...type.small, fontWeight: '600', color: colors.inkMuted },
    scopeLabelActive: { color: colors.brandDark, fontWeight: '700' },

    ruleNote: {
        flexDirection: 'row',
        alignItems: 'flex-start',
        gap: spacing.sm,
        marginBottom: spacing.md,
        paddingHorizontal: spacing.xs,
    },
    ruleText: { ...type.small, fontSize: 12, color: colors.inkMuted, flex: 1 },
    dualBadge: { ...type.small, fontSize: 10, color: colors.pending, marginTop: 2 },

    addBlock: { gap: spacing.sm, marginTop: spacing.md },

    summaryCard: { marginBottom: spacing.lg },
    summaryRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
    summaryName: { ...type.heading },
    summaryRole: { ...type.small, marginTop: 1 },
    countBox: { alignItems: 'flex-end' },
    countValue: { fontSize: 28, fontWeight: '800', color: colors.ink },
    countCaption: { ...type.small, fontSize: 11 },
    inheritNote: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: spacing.sm,
        marginTop: spacing.md,
        padding: spacing.md,
        backgroundColor: colors.pendingSoft,
        borderRadius: radius.md,
    },
    inheritText: { ...type.small, fontSize: 12, color: colors.pending, flex: 1 },

    templateRow: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
    templateChip: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: spacing.sm,
        backgroundColor: colors.surface,
        borderWidth: 1,
        borderColor: colors.line,
        borderRadius: radius.pill,
        paddingHorizontal: spacing.lg,
        paddingVertical: spacing.sm,
    },
    templateTitle: { ...type.small, fontWeight: '700', color: colors.ink },
    templateCount: { ...type.small, fontSize: 11, color: colors.inkFaint },
    templateHint: { ...type.small, fontSize: 12, marginTop: spacing.sm },

    group: { marginTop: spacing.xl },
    groupHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: spacing.sm,
        marginBottom: spacing.sm,
    },
    groupTitle: { ...type.subheading, flex: 1 },
    groupCount: { ...type.small, fontSize: 12, fontVariant: ['tabular-nums'] },
    groupToggle: { ...type.small, fontWeight: '700', color: colors.brandDark },
    groupCard: { paddingVertical: spacing.xs },

    permissionRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: spacing.md,
        paddingVertical: spacing.md,
    },
    permissionDivided: { borderTopWidth: 1, borderTopColor: colors.line },
    permissionTitle: { ...type.body, fontSize: 14, fontWeight: '600' },
    permissionUrl: { ...type.small, fontSize: 11, color: colors.inkFaint, marginTop: 1 },

    saveButton: { marginTop: spacing.xl },
    readOnlyNote: { ...type.small, textAlign: 'center', marginTop: spacing.xl },
})
