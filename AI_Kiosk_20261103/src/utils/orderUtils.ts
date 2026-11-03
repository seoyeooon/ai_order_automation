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
  manualOverrides: Record<string, number>
): ExpandedBomItem[] {
  const partMap = new Map<string, ExpandedBomItem>()

  for (const item of order.items) {
    if (item.quantity <= 0) continue
    const matchedModel = models.find((m) => m.modelCode === item.modelCode)
    if (!matchedModel) continue

    for (const part of matchedModel.bom) {
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

  const result: ExpandedBomItem[] = []
  for (const [, part] of partMap.entries()) {
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
    const list = supplierMap.get(item.supplierId) || []
    list.push(item)
    supplierMap.set(item.supplierId, list)
  }

  const datePrefix = order.orderDate.replace(/-/g, '') || '20261103'
  const pos: GeneratedPurchaseOrder[] = []
  let idx = 1

  for (const [supplierId, items] of supplierMap.entries()) {
    const first = items[0]
    const maxLeadDays = Math.max(...items.map((i) => i.leadTimeDays))
    const baseDate = new Date(order.orderDate || '2026-11-03')
    baseDate.setDate(baseDate.getDate() + maxLeadDays)
    const reqDateStr = baseDate.toISOString().slice(0, 10)

    const totalItemTypes = items.length
    const totalOrderQty = items.reduce((sum, i) => sum + i.adjustedOrderQty, 0)
    const poNumber = `PO-${datePrefix}-${String(idx).padStart(2, '0')}`
    const cleanSupplier = first.supplierName.replace(/[()주\s]/g, '')
    const fileName = `${poNumber}_매입발주서_${cleanSupplier}.csv`

    pos.push({
      poNumber,
      supplierId,
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
      fileName,
      status: downloadedMap[poNumber] || 'READY',
    })
    idx++
  }

  return pos
}

export function downloadPurchaseOrderCsv(
  po: GeneratedPurchaseOrder,
  clientOrder: ClientOrder
): void {
  const rows: string[][] = [
    ['[구매발주서 (PURCHASE ORDER)]', '', '', '', '', '', '', ''],
    ['발주번호', po.poNumber, '발주일자', po.issueDate, '납기요청일', po.requestedDeliveryDate, '', ''],
    ['수신처(공급사)', po.supplierName, '사업자번호', po.supplierBizNo, '담당자', po.supplierManager, '연락처', po.supplierPhone],
    ['연계 수주번호', clientOrder.orderNo, '발주 고객사', clientOrder.clientName, '입고장소', po.deliveryPlace, '', ''],
    [''],
    ['No', '부품코드', '부품명', '카테고리', '규격/사양', '적용 키오스크 모델', '단위', '발주수량'],
  ]

  po.items.forEach((item, index) => {
    const modelsText = item.sourceModels
      .map((m) => `${m.modelCode}(${m.orderQty}대→${m.subTotalQty}${item.unit})`)
      .join(' / ')
    rows.push([
      String(index + 1),
      item.partCode,
      item.partName,
      item.category,
      item.spec,
      modelsText,
      item.unit,
      String(item.adjustedOrderQty),
    ])
  })

  rows.push([''])
  rows.push(['', '', '', '', '', '발주 품목 종수', `${po.totalItemTypes}종`, ''])
  rows.push(['', '', '', '', '', '총 발주 수량 합계', '', String(po.totalOrderQty)])

  const csvContent =
    '\uFEFF' +
    rows
      .map((row) =>
        row
          .map((cell) => `"${String(cell ?? '').replace(/"/g, '""')}"`)
          .join(',')
      )
      .join('\r\n')

  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.setAttribute('download', po.fileName)
  document.body.appendChild(link)
  link.click()
  document.body.removeChild(link)
  URL.revokeObjectURL(url)
}
