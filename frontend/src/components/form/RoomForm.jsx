import { useRef, useState } from 'react'
import { ArrowLeft, ArrowRight, Loader2, Wand2 } from 'lucide-react'
import { DIRECTIONS, ROOM_TYPES } from '../../data/sampleData'
import { validateForm, validateImage, LIMITS } from '../../utils/validation'
import { formatINR } from '../../utils/format'
import ImageUploader from '../upload/ImageUploader'
import Button from '../ui/Button'
import Card from '../ui/Card'
import { NumberField, SelectField, ToggleSwitch } from './Fields'
import StyleSelector from './StyleSelector'
import Stepper from './Stepper'
import RoomBrief from './RoomBrief'

const STEP_FIELDS = {
  1: ['roomType', 'length', 'width', 'height'],
  2: ['style', 'budget'],
  3: ['roomType', 'length', 'width', 'height', 'style', 'budget'],
}

export default function RoomForm({ form, setForm, image, setImage, onSubmit, submitting, apiError }) {
  const [step, setStepState] = useState(1)
  const [dir, setDir] = useState('forward') // which way the step panels slide
  const setStep = (update) => {
    const n = typeof update === 'function' ? update(step) : update
    setDir(n < step ? 'back' : 'forward')
    setStepState(n)
  }
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

  const validateStep = (n) => {
    const imgErr = n === 1 || n === 3 ? validateImage(image.file) : ''
    const all = validateForm(form)
    const errs = Object.fromEntries(Object.entries(all).filter(([k]) => STEP_FIELDS[n].includes(k)))
    setImageError(imgErr)
    setErrors(errs)
    if (imgErr || Object.keys(errs).length) {
      const first = STEP_FIELDS[n].find((k) => errs[k])
      const target = imgErr
        ? formRef.current?.querySelector('button[aria-labelledby="upload-label"]')
        : formRef.current?.querySelector(`[name="${first}"]`)
      target?.focus()
      return false
    }
    return true
  }

  const next = () => {
    if (validateStep(step)) setStep((s) => Math.min(3, s + 1))
  }

  const submit = (e) => {
    e.preventDefault()
    if (step < 3) {
      next()
      return
    }
    if (!validateStep(1)) return setStep(1)
    if (!validateStep(2)) return setStep(2)
    onSubmit()
  }

  return (
    <form ref={formRef} onSubmit={submit} noValidate aria-label="Room details" className="grid grid-cols-1 items-start gap-6 lg:grid-cols-[minmax(0,1.6fr)_minmax(19rem,0.9fr)] lg:gap-8">
      <div className="reveal min-w-0">
        <Stepper step={step} onJump={(n) => { if (n < step || validateStep(step)) setStep(n) }} />

        <div key={step} className={dir === 'back' ? 'anim-from-left' : 'anim-from-right'}>
        {step === 1 && (
          <div className="grid gap-6">
            <Card>
              <ImageUploader file={image.file} previewUrl={image.url} error={imageError} onSelect={selectImage} onClear={() => { setImage(null); setImageError('') }} />
            </Card>
            <Card className="space-y-5">
              <div>
                <h3 className="font-display text-xl font-semibold">The room</h3>
                <p className="mt-0.5 text-xs text-muted">Measure wall to wall, in feet. Rough is fine.</p>
              </div>
              <SelectField id="roomType" label="Room type" value={form.roomType} onChange={set('roomType')} options={ROOM_TYPES} error={errors.roomType} />
              <div className="grid grid-cols-3 gap-2 sm:gap-3">
                <NumberField id="length" label="Length" suffix="ft" value={form.length} onChange={set('length')} error={errors.length} min={LIMITS.length[0]} max={LIMITS.length[1]} />
                <NumberField id="width" label="Width" suffix="ft" value={form.width} onChange={set('width')} error={errors.width} min={LIMITS.width[0]} max={LIMITS.width[1]} />
                <NumberField id="height" label="Height" suffix="ft" value={form.height} onChange={set('height')} error={errors.height} min={LIMITS.height[0]} max={LIMITS.height[1]} />
              </div>
            </Card>
          </div>
        )}

        {step === 2 && (
          <Card className="space-y-5">
            <NumberField
              id="budget"
              label="Budget"
              prefix="₹"
              value={form.budget}
              onChange={set('budget')}
              error={errors.budget}
              min={LIMITS.budget[0]}
              max={LIMITS.budget[1]}
              step={1000}
              hint={form.budget ? formatINR(Number(form.budget)) : `Allowed range: ${formatINR(LIMITS.budget[0])} – ${formatINR(LIMITS.budget[1])}`}
            />
            <ToggleSwitch id="vastu" label="Vastu preferences" description="Include Vastu-aware placement notes (optional)." checked={form.vastu} onChange={set('vastu')} />
            {form.vastu && (
              <div>
                <SelectField id="entryDirection" label="Direction you face when you walk in" value={form.entryDirection} onChange={set('entryDirection')} options={DIRECTIONS} required={false} placeholder="Not sure" />
                <p className="mt-1 text-xs text-muted">Stand at the room's main door looking in and check a phone compass. This lets us say which wall is south, which corner is north-east, and so on, instead of generic tips.</p>
              </div>
            )}
            <StyleSelector value={form.style} onChange={set('style')} error={errors.style} />
          </Card>
        )}

        {step === 3 && (
          <Card>
            <h3 className="font-display text-2xl font-semibold">Ready to generate</h3>
            <p className="mt-2 text-sm leading-relaxed text-muted">
              SpaceSense will analyse your photo for a {(form.style || 'chosen').replaceAll('-', ' ')} redesign within {form.budget ? formatINR(Number(form.budget)) : 'your budget'}, then suggest products you can buy. Your photo is sent to the SpaceSense server and is only edited if you approve.
            </p>
            <ul className="mt-4 space-y-2 text-sm">
              <li>{form.roomType} · {form.length} × {form.width} × {form.height} ft</li>
              {form.vastu && <li>Vastu placement notes will be included{form.entryDirection ? ` (entry facing ${form.entryDirection})` : ''}</li>}
            </ul>
          </Card>
        )}
        </div>

        {apiError && <p role="alert" className="mt-4 rounded-xl border border-red-300 bg-red-50 p-3 text-sm text-red-800">{apiError}</p>}

        <div className="mt-6 flex flex-wrap items-center justify-between gap-3 border-t border-line pt-5">
          {step > 1 ? (
            <Button variant="ghost" onClick={() => setStep((s) => s - 1)}>
              <ArrowLeft aria-hidden="true" className="h-4 w-4" /> Back
            </Button>
          ) : <span />}
          {step < 3 ? (
            <Button type="button" onClick={next} className="group min-w-[9.5rem]">
              Continue <ArrowRight aria-hidden="true" className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
            </Button>
          ) : (
            <Button type="submit" disabled={submitting} aria-busy={submitting}>
              {submitting ? <Loader2 aria-hidden="true" className="h-4 w-4 animate-spin" /> : <Wand2 aria-hidden="true" className="h-4 w-4" />}
              {submitting ? 'Contacting server…' : 'Generate preview'}
            </Button>
          )}
        </div>
      </div>
      <div className="reveal min-w-0 lg:sticky lg:top-20" style={{ transitionDelay: '120ms' }}>
        <RoomBrief form={form} imageUrl={image.url} />
      </div>
    </form>
  )
}
