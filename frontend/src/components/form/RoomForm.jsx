import { useRef, useState } from 'react'
import { Loader2, Wand2 } from 'lucide-react'
import { ROOM_TYPES } from '../../data/sampleData'
import { validateForm, validateImage, LIMITS } from '../../utils/validation'
import { formatINR } from '../../utils/format'
import ImageUploader from '../upload/ImageUploader'
import Button from '../ui/Button'
import Card from '../ui/Card'
import { NumberField, SelectField, ToggleSwitch } from './Fields'
import StyleSelector from './StyleSelector'

const ORDER = ['roomType', 'length', 'width', 'height', 'style', 'budget']

export default function RoomForm({ form, setForm, image, setImage, onSubmit, submitting }) {
  const [errors, setErrors] = useState({})
  const [imageError, setImageError] = useState('')
  const formRef = useRef(null)

  const set = (key) => (value) => {
    setForm((f) => ({ ...f, [key]: value }))
    setErrors((e) => ({ ...e, [key]: '' }))
  }

  const selectImage = (file) => {
    const err = validateImage(file)
    setImageError(err)
    if (!err) setImage(file)
  }

  const submit = (e) => {
    e.preventDefault()
    const imgErr = validateImage(image.file)
    const errs = validateForm(form)
    setImageError(imgErr)
    setErrors(errs)
    if (imgErr || Object.keys(errs).length) {
      const first = ORDER.find((k) => errs[k])
      const target = imgErr ? formRef.current.querySelector('button[aria-labelledby="upload-label"]') : formRef.current.querySelector(`[name="${first}"]`)
      target?.focus()
      return
    }
    onSubmit()
  }

  return (
    <form ref={formRef} onSubmit={submit} noValidate aria-label="Room details" className="grid gap-6 lg:grid-cols-2">
      <Card>
        <ImageUploader file={image.file} previewUrl={image.url} error={imageError} onSelect={selectImage} onClear={() => { setImage(null); setImageError('') }} />
      </Card>
      <Card className="space-y-2">
        <SelectField id="roomType" label="Room type" value={form.roomType} onChange={set('roomType')} options={ROOM_TYPES} error={errors.roomType} />
        <div className="grid grid-cols-3 gap-3">
          <NumberField id="length" label="Length" suffix="ft" value={form.length} onChange={set('length')} error={errors.length} min={LIMITS.length[0]} max={LIMITS.length[1]} />
          <NumberField id="width" label="Width" suffix="ft" value={form.width} onChange={set('width')} error={errors.width} min={LIMITS.width[0]} max={LIMITS.width[1]} />
          <NumberField id="height" label="Height" suffix="ft" value={form.height} onChange={set('height')} error={errors.height} min={LIMITS.height[0]} max={LIMITS.height[1]} />
        </div>
        <NumberField id="budget" label="Budget" prefix="₹" value={form.budget} onChange={set('budget')} error={errors.budget} min={LIMITS.budget[0]} max={LIMITS.budget[1]} step={1000}
          hint={form.budget ? formatINR(Number(form.budget)) : `${formatINR(LIMITS.budget[0])} – ${formatINR(LIMITS.budget[1])}`} />
        <ToggleSwitch id="vastu" label="Vastu preferences" description="Include Vastu-aware placement notes (optional)." checked={form.vastu} onChange={set('vastu')} />
      </Card>
      <Card className="lg:col-span-2">
        <StyleSelector value={form.style} onChange={set('style')} error={errors.style} />
        <div className="mt-4 flex justify-end">
          <Button type="submit" disabled={submitting}>
            {submitting ? <Loader2 aria-hidden="true" className="h-4 w-4 animate-spin" /> : <Wand2 aria-hidden="true" className="h-4 w-4" />}
            {submitting ? 'Preparing preview…' : 'Generate preview'}
          </Button>
        </div>
      </Card>
    </form>
  )
}
