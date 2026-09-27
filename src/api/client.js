import AsyncStorage from '@react-native-async-storage/async-storage'
import axios from 'axios'
import * as Device from 'expo-device'
import qs from 'qs'

// On a real phone 127.0.0.1 is the phone, so a device build has to use the deployed
// server. A simulator shares the Mac's network stack, so there localhost reaches the
// Django running on it - which is the whole point of working locally. Device.isDevice
// is the only thing that separates the two, so it decides rather than a hand-edit.
const LOCAL_BASE_URL = 'http://127.0.0.1:8000/'
const DEV_BASE_URL = Device.isDevice ? 'https://server.oinc.farm/' : LOCAL_BASE_URL
const PROD_BASE_URL = 'https://server.oinc.farm/'

export const TOKEN_KEY = 'token'

// The server reads the token from an Authorization header and answers 460 when the
// token is stale - which happens whenever a newer login elsewhere invalidated it.
export const STALE_TOKEN_STATUS = 460
// PermissionMiddleware answers 409 when the caller's role lacks the endpoint.
export const NO_PERMISSION_STATUS = 409

let onSessionExpired = null

export function setSessionExpiredHandler(handler) {
    onSessionExpired = handler
}

export async function startAxios() {
    axios.defaults.baseURL = __DEV__ ? DEV_BASE_URL : PROD_BASE_URL
    axios.defaults.timeout = 30000

    const token = await AsyncStorage.getItem(TOKEN_KEY)
    if (token) {
        setAuthToken(token)
        return true
    }
    return false
}

export function setAuthToken(token) {
    if (token) {
        axios.defaults.headers.common.Authorization = `Token ${token}`
    } else {
        delete axios.defaults.headers.common.Authorization
    }
}

export async function saveToken(token) {
    await AsyncStorage.setItem(TOKEN_KEY, token)
    setAuthToken(token)
}

export async function clearToken() {
    await AsyncStorage.removeItem(TOKEN_KEY)
    setAuthToken(null)
}

/**
 * The Django views read request.POST, so every call goes out form-encoded rather
 * than as JSON. Keeping that in one place means no screen has to remember it.
 */
export async function post(url, data = {}) {
    const response = await axios.post(url, qs.stringify(data), {
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    })
    return response.data
}

export async function postForm(url, formData) {
    const response = await axios.post(url, formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
        timeout: 60000,
    })
    return response.data
}

/**
 * Turns an axios failure into a sentence worth showing someone.
 * The server sends {"message": "..."} on a 400, which is already written for a human.
 */
export function describeError(error, fallback = 'Something went wrong. Try again.') {
    if (!error?.response) {
        return 'No connection to the server. Check your signal and try again.'
    }

    const { status, data } = error.response

    if (status === STALE_TOKEN_STATUS) {
        if (onSessionExpired) onSessionExpired()
        return 'You were signed out. Please log in again.'
    }
    if (status === NO_PERMISSION_STATUS) {
        return 'Your account does not have access to this.'
    }
    if (status === 401 || status === 403) {
        return typeof data?.message === 'string' ? data.message : 'You do not have access to this.'
    }
    if (typeof data?.message === 'string' && data.message.length > 0) {
        return data.message
    }
    return fallback
}
