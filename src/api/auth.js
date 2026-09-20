import { post } from './client'

export function login({ username, password, expoPushToken = '' }) {
    // membership/login expects expoPushToken on every call, even an empty one.
    return post('membership/login', { username, password, expoPushToken })
}

export function logout() {
    return post('membership/logout')
}

export function getUser() {
    return post('membership/getuser')
}

/**
 * Returns [{ id, title }] - the frontend-related permissions held by the caller's
 * role. Navigation is built from these titles, so they are the contract between
 * hr/permissions.py on the server and PERMISSION in this app.
 */
export function getSystemPermission() {
    return post('membership/getsystempermission')
}

export function changePassword({ oldPassword, newPassword }) {
    return post('membership/changepassword', { oldPassword, newPassword })
}

export function resetPasswordRequest(email) {
    return post('membership/resetpasswordrequest', { email })
}
