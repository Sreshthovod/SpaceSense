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
      <span id="upload-label" className="mb-2 block text-sm font-semibold">Room photo</span>
      {previewUrl ? (
        <div className="relative overflow-hidden rounded-2xl border border-line bg-sand">
          <img src={previewUrl} alt="Preview of your uploaded room" className="max-h-80 w-full object-cover" />
          <div className="flex items-center justify-between gap-2 bg-white px-4 py-2 text-sm">
            <span className="truncate text-muted">{file?.name}</span>
            <button type="button" onClick={onClear} className="inline-flex items-center gap-1 font-semibold text-clay hover:underline">
              <Trash2 aria-hidden="true" className="h-4 w-4" /> Remove
            </button>
          </div>
        </div>
      ) : (
        <button
          type="button"
          aria-labelledby="upload-label"
          aria-describedby="upload-hint upload-error"
          onClick={() => inputRef.current?.click()}
          onDragOver={(e) => { e.preventDefault(); setDragging(true) }}
          onDragLeave={() => setDragging(false)}
          onDrop={(e) => { e.preventDefault(); setDragging(false); handleFiles(e.dataTransfer.files) }}
          className={`flex w-full flex-col items-center justify-center gap-2 rounded-2xl border-2 border-dashed px-4 py-12 text-center transition-colors ${
            dragging ? 'border-sage bg-sage/10' : error ? 'border-red-400 bg-red-50' : 'border-line bg-cream hover:bg-sand'
          }`}
        >
          <ImagePlus aria-hidden="true" className="h-8 w-8 text-sage" />
          <span className="font-semibold">Click to upload or drag and drop</span>
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
      <p id="upload-error" role="alert" className="mt-2 min-h-5 text-sm text-red-700">{error}</p>
    </div>
  )
}
