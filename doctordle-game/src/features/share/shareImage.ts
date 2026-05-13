import { toBlob } from 'html-to-image'
import type { ShareCardData } from './shareCard.types'
import { shareNatively } from './nativeShare'
import { buildShareTextForShareSheet, getShareUrl } from './shareText'

export type ShareImageResult = 'shared' | 'copied' | 'downloaded' | 'idle'

export async function shareCardImage(
  cardElement: HTMLElement,
  data: ShareCardData,
): Promise<ShareImageResult> {
  const shareText = buildShareTextForShareSheet(data)
  const shareUrl = getShareUrl()

  const blob = await toBlob(cardElement, {
    backgroundColor: '#0d2440',
    cacheBust: true,
    pixelRatio: 2,
  })

  if (!blob) {
    return 'idle'
  }

  const file = new File([blob], getShareImageFilename(data), { type: 'image/png' })
  try {
    if (navigator.canShare?.({ files: [file] }) && navigator.share) {
      await navigator.share({
        title: 'Wardle score',
        text: shareText,
        url: shareUrl,
        files: [file],
      })
      return 'shared'
    }
  } catch {
    // Share cancellation falls through to native/text, clipboard, or download options.
  }

  if (await shareNatively({
    title: 'Wardle score',
    text: shareText,
    url: shareUrl,
    dialogTitle: 'Share Wardle score',
  })) {
    return 'shared'
  }

  try {
    const ClipboardItemConstructor = globalThis.ClipboardItem
    if (navigator.clipboard?.write && ClipboardItemConstructor) {
      await navigator.clipboard.write([
        new ClipboardItemConstructor({ 'image/png': blob }),
      ])
      return 'copied'
    }
  } catch {
    // Some browsers expose ClipboardItem but reject image clipboard writes.
  }

  downloadBlob(blob, file.name)
  return 'downloaded'
}

function getShareImageFilename(_data: ShareCardData) {
  return 'wardle-score.png'
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
