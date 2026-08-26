import { sceneById, SCENES } from './dev/scenes'

export function App() {
  const params = new URLSearchParams(location.search)
  const scene = sceneById(params.get('scene'))
  const gallery = location.pathname.startsWith('/gallery')

  return (
    <div className="flex h-full flex-col items-center justify-center gap-4">
      <div className="font-mono text-sm" style={{ color: 'var(--text-dim)' }}>
        {gallery ? 'gallery' : scene.id}
      </div>
      <div className="text-2xl">nard — scaffold</div>
      <div className="max-w-md text-center text-sm" style={{ color: 'var(--text-dim)' }}>
        {scene.title} · {SCENES.length} scenes registered
      </div>
    </div>
  )
}
