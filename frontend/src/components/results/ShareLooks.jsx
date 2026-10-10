import { useState } from 'react'
import { Bookmark, Link2 } from 'lucide-react'
import Button from '../ui/Button'

export default function ShareLooks({ looks, onSave, onCopy, onRestore }) {
  const [note, setNote] = useState('')

  const copy = async () => {
    const ok = await onCopy()
    setNote(ok ? 'Link copied' : 'Could not copy')
    setTimeout(() => setNote(''), 2000)
  }

  return (
    <div className="flex flex-wrap items-center gap-3">
      <Button variant="secondary" onClick={onSave}>
        <Bookmark aria-hidden="true" className="h-4 w-4" /> Save brief
      </Button>
      <Button variant="ghost" onClick={copy}>
        <Link2 aria-hidden="true" className="h-4 w-4" /> Copy brief link
      </Button>
      {looks.length > 0 && (
        <label className="text-sm">
          <span className="sr-only">Saved briefs</span>
          <select defaultValue="" onChange={(e) => { if (e.target.value) onRestore(e.target.value); e.target.value = '' }} className="rounded-xl border border-line bg-white px-3 py-2">
            <option value="">Open a saved brief…</option>
            {looks.map((look) => (
              <option key={look.id} value={look.id}>{look.title}</option>
            ))}
          </select>
        </label>
      )}
      <p className="basis-full text-xs text-muted">Saves your room details and mood in this browser. Your photo and the analysis are not saved, so add the photo again to get new advice.</p>
      {note && <span role="status" className="text-xs text-sage-dark">{note}</span>}
    </div>
  )
}
