import React from 'react'
import { Alert, Image, Pressable, StyleSheet, Text, View } from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import * as ImagePicker from 'expo-image-picker'
import * as DocumentPicker from 'expo-document-picker'

import { colors, radius, spacing, type } from '../theme'

/** What the server will accept. Kept in step with ALLOWED_ATTACHMENT_TYPE on it. */
export const ACCEPTED_MIME_TYPE_LIST = ['image/*', 'application/pdf']

export function isImageAsset(asset) {
    if (asset?.mimeType) return asset.mimeType.startsWith('image/')
    // A camera capture sometimes arrives with no mime type at all.
    return !(asset?.fileName || '').toLowerCase().endsWith('.pdf')
}

/**
 * Offers the camera first, because a receipt in hand is still the common case, then
 * the photo library, then Files for an e-receipt that arrived as a PDF.
 *
 * iOS has no one native picker spanning the photo library and Files - PHPicker and
 * UIDocumentPicker are different system screens - so the choice is offered here
 * rather than pretended away. What is uniform is what comes back: every route
 * resolves to {uri, fileName, mimeType}, whatever the picker called those.
 *
 * Returns [] when the person backs out or denies permission - never throws, so a
 * refused camera cannot block a submission.
 */
export async function pickAttachment() {
    return new Promise((resolve) => {
        Alert.alert('Add an attachment', 'A photo, or a PDF you already have.', [
            {
                text: 'Take a photo',
                onPress: async () => resolve(await launchCamera()),
            },
            {
                text: 'Choose from library',
                onPress: async () => resolve(await launchLibrary()),
            },
            {
                text: 'Choose a file (PDF)',
                onPress: async () => resolve(await launchDocuments()),
            },
            { text: 'Cancel', style: 'cancel', onPress: () => resolve([]) },
        ])
    })
}

/**
 * The two pickers disagree about what a file is called - ImagePicker says fileName,
 * DocumentPicker says name - and everything downstream (the upload body, the
 * thumbnail, the saved file) reads one shape, so they are reconciled here.
 */
function normaliseAsset(asset) {
    return {
        uri: asset.uri,
        fileName: asset.fileName || asset.name || null,
        mimeType: asset.mimeType || null,
        size: asset.size,
    }
}

async function launchCamera() {
    const permission = await ImagePicker.requestCameraPermissionsAsync()
    if (!permission.granted) {
        Alert.alert('Camera access needed',
            'Allow camera access so you can photograph a document.')
        return []
    }
    const result = await ImagePicker.launchCameraAsync({ quality: 0.7 })
    return result.canceled ? [] : (result.assets || []).map(normaliseAsset)
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
    return result.canceled ? [] : (result.assets || []).map(normaliseAsset)
}

/**
 * Files, iCloud Drive and anywhere else the OS exposes - which is where an e-receipt
 * emailed as a PDF actually lives. Needs no permission prompt of its own: the picker
 * hands back only what the person chose.
 */
async function launchDocuments() {
    const result = await DocumentPicker.getDocumentAsync({
        type: ACCEPTED_MIME_TYPE_LIST,
        multiple: true,
        // The file has to be readable by the upload that follows, and on iOS a
        // picked document is otherwise a security-scoped url that will not open.
        copyToCacheDirectory: true,
    })
    if (result.canceled) return []
    return (result.assets || []).map(normaliseAsset)
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
                        {/* A PDF through Image is a blank square, so it gets named. */}
                        {isImageAsset(asset) ? (
                            <Image source={{ uri: asset.uri }} style={styles.thumb} />
                        ) : (
                            <View style={[styles.thumb, styles.docThumb]}>
                                <Ionicons name="document-text-outline" size={26}
                                          color={colors.brandDark} />
                                <Text style={styles.docThumbName} numberOfLines={2}>
                                    {asset.fileName || 'Document'}
                                </Text>
                            </View>
                        )}
                        <Pressable
                            onPress={() => onRemove(index)}
                            hitSlop={8}
                            style={styles.remove}
                            accessibilityLabel={`Remove attachment ${index + 1}`}
                        >
                            <Ionicons name="close-circle" size={22} color={colors.ink} />
                        </Pressable>
                    </View>
                ))}

                <Pressable
                    onPress={onAdd}
                    style={({ pressed }) => [styles.addTile, pressed && styles.pressed]}
                    accessibilityLabel="Add an attachment"
                >
                    <Ionicons name="attach-outline" size={22} color={colors.brandDark} />
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
    docThumb: {
        alignItems: 'center',
        justifyContent: 'center',
        gap: 2,
        padding: spacing.xs,
        borderWidth: 1,
        borderColor: colors.line,
    },
    docThumbName: { ...type.small, fontSize: 9, textAlign: 'center' },
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
