import { toBlob } from 'html-to-image'
import type { ShareCardData } from './shareCard.types'
import { buildShareText, getShareUrl } from './shareText'

export type ShareImageResult = 'shared' | 'copied' | 'downloaded' | 'idle'

export async function shareCardImage(
  cardElement: HTMLElement,
  data: ShareCardData,
): Promise<ShareImageResult> {
  const blob = await toBlob(cardElement, {
    backgroundColor: '#0d2440',
    cacheBust: true,
    pixelRatio: 2,
  })

  if (!blob) {
    return 'idle'
  }

  const file = new File([blob], getShareImageFilename(data), { type: 'image/png' })
  const shareText = buildShareText(data)

  try {
    if (navigator.canShare?.({ files: [file] }) && navigator.share) {
      await navigator.share({
        title: 'Wardle score',
        text: shareText,
        url: getShareUrl(),
        files: [file],
      })
      return 'shared'
    }
  } catch {
    // Native share cancellation falls through to clipboard/download options.
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

function getShareImageFilename(data: ShareCardData) {
  const caseSlug = data.caseId ? data.caseId.replace(/[^a-z0-9-]/gi, '-') : 'daily'
  return `wardle-${caseSlug}-score.png`
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
