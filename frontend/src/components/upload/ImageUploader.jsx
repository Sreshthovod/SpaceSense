import { useRef, useState } from 'react'
import { ImagePlus, Trash2 } from 'lucide-react'
import { IMAGE_TYPES, MAX_IMAGE_MB } from '../../utils/validation'

export default function ImageUploader({ file, previewUrl, error, onSelect, onClear }) {
  const inputRef = useRef(null)
  const [dragging, setDragging] = useState(false)

  const handleFiles = (files) => {
    if (files && files[0]) onSelect(files[0])
  }

  return (
    <div>
      <span id="upload-label" className="mb-2 block text-sm font-semibold text-ink">
        Room photo <span className="ml-0.5 text-clay text-xs font-normal" title="Required">*</span>
      </span>
      {previewUrl ? (
        <div className="relative overflow-hidden rounded-2xl border border-line bg-sand">
          <img
            src={previewUrl}
            alt="Preview of your uploaded room"
            className="aspect-[4/3] max-h-80 w-full object-cover"
          />
          <div className="flex flex-wrap items-center justify-between gap-3 bg-white px-4 py-2.5 text-sm">
            <span className="truncate max-w-[180px] text-xs font-medium text-muted sm:max-w-xs">{file?.name}</span>
            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={() => inputRef.current?.click()}
                className="text-xs font-semibold text-sage-dark hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-sage-dark"
              >
                Change photo
              </button>
              <button
                type="button"
                onClick={onClear}
                className="inline-flex items-center gap-1 text-xs font-semibold text-clay hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-clay"
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
          className={`flex w-full cursor-pointer flex-col items-center justify-center gap-2 rounded-2xl border-2 border-dashed px-4 py-12 text-center transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-sage-dark ${
            dragging ? 'border-sage-dark bg-sage/15' : error ? 'border-red-400 bg-red-50/50' : 'border-line bg-cream hover:border-sage/60 hover:bg-sand/60'
          }`}
        >
          <ImagePlus aria-hidden="true" className="h-8 w-8 text-sage-dark" />
          <span className="font-semibold text-ink">Click to upload or drag and drop</span>
          <span id="upload-hint" className="text-xs text-muted">JPG, PNG or WebP, up to {MAX_IMAGE_MB} MB</span>
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
        <p id="upload-error" role="alert" className="mt-2 text-xs font-medium text-red-700">
          {error}
        </p>
      )}
    </div>
  )
}
