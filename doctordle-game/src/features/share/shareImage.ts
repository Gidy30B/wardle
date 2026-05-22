import { Capacitor } from '@capacitor/core'
import { Directory, Filesystem } from '@capacitor/filesystem'
import { toBlob } from 'html-to-image'
import type { ShareCardData } from './shareCard.types'
import { shareNatively } from './nativeShare'
import { buildSharePayload } from './shareText'

export type ShareImageResult =
  | 'shared'
  | 'text-shared'
  | 'copied'
  | 'downloaded'
  | 'idle'

type PreparedShareImage = {
  blob: Blob
  file: File
  nativeUri: string | null
}

type PreparedShareImageEntry = {
  key: string
  status: 'pending' | 'ready' | 'failed'
  promise: Promise<PreparedShareImage | null>
}

const preparedShareImages = new WeakMap<HTMLElement, PreparedShareImageEntry>()

export function prepareShareCardImage(
  cardElement: HTMLElement,
  data: ShareCardData,
): Promise<PreparedShareImage | null> {
  return getOrPrepareShareCardImage(cardElement, data).promise
}

export async function shareCardImage(
  cardElement: HTMLElement,
  data: ShareCardData,
): Promise<ShareImageResult> {
  const payload = buildSharePayload(data)
  const preparedImageEntry = getOrPrepareShareCardImage(cardElement, data)
  const preparedImage = await preparedImageEntry.promise

  if (Capacitor.isNativePlatform()) {
    if (preparedImage?.nativeUri) {
      if (await shareNatively({
        title: payload.title,
        text: payload.text,
        url: payload.url,
        files: [preparedImage.nativeUri],
        dialogTitle: payload.dialogTitle,
      })) {
        return 'shared'
      }

      warnShareImage('native file share failed; falling back to text')
    } else {
      warnShareImage(
        preparedImage
          ? 'native share image has no file URI; falling back to text'
          : 'native share image preparation failed; falling back to text',
      )
    }

    return shareTextFallback(payload, { nativeOnly: true })
  }

  if (!preparedImage) {
    return shareTextFallback(payload)
  }

  try {
    if (navigator.canShare?.({ files: [preparedImage.file] }) && navigator.share) {
      await navigator.share({
        title: payload.title,
        text: payload.text,
        url: payload.url,
        files: [preparedImage.file],
      })
      return 'shared'
    }
  } catch {
    // Share cancellation falls through to native/text, clipboard, or download options.
  }

  if (await shareNatively({
    title: payload.title,
    text: payload.text,
    url: payload.url,
    dialogTitle: payload.dialogTitle,
  })) {
    return 'shared'
  }

  try {
    const ClipboardItemConstructor = globalThis.ClipboardItem
    if (navigator.clipboard?.write && ClipboardItemConstructor) {
      await navigator.clipboard.write([
        new ClipboardItemConstructor({ 'image/png': preparedImage.blob }),
      ])
      return 'copied'
    }
  } catch {
    // Some browsers expose ClipboardItem but reject image clipboard writes.
  }

  downloadBlob(preparedImage.blob, preparedImage.file.name)
  return 'downloaded'
}

function getOrPrepareShareCardImage(
  cardElement: HTMLElement,
  data: ShareCardData,
): PreparedShareImageEntry {
  const key = getShareImageCacheKey(data)
  const cached = preparedShareImages.get(cardElement)
  if (cached?.key === key) {
    return cached
  }

  const entry: PreparedShareImageEntry = {
    key,
    status: 'pending',
    promise: Promise.resolve(null),
  }

  entry.promise = renderShareCardImage(cardElement, data)
    .then((image) => {
      entry.status = image ? 'ready' : 'failed'
      return image
    })
    .catch((error) => {
      entry.status = 'failed'
      warnShareImage('image preparation failed', error)
      return null
    })

  preparedShareImages.set(cardElement, entry)
  return entry
}

async function renderShareCardImage(
  cardElement: HTMLElement,
  data: ShareCardData,
): Promise<PreparedShareImage | null> {
  const blob = await toBlob(cardElement, {
    backgroundColor: '#0d2440',
    cacheBust: true,
    pixelRatio: 2,
  })

  if (!blob) {
    return null
  }

  const file = new File([blob], getShareImageFilename(data), { type: 'image/png' })
  const nativeUri = Capacitor.isNativePlatform()
    ? await writeNativeShareImage(blob, file.name).catch((error) => {
        warnShareImage('native cache write failed', error)
        return null
      })
    : null

  return {
    blob,
    file,
    nativeUri,
  }
}

async function shareTextFallback(
  payload: ReturnType<typeof buildSharePayload>,
  options: { nativeOnly?: boolean } = {},
): Promise<ShareImageResult> {
  warnShareImage('using text fallback')

  if (await shareNatively({
    title: payload.title,
    text: payload.text,
    url: payload.url,
    dialogTitle: payload.dialogTitle,
  })) {
    return 'text-shared'
  }

  if (options.nativeOnly) {
    return 'idle'
  }

  try {
    if (navigator.share) {
      await navigator.share({
        title: payload.title,
        text: payload.text,
        url: payload.url,
      })
      return 'text-shared'
    }
  } catch {
    // Share cancellation should fall through to copy.
  }

  try {
    await navigator.clipboard.writeText(payload.clipboardText)
    return 'copied'
  } catch {
    return 'idle'
  }
}

async function writeNativeShareImage(blob: Blob, filename: string) {
  const base64 = await blobToBase64(blob)
  const path = `share/${filename}`

  await Filesystem.writeFile({
    path,
    data: base64,
    directory: Directory.Cache,
    recursive: true,
  })

  const { uri } = await Filesystem.getUri({
    path,
    directory: Directory.Cache,
  })

  return uri
}

function blobToBase64(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onerror = () => reject(reader.error)
    reader.onload = () => {
      const result = typeof reader.result === 'string' ? reader.result : ''
      resolve(result.split(',')[1] ?? result)
    }
    reader.readAsDataURL(blob)
  })
}

function getShareImageFilename(_data: ShareCardData) {
  return 'wardle-score.png'
}

function getShareImageCacheKey(data: ShareCardData) {
  return JSON.stringify({
    caseId: data.caseId,
    caseLabel: data.caseLabel,
    result: data.result,
    attemptsUsed: data.attemptsUsed,
    cluesUsed: data.cluesUsed,
    totalClues: data.totalClues,
    score: data.score,
    streak: data.streak,
    xpTotal: data.xpTotal,
    school: data.school,
    attemptLabels: data.attemptLabels,
  })
}

function warnShareImage(message: string, error?: unknown) {
  if (import.meta.env.DEV) {
    console.warn('[share-image]', message, error)
  }
}

function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob)
  const anchor = document.createElement('a')
  anchor.href = url
  anchor.download = filename
  anchor.rel = 'noopener'
  document.body.appendChild(anchor)
  anchor.click()
  anchor.remove()
  window.setTimeout(() => URL.revokeObjectURL(url), 1000)
}
