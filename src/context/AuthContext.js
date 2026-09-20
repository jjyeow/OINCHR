import React, {
    createContext, useCallback, useContext, useEffect, useMemo, useRef, useState,
} from 'react'
import { AppState } from 'react-native'

import * as authApi from '../api/auth'
import { clearToken, saveToken, setSessionExpiredHandler, startAxios } from '../api/client'

const AuthContext = createContext(null)

// Permissions are cached when the session loads, so a grant made by an administrator
// while somebody has the app open used to stay invisible until they killed it. Long
// enough that flicking to another app and straight back costs nothing, short enough
// that a permission change lands on the next real return to the app.
const REFRESH_AFTER_MS = 30 * 1000

export function AuthProvider({ children }) {
    const [isStarting, setIsStarting] = useState(true)
    const [user, setUser] = useState(null)
    const [permissionTitleList, setPermissionTitleList] = useState([])

    // Read by the foreground listener, which must not be torn down and rebuilt every
    // time the user object changes.
    const lastLoadAtRef = useRef(0)
    const isSignedInRef = useRef(false)

    const signOut = useCallback(async () => {
        try {
            await authApi.logout()
        } catch (error) {
            // Signing out locally matters more than telling the server about it.
        }
        await clearToken()
        setUser(null)
        setPermissionTitleList([])
    }, [])

    /**
     * One round trip for identity, one for permissions. Both are needed before the
     * app can decide which navigation tree to show, so they load together.
     */
    const loadSession = useCallback(async () => {
        const [userData, permissionData] = await Promise.all([
            authApi.getUser(),
            authApi.getSystemPermission(),
        ])
        setUser(userData)
        setPermissionTitleList((permissionData || []).map((permission) => permission.title))
        lastLoadAtRef.current = Date.now()
        return userData
    }, [])

    const signIn = useCallback(async ({ username, password, expoPushToken }) => {
        const result = await authApi.login({ username, password, expoPushToken })
        if (!result?.token) {
            throw new Error('The server did not return a session token.')
        }
        await saveToken(result.token)
        return loadSession()
    }, [loadSession])

    useEffect(() => { isSignedInRef.current = user !== null }, [user])

    useEffect(() => {
        const subscription = AppState.addEventListener('change', (nextState) => {
            if (nextState !== 'active') return
            if (!isSignedInRef.current) return
            if (Date.now() - lastLoadAtRef.current < REFRESH_AFTER_MS) return

            // Deliberately swallowed. A failed refresh must leave the session exactly
            // as it was - the permissions already in hand beat none, and the server
            // re-checks every request anyway, so a stale list can only hide things,
            // never grant them. A dead token is handled by the 460 handler below.
            loadSession().catch(() => {})
        })
        return () => subscription.remove()
    }, [loadSession])

    useEffect(() => {
        // A 460 anywhere in the app means the token was invalidated by a newer login.
        setSessionExpiredHandler(() => {
            clearToken()
            setUser(null)
            setPermissionTitleList([])
        })
    }, [])

    useEffect(() => {
        let isMounted = true
        const bootstrap = async () => {
            const hasToken = await startAxios()
            if (hasToken) {
                try {
                    await loadSession()
                } catch (error) {
                    // A stored token that no longer works should not trap the user on
                    // a spinner - drop it and show the login screen.
                    await clearToken()
                }
            }
            if (isMounted) setIsStarting(false)
        }
        bootstrap()
        return () => { isMounted = false }
    }, [loadSession])

    const value = useMemo(() => ({
        isStarting,
        user,
        isSignedIn: user !== null,
        permissionTitleList,
        can: (permissionTitle) => permissionTitleList.includes(permissionTitle),
        canAny: (titleList) => titleList.some((title) => permissionTitleList.includes(title)),
        signIn,
        signOut,
        refreshSession: loadSession,
    }), [isStarting, user, permissionTitleList, signIn, signOut, loadSession])

    return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth() {
    const context = useContext(AuthContext)
    if (context === null) {
        throw new Error('useAuth must be used inside an AuthProvider')
    }
    return context
}
