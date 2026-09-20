import { post } from './client'

/**
 * Every permission in the system, grouped by area, with a `held` flag per permission
 * for the staff member asked about. One round trip gives the screen everything.
 */
export function getUserPermissionMatrix(staffID) {
    return post('membership/getuserpermissionmatrix', { staffID })
}

/** Replaces the user's permissions with exactly this list. */
export function saveUserPermission({ staffID, permissionIDList }) {
    return post('membership/saveuserpermission', {
        staffID,
        permissionIDList: permissionIDList.join(','),
    })
}

/**
 * Copies a role's permissions onto a user. A one-time copy, not a live link -
 * editing the role afterwards does not change anyone already seeded from it.
 */
export function applyRoleTemplate({ staffID, roleID, replace = true }) {
    return post('membership/applyroletemplate', { staffID, roleID, replace })
}

/**
 * Container permissions for one person in one container.
 *
 * Note `targetContainerID`, not `containerID`: the server middleware switches to
 * container-scoped checking the moment it sees a `containerID`, which would mean
 * only a member of a container could administer it. Renaming the parameter is what
 * keeps this a system-level screen.
 *
 * Called with no container to fill the picker - the reply carries `containerList`
 * either way, and an empty `groupList` until a container is chosen.
 */
export function getContainerPermissionMatrix(staffID, targetContainerID = null) {
    return post('container/getcontainerpermissionmatrix', targetContainerID
        ? { staffID, targetContainerID }
        : { staffID })
}

/** Replaces what this person may do in this one container. */
export function saveContainerPermission({ staffID, targetContainerID, permissionIDList }) {
    return post('container/savecontainerpermission', {
        staffID,
        targetContainerID,
        permissionIDList: permissionIDList.join(','),
    })
}

/** Copies a container role's permissions onto this person's membership. */
export function applyContainerRoleTemplate({ staffID, targetContainerID, roleID, replace = true }) {
    return post('container/applycontainerroletemplate', {
        staffID, targetContainerID, roleID, replace,
    })
}

/**
 * Puts someone into a container. System-scoped, unlike OINCRN's addcontaineruser,
 * which takes a containerID and therefore only works for containers the caller is
 * already a member of.
 */
export function addContainerMembership({ staffID, targetContainerID, roleID }) {
    return post('container/addcontainermembership', { staffID, targetContainerID, roleID })
}
