// @build-manifest: Read src/lib/system-manifest/index.ts BEFORE modifying this file.
// @see CONTRIBUTING.md for mandatory development rules.
'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import { 
  MousePointer2, Pencil, Circle, Square, ArrowRight, Type, 
  Highlighter, Sparkles, Undo, Trash2, Palette, X,
  Volume2, VolumeX, Zap, Target, Hand
} from 'lucide-react'

interface RecordingOverlayProps {
  isRecording: boolean
  onClose?: () => void
}

interface DrawingPoint {
  x: number
  y: number
}

interface DrawingPath {
  id: string
  points: DrawingPoint[]
  color: string
  width: number
  tool: string
}

interface ClickEffect {
  id: string
  x: number
  y: number
  timestamp: number
}

// Sound effects as base64 (short, simple sounds)
const SOUNDS = {
  click: 'data:audio/wav;base64,UklGRhQFAABXQVZFZm10IBAAAAABAAEARKwAAIhYAQACABAAZGF0YQAEAAB/f39/f39/f39/gICAgICBgYGBgoKCg4ODhISFhYaGh4eIiImJioqLi4yMjY2Ojo+PkJCRkZKSk5OUlJWVlpaXl5iYmZmampubm5ycnZ2enp+foKChoaKio6OkpKWlpqanp6ioqamqqqqrrKytra6ur6+wsLGxsrKzs7S0tbW2tre3uLi5ubq6u7u8vL29vr6/v8DAwcHCwsPDxMTFxcbGx8fIyMnJysrLy8zMzc3Ozs/P0NDR0dLS09PU1NXV1tbX19jY2dna2tvb3Nzd3d7e39/g4OHh4uLj4+Tk5eXm5ufn6Ojp6err7Ozt7e7u7+/w8PHx8vLz8/T09fX29vf3+Pj5+fr6+/v8/P39/v7/',
  pop: 'data:audio/wav;base64,UklGRjQCAABXQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YRACAAB/gH+Af4F/gn+Df4R/hX+Gf4d/iH+Jf4p/i3+Mf41/jn+Pf5B/kX+Sf5N/lH+Vf5Z/l3+Yf5l/mn+bf5x/nX+ef59/oH+hf6J/o3+kf6V/pn+nf6h/qX+qf6t/rH+tf65/r3+wf7F/sn+zf7R/tX+2f7d/uH+5f7p/u3+8f71/vn+/f8B/wX/Cf8N/xH/Ff8Z/x3/If8l/yn/Lf8x/zX/Of89/0H/Rf9J/03/Uf9V/1n/Xf9h/2X/af9t/3H/df95/33/gf+F/4n/jf+R/5X/mf+d/6H/pf+p/63/sf+1/7n/vf/B/8X/yf/N/9H/1f/Z/93/4f/l/+n/7f/x//X/+f/9/',
  success: 'data:audio/wav;base64,UklGRoQFAABXQVZFZm10IBAAAAABAAEARKwAAIhYAQACABAAZGF0YWAFAAB/f4CAgYGCgoODhISFhYaGh4eIiImJioqLi4yMjY2Ojo+PkJCRkZKSk5OUlJWVlpaXl5iYmZmampubm5ycnZ2enp+foKChoaKio6OkpKWlpqanp6ioqamqqqqrrKytra6ur6+wsLGxsrKzs7S0tbW2tre3uLi5ubq6u7u8vL29vr6/v8DAwcHCwsPDxMTFxcbGx8fIyMnJysrLy8zMzc3Ozs/P0NDR0dLS09PU1NXV1tbX19jY2dna2tvb3Nzd3d7e39/g4OHh4uLj4+Tk5eXm5ufn6Ojp6err7Ozt7e7u7+/w8PHx8vLz8/T09fX29vf3+Pj5+fr6+/v8/P39/v7//wAA',
  recordStart: 'data:audio/wav;base64,UklGRlQDAABXQVZFZm10IBAAAAABAAEARKwAAIhYAQACABAAZGF0YTADAACAf4B/gH+Bf4J/g3+Ef4V/hn+Hf4h/iX+Kf4t/jH+Nf45/j3+Qf5F/kn+Tf5R/lX+Wf5d/mH+Zf5p/m3+cf51/nn+ff6B/oX+if6N/pH+lf6Z/p3+of6l/qn+rf6x/rX+uf69/sH+xf7J/s3+0f7V/tn+3f7h/uX+6f7t/vH+9f75/v3/Af8F/wn/Df8R/xX/Gf8d/yH/Jf8p/y3/Mf81/zn/Pf9B/0X/Sf9N/1H/Vf9Z/13/Yf9l/2n/bf9x/3X/ef99/4H/hf+J/43/kf+V/5n/nf+h/6X/qf+t/7H/tf+5/73/wf/F/8n/zf/R/9X/2f/d/+H/5f+p/63/sf+1/7n/vf/B/8X/yf/N/9H/1f/Z/93/',
  recordStop: 'data:audio/wav;base64,UklGRlQDAABXQVZFZm10IBAAAAABAAEARKwAAIhYAQACABAAZGF0YTADAADd/9n/1f/R/83/yf/F/8H/vf+5/7X/sf+t/6n/pf+h/53/mf+V/5H/jf+J/4X/gf99/3n/df9x/23/af9l/2H/Xf9Z/1X/Uf9N/0n/Rf9B/z3/Of81/zH/Lf8p/yX/If8d/xn/Ff8R/w3/Cf8F/wH//f75/vX+8f7t/un+5f7h/t3+2f7V/tH+zf7J/sX+wf69/rn+tf6x/q3+qf6l/qH+nf6Z/pX+kf6N/on+hf6B/n3+ef51/nH+bf5p/mX+Yf5d/ln+Vf5R/k3+Sf5F/kH+Pf45/jX+Mf4t/in+Jf4h/h3+Gf4V/hH+Df4J/gX+Af39/fn99f3x/e396f3l/eH93f3Z/dX90f3N/cn9xf3B/',
  message: 'data:audio/wav;base64,UklGRjQEAABXQVZFZm10IBAAAAABAAEARKwAAIhYAQACABAAZGF0YRAEAACAf4GBgoOEhYaHiImKi4yNjo+QkZKTlJWWl5iZmpucnZ6foKGio6SlpqeoqaqrrK2ur7CxsrO0tba3uLm6u7y9vr/AwcLDxMXGx8jJysvMzc7P0NHS09TV1tfY2drb3N3e3+Dh4uPk5ebn6Onq6+zt7u/w8fLz9PX29/j5+vv8/f7/AAAAAP///v38+/r5+Pf29fTz8vHw7+7t7Ovq6ejn5uXk4+Lh4N/e3dzb2tnY19bV1NPS0dDPzs3My8rJyMfGxcTDwsHAv769vLu6ubi3trW0s7KxsK+urayrqqmop6alpKOioaCfnp2cm5qZmJeWlZSTkpGQj46NjIuKiYiHhoWEg4KBgH9+fXx7enl4d3Z1dHNycXBvbm1sa2ppZ2ZlZGNiYWBfXl1cW1pZWFdWVVRTUlFQT05NTEtKSUhHRkVEQ0JBQD8+PTw7Ojk4NzY1NDMyMTAvLi0sKyopKCcmJSQjIiEgHx4dHBsaGRgXFhUUExIREA8ODQwLCgkIBwYFBAMCAQA='
}

export default function RecordingOverlay({ isRecording, onClose }: RecordingOverlayProps) {
  const [activeTool, setActiveTool] = useState<string>('pointer')
  const [isDrawing, setIsDrawing] = useState(false)
  const [paths, setPaths] = useState<DrawingPath[]>([])
  const [currentPath, setCurrentPath] = useState<DrawingPoint[]>([])
  const [selectedColor, setSelectedColor] = useState('#ff0000')
  const [brushSize, setBrushSize] = useState(4)
  const [clickEffects, setClickEffects] = useState<ClickEffect[]>([])
  const [cursorHighlight, setCursorHighlight] = useState({ x: 0, y: 0, visible: false })
  const [soundEnabled, setSoundEnabled] = useState(true)
  const [showColorPicker, setShowColorPicker] = useState(false)
  const [isMinimized, setIsMinimized] = useState(false)
  
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const audioRefs = useRef<{ [key: string]: HTMLAudioElement }>({})

  // Initialize audio elements
  useEffect(() => {
    Object.entries(SOUNDS).forEach(([key, src]) => {
      const audio = new Audio(src)
      audio.volume = 0.3
      audioRefs.current[key] = audio
    })
  }, [])

  // Play sound helper
  const playSound = useCallback((soundName: keyof typeof SOUNDS) => {
    if (!soundEnabled) return
    const audio = audioRefs.current[soundName]
    if (audio) {
      audio.currentTime = 0
      audio.play().catch(() => {})
    }
  }, [soundEnabled])

  // Play start/stop sounds
  useEffect(() => {
    if (isRecording) {
      playSound('recordStart')
    }
  }, [isRecording, playSound])

  // Track mouse movement for cursor highlight
  useEffect(() => {
    if (!isRecording || activeTool !== 'spotlight') return

    const handleMouseMove = (e: MouseEvent) => {
      setCursorHighlight({ x: e.clientX, y: e.clientY, visible: true })
    }

    const handleMouseLeave = () => {
      setCursorHighlight(prev => ({ ...prev, visible: false }))
    }

    window.addEventListener('mousemove', handleMouseMove)
    window.addEventListener('mouseleave', handleMouseLeave)

    return () => {
      window.removeEventListener('mousemove', handleMouseMove)
      window.removeEventListener('mouseleave', handleMouseLeave)
    }
  }, [isRecording, activeTool])

  // Track clicks for effects
  useEffect(() => {
    if (!isRecording) return

    const handleClick = (e: MouseEvent) => {
      playSound('click')
      
      const newEffect: ClickEffect = {
        id: `click-${Date.now()}`,
        x: e.clientX,
        y: e.clientY,
        timestamp: Date.now()
      }
      
      setClickEffects(prev => [...prev, newEffect])
      
      // Remove effect after animation
      setTimeout(() => {
        setClickEffects(prev => prev.filter(ef => ef.id !== newEffect.id))
      }, 600)
    }

    window.addEventListener('click', handleClick)
    return () => window.removeEventListener('click', handleClick)
  }, [isRecording, playSound])

  // Canvas drawing setup
  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return

    canvas.width = window.innerWidth
    canvas.height = window.innerHeight

    const handleResize = () => {
      canvas.width = window.innerWidth
      canvas.height = window.innerHeight
      redrawPaths()
    }

    window.addEventListener('resize', handleResize)
    return () => window.removeEventListener('resize', handleResize)
  }, [])

  // Redraw all paths
  const redrawPaths = useCallback(() => {
    const canvas = canvasRef.current
    const ctx = canvas?.getContext('2d')
    if (!canvas || !ctx) return

    ctx.clearRect(0, 0, canvas.width, canvas.height)

    paths.forEach(path => {
      if (path.points.length < 2) return

      ctx.beginPath()
      ctx.strokeStyle = path.color
      ctx.lineWidth = path.width
      ctx.lineCap = 'round'
      ctx.lineJoin = 'round'

      if (path.tool === 'highlighter') {
        ctx.globalAlpha = 0.4
      } else {
        ctx.globalAlpha = 1
      }

      ctx.moveTo(path.points[0].x, path.points[0].y)
      for (let i = 1; i < path.points.length; i++) {
        ctx.lineTo(path.points[i].x, path.points[i].y)
      }
      ctx.stroke()
      ctx.globalAlpha = 1
    })
  }, [paths])

  useEffect(() => {
    redrawPaths()
  }, [paths, redrawPaths])

  // Drawing handlers
  const handlePointerDown = (e: React.PointerEvent) => {
    if (activeTool === 'pointer' || activeTool === 'spotlight') return
    
    setIsDrawing(true)
    setCurrentPath([{ x: e.clientX, y: e.clientY }])
    playSound('pop')
  }

  const handlePointerMove = (e: React.PointerEvent) => {
    if (!isDrawing) return
    
    setCurrentPath(prev => [...prev, { x: e.clientX, y: e.clientY }])
    
    // Draw current path
    const canvas = canvasRef.current
    const ctx = canvas?.getContext('2d')
    if (!ctx || currentPath.length < 1) return

    ctx.beginPath()
    ctx.strokeStyle = selectedColor
    ctx.lineWidth = activeTool === 'highlighter' ? brushSize * 4 : brushSize
    ctx.lineCap = 'round'
    ctx.globalAlpha = activeTool === 'highlighter' ? 0.4 : 1

    const lastPoint = currentPath[currentPath.length - 1]
    ctx.moveTo(lastPoint.x, lastPoint.y)
    ctx.lineTo(e.clientX, e.clientY)
    ctx.stroke()
    ctx.globalAlpha = 1
  }

  const handlePointerUp = () => {
    if (!isDrawing) return
    
    setIsDrawing(false)
    
    if (currentPath.length > 1) {
      const newPath: DrawingPath = {
        id: `path-${Date.now()}`,
        points: currentPath,
        color: selectedColor,
        width: activeTool === 'highlighter' ? brushSize * 4 : brushSize,
        tool: activeTool
      }
      setPaths(prev => [...prev, newPath])
    }
    
    setCurrentPath([])
  }

  const undoLastPath = () => {
    setPaths(prev => prev.slice(0, -1))
    playSound('pop')
  }

  const clearAllPaths = () => {
    setPaths([])
    playSound('pop')
  }

  const colors = ['#ff0000', '#00ff00', '#0066ff', '#ffff00', '#ff00ff', '#00ffff', '#ffffff', '#000000']
  
  const tools = [
    { id: 'pointer', icon: MousePointer2, label: 'Pointer' },
    { id: 'spotlight', icon: Target, label: 'Spotlight' },
    { id: 'pen', icon: Pencil, label: 'Draw' },
    { id: 'highlighter', icon: Highlighter, label: 'Highlight' },
    { id: 'arrow', icon: ArrowRight, label: 'Arrow' },
  ]

  if (!isRecording) return null

  return (
    <>
      {/* Click effects */}
      {clickEffects.map(effect => (
        <div
          key={effect.id}
          className="fixed pointer-events-none z-[9999]"
          style={{
            left: effect.x - 20,
            top: effect.y - 20,
          }}
        >
          <div className="w-10 h-10 rounded-full border-2 border-teal-400 animate-ping" />
          <div 
            className="absolute inset-0 w-10 h-10 rounded-full bg-teal-400/30 animate-pulse"
            style={{ animationDuration: '0.3s' }}
          />
        </div>
      ))}

      {/* Cursor spotlight */}
      {activeTool === 'spotlight' && cursorHighlight.visible && (
        <div
          className="fixed pointer-events-none z-[9998] rounded-full"
          style={{
            left: cursorHighlight.x - 40,
            top: cursorHighlight.y - 40,
            width: 80,
            height: 80,
            background: 'radial-gradient(circle, rgba(255,255,0,0.3) 0%, transparent 70%)',
            boxShadow: '0 0 30px 10px rgba(255,255,0,0.2)',
          }}
        />
      )}

      {/* Drawing canvas */}
      <canvas
        ref={canvasRef}
        className={`fixed inset-0 z-[9997] ${activeTool !== 'pointer' && activeTool !== 'spotlight' ? 'cursor-crosshair' : 'pointer-events-none'}`}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerLeave={handlePointerUp}
      />

      {/* Recording indicator */}
      <div className="fixed top-4 left-1/2 -translate-x-1/2 z-[9999] flex items-center gap-3 bg-black/80 backdrop-blur-sm px-4 py-2 rounded-full border border-red-500/50">
        <div className="w-3 h-3 bg-red-500 rounded-full animate-pulse" />
        <span className="text-white text-sm font-medium">Recording</span>
        <Sparkles className="w-4 h-4 text-yellow-400 animate-pulse" />
      </div>

      {/* Toolbar */}
      {!isMinimized ? (
        <div className="fixed bottom-8 left-1/2 -translate-x-1/2 z-[9999] flex items-center gap-2 bg-[#0d2626]/95 backdrop-blur-sm px-4 py-3 rounded-2xl border border-[#1a3d3d] shadow-2xl">
          {/* Tools */}
          <div className="flex items-center gap-1 pr-3 border-r border-[#1a3d3d]">
            {tools.map(tool => (
              <button
                key={tool.id}
                onClick={() => {
                  setActiveTool(tool.id)
                  playSound('pop')
                }}
                className={`p-2 rounded-lg transition-all ${
                  activeTool === tool.id 
                    ? 'bg-teal-600 text-white scale-110' 
                    : 'text-gray-400 hover:text-white hover:bg-[#1a3d3d]'
                }`}
                title={tool.label}
              >
                <tool.icon className="w-5 h-5" />
              </button>
            ))}
          </div>

          {/* Colors */}
          <div className="flex items-center gap-1 px-3 border-r border-[#1a3d3d]">
            {colors.slice(0, 4).map(color => (
              <button
                key={color}
                onClick={() => {
                  setSelectedColor(color)
                  playSound('pop')
                }}
                className={`w-6 h-6 rounded-full border-2 transition-transform ${
                  selectedColor === color ? 'scale-125 border-white' : 'border-transparent hover:scale-110'
                }`}
                style={{ backgroundColor: color }}
              />
            ))}
            <button
              onClick={() => setShowColorPicker(!showColorPicker)}
              className="p-1.5 text-gray-400 hover:text-white hover:bg-[#1a3d3d] rounded-lg"
              title="More colors"
            >
              <Palette className="w-4 h-4" />
            </button>
          </div>

          {/* Actions */}
          <div className="flex items-center gap-1 px-3 border-r border-[#1a3d3d]">
            <button
              onClick={undoLastPath}
              disabled={paths.length === 0}
              className="p-2 text-gray-400 hover:text-white hover:bg-[#1a3d3d] rounded-lg disabled:opacity-30 disabled:cursor-not-allowed"
              title="Undo"
            >
              <Undo className="w-5 h-5" />
            </button>
            <button
              onClick={clearAllPaths}
              disabled={paths.length === 0}
              className="p-2 text-gray-400 hover:text-red-400 hover:bg-[#1a3d3d] rounded-lg disabled:opacity-30 disabled:cursor-not-allowed"
              title="Clear all"
            >
              <Trash2 className="w-5 h-5" />
            </button>
          </div>

          {/* Sound toggle */}
          <div className="flex items-center gap-1 pl-1">
            <button
              onClick={() => {
                setSoundEnabled(!soundEnabled)
                playSound('pop')
              }}
              className={`p-2 rounded-lg transition-colors ${
                soundEnabled ? 'text-teal-400 bg-teal-600/20' : 'text-gray-500 hover:text-gray-400'
              }`}
              title={soundEnabled ? 'Mute sounds' : 'Enable sounds'}
            >
              {soundEnabled ? <Volume2 className="w-5 h-5" /> : <VolumeX className="w-5 h-5" />}
            </button>
            
            {/* Minimize toolbar */}
            <button
              onClick={() => setIsMinimized(true)}
              className="p-2 text-gray-400 hover:text-white hover:bg-[#1a3d3d] rounded-lg"
              title="Minimize toolbar"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Color picker dropdown */}
          {showColorPicker && (
            <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 p-2 bg-[#0d2626] border border-[#1a3d3d] rounded-lg shadow-xl">
              <div className="grid grid-cols-4 gap-2">
                {colors.map(color => (
                  <button
                    key={color}
                    onClick={() => {
                      setSelectedColor(color)
                      setShowColorPicker(false)
                      playSound('pop')
                    }}
                    className={`w-8 h-8 rounded-lg border-2 transition-transform hover:scale-110 ${
                      selectedColor === color ? 'border-white' : 'border-transparent'
                    }`}
                    style={{ backgroundColor: color }}
                  />
                ))}
              </div>
              <div className="mt-2 pt-2 border-t border-[#1a3d3d]">
                <label className="text-xs text-gray-400 block mb-1">Brush size</label>
                <input
                  type="range"
                  min="2"
                  max="20"
                  value={brushSize}
                  onChange={(e) => setBrushSize(Number(e.target.value))}
                  className="w-full"
                />
              </div>
            </div>
          )}
        </div>
      ) : (
        /* Minimized toolbar - just a small button */
        <button
          onClick={() => setIsMinimized(false)}
          className="fixed bottom-8 left-1/2 -translate-x-1/2 z-[9999] p-3 bg-[#0d2626]/95 backdrop-blur-sm rounded-full border border-[#1a3d3d] shadow-2xl text-teal-400 hover:text-white hover:bg-teal-600 transition-all"
          title="Show toolbar"
        >
          <Pencil className="w-5 h-5" />
        </button>
      )}

      {/* Keyboard shortcuts hint */}
      <div className="fixed bottom-4 right-4 z-[9998] text-xs text-gray-500 bg-black/50 px-2 py-1 rounded">
        Press ESC to stop recording
      </div>

      {/* Add animation styles */}
      <style jsx global>{`
        @keyframes ripple {
          0% {
            transform: scale(0.5);
            opacity: 1;
          }
          100% {
            transform: scale(2);
            opacity: 0;
          }
        }
        .animate-ripple {
          animation: ripple 0.6s ease-out forwards;
        }
      `}</style>
    </>
  )
}
