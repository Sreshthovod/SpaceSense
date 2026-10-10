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
        <Bookmark aria-hidden="true" className="h-4 w-4" /> Save look
      </Button>
      <Button variant="ghost" onClick={copy}>
        <Link2 aria-hidden="true" className="h-4 w-4" /> Copy share link
      </Button>
      {looks.length > 0 && (
        <label className="text-sm">
          <span className="sr-only">Saved looks</span>
          <select defaultValue="" onChange={(e) => { if (e.target.value) onRestore(e.target.value); e.target.value = '' }} className="rounded-xl border border-line bg-white px-3 py-2">
            <option value="">Open a saved look…</option>
            {looks.map((look) => (
              <option key={look.id} value={look.id}>{look.title}</option>
            ))}
          </select>
        </label>
      )}
      {note && <span role="status" className="text-xs text-sage-dark">{note}</span>}
    </div>
  )
}
