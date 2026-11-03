import XLSXStyle from 'xlsx-js-style'
import type {
  ClientOrder,
  ExpandedBomItem,
  GeneratedPurchaseOrder,
  KioskModelMaster,
} from '../types/order'

export function expandBomFromOrder(
  order: ClientOrder,
  models: KioskModelMaster[],
  deductStock: boolean,
  manualOverrides: Record<string, number>,
  customAddedBom: ExpandedBomItem[] = [],
  deletedPartCodes: string[] = [],
  partEdits: Record<string, Partial<ExpandedBomItem>> = {}
): ExpandedBomItem[] {
  const partMap = new Map<string, ExpandedBomItem>()

  for (const item of order.items) {
    if (item.quantity <= 0) continue
    const matchedModel = models.find((m) => m.modelCode === item.modelCode)
    if (!matchedModel) continue

    for (const part of matchedModel.bom) {
      if (deletedPartCodes.includes(part.partCode)) continue

      const subTotalQty = part.qtyPerUnit * item.quantity
      const existing = partMap.get(part.partCode)

      if (existing) {
        existing.grossRequiredQty += subTotalQty
        existing.sourceModels.push({
          modelCode: matchedModel.modelCode,
          modelName: matchedModel.modelName,
          orderQty: item.quantity,
          subTotalQty,
        })
      } else {
        partMap.set(part.partCode, {
          ...part,
          sourceModels: [
            {
              modelCode: matchedModel.modelCode,
              modelName: matchedModel.modelName,
              orderQty: item.quantity,
              subTotalQty,
            },
          ],
          grossRequiredQty: subTotalQty,
          netOrderQty: 0,
          adjustedOrderQty: 0,
        })
      }
    }
  }

  for (const customPart of customAddedBom) {
    if (deletedPartCodes.includes(customPart.partCode)) continue
    partMap.set(customPart.partCode, { ...customPart })
  }

  const result: ExpandedBomItem[] = []
  for (const [, rawPart] of partMap.entries()) {
    const edits = partEdits[rawPart.partCode] || {}
    const part: ExpandedBomItem = { ...rawPart, ...edits }

    const netQty = deductStock
      ? Math.max(0, part.grossRequiredQty - part.stockQty)
      : part.grossRequiredQty
    const finalQty =
      manualOverrides[part.partCode] !== undefined
        ? manualOverrides[part.partCode]
        : netQty

    part.netOrderQty = netQty
    part.adjustedOrderQty = finalQty
    result.push(part)
  }

  return result
}

export function generatePurchaseOrders(
  order: ClientOrder,
  expandedBom: ExpandedBomItem[],
  downloadedMap: Record<string, 'READY' | 'DOWNLOADED' | 'SENT'>
): GeneratedPurchaseOrder[] {
  const supplierMap = new Map<string, ExpandedBomItem[]>()

  for (const item of expandedBom) {
    if (item.adjustedOrderQty <= 0) continue
    const key = item.supplierName.trim() || item.supplierId
    const list = supplierMap.get(key) || []
    list.push(item)
    supplierMap.set(key, list)
  }

  const datePrefix = order.orderDate.replace(/-/g, '') || '20261103'
  const pos: GeneratedPurchaseOrder[] = []
  let idx = 1

  for (const [, items] of supplierMap.entries()) {
    const first = items[0]
    const maxLeadDays = Math.max(...items.map((i) => i.leadTimeDays || 3))
    const baseDate = new Date(order.orderDate || '2026-11-03')
    baseDate.setDate(baseDate.getDate() + maxLeadDays)
    const reqDateStr = baseDate.toISOString().slice(0, 10)

    const totalItemTypes = items.length
    const totalOrderQty = items.reduce((sum, i) => sum + i.adjustedOrderQty, 0)
    const poNumber = `PO-${datePrefix}-${String(idx).padStart(2, '0')}`
    const cleanSupplier = first.supplierName.replace(/[()주\s]/g, '')
    const baseFileName = `${poNumber}_매입발주서_${cleanSupplier}`

    pos.push({
      poNumber,
      supplierId: first.supplierId,
      supplierName: first.supplierName,
      supplierBizNo: first.supplierBizNo,
      supplierManager: first.supplierManager,
      supplierPhone: first.supplierPhone,
      supplierEmail: first.supplierEmail,
      issueDate: order.orderDate || '2026-11-03',
      requestedDeliveryDate: reqDateStr,
      deliveryPlace: '당사 제1공장 자재입고장 (경기도 화성시 동탄산단 8길 21)',
      items,
      totalItemTypes,
      totalOrderQty,
      pdfFileName: `${baseFileName}.pdf`,
      excelFileName: `${baseFileName}.xlsx`,
      status: downloadedMap[poNumber] || 'READY',
    })
    idx++
  }

  return pos
}

/**
 * Generates a richly styled official Purchase Order Excel (.xlsx) workbook
 * matching the exact layout and design of the PDF/Preview form.
 */
export function downloadPurchaseOrderCsv(
  po: GeneratedPurchaseOrder,
  clientOrder: ClientOrder
): void {
  const thinBorder = {
    top: { style: 'thin', color: { rgb: 'CBD5E1' } },
    bottom: { style: 'thin', color: { rgb: 'CBD5E1' } },
    left: { style: 'thin', color: { rgb: 'CBD5E1' } },
    right: { style: 'thin', color: { rgb: 'CBD5E1' } },
  }
  const darkBorder = {
    top: { style: 'medium', color: { rgb: '1E293B' } },
    bottom: { style: 'medium', color: { rgb: '1E293B' } },
    left: { style: 'thin', color: { rgb: 'CBD5E1' } },
    right: { style: 'thin', color: { rgb: 'CBD5E1' } },
  }

  type CellObj = {
    v: string | number
    t?: 's' | 'n'
    s?: Record<string, unknown>
  }

  const emptyCell = (style: Record<string, unknown> = { border: thinBorder }): CellObj => ({
    v: '',
    t: 's',
    s: style,
  })

  const rows: CellObj[][] = []
  const merges: { s: { r: number; c: number }; e: { r: number; c: number } }[] = []

  // Row 0: Top Accent Banner (A1:H1)
  const bannerStyle = {
    fill: { fgColor: { rgb: '4F46E5' } },
    font: { name: '맑은 고딕', sz: 10, bold: true, color: { rgb: 'FFFFFF' } },
    alignment: { horizontal: 'center', vertical: 'center' },
  }
  rows.push([
    {
      v: 'OFFICIAL PURCHASE ORDER  ·  AI 기반 키오스크 매출·매입 발주 자동화 시스템',
      t: 's',
      s: bannerStyle,
    },
    emptyCell(bannerStyle),
    emptyCell(bannerStyle),
    emptyCell(bannerStyle),
    emptyCell(bannerStyle),
    emptyCell(bannerStyle),
    emptyCell(bannerStyle),
    emptyCell(bannerStyle),
  ])
  merges.push({ s: { r: 0, c: 0 }, e: { r: 0, c: 7 } })

  // Row 1 & Row 2: Title (A2:D3) + Approval Box (E2:H3)
  const titleStyle = {
    font: { name: '맑은 고딕', sz: 22, bold: true, color: { rgb: '0F172A' } },
    alignment: { horizontal: 'left', vertical: 'center' },
  }
  const apprSideStyle = {
    fill: { fgColor: { rgb: 'E2E8F0' } },
    font: { name: '맑은 고딕', sz: 10, bold: true, color: { rgb: '1E293B' } },
    alignment: { horizontal: 'center', vertical: 'center', wrapText: true },
    border: thinBorder,
  }
  const apprHeaderStyle = {
    fill: { fgColor: { rgb: 'F1F5F9' } },
    font: { name: '맑은 고딕', sz: 10, bold: true, color: { rgb: '334155' } },
    alignment: { horizontal: 'center', vertical: 'center' },
    border: thinBorder,
  }
  const apprValStyle = {
    fill: { fgColor: { rgb: 'FFFFFF' } },
    font: { name: '맑은 고딕', sz: 10, bold: true, color: { rgb: '4338CA' } },
    alignment: { horizontal: 'center', vertical: 'center', wrapText: true },
    border: thinBorder,
  }
  const apprStampStyle = {
    fill: { fgColor: { rgb: 'FFF1F2' } },
    font: { name: '맑은 고딕', sz: 10, bold: true, color: { rgb: 'E11D48' } },
    alignment: { horizontal: 'center', vertical: 'center', wrapText: true },
    border: thinBorder,
  }

  rows.push([
    { v: '구 매 발 주 서', t: 's', s: titleStyle },
    emptyCell({}),
    emptyCell({}),
    emptyCell({}),
    { v: '결\n재', t: 's', s: apprSideStyle },
    { v: '담 당', t: 's', s: apprHeaderStyle },
    { v: '검 토', t: 's', s: apprHeaderStyle },
    { v: '승 인', t: 's', s: apprHeaderStyle },
  ])
  rows.push([
    emptyCell({}),
    emptyCell({}),
    emptyCell({}),
    emptyCell({}),
    emptyCell(apprSideStyle),
    { v: `AI자동발주\n(${po.issueDate.slice(5)})`, t: 's', s: apprValStyle },
    { v: '구매팀장\n(승인필)', t: 's', s: apprValStyle },
    { v: '대표이사\n(법인인감 날인필)', t: 's', s: apprStampStyle },
  ])
  merges.push({ s: { r: 1, c: 0 }, e: { r: 2, c: 3 } })
  merges.push({ s: { r: 1, c: 4 }, e: { r: 2, c: 4 } })

  // Row 3: Blank spacer
  rows.push(Array.from({ length: 8 }, () => emptyCell({})))

  // Row 4: Document Meta Row (발주번호 / 발주일자 / 납기요청일)
  const metaLabelStyle = {
    fill: { fgColor: { rgb: 'EEF2FF' } },
    font: { name: '맑은 고딕', sz: 10, bold: true, color: { rgb: '312E81' } },
    alignment: { horizontal: 'center', vertical: 'center' },
    border: thinBorder,
  }
  const metaValStyle = {
    fill: { fgColor: { rgb: 'FFFFFF' } },
    font: { name: '맑은 고딕', sz: 11, bold: true, color: { rgb: '0F172A' } },
    alignment: { horizontal: 'center', vertical: 'center' },
    border: thinBorder,
  }
  const metaDueStyle = {
    fill: { fgColor: { rgb: 'FFFFFF' } },
    font: { name: '맑은 고딕', sz: 11, bold: true, color: { rgb: '4338CA' } },
    alignment: { horizontal: 'center', vertical: 'center' },
    border: thinBorder,
  }

  rows.push([
    { v: '발주번호', t: 's', s: metaLabelStyle },
    { v: po.poNumber, t: 's', s: metaValStyle },
    emptyCell(metaValStyle),
    { v: '발주일자', t: 's', s: metaLabelStyle },
    { v: po.issueDate, t: 's', s: metaValStyle },
    { v: '입고 납기요청일', t: 's', s: metaLabelStyle },
    { v: po.requestedDeliveryDate, t: 's', s: metaDueStyle },
    emptyCell(metaDueStyle),
  ])
  merges.push({ s: { r: 4, c: 1 }, e: { r: 4, c: 2 } })
  merges.push({ s: { r: 4, c: 6 }, e: { r: 4, c: 7 } })

  // Row 5: Blank spacer
  rows.push(Array.from({ length: 8 }, () => emptyCell({})))

  // Row 6: Party Section Headers (수신처 vs 발신처)
  const leftSecHdr = {
    fill: { fgColor: { rgb: '4338CA' } },
    font: { name: '맑은 고딕', sz: 11, bold: true, color: { rgb: 'FFFFFF' } },
    alignment: { horizontal: 'left', vertical: 'center' },
    border: thinBorder,
  }
  const rightSecHdr = {
    fill: { fgColor: { rgb: '1E293B' } },
    font: { name: '맑은 고딕', sz: 11, bold: true, color: { rgb: 'FFFFFF' } },
    alignment: { horizontal: 'left', vertical: 'center' },
    border: thinBorder,
  }
  rows.push([
    { v: '  ■ 수신처 (공급사 / 매입 발주처)', t: 's', s: leftSecHdr },
    emptyCell(leftSecHdr),
    emptyCell(leftSecHdr),
    emptyCell(leftSecHdr),
    { v: '  ■ 발신처 (발주 기업)', t: 's', s: rightSecHdr },
    emptyCell(rightSecHdr),
    emptyCell(rightSecHdr),
    emptyCell(rightSecHdr),
  ])
  merges.push({ s: { r: 6, c: 0 }, e: { r: 6, c: 3 } })
  merges.push({ s: { r: 6, c: 4 }, e: { r: 6, c: 7 } })

  // Rows 7..10: Party Details
  const fieldLblStyle = {
    fill: { fgColor: { rgb: 'F8FAFC' } },
    font: { name: '맑은 고딕', sz: 10, bold: true, color: { rgb: '475569' } },
    alignment: { horizontal: 'center', vertical: 'center' },
    border: thinBorder,
  }
  const fieldValBoldStyle = {
    fill: { fgColor: { rgb: 'FFFFFF' } },
    font: { name: '맑은 고딕', sz: 11, bold: true, color: { rgb: '0F172A' } },
    alignment: { horizontal: 'left', vertical: 'center' },
    border: thinBorder,
  }
  const fieldValStyle = {
    fill: { fgColor: { rgb: 'FFFFFF' } },
    font: { name: '맑은 고딕', sz: 10, color: { rgb: '1E293B' } },
    alignment: { horizontal: 'left', vertical: 'center' },
    border: thinBorder,
  }

  const partyRows: [string, string, string, string, boolean][] = [
    [
      '상 호 (법인명)',
      ` ${po.supplierName} 귀하`,
      '상 호 (법인명)',
      ' (주)에이아이키오스크 테크놀로지 (인)',
      true,
    ],
    [
      '사업자등록번호',
      ` ${po.supplierBizNo}`,
      '사업자등록번호',
      ' 129-86-77012',
      false,
    ],
    [
      '담당자 / 연락처',
      ` ${po.supplierManager} (${po.supplierPhone})`,
      '입 고 장 소',
      ` ${po.deliveryPlace}`,
      false,
    ],
    [
      '수신 이메일',
      ` ${po.supplierEmail}`,
      '연계 수주처',
      ` ${clientOrder.clientName} (${clientOrder.orderNo})`,
      false,
    ],
  ]

  partyRows.forEach(([lLbl, lVal, rLbl, rVal, isBold], idx) => {
    const rIndex = 7 + idx
    const vStyle = isBold ? fieldValBoldStyle : fieldValStyle
    rows.push([
      { v: lLbl, t: 's', s: fieldLblStyle },
      { v: lVal, t: 's', s: vStyle },
      emptyCell(vStyle),
      emptyCell(vStyle),
      { v: rLbl, t: 's', s: fieldLblStyle },
      { v: rVal, t: 's', s: vStyle },
      emptyCell(vStyle),
      emptyCell(vStyle),
    ])
    merges.push({ s: { r: rIndex, c: 1 }, e: { r: rIndex, c: 3 } })
    merges.push({ s: { r: rIndex, c: 5 }, e: { r: rIndex, c: 7 } })
  })

  // Row 11: Blank spacer
  rows.push(Array.from({ length: 8 }, () => emptyCell({})))

  // Row 12: Summary Strip
  const sumLeftStyle = {
    fill: { fgColor: { rgb: 'EEF2FF' } },
    font: { name: '맑은 고딕', sz: 10, bold: true, color: { rgb: '1E1B4B' } },
    alignment: { horizontal: 'left', vertical: 'center' },
    border: thinBorder,
  }
  const sumRightStyle = {
    fill: { fgColor: { rgb: 'EEF2FF' } },
    font: { name: '맑은 고딕', sz: 11, bold: true, color: { rgb: '4338CA' } },
    alignment: { horizontal: 'right', vertical: 'center' },
    border: thinBorder,
  }
  rows.push([
    {
      v: '  아래와 같이 키오스크 제조용 자재(BOM)를 발주하오니 납기일 내 납품하여 주시기 바랍니다.',
      t: 's',
      s: sumLeftStyle,
    },
    emptyCell(sumLeftStyle),
    emptyCell(sumLeftStyle),
    emptyCell(sumLeftStyle),
    emptyCell(sumLeftStyle),
    {
      v: `총 발주 품목 ${po.totalItemTypes}종  |  총 발주수량 ${po.totalOrderQty.toLocaleString()} EA·SET  `,
      t: 's',
      s: sumRightStyle,
    },
    emptyCell(sumRightStyle),
    emptyCell(sumRightStyle),
  ])
  merges.push({ s: { r: 12, c: 0 }, e: { r: 12, c: 4 } })
  merges.push({ s: { r: 12, c: 5 }, e: { r: 12, c: 7 } })

  // Row 13: Blank spacer
  rows.push(Array.from({ length: 8 }, () => emptyCell({})))

  // Row 14: Item Table Header
  const tblHeaderStyle = {
    fill: { fgColor: { rgb: '1E293B' } },
    font: { name: '맑은 고딕', sz: 10, bold: true, color: { rgb: 'FFFFFF' } },
    alignment: { horizontal: 'center', vertical: 'center' },
    border: darkBorder,
  }
  rows.push([
    { v: 'No', t: 's', s: tblHeaderStyle },
    { v: '부품코드', t: 's', s: tblHeaderStyle },
    { v: '분류', t: 's', s: tblHeaderStyle },
    { v: '품목명', t: 's', s: tblHeaderStyle },
    { v: '상세 규격 및 사양', t: 's', s: tblHeaderStyle },
    { v: '적용 키오스크 (산출근거)', t: 's', s: tblHeaderStyle },
    { v: '단위', t: 's', s: tblHeaderStyle },
    { v: '발주수량', t: 's', s: tblHeaderStyle },
  ])

  // Item Rows
  const minItemRows = Math.max(po.items.length, 5)
  for (let i = 0; i < minItemRows; i++) {
    const item = po.items[i]
    const rowBg = i % 2 === 1 ? 'F8FAFC' : 'FFFFFF'

    const baseCenter = {
      fill: { fgColor: { rgb: rowBg } },
      font: { name: '맑은 고딕', sz: 10, color: { rgb: '334155' } },
      alignment: { horizontal: 'center', vertical: 'center' },
      border: thinBorder,
    }
    const codeStyle = {
      fill: { fgColor: { rgb: rowBg } },
      font: { name: 'Consolas', sz: 10, bold: true, color: { rgb: '4338CA' } },
      alignment: { horizontal: 'center', vertical: 'center' },
      border: thinBorder,
    }
    const nameStyle = {
      fill: { fgColor: { rgb: rowBg } },
      font: { name: '맑은 고딕', sz: 10, bold: true, color: { rgb: '0F172A' } },
      alignment: { horizontal: 'left', vertical: 'center', wrapText: true },
      border: thinBorder,
    }
    const specStyle = {
      fill: { fgColor: { rgb: rowBg } },
      font: { name: '맑은 고딕', sz: 9, color: { rgb: '475569' } },
      alignment: { horizontal: 'left', vertical: 'center', wrapText: true },
      border: thinBorder,
    }
    const modelStyle = {
      fill: { fgColor: { rgb: rowBg } },
      font: { name: '맑은 고딕', sz: 9, bold: true, color: { rgb: '4F46E5' } },
      alignment: { horizontal: 'left', vertical: 'center', wrapText: true },
      border: thinBorder,
    }
    const qtyStyle = {
      fill: { fgColor: { rgb: rowBg } },
      font: { name: '맑은 고딕', sz: 11, bold: true, color: { rgb: '0F172A' } },
      alignment: { horizontal: 'right', vertical: 'center' },
      numFmt: '#,##0',
      border: thinBorder,
    }

    if (item) {
      const modelsText = item.sourceModels
        .map((m) => `${m.modelCode}(${m.orderQty}대→${m.subTotalQty}${item.unit})`)
        .join(', ')
      rows.push([
        { v: i + 1, t: 'n', s: baseCenter },
        { v: item.partCode, t: 's', s: codeStyle },
        { v: item.category, t: 's', s: baseCenter },
        { v: item.partName, t: 's', s: nameStyle },
        { v: item.spec, t: 's', s: specStyle },
        { v: modelsText, t: 's', s: modelStyle },
        { v: item.unit, t: 's', s: baseCenter },
        { v: item.adjustedOrderQty, t: 'n', s: qtyStyle },
      ])
    } else {
      rows.push([
        { v: i + 1, t: 'n', s: baseCenter },
        { v: '-', t: 's', s: baseCenter },
        { v: '-', t: 's', s: baseCenter },
        { v: '-', t: 's', s: baseCenter },
        { v: '-', t: 's', s: baseCenter },
        { v: '-', t: 's', s: baseCenter },
        { v: '-', t: 's', s: baseCenter },
        { v: '-', t: 's', s: baseCenter },
      ])
    }
  }

  // Total Footer Row
  const totalRowIdx = rows.length
  const totalLblStyle = {
    fill: { fgColor: { rgb: 'F1F5F9' } },
    font: { name: '맑은 고딕', sz: 11, bold: true, color: { rgb: '1E293B' } },
    alignment: { horizontal: 'right', vertical: 'center' },
    border: darkBorder,
  }
  const totalUnitStyle = {
    fill: { fgColor: { rgb: 'F1F5F9' } },
    font: { name: '맑은 고딕', sz: 10, bold: true, color: { rgb: '475569' } },
    alignment: { horizontal: 'center', vertical: 'center' },
    border: darkBorder,
  }
  const totalQtyStyle = {
    fill: { fgColor: { rgb: 'EEF2FF' } },
    font: { name: '맑은 고딕', sz: 12, bold: true, color: { rgb: '4338CA' } },
    alignment: { horizontal: 'right', vertical: 'center' },
    numFmt: '#,##0',
    border: darkBorder,
  }

  rows.push([
    { v: `발주 수량 총 합계 (품목 ${po.totalItemTypes}종)  `, t: 's', s: totalLblStyle },
    emptyCell(totalLblStyle),
    emptyCell(totalLblStyle),
    emptyCell(totalLblStyle),
    emptyCell(totalLblStyle),
    emptyCell(totalLblStyle),
    { v: '합계', t: 's', s: totalUnitStyle },
    { v: po.totalOrderQty, t: 'n', s: totalQtyStyle },
  ])
  merges.push({ s: { r: totalRowIdx, c: 0 }, e: { r: totalRowIdx, c: 5 } })

  // Blank spacer
  rows.push(Array.from({ length: 8 }, () => emptyCell({})))

  // Notes Rows
  const noteHeaderStyle = {
    fill: { fgColor: { rgb: 'F8FAFC' } },
    font: { name: '맑은 고딕', sz: 10, bold: true, color: { rgb: '1E293B' } },
    alignment: { horizontal: 'left', vertical: 'center' },
    border: thinBorder,
  }
  const noteBodyStyle = {
    fill: { fgColor: { rgb: 'F8FAFC' } },
    font: { name: '맑은 고딕', sz: 9.5, color: { rgb: '475569' } },
    alignment: { horizontal: 'left', vertical: 'center' },
    border: thinBorder,
  }

  const noteLines: [string, Record<string, unknown>][] = [
    ['  ※ [납품 및 검수 유의사항]', noteHeaderStyle],
    [
      `  1. 납품 시 본 발주서 번호(${po.poNumber})가 기재된 거래명세서 및 시험성적서를 동봉하여 주시기 바랍니다.`,
      noteBodyStyle,
    ],
    [
      `  2. 지정된 입고 납기요청일(${po.requestedDeliveryDate})까지 당사 지정 입고장소(${po.deliveryPlace})로 납품 바랍니다.`,
      noteBodyStyle,
    ],
    [
      '  3. 발행시스템: AI 기반 키오스크 매출·매입 발주 자동화 웹 시스템   |   수령 확인 (공급사 인): ________________ (인)',
      noteHeaderStyle,
    ],
  ]

  noteLines.forEach(([text, style]) => {
    const rIdx = rows.length
    rows.push([
      { v: text, t: 's', s: style },
      emptyCell(style),
      emptyCell(style),
      emptyCell(style),
      emptyCell(style),
      emptyCell(style),
      emptyCell(style),
      emptyCell(style),
    ])
    merges.push({ s: { r: rIdx, c: 0 }, e: { r: rIdx, c: 7 } })
  })

  const ws = XLSXStyle.utils.aoa_to_sheet(rows)
  ws['!merges'] = merges
  ws['!cols'] = [
    { wch: 15 }, // A: No / 좌측 라벨
    { wch: 18 }, // B: 부품코드
    { wch: 15 }, // C: 분류
    { wch: 34 }, // D: 품목명
    { wch: 16 }, // E: 상세규격 / 우측 라벨
    { wch: 26 }, // F: 적용 모델
    { wch: 12 }, // G: 단위
    { wch: 16 }, // H: 발주수량
  ]
  ws['!rows'] = rows.map((_, idx) => {
    if (idx === 0) return { hpt: 24 }
    if (idx === 1) return { hpt: 22 }
    if (idx === 2) return { hpt: 34 }
    if (idx === 3 || idx === 5 || idx === 11 || idx === 13) return { hpt: 10 }
    if (idx === 4 || idx === 6 || idx === 12 || idx === 14) return { hpt: 26 }
    if (idx >= 7 && idx <= 10) return { hpt: 23 }
    if (idx === totalRowIdx) return { hpt: 28 }
    return { hpt: 25 }
  })

  const wb = XLSXStyle.utils.book_new()
  XLSXStyle.utils.book_append_sheet(wb, ws, '구매발주서')
  XLSXStyle.writeFile(wb, po.excelFileName)
}

export function openPurchaseOrderPrintOrPdf(
  po: GeneratedPurchaseOrder,
  clientOrder: ClientOrder,
  mode: 'PDF' | 'PRINT'
): void {
  const docTitle = po.pdfFileName.replace(/\.pdf$/i, '')
  const rowsHtml = po.items
    .map(
      (item, idx) => `
      <tr>
        <td class="center">${idx + 1}</td>
        <td class="mono bold indigo">${item.partCode}</td>
        <td class="center"><span class="badge">${item.category}</span></td>
        <td>
          <div class="part-name">${item.partName}</div>
          <div class="part-spec">${item.spec}</div>
        </td>
        <td class="models">${item.sourceModels
          .map((m) => `${m.modelCode}(${m.orderQty}대→${m.subTotalQty}${item.unit})`)
          .join(', ')}</td>
        <td class="center">${item.unit}</td>
        <td class="right qty">${item.adjustedOrderQty.toLocaleString()}</td>
        <td class="center note">정품검수필</td>
      </tr>
    `
    )
    .join('')

  const html = `<!doctype html>
<html lang="ko">
<head>
  <meta charset="UTF-8" />
  <title>${docTitle}</title>
  <style>
    @page { size: A4 portrait; margin: 14mm; }
    * { box-sizing: border-box; font-family: 'Pretendard', 'Malgun Gothic', 'Apple SD Gothic Neo', sans-serif; }
    body { margin: 0; padding: 24px; background: #f8fafc; color: #0f172a; }
    .guide-banner {
      max-width: 820px; margin: 0 auto 16px auto; padding: 12px 18px;
      background: #eef2ff; border: 1px solid #c7d2fe; border-radius: 10px;
      display: flex; align-items: center; justify-content: space-between; font-size: 13px; color: #312e81;
    }
    .guide-banner button {
      background: #4f46e5; color: #fff; border: none; border-radius: 8px;
      padding: 8px 16px; font-weight: 700; cursor: pointer; font-size: 13px;
    }
    .sheet {
      max-width: 820px; margin: 0 auto; background: #ffffff;
      border: 1px solid #cbd5e1; border-radius: 12px; padding: 36px 40px;
      box-shadow: 0 10px 25px rgba(15, 23, 42, 0.06);
    }
    .top-bar {
      height: 6px; background: linear-gradient(90deg, #4f46e5, #7c3aed, #10b981);
      border-radius: 6px; margin-bottom: 24px;
    }
    .header-row {
      display: flex; justify-content: space-between; align-items: flex-start;
      border-bottom: 2px solid #0f172a; padding-bottom: 20px; margin-bottom: 22px;
    }
    .doc-sub { font-size: 11px; font-weight: 800; color: #4f46e5; letter-spacing: 2px; }
    .doc-title { font-size: 32px; font-weight: 900; letter-spacing: 6px; margin: 4px 0 8px 0; color: #0f172a; }
    .doc-meta { font-size: 13px; color: #475569; line-height: 1.6; }
    .doc-meta strong { color: #0f172a; }
    .approval-table { border-collapse: collapse; font-size: 12px; text-align: center; }
    .approval-table th, .approval-table td { border: 1px solid #94a3b8; width: 68px; }
    .approval-table th { background: #f1f5f9; padding: 5px; font-weight: 700; color: #334155; }
    .approval-table td { height: 52px; vertical-align: middle; color: #4f46e5; font-weight: 800; }
    .approval-side { width: 26px !important; background: #e2e8f0 !important; font-weight: 800; }
    .party-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 16px; margin-bottom: 20px; }
    .party-box { border: 1px solid #cbd5e1; border-radius: 10px; padding: 16px; background: #f8fafc; position: relative; }
    .party-tag { font-size: 11px; font-weight: 800; color: #4f46e5; margin-bottom: 6px; display: block; }
    .party-name { font-size: 18px; font-weight: 800; color: #0f172a; margin-bottom: 10px; }
    .party-info { font-size: 12.5px; color: #334155; line-height: 1.65; }
    .stamp {
      position: absolute; top: 16px; right: 16px; width: 52px; height: 52px;
      border: 2.5px solid #e11d48; border-radius: 50%; color: #e11d48;
      font-size: 10px; font-weight: 900; display: flex; align-items: center;
      justify-content: center; text-align: center; line-height: 1.15;
      transform: rotate(-8deg); background: rgba(255, 241, 242, 0.7);
    }
    .summary-strip {
      display: flex; justify-content: space-between; align-items: center;
      background: #eef2ff; border: 1px solid #c7d2fe; border-radius: 10px;
      padding: 12px 18px; margin-bottom: 20px; font-size: 14px;
    }
    .summary-strip strong { color: #4338ca; font-size: 17px; }
    table.items { width: 100%; border-collapse: collapse; font-size: 12.5px; margin-bottom: 20px; }
    table.items th {
      background: #1e293b; color: #ffffff; padding: 10px 8px;
      font-weight: 700; border: 1px solid #1e293b;
    }
    table.items td { padding: 10px 8px; border: 1px solid #cbd5e1; vertical-align: middle; }
    table.items tbody tr:nth-child(even) { background: #f8fafc; }
    table.items tfoot td { background: #f1f5f9; font-weight: 800; padding: 11px 8px; border-top: 2px solid #0f172a; }
    .center { text-align: center; }
    .right { text-align: right; }
    .mono { font-family: Consolas, monospace; }
    .bold { font-weight: 700; }
    .indigo { color: #4338ca; }
    .badge { background: #e2e8f0; color: #334155; padding: 2px 6px; border-radius: 4px; font-size: 11px; font-weight: 600; }
    .part-name { font-weight: 700; color: #0f172a; margin-bottom: 2px; }
    .part-spec { font-size: 11px; color: #64748b; }
    .models { font-size: 11px; color: #4f46e5; font-weight: 600; }
    .qty { font-size: 14px; font-weight: 800; color: #0f172a; }
    .note { font-size: 11px; color: #64748b; }
    .footer-box {
      border: 1px solid #cbd5e1; border-radius: 10px; padding: 14px 16px;
      background: #f8fafc; font-size: 12px; color: #475569; line-height: 1.6;
    }
    .sign-row {
      margin-top: 24px; display: flex; justify-content: space-between; align-items: center;
      font-size: 13px; color: #334155; padding-top: 14px; border-top: 1px dashed #cbd5e1;
    }
    @media print {
      body { background: #fff; padding: 0; }
      .guide-banner { display: none !important; }
      .sheet { box-shadow: none; border: none; padding: 0; max-width: 100%; }
    }
  </style>
</head>
<body>
  <div class="guide-banner">
    <span>
      ${
        mode === 'PDF'
          ? '💡 인쇄 대화상자에서 <strong>[대상(프린터): PDF로 저장]</strong>을 선택하시면 <strong>' +
            po.pdfFileName +
            '</strong> 파일로 즉시 저장됩니다.'
          : '🖨️ 인쇄 미리보기 화면입니다. 프린터를 선택하여 출력하거나 PDF로 저장하실 수 있습니다.'
      }
    </span>
    <button onclick="window.print()">인쇄 / PDF 저장 실행</button>
  </div>

  <div class="sheet">
    <div class="top-bar"></div>
    <div class="header-row">
      <div>
        <div class="doc-sub">PURCHASE ORDER</div>
        <h1 class="doc-title">구 매 발 주 서</h1>
        <div class="doc-meta">
          <div>발주번호: <strong>${po.poNumber}</strong> &nbsp;|&nbsp; 발주일자: <strong>${po.issueDate}</strong></div>
          <div>입고 납기요청일: <strong style="color:#4f46e5;">${po.requestedDeliveryDate}</strong></div>
        </div>
      </div>

      <table class="approval-table">
        <tr>
          <th rowspan="2" class="approval-side">결<br/>재</th>
          <th>담 당</th>
          <th>검 토</th>
          <th>승 인</th>
        </tr>
        <tr>
          <td>AI자동발주<br/><span style="font-size:10px;color:#64748b;">${po.issueDate.slice(5)}</span></td>
          <td>구매팀장<br/>승인필</td>
          <td>대표이사<br/>승인필</td>
        </tr>
      </table>
    </div>

    <div class="party-grid">
      <div class="party-box">
        <span class="party-tag">수신처 (공급사 / 매입 발주처)</span>
        <div class="party-name">${po.supplierName} 귀하</div>
        <div class="party-info">
          <div>• 사업자번호: <strong>${po.supplierBizNo}</strong></div>
          <div>• 담당자: <strong>${po.supplierManager}</strong> (${po.supplierPhone})</div>
          <div>• 이메일: <strong>${po.supplierEmail}</strong></div>
        </div>
      </div>

      <div class="party-box">
        <span class="party-tag">발신처 (발주 기업)</span>
        <div class="party-name">(주)에이아이키오스크 테크놀로지</div>
        <div class="stamp">법인인감<br/>날인필</div>
        <div class="party-info">
          <div>• 사업자번호: <strong>129-86-77012</strong></div>
          <div>• 입고장소: <strong>${po.deliveryPlace}</strong></div>
          <div>• 연계 수주처: <strong>${clientOrder.clientName} (${clientOrder.orderNo})</strong></div>
        </div>
      </div>
    </div>

    <div class="summary-strip">
      <span>아래와 같이 키오스크 제조용 자재(BOM)를 발주하오니 납기일 내 납품하여 주시기 바랍니다.</span>
      <span>총 발주 품목 <strong>${po.totalItemTypes}종</strong> &nbsp;/&nbsp; 총 수량 <strong>${po.totalOrderQty.toLocaleString()} EA·SET</strong></span>
    </div>

    <table class="items">
      <thead>
        <tr>
          <th style="width:38px;">No</th>
          <th style="width:110px;">부품코드</th>
          <th style="width:92px;">분류</th>
          <th>품목명 및 상세 규격</th>
          <th style="width:165px;">적용 모델 (산출근거)</th>
          <th style="width:48px;">단위</th>
          <th style="width:72px;">발주수량</th>
          <th style="width:68px;">비고</th>
        </tr>
      </thead>
      <tbody>
        ${rowsHtml}
      </tbody>
      <tfoot>
        <tr>
          <td colspan="5" class="right">발주 수량 총 합계 (품목 ${po.totalItemTypes}종)</td>
          <td class="center">합계</td>
          <td class="right" style="color:#4338ca;font-size:15px;">${po.totalOrderQty.toLocaleString()}</td>
          <td class="center">-</td>
        </tr>
      </tfoot>
    </table>

    <div class="footer-box">
      <strong>[납품 및 검수 유의사항]</strong><br/>
      1. 납품 시 본 발주서 번호(<strong>${po.poNumber}</strong>)가 기재된 거래명세서 및 시험성적서를 동봉하여 주시기 바랍니다.<br/>
      2. 납기일(<strong>${po.requestedDeliveryDate}</strong>) 준수 요망하며, 일정 변동 사유 발생 시 즉시 당사 구매팀으로 연락 바랍니다.
    </div>

    <div class="sign-row">
      <span>발행시스템: AI 기반 키오스크 매출·매입 발주 자동화 웹 시스템</span>
      <span>수령 확인 (공급사 인): ________________ (인)</span>
    </div>
  </div>

  <script>
    window.onload = function() {
      setTimeout(function() { window.print(); }, 250);
    };
  </script>
</body>
</html>`

  const printWin = window.open('', '_blank', 'width=960,height=880')
  if (printWin) {
    printWin.document.open()
    printWin.document.write(html)
    printWin.document.close()
  }
}
