/** Whether this browser can create a WebGL context. Checked once, before the 3D scene loads. */
export function hasWebGL() {
  try {
    const canvas = document.createElement('canvas')
    const gl = canvas.getContext('webgl2') || canvas.getContext('webgl')
    gl?.getExtension('WEBGL_lose_context')?.loseContext()
    return !!gl
  } catch {
    return false
  }
}
