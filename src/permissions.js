/**
 * Permission titles, mirroring hr/permissions.py on the server.
 *
 * membership/getsystempermission returns [{ id, title }] for the caller's role -
 * titles only, no urls - so the title string is the contract between the two
 * codebases. Change one, change the other.
 *
 * Only permissions marked frontendRelated on the server come back here, which is
 * why this list is shorter than the server's.
 */
export const PERMISSION = {
    APPLY_LEAVE: 'Apply Leave',

    // HR
    VIEW_ALL_LEAVE: 'View All Leave Requests',
    SUBMIT_ON_BEHALF: 'Submit Leave On Behalf',
    SET_ENTITLEMENT: 'Set Leave Entitlement',
    MANAGE_EMPLOYEE: 'Manage Employee Profile',
    MANAGE_LEAVE_TYPE: 'Manage Leave Types',
    MANAGE_HOLIDAY: 'Manage Public Holidays',
    VIEW_TEAM_CALENDAR: 'View Team Calendar',

    // Director
    APPROVE_LEAVE: 'Approve Leave Request',

    // Access control
    VIEW_USER_PERMISSIONS: 'View User Permissions',
    MANAGE_USER_PERMISSIONS: 'Manage User Permissions',
    VIEW_CONTAINER_PERMISSIONS: 'View Container Permissions',
    MANAGE_CONTAINER_PERMISSIONS: 'Manage Container Permissions',
    ADD_CONTAINER_MEMBER: 'Add Container Member',

    // Claims. A claim is one expense, so submitting one is the whole act - there is
    // no folder to open and no line to add afterwards.
    SUBMIT_CLAIM: 'Submit Claim',
    EDIT_CLAIM: 'Edit Claim',
    VIEW_ALL_CLAIMS: 'View All Claims',
    SUBMIT_CLAIM_ON_BEHALF: 'Submit Claim On Behalf',
    VIEW_CLAIM_PERIODS: 'View Claim Periods',
    MARK_CLAIM_PAID: 'Mark Claim Paid',
    MANAGE_CLAIM_TYPE: 'Manage Claim Categories',
    APPROVE_CLAIM: 'Approve Claim',
}
