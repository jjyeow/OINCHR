import React from 'react'
import { Alert, Image, Pressable, StyleSheet, Text, View } from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import * as ImagePicker from 'expo-image-picker'

import { colors, radius, spacing, type } from '../theme'

/**
 * Offers the camera first, because the common case is a receipt or MC in hand rather
 * than one already in the photo roll. Returns [] when the person backs out or denies
 * permission - never throws, so a refused camera cannot block a submission.
 */
export async function pickAttachment() {
    return new Promise((resolve) => {
        Alert.alert('Add a photo', undefined, [
            {
                text: 'Take a photo',
                onPress: async () => resolve(await launchCamera()),
            },
            {
                text: 'Choose from library',
                onPress: async () => resolve(await launchLibrary()),
            },
            { text: 'Cancel', style: 'cancel', onPress: () => resolve([]) },
        ])
    })
}

async function launchCamera() {
    const permission = await ImagePicker.requestCameraPermissionsAsync()
    if (!permission.granted) {
        Alert.alert('Camera access needed',
            'Allow camera access so you can photograph a document.')
        return []
    }
    const result = await ImagePicker.launchCameraAsync({ quality: 0.7 })
    return result.canceled ? [] : (result.assets || [])
}

async function launchLibrary() {
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync()
    if (!permission.granted) {
        Alert.alert('Photo access needed',
            'Allow photo access so you can attach an existing document.')
        return []
    }
    const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ['images'],
        quality: 0.7,
        allowsMultipleSelection: true,
        selectionLimit: 5,
    })
    return result.canceled ? [] : (result.assets || [])
}

/**
 * Thumbnails of what will be uploaded once the record is created. The upload cannot
 * happen before then - the server needs an id to attach to - so this holds them.
 */
export function AttachmentStrip({ assetList, onAdd, onRemove, label, hint, required }) {
    return (
        <View style={styles.wrap}>
            <Text style={styles.label}>{label}</Text>
            {!!hint && (
                <Text style={[styles.hint, required && assetList.length === 0 && styles.hintRequired]}>
                    {hint}
                </Text>
            )}

            <View style={styles.grid}>
                {assetList.map((asset, index) => (
                    <View key={`${asset.uri}-${index}`} style={styles.thumbWrap}>
                        <Image source={{ uri: asset.uri }} style={styles.thumb} />
                        <Pressable
                            onPress={() => onRemove(index)}
                            hitSlop={8}
                            style={styles.remove}
                            accessibilityLabel={`Remove photo ${index + 1}`}
                        >
                            <Ionicons name="close-circle" size={22} color={colors.ink} />
                        </Pressable>
                    </View>
                ))}

                <Pressable
                    onPress={onAdd}
                    style={({ pressed }) => [styles.addTile, pressed && styles.pressed]}
                    accessibilityLabel="Add a photo"
                >
                    <Ionicons name="camera-outline" size={22} color={colors.brandDark} />
                    <Text style={styles.addText}>Add</Text>
                </Pressable>
            </View>
        </View>
    )
}

const THUMB_SIZE = 84

const styles = StyleSheet.create({
    wrap: { marginBottom: spacing.lg },
    label: { ...type.label, marginBottom: spacing.sm },
    hint: { ...type.small, fontSize: 12, marginBottom: spacing.md },
    hintRequired: { color: colors.pending },

    grid: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
    thumbWrap: { width: THUMB_SIZE, height: THUMB_SIZE },
    thumb: {
        width: THUMB_SIZE,
        height: THUMB_SIZE,
        borderRadius: radius.md,
        backgroundColor: colors.surfaceAlt || colors.ground,
    },
    remove: {
        position: 'absolute',
        top: -6,
        right: -6,
        backgroundColor: colors.surface,
        borderRadius: radius.pill,
    },

    addTile: {
        width: THUMB_SIZE,
        height: THUMB_SIZE,
        borderRadius: radius.md,
        borderWidth: 1,
        borderStyle: 'dashed',
        borderColor: colors.brand,
        backgroundColor: colors.brandSoft,
        alignItems: 'center',
        justifyContent: 'center',
        gap: 2,
    },
    addText: { fontSize: 11, fontWeight: '700', color: colors.brandDark },
    pressed: { opacity: 0.7 },
})
