export interface OrderItem {
  id: string
  modelCode: string
  modelName: string
  spec: string
  quantity: number
}

export interface ClientOrder {
  orderNo: string
  clientName: string
  businessNo: string
  managerName: string
  managerPhone: string
  managerEmail: string
  orderDate: string
  deliveryDate: string
  deliveryAddress: string
  notes: string
  confidenceScore: number
  sourceFileName: string
  items: OrderItem[]
}

export type PartCategory =
  | '디스플레이/터치'
  | '메인보드/PC'
  | '결제/리더기'
  | '프린터/스캐너'
  | '함체/기구물'
  | '전원/케이블'

export interface PartnerCompany {
  id: string
  type: 'CLIENT' | 'SUPPLIER'
  name: string
  bizNo: string
  manager: string
  phone: string
  email: string
  address: string
  leadTimeDays: number
}

export interface BomPart {
  partCode: string
  partName: string
  category: PartCategory
  spec: string
  unit: string
  qtyPerUnit: number
  stockQty: number
  supplierId: string
  supplierName: string
  supplierBizNo: string
  supplierManager: string
  supplierPhone: string
  supplierEmail: string
  leadTimeDays: number
}

export interface KioskModelMaster {
  modelCode: string
  modelName: string
  spec: string
  bom: BomPart[]
}

export interface ExpandedBomItem extends BomPart {
  sourceModels: { modelCode: string; modelName: string; orderQty: number; subTotalQty: number }[]
  grossRequiredQty: number
  netOrderQty: number
  adjustedOrderQty: number
}

export interface GeneratedPurchaseOrder {
  poNumber: string
  supplierId: string
  supplierName: string
  supplierBizNo: string
  supplierManager: string
  supplierPhone: string
  supplierEmail: string
  issueDate: string
  requestedDeliveryDate: string
  deliveryPlace: string
  items: ExpandedBomItem[]
  totalItemTypes: number
  totalOrderQty: number
  pdfFileName: string
  excelFileName: string
  status: 'READY' | 'DOWNLOADED' | 'SENT'
}

export interface InventoryLogItem {
  id: string
  timestamp: string
  type: 'IN' | 'OUT' | 'ADJUST'
  partCode: string
  partName: string
  changeQty: number
  afterStockQty: number
  unit: string
  note: string
}

