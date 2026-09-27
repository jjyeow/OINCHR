import { Directory, File, Paths } from 'expo-file-system'
import * as Sharing from 'expo-sharing'

/**
 * Saving a receipt off the phone.
 *
 * Receipts live in a private bucket and are reached through a signed URL that dies
 * after five minutes, so there is no permanent link to hand to the OS. The file is
 * fetched into the cache first and the share sheet is pointed at the local copy -
 * that is also what gives "Save to Files" and "Save Image" for free, without asking
 * for the photo library permission a direct save would need.
 */

const MIME_BY_EXTENSION = {
    pdf: 'application/pdf',
    png: 'image/png',
    jpg: 'image/jpeg',
    jpeg: 'image/jpeg',
    heic: 'image/heic',
    heif: 'image/heif',
    webp: 'image/webp',
    gif: 'image/gif',
}

// Uniform Type Identifiers, which is what iOS's share sheet reads rather than the
// MIME type. Getting this wrong is the difference between being offered "Save to
// Files" and being offered nothing useful.
const UTI_BY_EXTENSION = {
    pdf: 'com.adobe.pdf',
    png: 'public.png',
    jpg: 'public.jpeg',
    jpeg: 'public.jpeg',
    heic: 'public.heic',
    heif: 'public.heif',
    webp: 'org.webmproject.webp',
    gif: 'com.compuserve.gif',
}

export function extensionOf(fileName) {
    if (!fileName || !fileName.includes('.')) return ''
    return fileName.split('.').pop().toLowerCase()
}

/**
 * The field is an ImageField on the server but the upload view writes the row
 * directly, so Pillow never runs and PDFs are stored alongside photos. The extension
 * is the only thing that says which a receipt is.
 */
export function isPdf(fileName) {
    return extensionOf(fileName) === 'pdf'
}

export function mimeTypeFor(fileName) {
    return MIME_BY_EXTENSION[extensionOf(fileName)] || 'application/octet-stream'
}

/**
 * The file name out of a signed S3 url, which carries the object key in its path.
 *
 * A fallback for when the server has not sent fileName - an older build of it, or an
 * endpoint that does not return one. Without this a PDF is indistinguishable from a
 * photo and gets rendered as a blank square, so it is worth reading the url rather
 * than depending on deploy order.
 */
export function fileNameFromUrl(url) {
    if (!url) return null
    try {
        const path = url.split('?')[0]
        const last = decodeURIComponent(path.split('/').pop() || '')
        return last.includes('.') ? last : null
    } catch (error) {
        return null
    }
}

/** Falls back to something recognisable when nothing has a name on record. */
export function displayNameFor(fileName, attachmentID) {
    if (fileName) return fileName
    return `receipt-${attachmentID || 'file'}.jpg`
}

/**
 * Downloads the receipt and opens the system share sheet on it. Returns nothing on
 * success and throws with a message worth showing on failure.
 */
export async function saveAttachment({ url, fileName, attachmentID }) {
    if (!url) throw new Error('That receipt has no file to save.')

    if (!(await Sharing.isAvailableAsync())) {
        throw new Error('Saving is not available on this device.')
    }

    const name = displayNameFor(fileName, attachmentID)

    // A folder of our own keeps a re-save from colliding with the last one, and keeps
    // these out of whatever else lands in the cache.
    const folder = new Directory(Paths.cache, 'receipts')
    try {
        if (!folder.exists) folder.create({ intermediates: true })
    } catch (error) {
        // An existing folder is the normal case and not worth failing over.
    }

    const target = new File(folder, name)
    try {
        if (target.exists) target.delete()
    } catch (error) {
        // A stale copy we cannot remove is not a reason to abandon the save.
    }

    let downloaded
    try {
        downloaded = await File.downloadFileAsync(url, target)
    } catch (error) {
        // Five minutes is the usual culprit: the URL the page was rendered with has
        // expired, and the caller should mint a fresh one and try again.
        throw new Error('Could not download the receipt. It may have expired - reopen it and try again.')
    }

    await Sharing.shareAsync(downloaded.uri, {
        mimeType: mimeTypeFor(name),
        UTI: UTI_BY_EXTENSION[extensionOf(name)],
        dialogTitle: `Save ${name}`,
    })
}
