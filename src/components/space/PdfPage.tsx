import { useEffect, useRef, useState, type ReactNode } from 'react'
import type { PdfDocument } from '@/lib/pdf'

interface PdfPageProps {
  pdf: PdfDocument
  pageNumber: number
  // Click position as fractions of the page, so pins land in the same spot at any zoom
  onPageClick?: (x: number, y: number) => void
  children?: ReactNode
}

export function PdfPage({ pdf, pageNumber, onPageClick, children }: PdfPageProps) {
  const wrapperRef = useRef<HTMLDivElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const [width, setWidth] = useState(0)
  const [aspect, setAspect] = useState(1.294)

  useEffect(() => {
    const wrapper = wrapperRef.current
    if (!wrapper) return
    const observer = new ResizeObserver(([entry]) => setWidth(Math.floor(entry.contentRect.width)))
    observer.observe(wrapper)
    return () => observer.disconnect()
  }, [])

  useEffect(() => {
    if (!width) return
    let cancelled = false
    let task: { cancel: () => void } | null = null
    void pdf.getPage(pageNumber).then((page) => {
      if (cancelled || !canvasRef.current) return
      const base = page.getViewport({ scale: 1 })
      const viewport = page.getViewport({ scale: width / base.width })
      const ratio = window.devicePixelRatio || 1
      const canvas = canvasRef.current
      canvas.width = Math.floor(viewport.width * ratio)
      canvas.height = Math.floor(viewport.height * ratio)
      setAspect(viewport.height / viewport.width)
      const render = page.render({
        canvasContext: canvas.getContext('2d')!,
        viewport,
        transform: ratio === 1 ? undefined : [ratio, 0, 0, ratio, 0, 0],
      })
      task = render
      render.promise.catch(() => undefined)
    })
    return () => {
      cancelled = true
      task?.cancel()
    }
  }, [pdf, pageNumber, width])

  function handleClick(event: React.MouseEvent<HTMLDivElement>) {
    if (!onPageClick) return
    const rect = event.currentTarget.getBoundingClientRect()
    const x = (event.clientX - rect.left) / rect.width
    const y = (event.clientY - rect.top) / rect.height
    onPageClick(Math.min(Math.max(x, 0), 1), Math.min(Math.max(y, 0), 1))
  }

  return (
    <div ref={wrapperRef} className="w-full">
      <div
        className={`relative w-full overflow-hidden rounded-lg border border-border bg-white shadow-sm ${onPageClick ? 'cursor-crosshair' : ''}`}
        style={{ aspectRatio: `1 / ${aspect}` }}
        onClick={handleClick}
      >
        <canvas ref={canvasRef} className="absolute inset-0 size-full" />
        {children}
      </div>
    </div>
  )
}
