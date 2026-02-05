'use client'

import { useState, useRef, useEffect, useCallback } from 'react'
import { 
  ArrowRight, Circle, Square, Type, Pencil, Eraser, 
  Undo, Redo, Check, X, Trash2, Minus
} from 'lucide-react'

interface Annotation {
  id: string
  type: 'arrow' | 'circle' | 'rectangle' | 'text' | 'freehand'
  color: string
  strokeWidth: number
  // Arrow
  from?: [number, number]
  to?: [number, number]
  // Circle
  center?: [number, number]
  radius?: number
  // Rectangle
  position?: [number, number]
  width?: number
  height?: number
  // Text
  content?: string
  fontSize?: number
  // Freehand
  points?: Array<[number, number]>
}

interface AnnotationEditorProps {
  imageDataUrl: string
  onSave: (annotatedDataUrl: string, annotations: Annotation[]) => void
  onCancel: () => void
}

type Tool = 'arrow' | 'circle' | 'rectangle' | 'text' | 'freehand' | 'eraser' | 'select'

const COLORS = ['#ef4444', '#f97316', '#eab308', '#22c55e', '#3b82f6', '#8b5cf6', '#ffffff', '#000000']

export default function AnnotationEditor({ imageDataUrl, onSave, onCancel }: AnnotationEditorProps) {
  const [tool, setTool] = useState<Tool>('arrow')
  const [color, setColor] = useState('#ef4444')
  const [strokeWidth, setStrokeWidth] = useState(3)
  const [annotations, setAnnotations] = useState<Annotation[]>([])
  const [undoStack, setUndoStack] = useState<Annotation[][]>([])
  const [redoStack, setRedoStack] = useState<Annotation[][]>([])
  const [isDrawing, setIsDrawing] = useState(false)
  const [currentAnnotation, setCurrentAnnotation] = useState<Annotation | null>(null)
  const [textInput, setTextInput] = useState('')
  const [textPosition, setTextPosition] = useState<[number, number] | null>(null)
  const [imageSize, setImageSize] = useState({ width: 0, height: 0 })
  
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const imageRef = useRef<HTMLImageElement | null>(null)
  const containerRef = useRef<HTMLDivElement>(null)

  // Load image
  useEffect(() => {
    const img = new Image()
    img.onload = () => {
      imageRef.current = img
      
      // Calculate size to fit in container while maintaining aspect ratio
      const maxWidth = window.innerWidth * 0.9 - 100 // Account for toolbar
      const maxHeight = window.innerHeight * 0.8 - 100 // Account for buttons
      
      let width = img.width
      let height = img.height
      
      if (width > maxWidth) {
        height = (maxWidth / width) * height
        width = maxWidth
      }
      if (height > maxHeight) {
        width = (maxHeight / height) * width
        height = maxHeight
      }
      
      setImageSize({ width, height })
    }
    img.src = imageDataUrl
  }, [imageDataUrl])

  // Render canvas
  useEffect(() => {
    const canvas = canvasRef.current
    const ctx = canvas?.getContext('2d')
    if (!canvas || !ctx || !imageRef.current || imageSize.width === 0) return

    canvas.width = imageSize.width
    canvas.height = imageSize.height

    // Draw image
    ctx.drawImage(imageRef.current, 0, 0, imageSize.width, imageSize.height)

    // Draw annotations
    annotations.forEach(annotation => {
      drawAnnotation(ctx, annotation)
    })

    // Draw current annotation being created
    if (currentAnnotation) {
      drawAnnotation(ctx, currentAnnotation)
    }
  }, [imageSize, annotations, currentAnnotation])

  // Draw a single annotation
  const drawAnnotation = (ctx: CanvasRenderingContext2D, annotation: Annotation) => {
    ctx.strokeStyle = annotation.color
    ctx.fillStyle = annotation.color
    ctx.lineWidth = annotation.strokeWidth
    ctx.lineCap = 'round'
    ctx.lineJoin = 'round'

    switch (annotation.type) {
      case 'arrow':
        if (annotation.from && annotation.to) {
          const [x1, y1] = annotation.from
          const [x2, y2] = annotation.to
          
          // Draw line
          ctx.beginPath()
          ctx.moveTo(x1, y1)
          ctx.lineTo(x2, y2)
          ctx.stroke()
          
          // Draw arrowhead
          const angle = Math.atan2(y2 - y1, x2 - x1)
          const headLength = 15
          ctx.beginPath()
          ctx.moveTo(x2, y2)
          ctx.lineTo(
            x2 - headLength * Math.cos(angle - Math.PI / 6),
            y2 - headLength * Math.sin(angle - Math.PI / 6)
          )
          ctx.lineTo(
            x2 - headLength * Math.cos(angle + Math.PI / 6),
            y2 - headLength * Math.sin(angle + Math.PI / 6)
          )
          ctx.closePath()
          ctx.fill()
        }
        break

      case 'circle':
        if (annotation.center && annotation.radius) {
          ctx.beginPath()
          ctx.arc(annotation.center[0], annotation.center[1], annotation.radius, 0, Math.PI * 2)
          ctx.stroke()
        }
        break

      case 'rectangle':
        if (annotation.position && annotation.width !== undefined && annotation.height !== undefined) {
          ctx.strokeRect(annotation.position[0], annotation.position[1], annotation.width, annotation.height)
        }
        break

      case 'text':
        if (annotation.position && annotation.content) {
          ctx.font = `${annotation.fontSize || 16}px Arial`
          ctx.fillText(annotation.content, annotation.position[0], annotation.position[1])
        }
        break

      case 'freehand':
        if (annotation.points && annotation.points.length > 1) {
          ctx.beginPath()
          ctx.moveTo(annotation.points[0][0], annotation.points[0][1])
          for (let i = 1; i < annotation.points.length; i++) {
            ctx.lineTo(annotation.points[i][0], annotation.points[i][1])
          }
          ctx.stroke()
        }
        break
    }
  }

  // Get mouse position relative to canvas
  const getMousePos = (e: React.MouseEvent<HTMLCanvasElement>): [number, number] => {
    const canvas = canvasRef.current
    if (!canvas) return [0, 0]
    const rect = canvas.getBoundingClientRect()
    return [
      e.clientX - rect.left,
      e.clientY - rect.top
    ]
  }

  // Mouse event handlers
  const handleMouseDown = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const pos = getMousePos(e)
    setIsDrawing(true)

    if (tool === 'text') {
      setTextPosition(pos)
      return
    }

    const newAnnotation: Annotation = {
      id: `annotation-${Date.now()}`,
      type: tool === 'eraser' || tool === 'select' ? 'freehand' : tool,
      color,
      strokeWidth,
    }

    switch (tool) {
      case 'arrow':
        newAnnotation.from = pos
        newAnnotation.to = pos
        break
      case 'circle':
        newAnnotation.center = pos
        newAnnotation.radius = 0
        break
      case 'rectangle':
        newAnnotation.position = pos
        newAnnotation.width = 0
        newAnnotation.height = 0
        break
      case 'freehand':
        newAnnotation.points = [pos]
        break
    }

    setCurrentAnnotation(newAnnotation)
  }

  const handleMouseMove = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!isDrawing || !currentAnnotation || tool === 'text') return

    const pos = getMousePos(e)

    switch (tool) {
      case 'arrow':
        setCurrentAnnotation({ ...currentAnnotation, to: pos })
        break
      case 'circle':
        if (currentAnnotation.center) {
          const dx = pos[0] - currentAnnotation.center[0]
          const dy = pos[1] - currentAnnotation.center[1]
          const radius = Math.sqrt(dx * dx + dy * dy)
          setCurrentAnnotation({ ...currentAnnotation, radius })
        }
        break
      case 'rectangle':
        if (currentAnnotation.position) {
          setCurrentAnnotation({
            ...currentAnnotation,
            width: pos[0] - currentAnnotation.position[0],
            height: pos[1] - currentAnnotation.position[1],
          })
        }
        break
      case 'freehand':
        if (currentAnnotation.points) {
          setCurrentAnnotation({
            ...currentAnnotation,
            points: [...currentAnnotation.points, pos],
          })
        }
        break
    }
  }

  const handleMouseUp = () => {
    if (!isDrawing) return
    setIsDrawing(false)

    if (currentAnnotation && tool !== 'text') {
      // Save to undo stack
      setUndoStack(prev => [...prev, annotations])
      setRedoStack([])
      setAnnotations(prev => [...prev, currentAnnotation])
      setCurrentAnnotation(null)
    }
  }

  // Text input handlers
  const handleTextSubmit = () => {
    if (!textPosition || !textInput.trim()) {
      setTextPosition(null)
      setTextInput('')
      return
    }

    const newAnnotation: Annotation = {
      id: `annotation-${Date.now()}`,
      type: 'text',
      color,
      strokeWidth,
      position: textPosition,
      content: textInput.trim(),
      fontSize: 20,
    }

    setUndoStack(prev => [...prev, annotations])
    setRedoStack([])
    setAnnotations(prev => [...prev, newAnnotation])
    setTextPosition(null)
    setTextInput('')
  }

  // Undo/Redo
  const undo = () => {
    if (undoStack.length === 0) return
    const previousState = undoStack[undoStack.length - 1]
    setUndoStack(prev => prev.slice(0, -1))
    setRedoStack(prev => [...prev, annotations])
    setAnnotations(previousState)
  }

  const redo = () => {
    if (redoStack.length === 0) return
    const nextState = redoStack[redoStack.length - 1]
    setRedoStack(prev => prev.slice(0, -1))
    setUndoStack(prev => [...prev, annotations])
    setAnnotations(nextState)
  }

  // Clear all
  const clearAll = () => {
    if (annotations.length > 0) {
      setUndoStack(prev => [...prev, annotations])
      setRedoStack([])
      setAnnotations([])
    }
  }

  // Save annotated image
  const handleSave = () => {
    const canvas = canvasRef.current
    if (!canvas) return
    
    const dataUrl = canvas.toDataURL('image/png')
    onSave(dataUrl, annotations)
  }

  const tools: { id: Tool; icon: typeof ArrowRight; label: string }[] = [
    { id: 'arrow', icon: ArrowRight, label: 'Arrow' },
    { id: 'circle', icon: Circle, label: 'Circle' },
    { id: 'rectangle', icon: Square, label: 'Rectangle' },
    { id: 'text', icon: Type, label: 'Text' },
    { id: 'freehand', icon: Pencil, label: 'Draw' },
  ]

  return (
    <div className="flex flex-col h-full bg-[#0a1f1f]">
      {/* Toolbar */}
      <div className="flex items-center justify-between p-3 bg-[#0d2626] border-b border-[#1a3d3d]">
        <div className="flex items-center gap-2">
          {/* Tool buttons */}
          {tools.map(({ id, icon: Icon, label }) => (
            <button
              key={id}
              onClick={() => setTool(id)}
              className={`p-2 rounded transition-colors ${
                tool === id
                  ? 'bg-teal-600 text-white'
                  : 'bg-[#1a3d3d] text-gray-400 hover:text-white'
              }`}
              title={label}
            >
              <Icon className="w-5 h-5" />
            </button>
          ))}

          <div className="w-px h-6 bg-[#1a3d3d] mx-2" />

          {/* Color picker */}
          <div className="flex items-center gap-1">
            {COLORS.map((c) => (
              <button
                key={c}
                onClick={() => setColor(c)}
                className={`w-6 h-6 rounded-full border-2 transition-transform ${
                  color === c ? 'border-white scale-110' : 'border-transparent'
                }`}
                style={{ backgroundColor: c }}
              />
            ))}
          </div>

          <div className="w-px h-6 bg-[#1a3d3d] mx-2" />

          {/* Stroke width */}
          <div className="flex items-center gap-2">
            <Minus className="w-4 h-4 text-gray-400" />
            <input
              type="range"
              min="1"
              max="10"
              value={strokeWidth}
              onChange={(e) => setStrokeWidth(Number(e.target.value))}
              className="w-20"
            />
            <span className="text-sm text-gray-400 w-4">{strokeWidth}</span>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {/* Undo/Redo */}
          <button
            onClick={undo}
            disabled={undoStack.length === 0}
            className="p-2 rounded bg-[#1a3d3d] text-gray-400 hover:text-white disabled:opacity-50 disabled:cursor-not-allowed"
            title="Undo"
          >
            <Undo className="w-5 h-5" />
          </button>
          <button
            onClick={redo}
            disabled={redoStack.length === 0}
            className="p-2 rounded bg-[#1a3d3d] text-gray-400 hover:text-white disabled:opacity-50 disabled:cursor-not-allowed"
            title="Redo"
          >
            <Redo className="w-5 h-5" />
          </button>
          <button
            onClick={clearAll}
            disabled={annotations.length === 0}
            className="p-2 rounded bg-[#1a3d3d] text-gray-400 hover:text-red-400 disabled:opacity-50 disabled:cursor-not-allowed"
            title="Clear All"
          >
            <Trash2 className="w-5 h-5" />
          </button>
        </div>
      </div>

      {/* Canvas area */}
      <div 
        ref={containerRef}
        className="flex-1 overflow-auto flex items-center justify-center p-4 bg-[#080f0f]"
      >
        <div className="relative">
          <canvas
            ref={canvasRef}
            onMouseDown={handleMouseDown}
            onMouseMove={handleMouseMove}
            onMouseUp={handleMouseUp}
            onMouseLeave={handleMouseUp}
            className="cursor-crosshair rounded shadow-lg"
            style={{ 
              width: imageSize.width, 
              height: imageSize.height,
            }}
          />
          
          {/* Text input overlay */}
          {textPosition && (
            <div
              className="absolute"
              style={{
                left: textPosition[0],
                top: textPosition[1],
              }}
            >
              <input
                type="text"
                value={textInput}
                onChange={(e) => setTextInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') handleTextSubmit()
                  if (e.key === 'Escape') {
                    setTextPosition(null)
                    setTextInput('')
                  }
                }}
                onBlur={handleTextSubmit}
                autoFocus
                className="bg-transparent border-b-2 border-white text-white outline-none min-w-[100px]"
                style={{ 
                  color, 
                  fontSize: '20px',
                  borderColor: color,
                }}
                placeholder="Type text..."
              />
            </div>
          )}
        </div>
      </div>

      {/* Action buttons */}
      <div className="flex items-center justify-between p-3 bg-[#0d2626] border-t border-[#1a3d3d]">
        <button
          onClick={onCancel}
          className="px-4 py-2 bg-[#1a3d3d] hover:bg-[#245454] text-white rounded-lg transition-colors flex items-center gap-2"
        >
          <X className="w-4 h-4" />
          Cancel
        </button>
        <button
          onClick={handleSave}
          className="px-4 py-2 bg-teal-600 hover:bg-teal-700 text-white rounded-lg transition-colors flex items-center gap-2"
        >
          <Check className="w-4 h-4" />
          Save Annotation
        </button>
      </div>
    </div>
  )
}
