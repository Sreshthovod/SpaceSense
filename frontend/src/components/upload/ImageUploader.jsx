import { useEffect, useRef, useState } from 'react'
import { AlertCircle, ImagePlus, RefreshCw, Trash2, Upload } from 'lucide-react'
import { IMAGE_TYPES, MAX_IMAGE_MB } from '../../utils/validation'
import { isMac } from '../../utils/fuzzy'

const sizeOf = (bytes) => (bytes >= 1024 * 1024 ? `${(bytes / (1024 * 1024)).toFixed(1)} MB` : `${Math.max(1, Math.round(bytes / 1024))} KB`)

export default function ImageUploader({ file, previewUrl, error, onSelect, onClear }) {
  const inputRef = useRef(null)
  const [dragging, setDragging] = useState(false)

  const handleFiles = (files) => {
    if (files && files[0]) onSelect(files[0])
  }

  // Paste a screenshot or copied photo straight in (Cmd/Ctrl+V), unless the user is typing in a field.
  const onSelectRef = useRef(onSelect)
  useEffect(() => { onSelectRef.current = onSelect })
  useEffect(() => {
    if (previewUrl) return undefined
    const onPaste = (e) => {
      if (e.target.closest?.('input, textarea, select, [contenteditable="true"]')) return
      const image = [...(e.clipboardData?.files ?? [])].find((f) => f.type.startsWith('image/'))
      if (image) {
        e.preventDefault()
        onSelectRef.current(image)
      }
    }
    document.addEventListener('paste', onPaste)
    return () => document.removeEventListener('paste', onPaste)
  }, [previewUrl])

  return (
    <div>
      <span id="upload-label" className="mb-2 block text-sm font-semibold text-ink">
        Room photo <span className="ml-0.5 text-clay text-xs font-normal" title="Required">*</span>
      </span>
      {previewUrl ? (
        <div className="overflow-hidden rounded-xl border border-line bg-cream">
          <img
            key={previewUrl}
            src={previewUrl}
            alt="Preview of your uploaded room"
            className="photo-reveal aspect-[4/3] max-h-80 w-full bg-sand object-contain"
          />
          <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-2 border-t border-line px-4 py-2.5">
            <p className="min-w-0 text-xs">
              <span className="block max-w-[14rem] truncate font-medium text-ink sm:max-w-xs">{file?.name}</span>
              {file?.size ? <span className="text-muted">{sizeOf(file.size)}</span> : null}
            </p>
            <div className="flex items-center gap-1">
              <button
                type="button"
                onClick={() => inputRef.current?.click()}
                className="inline-flex min-h-[36px] items-center gap-1.5 rounded-full px-3 text-xs font-semibold text-ink transition-colors hover:bg-sand focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-sage-dark"
              >
                <RefreshCw aria-hidden="true" className="h-3.5 w-3.5" /> Change photo
              </button>
              <button
                type="button"
                onClick={onClear}
                className="inline-flex min-h-[36px] items-center gap-1.5 rounded-full px-3 text-xs font-semibold text-clay transition-colors hover:bg-warn-bg focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-clay"
              >
                <Trash2 aria-hidden="true" className="h-3.5 w-3.5" /> Remove
              </button>
            </div>
          </div>
        </div>
      ) : (
        <button
          type="button"
          aria-labelledby="upload-label"
          aria-describedby={error ? 'upload-hint upload-error' : 'upload-hint'}
          onClick={() => inputRef.current?.click()}
          onDragOver={(e) => { e.preventDefault(); setDragging(true) }}
          onDragLeave={() => setDragging(false)}
          onDrop={(e) => { e.preventDefault(); setDragging(false); handleFiles(e.dataTransfer.files) }}
          className={`drop-zone spotlight group flex w-full cursor-pointer flex-col items-center justify-center gap-2 rounded-xl border px-5 py-10 text-center focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-sage-dark sm:py-12 ${
            dragging ? 'is-dragging border-sage-dark bg-sand' : error ? 'border-red-400 bg-cream' : 'border-line bg-cream hover:border-muted/60 hover:bg-sand/70'
          }`}
        >
          {/* Frame corners, like a photo being lined up. */}
          <span aria-hidden="true" className={`drop-corners pointer-events-none absolute inset-3 ${dragging ? 'text-sage-dark' : 'text-muted/50 group-hover:text-sage'}`} />
          <span aria-hidden="true" className={`flex h-12 w-12 items-center justify-center rounded-full border transition-[transform,background-color,border-color] duration-300 ${dragging ? '-translate-y-1 border-sage-dark bg-sage-dark text-cream' : 'border-line bg-white text-sage-dark group-hover:-translate-y-0.5'}`}>
            {dragging ? <Upload className="h-5 w-5" /> : <ImagePlus className="h-5 w-5" strokeWidth={1.75} />}
          </span>
          <span className="mt-1 font-display text-xl font-semibold text-ink sm:text-2xl">{dragging ? 'Let go to use this photo' : 'Drop your room photo here'}</span>
          <span className="text-sm text-muted">Choose an image or drag it into this area.</span>
          <span id="upload-hint" className="mt-1 text-xs text-muted">
            JPG, PNG or WebP, up to {MAX_IMAGE_MB} MB. You can also paste one with <kbd className="rounded border border-line px-1 font-sans text-[10px] font-semibold">{isMac() ? '⌘V' : 'Ctrl V'}</kbd>.
          </span>
        </button>
      )}
      <input
        ref={inputRef}
        type="file"
        accept={IMAGE_TYPES.join(',')}
        className="sr-only"
        tabIndex={-1}
        aria-hidden="true"
        onChange={(e) => { handleFiles(e.target.files); e.target.value = '' }}
      />
      {error && (
        <p id="upload-error" role="alert" className="anim-up mt-2 flex items-start gap-1.5 text-xs font-medium text-red-700">
          <AlertCircle aria-hidden="true" className="mt-px h-3.5 w-3.5 shrink-0" />
          {error}
        </p>
      )}
    </div>
  )
}
