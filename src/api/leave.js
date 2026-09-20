import { post, postForm } from './client'

// reference data
// includeInactive is for the setup screens only - the apply form must never offer a
// retired leave type.
export function getLeaveTypeList({ includeInactive = false } = {}) {
    return post('hr/getleavetypelist', { includeInactive })
}

export function saveLeaveType(leaveType) {
    return post('hr/saveleavetype', leaveType)
}

export function getPublicHolidayList({ year, includeInactive = false } = {}) {
    return post('hr/getpublicholidaylist', { year, includeInactive })
}

export function savePublicHoliday(holiday) {
    return post('hr/savepublicholiday', holiday)
}

export function calculateLeaveDays({ startDate, endDate, dayPortion = 'FULL' }) {
    return post('hr/calculateleavedays', { startDate, endDate, dayPortion })
}

// balances
export function getMyLeaveBalance(year) {
    return post('hr/getmyleavebalance', { year })
}

export function getStaffLeaveBalance({ staffID, year }) {
    return post('hr/getstaffleavebalance', { staffID, year })
}

export function setLeaveEntitlement({ staffID, leaveTypeID, year, entitledDays, carriedForwardDays }) {
    return post('hr/setleaveentitlement', {
        staffID, leaveTypeID, year, entitledDays, carriedForwardDays,
    })
}

// applying
export function applyLeave({ leaveTypeID, startDate, endDate, dayPortion = 'FULL', reason }) {
    return post('hr/applyleave', { leaveTypeID, startDate, endDate, dayPortion, reason })
}

export function applyLeaveOnBehalf({ staffID, leaveTypeID, startDate, endDate, dayPortion = 'FULL', reason }) {
    return post('hr/applyleaveonbehalf', {
        staffID, leaveTypeID, startDate, endDate, dayPortion, reason,
    })
}

export function cancelLeaveRequest({ leaveRequestID, note }) {
    return post('hr/cancelleaverequest', { leaveRequestID, note })
}

// listing
export function getMyLeaveRequestList(filters = {}) {
    return post('hr/getmyleaverequestlist', filters)
}

export function getAllLeaveRequestList(filters = {}) {
    return post('hr/getallleaverequestlist', filters)
}

export function getLeaveRequestDetail(leaveRequestID) {
    return post('hr/getleaverequestdetail', { leaveRequestID })
}

export function getPendingApprovalCount() {
    return post('hr/getpendingapprovalcount')
}

export function getTeamCalendar({ fromDate, toDate, department }) {
    return post('hr/getteamcalendar', { fromDate, toDate, department })
}

// approving
export function approveLeaveRequest({ leaveRequestID, note }) {
    return post('hr/approveleaverequest', { leaveRequestID, note })
}

export function rejectLeaveRequest({ leaveRequestID, rejectionReason }) {
    return post('hr/rejectleaverequest', { leaveRequestID, rejectionReason })
}

// attachments
export function uploadLeaveAttachment({ leaveRequestID, asset }) {
    const formData = new FormData()
    formData.append('leaveRequestID', String(leaveRequestID))
    formData.append('image', {
        uri: asset.uri,
        name: asset.fileName || `attachment-${Date.now()}.jpg`,
        type: asset.mimeType || 'image/jpeg',
    })
    return postForm('hr/uploadleaveattachment', formData)
}

// Attachments are private, so the URL is minted on demand and expires in 5 minutes.
export function getLeaveAttachmentUrl(attachmentID) {
    return post('hr/getleaveattachmenturl', { attachmentID })
}

// staff
export function getStaffList(filters = {}) {
    return post('hr/getstafflist', filters)
}
