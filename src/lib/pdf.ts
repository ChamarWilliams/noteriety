import { GlobalWorkerOptions, getDocument } from 'pdfjs-dist'
import type { PDFDocumentProxy } from 'pdfjs-dist'
import workerUrl from 'pdfjs-dist/build/pdf.worker.min.mjs?url'

GlobalWorkerOptions.workerSrc = workerUrl

export type PdfDocument = PDFDocumentProxy

export async function openPdf(blob: Blob): Promise<PdfDocument> {
  const data = new Uint8Array(await blob.arrayBuffer())
  // Scripting stays off: the viewer only draws pages
  return getDocument({ data, isEvalSupported: false, enableXfa: false }).promise
}
