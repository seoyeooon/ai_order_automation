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
          totalAmount: 0,
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
    part.totalAmount = finalQty * part.unitCost
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

    const supplyAmount = items.reduce((sum, i) => sum + i.totalAmount, 0)
    const vatAmount = Math.round(supplyAmount * 0.1)
    const totalAmount = supplyAmount + vatAmount
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
      supplyAmount,
      vatAmount,
      totalAmount,
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
    ['No', '부품코드', '부품명', '카테고리', '규격/사양', '단위', '발주수량', '단가(원)', '공급가액(원)'],
  ]

  po.items.forEach((item, index) => {
    rows.push([
      String(index + 1),
      item.partCode,
      item.partName,
      item.category,
      item.spec,
      item.unit,
      String(item.adjustedOrderQty),
      String(item.unitCost),
      String(item.totalAmount),
    ])
  })

  rows.push([''])
  rows.push(['', '', '', '', '', '', '공급가액 합계', '', String(po.supplyAmount)])
  rows.push(['', '', '', '', '', '', '부가세 (10%)', '', String(po.vatAmount)])
  rows.push(['', '', '', '', '', '', '총 발주금액 (VAT포함)', '', String(po.totalAmount)])

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

export function formatKRW(amount: number): string {
  return new Intl.NumberFormat('ko-KR').format(amount) + '원'
}
