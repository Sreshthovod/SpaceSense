import { useEffect, useRef, useState } from 'react'
import { MessageCircle, RotateCcw, Send } from 'lucide-react'
import { sendChat } from '../../services/api'
import Button from '../ui/Button'
import Card from '../ui/Card'

const MAX_CHARS = 2000
const HISTORY_SENT = 20 // the backend accepts at most 30 messages
const SUGGESTIONS = [
  'Which piece should I buy first with my budget?',
  'What wall colour would suit this room?',
  'How can I make the room feel bigger?',
]

export default function ChatPanel({ form, photo, recommendations }) {
  const [messages, setMessages] = useState([])
  const [draft, setDraft] = useState('')
  const [pending, setPending] = useState(false)
  const [error, setError] = useState('')
  const inFlight = useRef(false)
  const abortRef = useRef(null)
  const listRef = useRef(null)
  useEffect(() => () => abortRef.current?.abort(), [])
  useEffect(() => {
    listRef.current?.scrollTo?.({ top: listRef.current.scrollHeight })
  }, [messages, pending])

  const ask = async (history) => {
    if (inFlight.current) return
    inFlight.current = true
    const controller = new AbortController()
    abortRef.current = controller
    setPending(true)
    setError('')
    try {
      // Keep the latest messages, starting from a user turn.
      let recent = history.slice(-HISTORY_SENT)
      while (recent[0]?.role === 'assistant') recent = recent.slice(1)
      // Send only the fields the API accepts.
      const payload = recent.map(({ role, content }) => ({ role, content }))
      const data = await sendChat({ form, photo, messages: payload, recommendations }, controller.signal)
      setMessages([...history, { role: 'assistant', content: data.reply, provider: data.provider }])
    } catch (err) {
      if (!controller.signal.aborted) setError(err.message || 'The consultant could not answer.')
    } finally {
      inFlight.current = false
      setPending(false)
    }
  }

  const submit = (text) => {
    const content = text.trim()
    if (!content || inFlight.current) return
    const history = [...messages, { role: 'user', content }]
    setMessages(history)
    setDraft('')
    ask(history)
  }

  const onKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      submit(draft)
    }
  }

  return (
    <Card>
      <div className="flex items-center gap-2">
        <MessageCircle aria-hidden="true" className="h-5 w-5 text-sage-dark" />
        <h2 className="font-display text-3xl font-semibold">Ask SpaceSense</h2>
      </div>
      <p className="mt-1 text-sm text-muted">Ask follow-up questions about your room, the recommendations or your budget. Answers are AI-generated estimates.</p>

      <div ref={listRef} aria-live="polite" aria-label="Conversation" className="mt-4 max-h-96 space-y-3 overflow-y-auto">
        {messages.length === 0 && (
          <div className="stagger flex flex-wrap gap-2">
            {SUGGESTIONS.map((s, i) => (
              <button
                key={s} type="button" onClick={() => submit(s)} disabled={pending} style={{ '--i': i }}
                className="press rounded-full border border-line bg-cream px-3 py-1.5 text-left text-xs font-medium transition-colors hover:border-sage hover:bg-sand disabled:opacity-50"
              >
                {s}
              </button>
            ))}
          </div>
        )}
        {messages.map((m, i) => (
          <div key={i} className={`bubble-in ${m.role === 'user' ? 'bubble-in-own flex justify-end' : 'flex justify-start'}`}>
            <p
              className={`max-w-[85%] whitespace-pre-line rounded-2xl px-4 py-2.5 text-sm leading-relaxed ${
                m.role === 'user' ? 'bg-ink text-cream' : 'border border-line bg-cream'
              }`}
            >
              <span className="sr-only">{m.role === 'user' ? 'You: ' : 'SpaceSense: '}</span>
              {m.content}
            </p>
          </div>
        ))}
        {pending && (
          <div role="status" className="anim-up flex justify-start">
            <p className="flex items-center gap-2 rounded-2xl border border-line bg-cream px-4 py-3 text-sm text-muted">
              <span aria-hidden="true" className="flex gap-1">
                <span className="typing-dot h-1.5 w-1.5 rounded-full bg-sage-dark" />
                <span className="typing-dot h-1.5 w-1.5 rounded-full bg-sage-dark" />
                <span className="typing-dot h-1.5 w-1.5 rounded-full bg-sage-dark" />
              </span>
              <span className="sr-only sm:not-sr-only">SpaceSense is thinking…</span>
            </p>
          </div>
        )}
      </div>

      {error && (
        <div className="mt-3 flex flex-wrap items-center gap-3">
          <p role="alert" className="rounded-xl border border-red-300 bg-red-50 px-3 py-2 text-sm text-red-800">{error}</p>
          <Button variant="secondary" onClick={() => ask(messages)} disabled={pending}>
            <RotateCcw aria-hidden="true" className="h-4 w-4" /> Retry
          </Button>
        </div>
      )}

      <form className="mt-4 flex items-end gap-2" onSubmit={(e) => { e.preventDefault(); submit(draft) }}>
        <label htmlFor="chat-input" className="sr-only">Your question</label>
        <textarea
          id="chat-input" rows={2} maxLength={MAX_CHARS} value={draft}
          onChange={(e) => setDraft(e.target.value)} onKeyDown={onKeyDown}
          placeholder="e.g. Is a 3-seater sofa too big for this room?"
          className="min-h-[2.75rem] flex-1 resize-y rounded-xl border border-line bg-white px-3 py-2 text-sm"
        />
        <Button type="submit" disabled={pending || !draft.trim()} aria-label="Send question">
          <Send aria-hidden="true" className="h-4 w-4" />
        </Button>
      </form>
    </Card>
  )
}
