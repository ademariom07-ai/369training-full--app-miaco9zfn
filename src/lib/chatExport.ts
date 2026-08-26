import jsPDF from 'jspdf'

// Compute SHA-256 hash using web crypto API
export async function sha256(text: string): Promise<string> {
  const encoder = new TextEncoder()
  const data = encoder.encode(text)
  const hashBuffer = await crypto.subtle.digest('SHA-256', data)
  const hashArray = Array.from(new Uint8Array(hashBuffer))
  return hashArray.map((b) => b.toString(16).padStart(2, '0')).join('')
}

export interface ExportMessageItem {
  id: string
  sender_name: string
  sender_role?: string
  content: string
  created: string
}

export async function exportChatToPdf(params: {
  participants: string[]
  messages: ExportMessageItem[]
  title?: string
}) {
  const { participants, messages, title = 'Histórico Oficial de Atendimento e Mensagens' } = params

  // 1. Build chronological text representation for SHA-256 calculation
  const chronologicalLines = messages.map((m) => {
    const timeStr = new Date(m.created).toISOString()
    return `[${timeStr}] ${m.sender_name}: ${m.content}`
  })
  const fullTextToHash = chronologicalLines.join('\n')
  const sha256Hash = await sha256(fullTextToHash || 'EMPTY_CONVERSATION')

  const nowFormatted = new Date().toLocaleString('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  })

  // 2. Generate PDF using jsPDF
  const doc = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: 'a4',
  })

  const pageWidth = doc.internal.pageSize.getWidth()
  const pageHeight = doc.internal.pageSize.getHeight()
  const margin = 14
  const contentWidth = pageWidth - margin * 2
  let y = margin

  // Header Banner
  doc.setFillColor(24, 24, 24)
  doc.rect(margin, y, contentWidth, 22, 'F')

  doc.setTextColor(212, 175, 55) // Gold #D4AF37
  doc.setFontSize(14)
  doc.setFont('helvetica', 'bold')
  doc.text('369TRAINING — REGISTRO OFICIAL DE COMUNICAÇÃO', margin + 6, y + 8)

  doc.setTextColor(220, 220, 220)
  doc.setFontSize(9)
  doc.setFont('helvetica', 'normal')
  doc.text(`Participantes: ${participants.join('  •  ')}`, margin + 6, y + 14)
  doc.text(`Emissão: ${nowFormatted} (Horário de Brasília)`, margin + 6, y + 18.5)

  y += 28

  // Legal reference notice
  doc.setFillColor(245, 245, 245)
  doc.setDrawColor(200, 200, 200)
  doc.roundedRect(margin, y, contentWidth, 14, 2, 2, 'FD')

  doc.setTextColor(60, 60, 60)
  doc.setFontSize(7.5)
  doc.setFont('helvetica', 'italic')
  const legalText =
    'Documento com validade jurídica conforme Art. 225 do Código de Processo Civil e Medida Provisória 2.200-2/2001. A integridade e inviolabilidade deste registro são garantidas pela assinatura criptográfica SHA-256 no rodapé.'
  const legalLines = doc.splitTextToSize(legalText, contentWidth - 8)
  doc.text(legalLines, margin + 4, y + 5)

  y += 18

  // Section Title
  doc.setTextColor(0, 87, 255)
  doc.setFontSize(11)
  doc.setFont('helvetica', 'bold')
  doc.text(title, margin, y)
  y += 6

  doc.setDrawColor(0, 87, 255)
  doc.setLineWidth(0.5)
  doc.line(margin, y, pageWidth - margin, y)
  y += 6

  // Messages List
  doc.setFontSize(8.5)
  doc.setFont('helvetica', 'normal')

  if (messages.length === 0) {
    doc.setTextColor(120, 120, 120)
    doc.text('Nenhuma mensagem registrada nesta conversa.', margin, y + 4)
    y += 10
  } else {
    for (const msg of messages) {
      if (y > pageHeight - 35) {
        doc.addPage()
        y = margin + 10
      }

      const dateObj = new Date(msg.created)
      const dateStr = dateObj.toLocaleDateString('pt-BR')
      const timeStr = dateObj.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })

      doc.setFont('helvetica', 'bold')
      doc.setTextColor(30, 30, 30)
      doc.text(`${msg.sender_name} [${dateStr} às ${timeStr}]:`, margin, y)
      y += 4

      doc.setFont('helvetica', 'normal')
      doc.setTextColor(70, 70, 70)
      const lines = doc.splitTextToSize(msg.content, contentWidth - 4)
      doc.text(lines, margin + 2, y)
      y += lines.length * 4 + 3

      // Light separator
      doc.setDrawColor(235, 235, 235)
      doc.setLineWidth(0.2)
      doc.line(margin, y - 1.5, pageWidth - margin, y - 1.5)
    }
  }

  // Footer on all pages or last page
  const totalPages = doc.getNumberOfPages()
  for (let i = 1; i <= totalPages; i++) {
    doc.setPage(i)
    doc.setFillColor(250, 250, 250)
    doc.rect(margin, pageHeight - 20, contentWidth, 16, 'F')
    doc.setDrawColor(220, 220, 220)
    doc.setLineWidth(0.3)
    doc.line(margin, pageHeight - 20, pageWidth - margin, pageHeight - 20)

    doc.setTextColor(40, 40, 40)
    doc.setFontSize(7)
    doc.setFont('helvetica', 'bold')
    doc.text(
      `Documento com validade jurídica — Hash SHA-256: ${sha256Hash}`,
      margin + 2,
      pageHeight - 14,
    )

    doc.setFont('helvetica', 'normal')
    doc.setTextColor(100, 100, 100)
    doc.text(
      `Gerado eletronicamente em ${nowFormatted} • Plataforma 369TRAINING • Página ${i} de ${totalPages}`,
      margin + 2,
      pageHeight - 9,
    )
  }

  doc.save(`369training_chat_${Date.now()}.pdf`)
}
