import TemplatePanel from './TemplatePanel'
import AiLayoutPanel from './AiLayoutPanel'
import VastuPanel from './VastuPanel'
import LayoutScorePanel from './LayoutScorePanel'

/**
 * The Room tab's starting points: templates, AI arrange, the layout score and the Vastu check. Loaded as its own chunk
 * (with the template and AI layout code), so the 3D view can open before it arrives.
 */
export default function RoomStarters({ design, form, photo, onApply, onDialog, onFacing, onFocus }) {
  return (
    <>
      <TemplatePanel design={design} roomType={form.roomType} onApply={onApply} onDialog={onDialog} />
      <AiLayoutPanel design={design} roomType={form.roomType} photo={photo} onApply={onApply} onDialog={onDialog} vastuDefault={form.vastu} onFacing={onFacing} />
      <LayoutScorePanel design={design} roomType={form.roomType} onApply={onApply} onFocus={onFocus} vastuDefault={form.vastu} />
      <VastuPanel design={design} roomType={form.roomType} onFacing={onFacing} onFocus={onFocus} />
    </>
  )
}
