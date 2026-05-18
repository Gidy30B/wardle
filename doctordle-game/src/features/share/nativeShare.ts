import { Share } from '@capacitor/share'
import { Capacitor } from '@capacitor/core'

type NativeShareOptions = {
  title: string
  text: string
  url?: string
  files?: string[]
  dialogTitle?: string
}

export async function shareNatively({
  title,
  text,
  url,
  files,
  dialogTitle,
}: NativeShareOptions) {
  if (!Capacitor.isNativePlatform()) {
    return false
  }

  try {
    const canShare = await Share.canShare()
    if (!canShare.value) {
      return false
    }

    await Share.share({
      title,
      text,
      url,
      files,
      dialogTitle,
    })
    return true
  } catch {
    return false
  }
}
