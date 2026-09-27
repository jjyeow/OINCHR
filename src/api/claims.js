import { post, postForm } from './client'

// Locations (Sibu, Miri...) come from the container app - the same list containers
// and inventory already use, rather than a second one to keep in step.
/**
 * Lives in the container app, and answers with a **bare array** rather than the
 * {data: [...]} envelope every hr endpoint here uses. Callers have to handle that -
 * reading .data off it silently yields undefined and an empty dropdown.
 */
export function getLocationList() {
    return post('container/getlocationlist')
}

// categories
export function getClaimTypeList({ includeInactive = false } = {}) {
    return post('hr/getclaimtypelist', { includeInactive })
}

export function saveClaimType(claimType) {
    return post('hr/saveclaimtype', claimType)
}

/**
 * Everything here is form-encoded, because the Django views read request.POST. A claim
 * is a single expense, so there is no nested array to smuggle through as JSON any more
 * - every field is a flat form value.
 */
/**
 * Submits one expense. A claim *is* the expense, so this is the whole act - there is
 * no folder to open first and nothing to add afterwards.
 */
export function submitClaim({ title, locationID, claimTypeID, amount, expenseDate, description }) {
    return post('hr/submitclaim', {
        title, locationID, claimTypeID, amount, expenseDate, description,
    })
}

/** The same thing, keyed in by HR for a receipt handed over in person. */
export function submitClaimOnBehalf({
    staffID, title, locationID, claimTypeID, amount, expenseDate, description,
}) {
    return post('hr/submitclaimonbehalf', {
        staffID, title, locationID, claimTypeID, amount, expenseDate, description,
    })
}

/**
 * Corrects a claim that has not been decided yet. Your own always; somebody else's
 * needs Submit Claim On Behalf. The server refuses either once the claim is approved,
 * rejected, paid or cancelled.
 */
export function editClaim({ claimID, title, locationID, claimTypeID, amount, expenseDate, description }) {
    return post('hr/editclaim', {
        claimID, title, locationID, claimTypeID, amount, expenseDate, description,
    })
}

// Saved periods. A period is a named set of filters - "September 2026" meaning
// 26 Aug to 25 Sep - not a container of claims, so nothing is enrolled into one and
// deleting one deletes nothing else.
export function getClaimViewList() {
    return post('hr/getclaimviewlist')
}

export function saveClaimView({
    claimViewID, title, fromDate, toDate, locationID, claimTypeID, systemRoleID,
    status, isShared,
}) {
    return post('hr/saveclaimview', {
        claimViewID, title, fromDate, toDate, locationID, claimTypeID, systemRoleID,
        status, isShared: isShared ? 'true' : 'false',
    })
}

export function removeClaimView(claimViewID) {
    return post('hr/removeclaimview', { claimViewID })
}

export function getMyClaimList(filters = {}) {
    return post('hr/getmyclaimlist', filters)
}

export function getAllClaimList(filters = {}) {
    return post('hr/getallclaimlist', filters)
}

export function getClaimDetail(claimID) {
    return post('hr/getclaimdetail', { claimID })
}

// decisions
export function approveClaim({ claimID, note }) {
    return post('hr/approveclaim', { claimID, note })
}

export function rejectClaim({ claimID, rejectionReason }) {
    return post('hr/rejectclaim', { claimID, rejectionReason })
}

/**
 * Reimbursement is per person: a shared claim like "September 2026" may owe three
 * people different amounts, settled on different days. Omitting staffID pays the
 * caller, which is what a one-person claim wants.
 */
export function markClaimPaid({ claimID, paymentReference }) {
    return post('hr/markclaimpaid', { claimID, staffID, paymentReference })
}

/**
 * Opens an empty shared claim for people to file into. The only way a claim is
 * which files your own expenses at the same time - a manager opening a folder for
 * the team has nothing of their own to put in it yet.
 */
export function cancelClaim({ claimID, note }) {
    return post('hr/cancelclaim', { claimID, note })
}

// receipts. A claim is one expense, so a receipt hangs off the claim directly - more
// than one is fine, since a receipt and the invoice behind it are the same spend.
export function uploadClaimAttachment({ claimID, asset }) {
    const formData = new FormData()
    formData.append('claimID', String(claimID))
    formData.append('image', {
        uri: asset.uri,
        name: asset.fileName || `receipt-${Date.now()}.jpg`,
        type: asset.mimeType || 'image/jpeg',
    })
    return postForm('hr/uploadclaimattachment', formData)
}

// individual expenses inside a claim
/**
 * The only way an expense reaches a claim. Pass staffID to file on somebody else's
 * behalf - the server checks Submit Claim On Behalf before allowing it, and answers
 * 403 otherwise.
 */
/**
 * Takes a receipt off a claim, and deletes the stored file with it. Same rule as
 * editing: only while the claim is still PENDING, and only your own unless you hold
 * Submit Claim On Behalf.
 */
export function removeClaimAttachment(attachmentID) {
    return post('hr/removeclaimattachment', { attachmentID })
}

export function getClaimAttachmentUrl(attachmentID) {
    return post('hr/getclaimattachmenturl', { attachmentID })
}
