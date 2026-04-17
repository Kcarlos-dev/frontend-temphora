import imageCompression from 'browser-image-compression'

const options = {
  maxSizeMB: 1.2,
  maxWidthOrHeight: 1920,
  useWebWorker: true,
  fileType: 'image/jpeg' as const,
  initialQuality: 0.82,
}

/**
 * Reduz peso e dimensão de imagens antes do upload (ponto, atestado, etc.).
 * Formatos não-imagem ou falhas na compressão devolvem o arquivo original.
 */
export async function compressImageFileIfNeeded(file: File): Promise<File> {
  if (!file.type.startsWith('image/')) {
    return file
  }
  try {
    const blob = await imageCompression(file, options)
    const base = file.name.replace(/\.[^.]+$/i, '') || 'imagem'
    return new File([blob], `${base}.jpg`, {
      type: 'image/jpeg',
      lastModified: Date.now(),
    })
  } catch {
    return file
  }
}
