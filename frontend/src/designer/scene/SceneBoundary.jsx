import { Component } from 'react'
import { RotateCcw, TriangleAlert } from 'lucide-react'

/**
 * Keeps a 3D failure (a rendering error, or the browser dropping the graphics context) from taking
 * the designer down: the panels keep working and the view can be reloaded. The design is untouched.
 */
export default class SceneBoundary extends Component {
  constructor(props) {
    super(props)
    this.state = { failed: false }
  }

  static getDerivedStateFromError() {
    return { failed: true }
  }

  componentDidCatch(error) {
    console.error('3D view failed', error)
  }

  render() {
    const { lost, onReload, children } = this.props
    if (!this.state.failed && !lost) return children
    return (
      <div role="alert" className="flex h-full items-center justify-center p-6 text-center">
        <div className="max-w-sm">
          <TriangleAlert aria-hidden="true" className="mx-auto h-8 w-8 text-clay" />
          <p className="mt-2 font-display text-xl font-semibold">The 3D view stopped working</p>
          <p className="mt-1 text-sm text-muted">
            {lost ? 'The browser reset the graphics card connection.' : 'Something went wrong while drawing the room.'} Your design is safe;
            the panels still work.
          </p>
          <button
            type="button"
            onClick={() => {
              this.setState({ failed: false })
              onReload()
            }}
            className="mt-3 inline-flex items-center gap-1.5 rounded-full bg-ink px-4 py-2 text-sm font-semibold text-cream"
          >
            <RotateCcw aria-hidden="true" className="h-4 w-4" /> Reload 3D view
          </button>
        </div>
      </div>
    )
  }
}
