import { post, postForm } from './client'

// Locations (Sibu, Miri...) come from the container app - the same list containers
// and inventory already use, rather than a second one to keep in step.
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
 * itemList is a JSON string inside a form-encoded body. The rest of the API is
 * form-encoded because the Django views read request.POST, and nested arrays do not
 * survive that, so the lines travel as JSON and the server parses them back.
 */
export function submitClaim({ title, locationID, itemList }) {
    return post('hr/submitclaim', {
        title,
        locationID,
        itemList: JSON.stringify(itemList),
    })
}

export function submitClaimOnBehalf({ staffID, title, locationID, itemList }) {
    return post('hr/submitclaimonbehalf', {
        staffID,
        title,
        locationID,
        itemList: JSON.stringify(itemList),
    })
}

// listing
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
export function markClaimPaid({ claimID, staffID, paymentReference }) {
    return post('hr/markclaimpaid', { claimID, staffID, paymentReference })
}

/**
 * Opens an empty shared claim for people to file into. Separate from submitClaim,
 * which files your own expenses at the same time - a manager opening a folder for
 * the team has nothing of their own to put in it yet.
 */
export function createClaim({ title, locationID }) {
    return post('hr/createclaim', { title, locationID })
}

export function cancelClaim({ claimID, note }) {
    return post('hr/cancelclaim', { claimID, note })
}

// receipts
// Pass claimItemID to attach the receipt to one expense; leave it out and the
// receipt covers the whole claim.
export function uploadClaimAttachment({ claimID, claimItemID, asset }) {
    const formData = new FormData()
    formData.append('claimID', String(claimID))
    if (claimItemID) formData.append('claimItemID', String(claimItemID))
    formData.append('image', {
        uri: asset.uri,
        name: asset.fileName || `receipt-${Date.now()}.jpg`,
        type: asset.mimeType || 'image/jpeg',
    })
    return postForm('hr/uploadclaimattachment', formData)
}

// individual expenses inside a claim
export function addClaimItem({ claimID, claimTypeID, title, amount, expenseDate, description }) {
    return post('hr/addclaimitem', {
        claimID, claimTypeID, title, amount, expenseDate, description,
    })
}

export function removeClaimItem(claimItemID) {
    return post('hr/removeclaimitem', { claimItemID })
}

export function approveClaimItem({ claimItemID, note }) {
    return post('hr/approveclaimitem', { claimItemID, note })
}

export function rejectClaimItem({ claimItemID, rejectionReason }) {
    return post('hr/rejectclaimitem', { claimItemID, rejectionReason })
}

export function getClaimAttachmentUrl(attachmentID) {
    return post('hr/getclaimattachmenturl', { attachmentID })
}
