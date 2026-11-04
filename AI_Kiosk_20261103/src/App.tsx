import { useMemo, useRef, useState } from 'react'
import {
  ArrowRight,
  Boxes,
  Building2,
  Check,
  CheckCircle2,
  ClipboardList,
  Cpu,
  Download,
  Edit3,
  Eye,
  FileCheck2,
  FileSpreadsheet,
  FileText,
  History,
  Layers,
  Package,
  PackageCheck,
  Pencil,
  Plus,
  Printer,
  RefreshCw,
  Search,
  Send,
  Trash2,
  UploadCloud,
  UserPlus,
  X,
} from 'lucide-react'
import { PurchaseOrderModal } from './components/PurchaseOrderModal'
import { DEFAULT_CLIENT_ORDER, INITIAL_PARTNERS, KIOSK_MODELS } from './data/mockData'
import type {
  BomPart,
  ClientOrder,
  ExpandedBomItem,
  GeneratedPurchaseOrder,
  InventoryLogItem,
  KioskModelMaster,
  KioskProductStatus,
  PartCategory,
  PartnerCompany,
} from './types/order'
import {
  downloadPurchaseOrderCsv,
  expandBomFromOrder,
  generatePurchaseOrders,
  openPurchaseOrderPrintOrPdf,
} from './utils/orderUtils'
import { parseUploadedOrderDocument } from './utils/documentParser'

type ActiveTab =
  | 'ORDER_INTAKE'
  | 'MATERIAL_ORDER'
  | 'MANAGE_BOM'
  | 'MANAGE_INVENTORY'
  | 'MANAGE_PARTNERS'

const CATEGORIES: ('전체' | PartCategory)[] = [
  '전체',
  '디스플레이/터치',
  '메인보드/PC',
  '결제/리더기',
  '프린터/스캐너',
  '함체/기구물',
  '전원/케이블',
]

const PART_CATEGORIES: PartCategory[] = [
  '디스플레이/터치',
  '메인보드/PC',
  '결제/리더기',
  '프린터/스캐너',
  '함체/기구물',
  '전원/케이블',
]

function formatNowTimestamp(): string {
  const now = new Date()
  const yyyy = now.getFullYear()
  const mm = String(now.getMonth() + 1).padStart(2, '0')
  const dd = String(now.getDate()).padStart(2, '0')
  const hh = String(now.getHours()).padStart(2, '0')
  const mi = String(now.getMinutes()).padStart(2, '0')
  return `${yyyy}-${mm}-${dd} ${hh}:${mi}`
}

function KioskSystemIcon({ className = 'w-10 h-10' }: { className?: string }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 64 64"
      fill="none"
      className={className}
      aria-hidden="true"
    >
      <defs>
        <linearGradient id="kioskBgGrad" x1="0" y1="0" x2="64" y2="64" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="#0E8A5F" />
          <stop offset="100%" stopColor="#09583C" />
        </linearGradient>
        <linearGradient id="kioskScreenGrad" x1="18" y1="12" x2="42" y2="38" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="#ECFDF5" />
          <stop offset="100%" stopColor="#D1FAE5" />
        </linearGradient>
      </defs>
      <rect width="64" height="64" rx="16" fill="url(#kioskBgGrad)" />
      <rect
        x="1.5"
        y="1.5"
        width="61"
        height="61"
        rx="14.5"
        stroke="#6EE7B7"
        strokeOpacity="0.35"
        strokeWidth="1.5"
      />
      {/* Kiosk Stand Body */}
      <rect x="15" y="9" width="28" height="40" rx="4" fill="#FFFFFF" />
      {/* Kiosk Touch Display */}
      <rect x="18" y="12.5" width="22" height="22" rx="2.5" fill="url(#kioskScreenGrad)" />
      {/* Order & BOM Lines on Screen */}
      <rect x="21" y="16" width="10" height="2.2" rx="1.1" fill="#065F46" />
      <rect x="21" y="20.5" width="16" height="2" rx="1" fill="#0E8A5F" />
      <rect x="21" y="24.5" width="13" height="2" rx="1" fill="#0E8A5F" />
      <rect x="21" y="28.5" width="8" height="2.2" rx="1.1" fill="#047857" />
      {/* Card Reader & Dispenser */}
      <rect x="20" y="38" width="10" height="2.2" rx="1.1" fill="#94A3B8" />
      <rect x="33" y="37.5" width="4" height="3.2" rx="1" fill="#0E8A5F" />
      <rect x="20" y="43" width="18" height="2" rx="1" fill="#CBD5E1" />
      {/* Base Stand */}
      <path
        d="M11 49H47C48.1046 49 49 49.8954 49 51V53H9V51C9 49.8954 9.89543 49 11 49Z"
        fill="#D1FAE5"
      />
      {/* Order Approval Check Badge */}
      <circle cx="45" cy="43" r="10.5" fill="#0F2E26" stroke="#FFFFFF" strokeWidth="2.5" />
      <path
        d="M40.5 43.2L43.4 46.1L49.8 39.7"
        stroke="#34D399"
        strokeWidth="2.6"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  )
}

function App() {
  const [isHome, setIsHome] = useState<boolean>(true)
  const [activeTab, setActiveTab] = useState<ActiveTab>('ORDER_INTAKE')
  const [materialSubView, setMaterialSubView] = useState<'ALL' | 'BOM_ONLY' | 'PO_ONLY'>('ALL')
  const logSeqRef = useRef<number>(200)

  // Master states (editable in-app)
  const [partners, setPartners] = useState<PartnerCompany[]>(INITIAL_PARTNERS)
  const [kioskModels, setKioskModels] = useState<KioskModelMaster[]>(KIOSK_MODELS)

  // Order Intake: Client Order state
  const [clientOrder, setClientOrder] = useState<ClientOrder>(DEFAULT_CLIENT_ORDER)
  const [showAddClientForm, setShowAddClientForm] = useState<boolean>(false)
  const [newClientForm, setNewClientForm] = useState({
    name: '',
    bizNo: '',
    manager: '',
    phone: '',
    email: '',
    address: '',
  })

  // File Upload states
  const [isScanning, setIsScanning] = useState<boolean>(false)
  const [uploadedPreviewUrl, setUploadedPreviewUrl] = useState<string | null>(null)
  const [isDragging, setIsDragging] = useState<boolean>(false)
  const fileInputRef = useRef<HTMLInputElement | null>(null)

  // Material Order: BOM Options & CRUD states
  const [deductStock, setDeductStock] = useState<boolean>(true)
  const [selectedCategory, setSelectedCategory] = useState<'전체' | PartCategory>('전체')
  const [manualOverrides, setManualOverrides] = useState<Record<string, number>>({})
  const [customAddedBom, setCustomAddedBom] = useState<ExpandedBomItem[]>([])
  const [deletedPartCodes, setDeletedPartCodes] = useState<string[]>([])
  const [partEdits, setPartEdits] = useState<Record<string, Partial<ExpandedBomItem>>>({})
  const [editingPartCode, setEditingPartCode] = useState<string | null>(null)
  const [showAddBomModal, setShowAddBomModal] = useState<boolean>(false)
  const [newBomPart, setNewBomPart] = useState<{
    partCode: string
    partName: string
    category: PartCategory
    spec: string
    unit: string
    grossRequiredQty: number
    stockQty: number
    supplierId: string
  }>({
    partCode: '',
    partName: '',
    category: '디스플레이/터치',
    spec: '',
    unit: 'EA',
    grossRequiredQty: 10,
    stockQty: 0,
    supplierId: 'SUP-01',
  })

  // PO Modal & Download states
  const [previewPo, setPreviewPo] = useState<GeneratedPurchaseOrder | null>(null)
  const [poStatusMap, setPoStatusMap] = useState<Record<string, 'READY' | 'DOWNLOADED' | 'SENT'>>({})
  const [poReceivedMap, setPoReceivedMap] = useState<Record<string, boolean>>({})

  // Warehouse Inventory Management states
  const [inventoryCategory, setInventoryCategory] = useState<'전체' | PartCategory>('전체')
  const [inventoryStatusFilter, setInventoryStatusFilter] = useState<
    'ALL' | 'NORMAL' | 'LOW' | 'EMPTY'
  >('ALL')
  const [inventorySearch, setInventorySearch] = useState<string>('')
  const [safetyStockMap, setSafetyStockMap] = useState<Record<string, number>>({
    'TAP-PC-001': 5,
    'TAP-DSP-027': 5,
    'TAP-DSP-032': 4,
    'TAP-TCH-027': 5,
    'TAP-TCH-032': 4,
    'TAP-BKT-001': 5,
    'TAP-PRT-001': 4,
    'TAP-TON-001': 5,
    'TAP-UPS-001': 5,
    'TAP-PWR-001': 8,
    'TAP-COI-001': 12,
    'TAP-BIL-001': 5,
    'TAP-CRD-001': 5,
    'TAP-BIO-001': 5,
    'TAP-CAM-001': 8,
    'TAP-ACC-001': 3,
    'TAP-SCN-001': 5,
    'TAP-SND-001': 5,
    'TAP-SEN-001': 5,
    'TAP-VCE-001': 3,
    'TAP-LED-001': 5,
    'TAP-CAB-001': 3,
  })
  const [customInventoryParts, setCustomInventoryParts] = useState<BomPart[]>([])
  const [showAddInventoryPartForm, setShowAddInventoryPartForm] = useState<boolean>(false)
  const [newInventoryPart, setNewInventoryPart] = useState({
    partCode: '',
    partName: '',
    category: '디스플레이/터치' as PartCategory,
    spec: '',
    unit: 'EA',
    stockQty: 10,
    safetyStockQty: 5,
    supplierId: 'SUP-01',
  })
  const [inventoryLogs, setInventoryLogs] = useState<InventoryLogItem[]>([
    {
      id: 'LOG-103',
      timestamp: '2026-11-03 09:30',
      type: 'IN',
      partCode: 'TAP-COI-001',
      partName: '코인호퍼 (동전방출기 · 1대당 3개 장착)',
      changeQty: 10,
      afterStockQty: 12,
      unit: 'EA',
      note: '정기 안전재고 보충 입고 (모아캐시텍)',
    },
    {
      id: 'LOG-102',
      timestamp: '2026-11-02 16:15',
      partCode: 'TAP-PRT-001',
      partName: '제증명 프린터 (A4 레이저 발급 프린터)',
      type: 'IN',
      changeQty: 4,
      afterStockQty: 4,
      unit: 'EA',
      note: '창고 실사 및 기초 재고 등록 (바른프린텍)',
    },
    {
      id: 'LOG-101',
      timestamp: '2026-11-02 14:00',
      partCode: 'TAP-DSP-027',
      partName: 'LCD 모니터 27인치 (무인민원발급기 메인 디스플레이)',
      type: 'OUT',
      changeQty: -2,
      afterStockQty: 6,
      unit: 'EA',
      note: 'TAPI-9270J 시제품 2대 조립 출고 (새솔디스플레이)',
    },
  ])

  // Step 5: Master management states (Kiosk Products, 10+ BOMs, Partners)
  const [editingPartnerId, setEditingPartnerId] = useState<string | null>(null)
  const [partnerFilter, setPartnerFilter] = useState<'ALL' | 'CLIENT' | 'SUPPLIER'>('ALL')
  const [showNewPartnerForm, setShowNewPartnerForm] = useState<boolean>(false)
  const [newPartner, setNewPartner] = useState<Omit<PartnerCompany, 'id'>>({
    type: 'SUPPLIER',
    name: '',
    bizNo: '',
    manager: '',
    phone: '',
    email: '',
    address: '',
    leadTimeDays: 5,
  })
  const [selectedMasterModelCode, setSelectedMasterModelCode] = useState<string>(
    KIOSK_MODELS[0].modelCode
  )
  const [modelSearch, setModelSearch] = useState<string>('')
  const [modelStatusFilter, setModelStatusFilter] = useState<'ALL' | KioskProductStatus>('ALL')
  const [showAddModelForm, setShowAddModelForm] = useState<boolean>(false)
  const [newModelForm, setNewModelForm] = useState<{
    modelCode: string
    modelName: string
    spec: string
    status: KioskProductStatus
    copyFromModelCode: string
  }>({
    modelCode: '',
    modelName: '',
    spec: '',
    status: 'NEW',
    copyFromModelCode: KIOSK_MODELS[0].modelCode,
  })
  const [editingModelCode, setEditingModelCode] = useState<string | null>(null)
  const [masterBomCategoryFilter, setMasterBomCategoryFilter] = useState<'전체' | PartCategory>('전체')
  const [editingMasterPartCode, setEditingMasterPartCode] = useState<string | null>(null)
  const [selectedExistingPartCode, setSelectedExistingPartCode] = useState<string>('')
  const [existingPartAddQty, setExistingPartAddQty] = useState<number>(1)
  const [showAddMasterBomForm, setShowAddMasterBomForm] = useState<boolean>(false)
  const [newMasterPart, setNewMasterPart] = useState({
    partCode: '',
    partName: '',
    category: '디스플레이/터치' as PartCategory,
    spec: '',
    unit: 'EA',
    qtyPerUnit: 1,
    stockQty: 5,
    supplierId: 'SUP-01',
  })

  // Toast
  const [toastMessage, setToastMessage] = useState<string | null>(null)
  const showToast = (msg: string) => {
    setToastMessage(msg)
    setTimeout(() => {
      setToastMessage((prev) => (prev === msg ? null : prev))
    }, 3400)
  }

  const clientPartners = useMemo(
    () => partners.filter((p) => p.type === 'CLIENT'),
    [partners]
  )
  const supplierPartners = useMemo(
    () => partners.filter((p) => p.type === 'SUPPLIER'),
    [partners]
  )

  // Real File Upload & Document Parsing (Excel / PDF / Image)
  const handleFileUpload = async (file: File | undefined) => {
    if (!file) return
    setIsScanning(true)
    setManualOverrides({})
    setCustomAddedBom([])
    setDeletedPartCodes([])
    setPartEdits({})
    setPoStatusMap({})

    try {
      const parsed = await parseUploadedOrderDocument(file, kioskModels)

      setClientOrder(parsed.order)
      setUploadedPreviewUrl(parsed.previewImageUrl || null)
      setIsScanning(false)

      // Automatically add extracted client to partners list if not already registered
      setPartners((prev) => {
        const exists = prev.some(
          (p) =>
            p.type === 'CLIENT' &&
            (p.name === parsed.order.clientName || p.bizNo === parsed.order.businessNo)
        )
        if (exists) return prev
        return [
          {
            id: `CLI-${Date.now().toString().slice(-4)}`,
            type: 'CLIENT',
            name: parsed.order.clientName,
            bizNo: parsed.order.businessNo,
            manager: parsed.order.managerName,
            phone: parsed.order.managerPhone,
            email: parsed.order.managerEmail,
            address: parsed.order.deliveryAddress,
            leadTimeDays: 10,
          },
          ...prev,
        ]
      })

      showToast(
        `"${file.name}" 접수 완료 · [${parsed.order.clientName} / ${parsed.order.items
          .map((i) => `${i.modelCode} ${i.quantity}대`)
          .join(', ')}] 정보가 반영되었습니다.`
      )
    } catch (err) {
      console.error('Document parse error:', err)
      setIsScanning(false)
      showToast('파일 분석 중 오류가 발생하여 기본 양식으로 불러왔습니다.')
    } finally {
      if (fileInputRef.current) {
        fileInputRef.current.value = ''
      }
    }
  }

  // Derived BOM & PO calculations
  const expandedBom = useMemo(
    () =>
      expandBomFromOrder(
        clientOrder,
        kioskModels,
        deductStock,
        manualOverrides,
        customAddedBom,
        deletedPartCodes,
        partEdits
      ),
    [
      clientOrder,
      kioskModels,
      deductStock,
      manualOverrides,
      customAddedBom,
      deletedPartCodes,
      partEdits,
    ]
  )

  const filteredBom = useMemo(
    () =>
      selectedCategory === '전체'
        ? expandedBom
        : expandedBom.filter((item) => item.category === selectedCategory),
    [expandedBom, selectedCategory]
  )

  const purchaseOrders = useMemo(
    () => generatePurchaseOrders(clientOrder, expandedBom, poStatusMap),
    [clientOrder, expandedBom, poStatusMap]
  )

  // Unified Warehouse Inventory Derivation (100% synced with STEP 2 BOM & STEP 5 Master)
  const warehouseInventory = useMemo(() => {
    const map = new Map<
      string,
      BomPart & {
        usedInModels: string[]
        currentReqQty: number
        safetyStockQty: number
        stockStatus: 'NORMAL' | 'LOW' | 'EMPTY'
      }
    >()

    const reqMap = new Map<string, number>()
    for (const bomItem of expandedBom) {
      reqMap.set(bomItem.partCode, bomItem.grossRequiredQty)
    }

    for (const model of kioskModels) {
      for (const part of model.bom) {
        const editStock = partEdits[part.partCode]?.stockQty
        const effectiveStock = editStock !== undefined ? editStock : part.stockQty
        const safety = safetyStockMap[part.partCode] ?? 5
        const status: 'NORMAL' | 'LOW' | 'EMPTY' =
          effectiveStock <= 0 ? 'EMPTY' : effectiveStock < safety ? 'LOW' : 'NORMAL'

        const existing = map.get(part.partCode)
        if (existing) {
          if (!existing.usedInModels.includes(model.modelCode)) {
            existing.usedInModels.push(model.modelCode)
          }
        } else {
          map.set(part.partCode, {
            ...part,
            stockQty: effectiveStock,
            usedInModels: [model.modelCode],
            currentReqQty: reqMap.get(part.partCode) || 0,
            safetyStockQty: safety,
            stockStatus: status,
          })
        }
      }
    }

    for (const custom of [...customAddedBom, ...customInventoryParts]) {
      if (!map.has(custom.partCode)) {
        const editStock = partEdits[custom.partCode]?.stockQty
        const effectiveStock = editStock !== undefined ? editStock : custom.stockQty
        const safety = safetyStockMap[custom.partCode] ?? 5
        const status: 'NORMAL' | 'LOW' | 'EMPTY' =
          effectiveStock <= 0 ? 'EMPTY' : effectiveStock < safety ? 'LOW' : 'NORMAL'

        map.set(custom.partCode, {
          ...custom,
          stockQty: effectiveStock,
          usedInModels: ['수동등록'],
          currentReqQty: reqMap.get(custom.partCode) || 0,
          safetyStockQty: safety,
          stockStatus: status,
        })
      }
    }

    return Array.from(map.values())
  }, [kioskModels, customAddedBom, customInventoryParts, expandedBom, partEdits, safetyStockMap])

  const filteredWarehouseInventory = useMemo(() => {
    return warehouseInventory.filter((item) => {
      if (inventoryCategory !== '전체' && item.category !== inventoryCategory) return false
      if (inventoryStatusFilter !== 'ALL' && item.stockStatus !== inventoryStatusFilter)
        return false
      if (inventorySearch.trim()) {
        const q = inventorySearch.trim().toLowerCase()
        const matchCode = item.partCode.toLowerCase().includes(q)
        const matchName = item.partName.toLowerCase().includes(q)
        const matchSupplier = item.supplierName.toLowerCase().includes(q)
        if (!matchCode && !matchName && !matchSupplier) return false
      }
      return true
    })
  }, [warehouseInventory, inventoryCategory, inventoryStatusFilter, inventorySearch])

  // Synchronized Warehouse Stock Updater
  const handleAdjustWarehouseStock = (
    partCode: string,
    nextStockQty: number,
    note: string,
    explicitType?: 'IN' | 'OUT' | 'ADJUST'
  ) => {
    const clamped = Math.max(0, Math.round(nextStockQty))
    const target = warehouseInventory.find((p) => p.partCode === partCode)
    const prevStock = target ? target.stockQty : 0
    const diff = clamped - prevStock
    if (diff === 0) return

    // 1. Update kioskModels BOM
    setKioskModels((prev) =>
      prev.map((m) => ({
        ...m,
        bom: m.bom.map((b) => (b.partCode === partCode ? { ...b, stockQty: clamped } : b)),
      }))
    )

    // 2. Update customAddedBom & customInventoryParts
    setCustomAddedBom((prev) =>
      prev.map((b) => (b.partCode === partCode ? { ...b, stockQty: clamped } : b))
    )
    setCustomInventoryParts((prev) =>
      prev.map((b) => (b.partCode === partCode ? { ...b, stockQty: clamped } : b))
    )

    // 3. Sync partEdits so STEP 2 expandedBom immediately uses the updated stock
    setPartEdits((prev) => {
      if (!prev[partCode]) return prev
      return {
        ...prev,
        [partCode]: {
          ...prev[partCode],
          stockQty: clamped,
        },
      }
    })

    // 4. Record Inventory Log
    const logType: 'IN' | 'OUT' | 'ADJUST' =
      explicitType || (diff > 0 ? 'IN' : diff < 0 ? 'OUT' : 'ADJUST')

    logSeqRef.current += 1
    const newLog: InventoryLogItem = {
      id: `LOG-${logSeqRef.current}`,
      timestamp: formatNowTimestamp(),
      type: logType,
      partCode,
      partName: target?.partName || partCode,
      changeQty: diff,
      afterStockQty: clamped,
      unit: target?.unit || 'EA',
      note,
    }
    setInventoryLogs((prev) => [newLog, ...prev.slice(0, 29)])
  }

  const handleAddWarehousePart = () => {
    if (!newInventoryPart.partName.trim()) {
      showToast('부품명을 입력해 주세요.')
      return
    }
    const sup =
      supplierPartners.find((s) => s.id === newInventoryPart.supplierId) || supplierPartners[0]
    const code =
      newInventoryPart.partCode.trim() || `INV-${Math.floor(100 + Math.random() * 899)}`

    const created: BomPart = {
      partCode: code,
      partName: newInventoryPart.partName.trim(),
      category: newInventoryPart.category,
      spec: newInventoryPart.spec.trim() || '창고 재고 관리 품목',
      unit: newInventoryPart.unit || 'EA',
      qtyPerUnit: 1,
      stockQty: Math.max(0, newInventoryPart.stockQty),
      supplierId: sup?.id || 'SUP-01',
      supplierName: sup?.name || '(주)한빛디스플레이테크',
      supplierBizNo: sup?.bizNo || '120-87-44910',
      supplierManager: sup?.manager || '담당자',
      supplierPhone: sup?.phone || '02-000-0000',
      supplierEmail: sup?.email || 'order@supplier.co.kr',
      leadTimeDays: sup?.leadTimeDays || 5,
    }

    setCustomInventoryParts((prev) => [created, ...prev])
    setSafetyStockMap((prev) => ({
      ...prev,
      [code]: Math.max(0, newInventoryPart.safetyStockQty),
    }))
    setInventoryLogs((prev) => [
      {
        id: `LOG-${Date.now()}`,
        timestamp: formatNowTimestamp(),
        type: 'IN',
        partCode: created.partCode,
        partName: created.partName,
        changeQty: created.stockQty,
        afterStockQty: created.stockQty,
        unit: created.unit,
        note: '신규 재고 관리 품목 등록 (기초재고 입고)',
      },
      ...prev,
    ])
    setShowAddInventoryPartForm(false)
    setNewInventoryPart({
      partCode: '',
      partName: '',
      category: '디스플레이/터치',
      spec: '',
      unit: 'EA',
      stockQty: 10,
      safetyStockQty: 5,
      supplierId: supplierPartners[0]?.id || 'SUP-01',
    })
    showToast(`창고 재고 목록에 "${created.partName}" 품목이 등록되었습니다.`)
  }

  // Receive PO items into Warehouse Inventory (STEP 3 -> STEP 4 sync)
  const handleReceivePoItems = (po: GeneratedPurchaseOrder) => {
    if (poReceivedMap[po.poNumber]) {
      showToast('이미 창고 입고가 완료된 발주서입니다.')
      return
    }
    const qtyMap = new Map<string, number>()
    for (const item of po.items) {
      qtyMap.set(item.partCode, item.adjustedOrderQty)
    }

    setKioskModels((prev) =>
      prev.map((m) => ({
        ...m,
        bom: m.bom.map((b) => {
          const add = qtyMap.get(b.partCode)
          return add ? { ...b, stockQty: b.stockQty + add } : b
        }),
      }))
    )
    setCustomAddedBom((prev) =>
      prev.map((b) => {
        const add = qtyMap.get(b.partCode)
        return add ? { ...b, stockQty: b.stockQty + add } : b
      })
    )
    setCustomInventoryParts((prev) =>
      prev.map((b) => {
        const add = qtyMap.get(b.partCode)
        return add ? { ...b, stockQty: b.stockQty + add } : b
      })
    )

    const nowStr = formatNowTimestamp()
    const newLogs: InventoryLogItem[] = po.items.map((item, idx) => {
      const currentPart = warehouseInventory.find((p) => p.partCode === item.partCode)
      const prevStock = currentPart ? currentPart.stockQty : item.stockQty
      return {
        id: `LOG-${Date.now()}-${idx}`,
        timestamp: nowStr,
        type: 'IN',
        partCode: item.partCode,
        partName: item.partName,
        changeQty: item.adjustedOrderQty,
        afterStockQty: prevStock + item.adjustedOrderQty,
        unit: item.unit,
        note: `발주서(${po.poNumber}) 자재 입고 완료 · ${po.supplierName}`,
      }
    })

    setInventoryLogs((prev) => [...newLogs, ...prev.slice(0, 25)])
    setPoReceivedMap((prev) => ({ ...prev, [po.poNumber]: true }))
    showToast(
      `[${po.supplierName}] 발주 부품 ${po.totalItemTypes}종(총 ${po.totalOrderQty}개)이 창고 현재고에 입고(+) 반영되었습니다!`
    )
  }

  // Step 1 Client Partner CRUD Handlers
  const handleSelectClientPartner = (partner: PartnerCompany) => {
    setClientOrder((prev) => ({
      ...prev,
      clientName: partner.name,
      businessNo: partner.bizNo,
      managerName: partner.manager,
      managerPhone: partner.phone,
      managerEmail: partner.email,
      deliveryAddress: partner.address,
    }))
    showToast(`거래처 정보가 "${partner.name}"(으)로 적용되었습니다.`)
  }

  const handleAddClientPartnerInStep1 = () => {
    if (!newClientForm.name.trim()) {
      showToast('거래처명을 입력해 주세요.')
      return
    }
    const created: PartnerCompany = {
      id: `CLI-${Date.now().toString().slice(-4)}`,
      type: 'CLIENT',
      name: newClientForm.name.trim(),
      bizNo: newClientForm.bizNo.trim() || '000-00-00000',
      manager: newClientForm.manager.trim() || '담당자',
      phone: newClientForm.phone.trim() || '02-000-0000',
      email: newClientForm.email.trim() || 'info@company.co.kr',
      address: newClientForm.address.trim() || '납품 장소 미정',
      leadTimeDays: 14,
    }
    setPartners((prev) => [created, ...prev])
    handleSelectClientPartner(created)
    setNewClientForm({ name: '', bizNo: '', manager: '', phone: '', email: '', address: '' })
    setShowAddClientForm(false)
    showToast(`신규 거래처 "${created.name}" 등록 및 적용이 완료되었습니다.`)
  }

  const handleDeleteClientPartner = (id: string, name: string) => {
    setPartners((prev) => prev.filter((p) => p.id !== id))
    showToast(`거래처 "${name}" 항목이 삭제되었습니다.`)
  }

  // Order Items CRUD
  const handleQuantityChange = (itemId: string, newQty: number) => {
    const clamped = Math.max(1, Math.min(999, newQty))
    setClientOrder((prev) => ({
      ...prev,
      items: prev.items.map((it) => (it.id === itemId ? { ...it, quantity: clamped } : it)),
    }))
  }

  const handleModelChange = (itemId: string, newModelCode: string) => {
    const model = kioskModels.find((m) => m.modelCode === newModelCode)
    if (!model) return
    setClientOrder((prev) => ({
      ...prev,
      items: prev.items.map((it) =>
        it.id === itemId
          ? {
              ...it,
              modelCode: model.modelCode,
              modelName: model.modelName,
              spec: model.spec,
            }
          : it
      ),
    }))
  }

  const handleAddOrderItem = () => {
    const defaultModel = kioskModels[0]
    setClientOrder((prev) => ({
      ...prev,
      items: [
        ...prev.items,
        {
          id: `ITEM-${Date.now()}`,
          modelCode: defaultModel.modelCode,
          modelName: defaultModel.modelName,
          spec: defaultModel.spec,
          quantity: 1,
        },
      ],
    }))
  }

  const handleRemoveOrderItem = (itemId: string) => {
    setClientOrder((prev) => ({
      ...prev,
      items: prev.items.filter((it) => it.id !== itemId),
    }))
  }

  const handleResetClientOrder = () => {
    setClientOrder(DEFAULT_CLIENT_ORDER)
    setUploadedPreviewUrl(null)
    setManualOverrides({})
    setCustomAddedBom([])
    setDeletedPartCodes([])
    if (fileInputRef.current) {
      fileInputRef.current.value = ''
    }
    showToast('발주서 접수 입력 내용이 모두 초기화되었습니다.')
  }

  // Step 2 BOM Item CRUD Handlers
  const handleAddCustomBomItem = () => {
    if (!newBomPart.partName.trim()) {
      showToast('부품명을 입력해 주세요.')
      return
    }
    const supplier =
      supplierPartners.find((s) => s.id === newBomPart.supplierId) || supplierPartners[0]
    const code =
      newBomPart.partCode.trim() || `USR-${Math.floor(100 + Math.random() * 899)}`

    const added: ExpandedBomItem = {
      partCode: code,
      partName: newBomPart.partName.trim(),
      category: newBomPart.category,
      spec: newBomPart.spec.trim() || '사용자 추가 사양',
      unit: newBomPart.unit || 'EA',
      qtyPerUnit: 1,
      stockQty: newBomPart.stockQty,
      supplierId: supplier?.id || 'SUP-01',
      supplierName: supplier?.name || '(주)한빛디스플레이테크',
      supplierBizNo: supplier?.bizNo || '120-87-44910',
      supplierManager: supplier?.manager || '담당자',
      supplierPhone: supplier?.phone || '02-000-0000',
      supplierEmail: supplier?.email || 'order@supplier.co.kr',
      leadTimeDays: supplier?.leadTimeDays || 5,
      sourceModels: [
        {
          modelCode: '수동추가',
          modelName: '사용자 직접 추가 품목',
          orderQty: 1,
          subTotalQty: newBomPart.grossRequiredQty,
        },
      ],
      grossRequiredQty: newBomPart.grossRequiredQty,
      netOrderQty: Math.max(0, newBomPart.grossRequiredQty - newBomPart.stockQty),
      adjustedOrderQty: Math.max(0, newBomPart.grossRequiredQty - newBomPart.stockQty),
    }

    setCustomAddedBom((prev) => [...prev, added])
    setShowAddBomModal(false)
    setNewBomPart({
      partCode: '',
      partName: '',
      category: '디스플레이/터치',
      spec: '',
      unit: 'EA',
      grossRequiredQty: 10,
      stockQty: 0,
      supplierId: supplierPartners[0]?.id || 'SUP-01',
    })
    showToast(`BOM 부품 "${added.partName}" 항목이 추가되었습니다.`)
  }

  const handleDeleteBomItem = (partCode: string, partName: string) => {
    setDeletedPartCodes((prev) => [...prev, partCode])
    showToast(`BOM 목록에서 "${partName}" 항목이 삭제되었습니다.`)
  }

  const handleUpdateBomField = (
    partCode: string,
    field: keyof ExpandedBomItem,
    value: string | number
  ) => {
    if (field === 'stockQty') {
      handleAdjustWarehouseStock(
        partCode,
        Number(value) || 0,
        'STEP 2 BOM 화면에서 창고 현재고 직접 수정',
        'ADJUST'
      )
      return
    }
    if (field === 'supplierId') {
      const sup = supplierPartners.find((s) => s.id === value)
      if (sup) {
        setPartEdits((prev) => ({
          ...prev,
          [partCode]: {
            ...(prev[partCode] || {}),
            supplierId: sup.id,
            supplierName: sup.name,
            supplierBizNo: sup.bizNo,
            supplierManager: sup.manager,
            supplierPhone: sup.phone,
            supplierEmail: sup.email,
            leadTimeDays: sup.leadTimeDays,
          },
        }))
        return
      }
    }
    setPartEdits((prev) => ({
      ...prev,
      [partCode]: {
        ...(prev[partCode] || {}),
        [field]: value,
      },
    }))
  }

  // Step 3 PO Actions
  const handleDownloadExcel = (po: GeneratedPurchaseOrder) => {
    downloadPurchaseOrderCsv(po, clientOrder)
    setPoStatusMap((prev) => ({ ...prev, [po.poNumber]: 'DOWNLOADED' }))
    showToast(`엑셀 발주서(${po.excelFileName})가 다운로드되었습니다.`)
  }

  const handleDownloadPdf = (po: GeneratedPurchaseOrder) => {
    openPurchaseOrderPrintOrPdf(po, clientOrder, 'PDF')
    setPoStatusMap((prev) => ({ ...prev, [po.poNumber]: 'DOWNLOADED' }))
    showToast(`PDF 발주서(${po.pdfFileName}) 저장 창을 열었습니다.`)
  }

  const handlePrintPo = (po: GeneratedPurchaseOrder) => {
    openPurchaseOrderPrintOrPdf(po, clientOrder, 'PRINT')
  }

  const handleSendPoPdfEmail = (po: GeneratedPurchaseOrder) => {
    setPoStatusMap((prev) => ({ ...prev, [po.poNumber]: 'SENT' }))
    showToast(
      `[${po.supplierName}] ${po.supplierEmail} 앞으로 "${po.pdfFileName}" (PDF 파일) 전송이 완료되었습니다!`
    )
  }

  const handleDownloadAllExcel = () => {
    purchaseOrders.forEach((po, idx) => {
      setTimeout(() => {
        downloadPurchaseOrderCsv(po, clientOrder)
      }, idx * 220)
    })
    const nextMap: Record<string, 'READY' | 'DOWNLOADED' | 'SENT'> = { ...poStatusMap }
    purchaseOrders.forEach((po) => {
      nextMap[po.poNumber] = 'DOWNLOADED'
    })
    setPoStatusMap(nextMap)
    showToast(`총 ${purchaseOrders.length}건의 엑셀(.xlsx) 발주서 일괄 다운로드를 시작했습니다.`)
  }

  const handleSendAllPdfEmails = () => {
    const nextMap: Record<string, 'READY' | 'DOWNLOADED' | 'SENT'> = { ...poStatusMap }
    purchaseOrders.forEach((po) => {
      nextMap[po.poNumber] = 'SENT'
    })
    setPoStatusMap(nextMap)
    showToast(
      `총 ${purchaseOrders.length}개 발주처로 PDF 발주서 파일 일괄 이메일 전송이 완료되었습니다!`
    )
  }

  // Step 4 Master Management CRUD
  const handleCreatePartner = () => {
    if (!newPartner.name.trim()) {
      showToast('업체명을 입력해 주세요.')
      return
    }
    const prefix = newPartner.type === 'CLIENT' ? 'CLI' : 'SUP'
    const created: PartnerCompany = {
      ...newPartner,
      id: `${prefix}-${Date.now().toString().slice(-4)}`,
    }
    setPartners((prev) => [created, ...prev])
    setShowNewPartnerForm(false)
    setNewPartner({
      type: 'SUPPLIER',
      name: '',
      bizNo: '',
      manager: '',
      phone: '',
      email: '',
      address: '',
      leadTimeDays: 5,
    })
    showToast(`"${created.name}" 거래처가 등록되었습니다.`)
  }

  const handleUpdatePartner = (id: string, field: keyof PartnerCompany, value: string | number) => {
    setPartners((prev) =>
      prev.map((p) => (p.id === id ? { ...p, [field]: value } : p))
    )
    // Also sync supplier info across all model BOMs and inventory
    setKioskModels((prev) =>
      prev.map((m) => ({
        ...m,
        bom: m.bom.map((b) => {
          if (b.supplierId !== id) return b
          return {
            ...b,
            supplierName: field === 'name' ? String(value) : b.supplierName,
            supplierBizNo: field === 'bizNo' ? String(value) : b.supplierBizNo,
            supplierManager: field === 'manager' ? String(value) : b.supplierManager,
            supplierPhone: field === 'phone' ? String(value) : b.supplierPhone,
            supplierEmail: field === 'email' ? String(value) : b.supplierEmail,
            leadTimeDays: field === 'leadTimeDays' ? Number(value) || 3 : b.leadTimeDays,
          }
        }),
      }))
    )
  }

  // Kiosk Product (Model) Master CRUD (신제품 추가, 제품명/스펙 수정, 판매중/품절 전환, 삭제)
  const filteredMasterModels = useMemo(() => {
    return kioskModels.filter((m) => {
      const status = m.status || 'ACTIVE'
      if (modelStatusFilter !== 'ALL' && status !== modelStatusFilter) return false
      if (modelSearch.trim()) {
        const q = modelSearch.trim().toLowerCase()
        return (
          m.modelCode.toLowerCase().includes(q) ||
          m.modelName.toLowerCase().includes(q) ||
          m.spec.toLowerCase().includes(q)
        )
      }
      return true
    })
  }, [kioskModels, modelStatusFilter, modelSearch])

  const handleCreateKioskModel = () => {
    if (!newModelForm.modelName.trim()) {
      showToast('신규 키오스크 제품명을 입력해 주세요.')
      return
    }
    logSeqRef.current += 1
    const code =
      newModelForm.modelCode.trim().toUpperCase() || `KSK-${3000 + logSeqRef.current}N`

    if (kioskModels.some((m) => m.modelCode === code)) {
      showToast(`이미 존재하는 모델코드(${code})입니다.`)
      return
    }

    const baseModel = kioskModels.find((m) => m.modelCode === newModelForm.copyFromModelCode)
    const copiedBom: BomPart[] = baseModel ? baseModel.bom.map((b) => ({ ...b })) : []

    const created: KioskModelMaster = {
      modelCode: code,
      modelName: newModelForm.modelName.trim(),
      spec: newModelForm.spec.trim() || '신규 등록 키오스크 표준 사양',
      status: newModelForm.status,
      bom: copiedBom,
    }

    setKioskModels((prev) => [created, ...prev])
    setSelectedMasterModelCode(created.modelCode)
    setShowAddModelForm(false)
    setNewModelForm({
      modelCode: '',
      modelName: '',
      spec: '',
      status: 'NEW',
      copyFromModelCode: created.modelCode,
    })
    showToast(
      `신규 키오스크 제품 "[${created.modelCode}] ${created.modelName}" (BOM ${copiedBom.length}종 포함) 등록이 완료되었습니다!`
    )
  }

  const handleUpdateKioskModel = (
    modelCode: string,
    field: 'modelName' | 'spec' | 'status',
    value: string
  ) => {
    setKioskModels((prev) =>
      prev.map((m) => (m.modelCode === modelCode ? { ...m, [field]: value } : m))
    )
    if (field === 'modelName' || field === 'spec') {
      setClientOrder((prev) => ({
        ...prev,
        items: prev.items.map((it) =>
          it.modelCode === modelCode ? { ...it, [field]: value } : it
        ),
      }))
    }
    if (field === 'status') {
      const label =
        value === 'NEW' ? '신제품' : value === 'SOLD_OUT' ? '일시품절(수주불가)' : '정상 판매중'
      showToast(`[${modelCode}] 제품 상태가 "${label}"(으)로 변경되었습니다.`)
    }
  }

  const handleDeleteKioskModel = (modelCode: string, modelName: string) => {
    if (kioskModels.length <= 1) {
      showToast('최소 1개 이상의 키오스크 제품이 필요합니다.')
      return
    }
    const nextModels = kioskModels.filter((m) => m.modelCode !== modelCode)
    setKioskModels(nextModels)
    if (selectedMasterModelCode === modelCode) {
      setSelectedMasterModelCode(nextModels[0].modelCode)
    }
    showToast(`"[${modelCode}] ${modelName}" 제품이 삭제되었습니다.`)
  }

  // Model BOM Part CRUD (대당 소요량, 부품 정보, 창고 기존 부품 추가, 신규 부품 추가)
  const handleUpdateMasterBomPart = (
    modelCode: string,
    partCode: string,
    field: keyof BomPart,
    value: string | number
  ) => {
    if (field === 'stockQty') {
      handleAdjustWarehouseStock(
        partCode,
        Math.max(0, Number(value) || 0),
        `[${modelCode}] BOM 마스터에서 현재고 수정`,
        'ADJUST'
      )
      return
    }

    if (field === 'supplierId') {
      const sup = supplierPartners.find((s) => s.id === value)
      if (!sup) return
      setKioskModels((prev) =>
        prev.map((m) =>
          m.modelCode === modelCode
            ? {
                ...m,
                bom: m.bom.map((b) =>
                  b.partCode === partCode
                    ? {
                        ...b,
                        supplierId: sup.id,
                        supplierName: sup.name,
                        supplierBizNo: sup.bizNo,
                        supplierManager: sup.manager,
                        supplierPhone: sup.phone,
                        supplierEmail: sup.email,
                        leadTimeDays: sup.leadTimeDays,
                      }
                    : b
                ),
              }
            : m
        )
      )
      return
    }

    setKioskModels((prev) =>
      prev.map((m) =>
        m.modelCode === modelCode
          ? {
              ...m,
              bom: m.bom.map((b) =>
                b.partCode === partCode
                  ? {
                      ...b,
                      [field]:
                        field === 'qtyPerUnit'
                          ? Math.max(1, Number(value) || 1)
                          : value,
                    }
                  : b
              ),
            }
          : m
      )
    )
  }

  const handleAddExistingPartToModelBom = () => {
    if (!selectedExistingPartCode) {
      showToast('추가할 창고 부품을 선택해 주세요.')
      return
    }
    const whPart = warehouseInventory.find((p) => p.partCode === selectedExistingPartCode)
    if (!whPart) return

    const targetModel = kioskModels.find((m) => m.modelCode === selectedMasterModelCode)
    if (!targetModel) return

    const existsInModel = targetModel.bom.some((b) => b.partCode === whPart.partCode)
    if (existsInModel) {
      handleUpdateMasterBomPart(
        selectedMasterModelCode,
        whPart.partCode,
        'qtyPerUnit',
        (targetModel.bom.find((b) => b.partCode === whPart.partCode)?.qtyPerUnit || 1) +
          Math.max(1, existingPartAddQty)
      )
      showToast(
        `[${selectedMasterModelCode}]에 이미 있는 "${whPart.partName}"의 대당 소요량을 +${existingPartAddQty} 증가시켰습니다.`
      )
      return
    }

    const addedPart: BomPart = {
      partCode: whPart.partCode,
      partName: whPart.partName,
      category: whPart.category,
      spec: whPart.spec,
      unit: whPart.unit,
      qtyPerUnit: Math.max(1, existingPartAddQty),
      stockQty: whPart.stockQty,
      supplierId: whPart.supplierId,
      supplierName: whPart.supplierName,
      supplierBizNo: whPart.supplierBizNo,
      supplierManager: whPart.supplierManager,
      supplierPhone: whPart.supplierPhone,
      supplierEmail: whPart.supplierEmail,
      leadTimeDays: whPart.leadTimeDays,
    }

    setKioskModels((prev) =>
      prev.map((m) =>
        m.modelCode === selectedMasterModelCode ? { ...m, bom: [...m.bom, addedPart] } : m
      )
    )
    setSelectedExistingPartCode('')
    setExistingPartAddQty(1)
    showToast(
      `[${selectedMasterModelCode}] BOM에 "${addedPart.partName}" (대당 ${addedPart.qtyPerUnit}${addedPart.unit}) 부품이 연결되었습니다.`
    )
  }

  const handleAddMasterBomPart = () => {
    if (!newMasterPart.partName.trim()) {
      showToast('부품명을 입력해 주세요.')
      return
    }
    logSeqRef.current += 1
    const sup =
      supplierPartners.find((s) => s.id === newMasterPart.supplierId) || supplierPartners[0]
    const part: BomPart = {
      partCode:
        newMasterPart.partCode.trim() || `PRT-${100 + logSeqRef.current}`,
      partName: newMasterPart.partName.trim(),
      category: newMasterPart.category,
      spec: newMasterPart.spec.trim() || '표준 규격',
      unit: newMasterPart.unit || 'EA',
      qtyPerUnit: Math.max(1, newMasterPart.qtyPerUnit || 1),
      stockQty: Math.max(0, newMasterPart.stockQty || 0),
      supplierId: sup?.id || 'SUP-01',
      supplierName: sup?.name || '(주)한빛디스플레이테크',
      supplierBizNo: sup?.bizNo || '120-87-44910',
      supplierManager: sup?.manager || '담당자',
      supplierPhone: sup?.phone || '02-000-0000',
      supplierEmail: sup?.email || 'order@supplier.co.kr',
      leadTimeDays: sup?.leadTimeDays || 5,
    }

    setKioskModels((prev) =>
      prev.map((m) =>
        m.modelCode === selectedMasterModelCode ? { ...m, bom: [...m.bom, part] } : m
      )
    )
    setShowAddMasterBomForm(false)
    setNewMasterPart({
      partCode: '',
      partName: '',
      category: '디스플레이/터치',
      spec: '',
      unit: 'EA',
      qtyPerUnit: 1,
      stockQty: 5,
      supplierId: supplierPartners[0]?.id || 'SUP-01',
    })
    showToast(`${selectedMasterModelCode} 표준 BOM에 "${part.partName}" 부품이 추가되었습니다.`)
  }

  const handleDeleteMasterBomPart = (modelCode: string, partCode: string, partName: string) => {
    setKioskModels((prev) =>
      prev.map((m) =>
        m.modelCode === modelCode
          ? { ...m, bom: m.bom.filter((b) => b.partCode !== partCode) }
          : m
      )
    )
    showToast(`${modelCode} BOM에서 "${partName}" 부품이 삭제되었습니다.`)
  }

  if (isHome) {
    return (
      <div className="min-h-screen bg-white text-[#0F2E26] flex flex-col justify-between selection:bg-[#0E8A5F] selection:text-white overflow-x-hidden">
        {/* Top Minimal White Bar */}
        <header className="w-full max-w-6xl mx-auto px-6 py-6 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <KioskSystemIcon className="w-9 h-9" />
            <span className="text-base font-bold tracking-tight text-[#0F2E26]">
              키오스크 발주 관리 시스템
            </span>
          </div>
          <nav className="hidden sm:flex items-center gap-7 text-sm font-medium text-slate-600">
            <button
              type="button"
              onClick={() => {
                setActiveTab('ORDER_INTAKE')
                setIsHome(false)
              }}
              className="hover:text-[#0E8A5F] transition-colors cursor-pointer"
            >
              발주서 접수
            </button>
            <button
              type="button"
              onClick={() => {
                setActiveTab('MATERIAL_ORDER')
                setIsHome(false)
              }}
              className="hover:text-[#0E8A5F] transition-colors cursor-pointer"
            >
              자재 발주
            </button>
            <button
              type="button"
              onClick={() => {
                setActiveTab('MANAGE_BOM')
                setIsHome(false)
              }}
              className="hover:text-[#0E8A5F] transition-colors cursor-pointer"
            >
              제품 · BOM 관리
            </button>
            <button
              type="button"
              onClick={() => {
                setActiveTab('MANAGE_INVENTORY')
                setIsHome(false)
              }}
              className="hover:text-[#0E8A5F] transition-colors cursor-pointer"
            >
              재고 관리
            </button>
          </nav>
        </header>

        {/* Center White Hero Section */}
        <main className="flex-1 flex flex-col items-center justify-center max-w-4xl mx-auto px-6 py-12 text-center">
          {/* Minimalist Editorial Line-Art Illustration with Green Accents */}
          <div className="mb-6">
            <svg
              width="220"
              height="96"
              viewBox="0 0 220 96"
              fill="none"
              xmlns="http://www.w3.org/2000/svg"
              className="mx-auto"
              aria-hidden="true"
            >
              {/* Left: Order Document */}
              <rect
                x="18"
                y="18"
                width="46"
                height="58"
                rx="4"
                fill="#FFFFFF"
                stroke="#0F2E26"
                strokeWidth="2"
              />
              <rect x="26" y="28" width="22" height="5" rx="2" fill="#0E8A5F" />
              <line x1="26" y1="41" x2="54" y2="41" stroke="#0F2E26" strokeWidth="1.8" strokeLinecap="round" />
              <line x1="26" y1="49" x2="50" y2="49" stroke="#0F2E26" strokeWidth="1.8" strokeLinecap="round" />
              <line x1="26" y1="57" x2="44" y2="57" stroke="#0F2E26" strokeWidth="1.8" strokeLinecap="round" />

              {/* Continuous Organic Connection Line (User Interviews style) */}
              <path
                d="M64 48 C 92 48, 88 20, 110 28 C 130 35, 114 70, 136 62 C 146 58, 150 48, 156 48"
                stroke="#0F2E26"
                strokeWidth="1.8"
                strokeLinecap="round"
                fill="none"
              />
              <circle cx="110" cy="28" r="4" fill="#0E8A5F" />

              {/* Right: Smart Kiosk Stand */}
              <rect
                x="156"
                y="12"
                width="44"
                height="64"
                rx="5"
                fill="#FFFFFF"
                stroke="#0F2E26"
                strokeWidth="2"
              />
              <rect
                x="162"
                y="18"
                width="32"
                height="30"
                rx="2.5"
                fill="#D1FAE5"
                stroke="#0F2E26"
                strokeWidth="1.6"
              />
              <path
                d="M172 33L176.5 37.5L185 29"
                stroke="#0E8A5F"
                strokeWidth="2.4"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
              <rect x="165" y="54" width="14" height="3" rx="1.5" fill="#0F2E26" />
              <rect x="183" y="53" width="8" height="5" rx="1.5" fill="#0E8A5F" />
              <path d="M148 76H208" stroke="#0F2E26" strokeWidth="2.4" strokeLinecap="round" />
            </svg>
          </div>

          {/* Large Editorial Title */}
          <h1 className="text-4xl sm:text-5xl md:text-[56px] font-bold tracking-tight text-[#0F2E26] leading-[1.18]">
            키오스크 발주 관리 시스템
          </h1>

          <p className="mt-4 text-base sm:text-lg text-slate-600 max-w-xl leading-relaxed font-normal">
            거래처 수주 발주서 접수부터 제품별 소요 자재(BOM) 자동 산출 및 발주처별 구매발주서 발행까지 한 곳에서 간편하게 처리하세요.
          </p>

          {/* Single Centered Green Start Button Below Title */}
          <div className="mt-9">
            <button
              type="button"
              onClick={() => {
                setActiveTab('ORDER_INTAKE')
                setIsHome(false)
              }}
              className="group inline-flex items-center gap-2.5 px-9 py-4 rounded-lg bg-[#0E8A5F] hover:bg-[#0B704D] text-white text-base sm:text-lg font-semibold shadow-sm transition-all cursor-pointer"
            >
              <span>시작하기</span>
              <ArrowRight className="w-5 h-5 transition-transform group-hover:translate-x-1" />
            </button>
          </div>
        </main>

        {/* Bottom Organic Forest Green Wave Band (Inspired by Reference Design) */}
        <div className="w-full mt-8">
          {/* Curved Wave Top Edge */}
          <svg
            viewBox="0 0 1440 54"
            fill="none"
            xmlns="http://www.w3.org/2000/svg"
            className="w-full h-8 sm:h-12 block -mb-px"
            preserveAspectRatio="none"
          >
            <path
              d="M0 32C320 6 620 0 920 14C1160 25 1330 40 1440 24V54H0V32Z"
              fill="#0E8A5F"
            />
          </svg>

          <footer className="bg-[#0E8A5F] text-white pt-8 pb-10 px-6">
            <div className="max-w-5xl mx-auto flex flex-col items-center text-center space-y-7">
              <div className="text-[11px] tracking-[0.2em] uppercase text-emerald-100/90 font-medium">
                SMART KIOSK MODELS &amp; AUTOMATED BOM WORKFLOW
              </div>

              {/* Clean White Typographic Marks inside the Green Band */}
              <div className="flex flex-wrap items-center justify-center gap-x-10 gap-y-3 text-base sm:text-lg font-semibold tracking-tight text-white/95">
                <span>TAPI-9270J</span>
                <span>TAPI-9270T</span>
                <span>TAPI-9320J</span>
                <span>TAPI-9320T</span>
                <span>BOM 자동 산출</span>
                <span>구매발주서 발행</span>
              </div>

              {/* Divider & Creator Credits */}
              <div className="w-full pt-6 border-t border-white/15 flex items-center justify-center">
                <p className="text-sm sm:text-base text-white/95 tracking-wide font-normal">
                  <span className="text-white/60">|</span>
                  <span className="mx-2.5 font-medium">AI아이</span>
                  <span className="text-white/60 mr-3">|</span>
                  <span>김동준 · 최재혁 · 김여원 · 김서연</span>
                </p>
              </div>
            </div>
          </footer>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-[#F8FAF9] text-slate-800 flex flex-col selection:bg-[#0E8A5F] selection:text-white">
      {/* Toast Notification */}
      {toastMessage && (
        <div className="fixed bottom-6 right-6 z-50 flex items-center gap-3 px-5 py-3.5 rounded-xl bg-[#0F2E26] text-white text-sm font-medium shadow-xl border border-emerald-800">
          <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0" />
          <span>{toastMessage}</span>
        </div>
      )}

      {/* Top Header */}
      <header className="sticky top-0 z-30 border-b border-slate-200 bg-white/95 backdrop-blur-md">
        <div className="max-w-[1440px] mx-auto px-4 sm:px-6 lg:px-8 py-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <button
            type="button"
            onClick={() => setIsHome(true)}
            title="클릭하여 홈 화면으로 이동"
            className="group flex items-center gap-3.5 text-left cursor-pointer rounded-xl focus:outline-none"
          >
            <div className="shrink-0 transition-transform group-hover:scale-105">
              <KioskSystemIcon className="w-10 h-10" />
            </div>
            <div>
              <div className="flex items-center gap-2.5 flex-wrap">
                <h1 className="text-lg font-bold tracking-tight text-[#0F2E26] group-hover:text-[#0E8A5F] transition-colors">
                  키오스크 발주 관리 시스템
                </h1>
                <span className="px-2.5 py-0.5 rounded-full text-xs font-medium bg-emerald-50 text-[#0E8A5F] border border-emerald-200">
                  무인민원발급기 · 스마트 키오스크
                </span>
              </div>
              <p className="text-xs sm:text-sm text-slate-500 font-normal">
                발주서 접수 후 제품별 소요 자재(BOM)를 자동 산출하고 발주처별 구매발주서를 발행합니다
              </p>
            </div>
          </button>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setIsHome(true)}
              className="px-3.5 py-2 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs sm:text-sm font-medium transition-colors cursor-pointer"
            >
              홈 화면으로
            </button>
          </div>
        </div>
      </header>

      {/* Main Body with Left Sidebar Navigation + Right Content Area */}
      <div className="flex-1 max-w-[1440px] w-full mx-auto px-4 sm:px-6 lg:px-8 py-6 flex flex-col lg:flex-row gap-6 items-start">
        {/* Left Sidebar Navigation (Only Menu Titles, No Fixed Numbers Below) */}
        <aside className="w-full lg:w-60 shrink-0 lg:sticky lg:top-24 space-y-4">
          {/* Primary Workflow Group: 발주서 접수 -> 자재 발주 */}
          <div className="bg-white border border-slate-200 rounded-2xl p-3.5 shadow-2xs space-y-1.5">
            <div className="px-2.5 py-1 flex items-center justify-between">
              <span className="text-xs font-semibold uppercase tracking-wider text-slate-400">
                발주 업무
              </span>
            </div>

            <button
              type="button"
              onClick={() => setActiveTab('ORDER_INTAKE')}
              className={`w-full flex items-center justify-between px-3.5 py-3 rounded-xl text-left transition-all cursor-pointer border ${
                activeTab === 'ORDER_INTAKE'
                  ? 'bg-[#0E8A5F] text-white border-[#0E8A5F] shadow-2xs'
                  : 'bg-white hover:bg-slate-50 text-slate-700 border-transparent'
              }`}
            >
              <div className="flex items-center gap-3 min-w-0">
                <FileCheck2
                  className={`w-4 h-4 shrink-0 ${
                    activeTab === 'ORDER_INTAKE' ? 'text-white' : 'text-[#0E8A5F]'
                  }`}
                />
                <span className="text-sm font-semibold truncate">발주서 접수</span>
              </div>
              <ArrowRight
                className={`w-4 h-4 shrink-0 ${
                  activeTab === 'ORDER_INTAKE' ? 'text-white' : 'text-slate-300'
                }`}
              />
            </button>

            <button
              type="button"
              onClick={() => setActiveTab('MATERIAL_ORDER')}
              className={`w-full flex items-center justify-between px-3.5 py-3 rounded-xl text-left transition-all cursor-pointer border ${
                activeTab === 'MATERIAL_ORDER'
                  ? 'bg-[#0E8A5F] text-white border-[#0E8A5F] shadow-2xs'
                  : 'bg-white hover:bg-slate-50 text-slate-700 border-transparent'
              }`}
            >
              <div className="flex items-center gap-3 min-w-0">
                <Send
                  className={`w-4 h-4 shrink-0 ${
                    activeTab === 'MATERIAL_ORDER' ? 'text-white' : 'text-[#0E8A5F]'
                  }`}
                />
                <span className="text-sm font-semibold truncate">자재 발주</span>
              </div>
              <ArrowRight
                className={`w-4 h-4 shrink-0 ${
                  activeTab === 'MATERIAL_ORDER' ? 'text-white' : 'text-slate-300'
                }`}
              />
            </button>
          </div>

          {/* Management Menu Group: 제품·BOM 관리 / 재고 관리 / 거래처 관리 */}
          <div className="bg-white border border-slate-200 rounded-2xl p-3.5 shadow-2xs space-y-1.5">
            <div className="px-2.5 py-1 flex items-center justify-between">
              <span className="text-xs font-semibold uppercase tracking-wider text-slate-400">
                관리 메뉴
              </span>
            </div>

            <button
              type="button"
              onClick={() => setActiveTab('MANAGE_BOM')}
              className={`w-full flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-left transition-all cursor-pointer ${
                activeTab === 'MANAGE_BOM'
                  ? 'bg-[#0F2E26] text-white'
                  : 'hover:bg-slate-50 text-slate-700'
              }`}
            >
              <Layers
                className={`w-4 h-4 shrink-0 ${
                  activeTab === 'MANAGE_BOM' ? 'text-emerald-300' : 'text-[#0E8A5F]'
                }`}
              />
              <span className="text-sm font-medium truncate">제품 · BOM 관리</span>
            </button>

            <button
              type="button"
              onClick={() => setActiveTab('MANAGE_INVENTORY')}
              className={`w-full flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-left transition-all cursor-pointer ${
                activeTab === 'MANAGE_INVENTORY'
                  ? 'bg-[#0F2E26] text-white'
                  : 'hover:bg-slate-50 text-slate-700'
              }`}
            >
              <Package
                className={`w-4 h-4 shrink-0 ${
                  activeTab === 'MANAGE_INVENTORY' ? 'text-emerald-300' : 'text-[#0E8A5F]'
                }`}
              />
              <span className="text-sm font-medium truncate">재고 관리</span>
            </button>

            <button
              type="button"
              onClick={() => setActiveTab('MANAGE_PARTNERS')}
              className={`w-full flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-left transition-all cursor-pointer ${
                activeTab === 'MANAGE_PARTNERS'
                  ? 'bg-[#0F2E26] text-white'
                  : 'hover:bg-slate-50 text-slate-700'
              }`}
            >
              <Building2
                className={`w-4 h-4 shrink-0 ${
                  activeTab === 'MANAGE_PARTNERS' ? 'text-emerald-300' : 'text-[#0E8A5F]'
                }`}
              />
              <span className="text-sm font-medium truncate">거래처 관리</span>
            </button>
          </div>

          {/* Beginner Quick Guide Box */}
          <div className="bg-emerald-50/70 border border-emerald-200/80 rounded-2xl p-4 space-y-2 text-xs text-slate-600 leading-relaxed">
            <div className="font-semibold text-[#0F2E26] flex items-center gap-1.5">
              <ClipboardList className="w-4 h-4 text-[#0E8A5F]" />
              이용 안내
            </div>
            <p>
              1. <span className="font-medium text-slate-800">발주서 접수</span>에서 발주서 파일을 업로드하거나 주문 키오스크 모델·수량을 입력합니다.
            </p>
            <p>
              2. <span className="font-medium text-slate-800">자재 발주</span>로 이동하면 모델별 BOM 부품 소요량이 자동 계산되며, 공급처별 발주서(PDF·엑셀)를 발행할 수 있습니다.
            </p>
          </div>
        </aside>

        {/* Main Content Area */}
        <main className="flex-1 min-w-0 w-full space-y-6">
          {/* =====================================================================
              1. 발주서 접수 (ORDER_INTAKE)
          ===================================================================== */}
          {activeTab === 'ORDER_INTAKE' && (
            <section className="bg-white border border-slate-200 rounded-2xl overflow-hidden shadow-2xs space-y-5 p-6">
              {/* Section Header with Reset & Proceed Buttons */}
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-200 pb-4">
                <div>
                  <h2 className="text-xl font-bold text-[#0F2E26]">발주서 접수</h2>
                  <p className="text-sm text-slate-500 mt-1">
                    수주 발주서 파일을 업로드해 자동 입력하거나, 아래 거래처 정보 및 주문 품목을 직접 입력하세요.
                  </p>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <button
                    type="button"
                    onClick={handleResetClientOrder}
                    className="inline-flex items-center gap-1.5 px-4 py-2.5 rounded-xl text-sm font-medium bg-slate-100 hover:bg-slate-200 text-slate-700 border border-slate-200 transition-colors cursor-pointer"
                  >
                    <RefreshCw className="w-4 h-4 text-slate-500" />
                    <span>초기화</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setActiveTab('MATERIAL_ORDER')}
                    className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-semibold bg-[#0E8A5F] hover:bg-[#0B704D] text-white shadow-2xs transition-all cursor-pointer"
                  >
                    <span>자재 발주 진행하기</span>
                    <ArrowRight className="w-4 h-4" />
                  </button>
                </div>
              </div>

              {/* Compact Horizontal File Upload Bar (Space-Efficient!) */}
              <div
                onDragOver={(e) => {
                  e.preventDefault()
                  setIsDragging(true)
                }}
                onDragLeave={() => setIsDragging(false)}
                onDrop={(e) => {
                  e.preventDefault()
                  setIsDragging(false)
                  const file = e.dataTransfer.files?.[0]
                  handleFileUpload(file)
                }}
                className={`p-3.5 sm:px-5 rounded-xl border-2 border-dashed transition-all flex flex-col sm:flex-row sm:items-center justify-between gap-3 ${
                  isDragging
                    ? 'border-[#0E8A5F] bg-emerald-50/70'
                    : 'border-slate-300 hover:border-[#0E8A5F] bg-slate-50/70'
                }`}
              >
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".pdf,.png,.jpg,.jpeg,.xlsx,.xls,.csv"
                  className="hidden"
                  onChange={(e) => handleFileUpload(e.target.files?.[0])}
                />

                <div
                  onClick={() => fileInputRef.current?.click()}
                  className="flex items-center gap-3.5 cursor-pointer flex-1 min-w-0"
                >
                  <div className="w-10 h-10 rounded-xl bg-emerald-50 border border-emerald-200 flex items-center justify-center text-[#0E8A5F] shrink-0">
                    {isScanning ? (
                      <RefreshCw className="w-5 h-5 animate-spin" />
                    ) : (
                      <UploadCloud className="w-5 h-5" />
                    )}
                  </div>
                  <div className="min-w-0">
                    <div className="text-sm font-semibold text-slate-900 flex items-center gap-2 flex-wrap">
                      <span>
                        {isScanning
                          ? '발주서 파일 내용을 분석 중입니다...'
                          : '발주서 파일 업로드 (클릭 또는 드래그)'}
                      </span>
                      {clientOrder.sourceFileName && (
                        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-md bg-emerald-100 text-[#0F2E26] text-xs font-medium">
                          <FileCheck2 className="w-3.5 h-3.5 text-[#0E8A5F]" />
                          {clientOrder.sourceFileName}
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-slate-500 truncate mt-0.5">
                      지원 형식: PDF, Excel(XLSX/CSV), 이미지(JPG/PNG) — 업로드 시 아래 입력란에 자동 반영됩니다.
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-2 shrink-0">
                  {uploadedPreviewUrl && (
                    <a
                      href={uploadedPreviewUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="px-3 py-1.5 rounded-lg bg-white border border-slate-300 text-xs font-medium text-[#0E8A5F] hover:bg-emerald-50"
                    >
                      원본 미리보기
                    </a>
                  )}
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    className="px-3.5 py-1.5 rounded-lg bg-white hover:bg-slate-100 text-slate-800 border border-slate-300 text-xs font-semibold cursor-pointer"
                  >
                    파일 선택
                  </button>
                </div>
              </div>

              {/* Full-Width Client Info & Ordered Kiosks */}
              <div className="space-y-5">
                {/* Client Info Box */}
                <div className="p-5 rounded-2xl bg-slate-50/70 border border-slate-200 space-y-4">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <h3 className="text-base font-semibold text-[#0F2E26] flex items-center gap-2">
                      <Building2 className="w-5 h-5 text-[#0E8A5F]" />
                      수주 거래처(고객사) 정보
                    </h3>
                    <button
                      type="button"
                      onClick={() => setShowAddClientForm((v) => !v)}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-medium bg-white hover:bg-slate-100 text-slate-700 border border-slate-300 transition-colors cursor-pointer"
                    >
                      <UserPlus className="w-3.5 h-3.5 text-[#0E8A5F]" />
                      {showAddClientForm ? '닫기' : '+ 신규 고객사 등록'}
                    </button>
                  </div>

                  {/* Saved Client Partners Quick Chips */}
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-xs text-slate-500">등록 고객사 선택:</span>
                    {clientPartners.map((partner) => {
                      const isSelected =
                        Boolean(clientOrder.clientName) && clientOrder.clientName === partner.name
                      return (
                        <div
                          key={partner.id}
                          className={`inline-flex items-center gap-1.5 pl-3 pr-1.5 py-1 rounded-lg text-xs font-medium border transition-all ${
                            isSelected
                              ? 'bg-emerald-50 text-[#0E8A5F] border-emerald-400'
                              : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-100'
                          }`}
                        >
                          <button
                            type="button"
                            onClick={() => handleSelectClientPartner(partner)}
                            className="cursor-pointer"
                          >
                            {partner.name}
                          </button>
                          <button
                            type="button"
                            title="거래처 삭제"
                            onClick={() => handleDeleteClientPartner(partner.id, partner.name)}
                            className="p-0.5 rounded hover:bg-rose-100 text-slate-400 hover:text-rose-600 cursor-pointer"
                          >
                            <X className="w-3 h-3" />
                          </button>
                        </div>
                      )
                    })}
                  </div>

                  {/* Optional Quick Add New Client Form */}
                  {showAddClientForm && (
                    <div className="p-4 rounded-xl bg-emerald-50/60 border border-emerald-200 space-y-3">
                      <div className="text-sm font-semibold text-[#0F2E26]">
                        신규 고객사 빠른 등록
                      </div>
                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-sm">
                        <input
                          type="text"
                          placeholder="거래처명 (필수)"
                          value={newClientForm.name}
                          onChange={(e) =>
                            setNewClientForm({ ...newClientForm, name: e.target.value })
                          }
                          className="px-3 py-2 rounded-lg bg-white border border-emerald-200 text-slate-900"
                        />
                        <input
                          type="text"
                          placeholder="사업자번호 (예: 123-45-67890)"
                          value={newClientForm.bizNo}
                          onChange={(e) =>
                            setNewClientForm({ ...newClientForm, bizNo: e.target.value })
                          }
                          className="px-3 py-2 rounded-lg bg-white border border-emerald-200 text-slate-900"
                        />
                        <input
                          type="text"
                          placeholder="담당자명 / 직책"
                          value={newClientForm.manager}
                          onChange={(e) =>
                            setNewClientForm({ ...newClientForm, manager: e.target.value })
                          }
                          className="px-3 py-2 rounded-lg bg-white border border-emerald-200 text-slate-900"
                        />
                        <input
                          type="text"
                          placeholder="연락처 (예: 02-1234-5678)"
                          value={newClientForm.phone}
                          onChange={(e) =>
                            setNewClientForm({ ...newClientForm, phone: e.target.value })
                          }
                          className="px-3 py-2 rounded-lg bg-white border border-emerald-200 text-slate-900"
                        />
                        <input
                          type="email"
                          placeholder="이메일"
                          value={newClientForm.email}
                          onChange={(e) =>
                            setNewClientForm({ ...newClientForm, email: e.target.value })
                          }
                          className="px-3 py-2 rounded-lg bg-white border border-emerald-200 text-slate-900"
                        />
                        <input
                          type="text"
                          placeholder="기본 납품 주소"
                          value={newClientForm.address}
                          onChange={(e) =>
                            setNewClientForm({ ...newClientForm, address: e.target.value })
                          }
                          className="px-3 py-2 rounded-lg bg-white border border-emerald-200 text-slate-900"
                        />
                      </div>
                      <div className="flex justify-end gap-2">
                        <button
                          type="button"
                          onClick={() => setShowAddClientForm(false)}
                          className="px-3.5 py-1.5 rounded-lg text-xs font-medium bg-white text-slate-600 border border-slate-300 cursor-pointer"
                        >
                          취소
                        </button>
                        <button
                          type="button"
                          onClick={handleAddClientPartnerInStep1}
                          className="px-4 py-1.5 rounded-lg text-xs font-semibold bg-[#0E8A5F] text-white cursor-pointer"
                        >
                          저장 후 적용
                        </button>
                      </div>
                    </div>
                  )}

                  {/* Editable Client Info Inputs (Blank until file uploaded or manually entered) */}
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3.5 text-sm">
                    <div>
                      <label className="block text-xs font-medium text-slate-600 mb-1">
                        발주 거래처명 (상호)
                      </label>
                      <input
                        type="text"
                        placeholder="발주서 업로드 또는 직접 입력"
                        value={clientOrder.clientName}
                        onChange={(e) =>
                          setClientOrder({ ...clientOrder, clientName: e.target.value })
                        }
                        className="w-full px-3.5 py-2 rounded-xl bg-white border border-slate-300 text-slate-900 font-medium focus:outline-none focus:border-[#0E8A5F]"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-slate-600 mb-1">
                        사업자등록번호
                      </label>
                      <input
                        type="text"
                        placeholder="000-00-00000"
                        value={clientOrder.businessNo}
                        onChange={(e) =>
                          setClientOrder({ ...clientOrder, businessNo: e.target.value })
                        }
                        className="w-full px-3.5 py-2 rounded-xl bg-white border border-slate-300 text-slate-900 font-mono focus:outline-none focus:border-[#0E8A5F]"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-slate-600 mb-1">
                        문서번호 (발주번호)
                      </label>
                      <input
                        type="text"
                        placeholder="PO-YYYYMMDD-000"
                        value={clientOrder.orderNo}
                        onChange={(e) =>
                          setClientOrder({ ...clientOrder, orderNo: e.target.value })
                        }
                        className="w-full px-3.5 py-2 rounded-xl bg-white border border-slate-300 text-[#0E8A5F] font-mono font-medium focus:outline-none focus:border-[#0E8A5F]"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-slate-600 mb-1">
                        담당자명
                      </label>
                      <input
                        type="text"
                        placeholder="담당자 성명 / 직책"
                        value={clientOrder.managerName}
                        onChange={(e) =>
                          setClientOrder({ ...clientOrder, managerName: e.target.value })
                        }
                        className="w-full px-3.5 py-2 rounded-xl bg-white border border-slate-300 text-slate-900 focus:outline-none focus:border-[#0E8A5F]"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-slate-600 mb-1">
                        연락처
                      </label>
                      <input
                        type="text"
                        placeholder="02-0000-0000"
                        value={clientOrder.managerPhone}
                        onChange={(e) =>
                          setClientOrder({ ...clientOrder, managerPhone: e.target.value })
                        }
                        className="w-full px-3.5 py-2 rounded-xl bg-white border border-slate-300 text-slate-900 focus:outline-none focus:border-[#0E8A5F]"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-slate-600 mb-1">
                        이메일
                      </label>
                      <input
                        type="text"
                        placeholder="example@company.co.kr"
                        value={clientOrder.managerEmail}
                        onChange={(e) =>
                          setClientOrder({ ...clientOrder, managerEmail: e.target.value })
                        }
                        className="w-full px-3.5 py-2 rounded-xl bg-white border border-slate-300 text-slate-900 font-mono focus:outline-none focus:border-[#0E8A5F]"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-slate-600 mb-1">
                        발주일자
                      </label>
                      <input
                        type="date"
                        value={clientOrder.orderDate}
                        onChange={(e) =>
                          setClientOrder({ ...clientOrder, orderDate: e.target.value })
                        }
                        className="w-full px-3.5 py-2 rounded-xl bg-white border border-slate-300 text-slate-900 focus:outline-none focus:border-[#0E8A5F]"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-slate-600 mb-1">
                        납기요청일
                      </label>
                      <input
                        type="date"
                        value={clientOrder.deliveryDate}
                        onChange={(e) =>
                          setClientOrder({ ...clientOrder, deliveryDate: e.target.value })
                        }
                        className="w-full px-3.5 py-2 rounded-xl bg-white border border-slate-300 text-[#0E8A5F] font-medium focus:outline-none focus:border-[#0E8A5F]"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-slate-600 mb-1">
                        납품 장소
                      </label>
                      <input
                        type="text"
                        placeholder="납품 주소지 입력"
                        value={clientOrder.deliveryAddress}
                        onChange={(e) =>
                          setClientOrder({ ...clientOrder, deliveryAddress: e.target.value })
                        }
                        className="w-full px-3.5 py-2 rounded-xl bg-white border border-slate-300 text-slate-900 focus:outline-none focus:border-[#0E8A5F]"
                      />
                    </div>
                  </div>
                </div>

                {/* Ordered Kiosk Products Table */}
                <div className="p-5 rounded-2xl bg-slate-50/70 border border-slate-200 space-y-4">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div>
                      <h3 className="text-base font-semibold text-[#0F2E26] flex items-center gap-2">
                        <ClipboardList className="w-5 h-5 text-[#0E8A5F]" />
                        주문 키오스크 제품 및 수량
                      </h3>
                      <p className="text-xs text-slate-500 mt-0.5">
                        선택한 키오스크 모델의 표준 BOM 구성에 따라 자재 발주 수량이 자동 계산됩니다.
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => setActiveTab('MANAGE_BOM')}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-medium bg-white hover:bg-slate-100 text-slate-700 border border-slate-300 transition-colors cursor-pointer"
                      >
                        <Layers className="w-3.5 h-3.5 text-[#0E8A5F]" />
                        제품 · BOM 관리
                      </button>
                      <button
                        type="button"
                        onClick={handleAddOrderItem}
                        className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl text-xs font-semibold bg-[#0E8A5F] hover:bg-[#0B704D] text-white transition-colors cursor-pointer"
                      >
                        <Plus className="w-3.5 h-3.5" />
                        주문 품목 추가
                      </button>
                    </div>
                  </div>

                  <div className="overflow-x-auto bg-white rounded-xl border border-slate-200">
                    <table className="w-full text-left border-collapse text-sm">
                      <thead>
                        <tr className="bg-slate-100/80 border-b border-slate-200 text-slate-600">
                          <th className="py-3 px-4 font-medium">키오스크 모델 선택</th>
                          <th className="py-3 px-4 font-medium">규격 및 사양</th>
                          <th className="py-3 px-4 text-center font-medium w-44">주문 수량</th>
                          <th className="py-3 px-3 text-center font-medium w-16">삭제</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-200">
                        {clientOrder.items.length === 0 ? (
                          <tr>
                            <td colSpan={4} className="py-10 px-4 text-center text-slate-400">
                              <div className="flex flex-col items-center gap-2">
                                <p className="text-sm text-slate-500">
                                  접수된 주문 키오스크 품목이 없습니다.
                                </p>
                                <p className="text-xs text-slate-400">
                                  상단에 발주서 파일을 업로드하거나 우측 상단의{' '}
                                  <span className="text-[#0E8A5F] font-medium">
                                    [+ 주문 품목 추가]
                                  </span>{' '}
                                  버튼을 눌러 품목을 추가해 주세요.
                                </p>
                              </div>
                            </td>
                          </tr>
                        ) : (
                          clientOrder.items.map((item) => {
                            const matchedModel = kioskModels.find(
                              (m) => m.modelCode === item.modelCode
                            )
                            const modelStatus = matchedModel?.status || 'ACTIVE'
                            return (
                              <tr key={item.id} className="hover:bg-slate-50">
                                <td className="py-3.5 px-4">
                                  <select
                                    value={item.modelCode}
                                    onChange={(e) => handleModelChange(item.id, e.target.value)}
                                    className="w-full px-3 py-2 rounded-xl bg-white border border-slate-300 text-slate-900 font-medium text-sm focus:outline-none focus:border-[#0E8A5F]"
                                  >
                                    {kioskModels.map((m) => {
                                      const st =
                                        m.status === 'NEW'
                                          ? '[신제품] '
                                          : m.status === 'SOLD_OUT'
                                            ? '[일시품절] '
                                            : ''
                                      return (
                                        <option key={m.modelCode} value={m.modelCode}>
                                          {st}[{m.modelCode}] {m.modelName}
                                        </option>
                                      )
                                    })}
                                  </select>
                                  <div className="flex items-center gap-2 mt-1.5">
                                    {modelStatus === 'NEW' && (
                                      <span className="px-2 py-0.5 rounded text-[11px] font-medium bg-emerald-50 text-[#0E8A5F] border border-emerald-200">
                                        신제품
                                      </span>
                                    )}
                                    {modelStatus === 'SOLD_OUT' && (
                                      <span className="px-2 py-0.5 rounded text-[11px] font-medium bg-rose-50 text-rose-700 border border-rose-200">
                                        일시품절 모델
                                      </span>
                                    )}
                                    {matchedModel && (
                                      <button
                                        type="button"
                                        onClick={() => {
                                          setSelectedMasterModelCode(matchedModel.modelCode)
                                          setActiveTab('MANAGE_BOM')
                                        }}
                                        className="text-xs font-medium text-[#0E8A5F] hover:underline cursor-pointer"
                                      >
                                        구성 부품(BOM) 상세 보기 →
                                      </button>
                                    )}
                                  </div>
                                </td>
                                <td className="py-3.5 px-4">
                                  <input
                                    type="text"
                                    value={item.spec}
                                    onChange={(e) =>
                                      setClientOrder((prev) => ({
                                        ...prev,
                                        items: prev.items.map((it) =>
                                          it.id === item.id ? { ...it, spec: e.target.value } : it
                                        ),
                                      }))
                                    }
                                    className="w-full px-3 py-2 rounded-xl bg-white border border-slate-300 text-slate-700 text-sm focus:outline-none focus:border-[#0E8A5F]"
                                  />
                                </td>
                                <td className="py-3.5 px-4">
                                  <div className="flex items-center justify-center gap-1.5">
                                    <button
                                      type="button"
                                      onClick={() =>
                                        handleQuantityChange(item.id, item.quantity - 1)
                                      }
                                      className="w-8 h-8 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 font-medium cursor-pointer border border-slate-300 text-base"
                                    >
                                      -
                                    </button>
                                    <input
                                      type="number"
                                      min={1}
                                      value={item.quantity}
                                      onChange={(e) =>
                                        handleQuantityChange(item.id, Number(e.target.value) || 1)
                                      }
                                      className="w-16 text-center py-1.5 rounded-lg bg-white border border-slate-300 text-slate-900 font-semibold text-base"
                                    />
                                    <button
                                      type="button"
                                      onClick={() =>
                                        handleQuantityChange(item.id, item.quantity + 1)
                                      }
                                      className="w-8 h-8 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 font-medium cursor-pointer border border-slate-300 text-base"
                                    >
                                      +
                                    </button>
                                    <span className="text-slate-600 text-sm ml-1">대</span>
                                  </div>
                                </td>
                                <td className="py-3.5 px-3 text-center">
                                  <button
                                    type="button"
                                    onClick={() => handleRemoveOrderItem(item.id)}
                                    className="p-2 rounded-lg hover:bg-rose-50 text-slate-400 hover:text-rose-600 transition-colors cursor-pointer"
                                  >
                                    <Trash2 className="w-4 h-4" />
                                  </button>
                                </td>
                              </tr>
                            )
                          })
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>

              {/* Bottom CTA to Material Order */}
              <div className="pt-4 border-t border-slate-200 flex items-center justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setActiveTab('MATERIAL_ORDER')}
                  className="inline-flex items-center gap-2 px-6 py-3 rounded-xl text-sm sm:text-base font-semibold bg-[#0E8A5F] hover:bg-[#0B704D] text-white shadow-sm transition-all cursor-pointer"
                >
                  <span>자재 발주 화면으로 이동</span>
                  <ArrowRight className="w-5 h-5" />
                </button>
              </div>
            </section>
          )}

          {/* =====================================================================
              2. 자재 발주 (MATERIAL_ORDER: 소요 자재 BOM 확인·조정 + 공급처별 발주서 발행)
          ===================================================================== */}
          {activeTab === 'MATERIAL_ORDER' && (
            <div className="space-y-6">
              {/* Top Control Bar: Order Context + Sub-view Switcher */}
              <section className="bg-white border border-slate-200 rounded-2xl p-5 shadow-2xs flex flex-col lg:flex-row lg:items-center justify-between gap-4">
                <div>
                  <h2 className="text-xl font-bold text-[#0F2E26]">자재 발주</h2>
                  <p className="text-sm text-slate-500 mt-1">
                    접수된 키오스크 수량에 맞춰 산출된 자재 내역을 확인·조정하고, 공급처별 구매발주서(PDF·엑셀·인쇄·전송)를 바로 발행하세요.
                  </p>
                </div>

                {/* Quick View Mode Toggle (No Fixed Numbers) */}
                <div className="flex items-center gap-1.5 bg-slate-100 p-1 rounded-xl border border-slate-200 shrink-0">
                  {(
                    [
                      { key: 'ALL', label: '전체 한눈에 보기' },
                      { key: 'BOM_ONLY', label: '소요 자재 내역' },
                      { key: 'PO_ONLY', label: '발주처별 발주서' },
                    ] as const
                  ).map((v) => (
                    <button
                      key={v.key}
                      type="button"
                      onClick={() => setMaterialSubView(v.key)}
                      className={`px-3 py-1.5 rounded-lg text-xs sm:text-sm font-medium transition-all cursor-pointer ${
                        materialSubView === v.key
                          ? 'bg-white text-[#0F2E26] shadow-2xs'
                          : 'text-slate-600 hover:text-slate-900'
                      }`}
                    >
                      {v.label}
                    </button>
                  ))}
                </div>
              </section>

              {/* Part A: 산출된 소요 자재(BOM) 확인 및 수량 조정 */}
              {(materialSubView === 'ALL' || materialSubView === 'BOM_ONLY') && (
                <section className="bg-white border border-slate-200 rounded-2xl overflow-hidden shadow-2xs space-y-5 p-6">
                  <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-200 pb-4">
                    <div>
                      <h3 className="text-base sm:text-lg font-semibold text-slate-900 flex items-center gap-2">
                        <Boxes className="w-5 h-5 text-indigo-600" />
                        소요 자재(BOM) 산출 내역 및 발주수량 조정
                      </h3>
                      <p className="text-xs sm:text-sm text-slate-500 mt-0.5">
                        창고 현재고를 자동 차감하여 실제 발주할 수량을 계산합니다. 필요시 수량을 직접 수정하거나 품목을 추가할 수 있습니다.
                      </p>
                    </div>

                    <div className="flex flex-wrap items-center gap-2">
                      <label className="inline-flex items-center gap-2 text-xs sm:text-sm font-medium text-slate-700 cursor-pointer select-none bg-slate-50 px-3.5 py-2 rounded-xl border border-slate-200">
                        <input
                          type="checkbox"
                          checked={deductStock}
                          onChange={(e) => setDeductStock(e.target.checked)}
                          className="rounded accent-indigo-600 w-4 h-4"
                        />
                        <span>창고 현재고 자동 차감</span>
                      </label>

                      <button
                        type="button"
                        onClick={() => setActiveTab('MANAGE_INVENTORY')}
                        className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs sm:text-sm font-medium bg-amber-50 hover:bg-amber-100 text-amber-800 border border-amber-200 transition-colors cursor-pointer"
                      >
                        <Package className="w-4 h-4 text-amber-600" />
                        재고 관리
                      </button>

                      <button
                        type="button"
                        onClick={() => setShowAddBomModal((v) => !v)}
                        className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs sm:text-sm font-semibold bg-indigo-600 hover:bg-indigo-500 text-white transition-colors cursor-pointer"
                      >
                        <Plus className="w-4 h-4" />
                        자재 품목 추가
                      </button>
                    </div>
                  </div>

                  {/* Add Custom BOM Item Inline Form */}
                  {showAddBomModal && (
                    <div className="p-5 rounded-2xl bg-indigo-50/60 border border-indigo-200 space-y-4">
                      <div className="flex items-center justify-between">
                        <h4 className="text-sm font-semibold text-indigo-950 flex items-center gap-2">
                          <Boxes className="w-4 h-4 text-indigo-600" />
                          이번 발주에 추가할 자재 등록
                        </h4>
                        <button
                          type="button"
                          onClick={() => setShowAddBomModal(false)}
                          className="text-slate-400 hover:text-slate-700 cursor-pointer"
                        >
                          <X className="w-5 h-5" />
                        </button>
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-4 gap-3 text-sm">
                        <div>
                          <label className="block text-xs font-medium text-slate-700 mb-1">
                            부품코드
                          </label>
                          <input
                            type="text"
                            placeholder="예: TAP-ETC-001 (미입력시 자동)"
                            value={newBomPart.partCode}
                            onChange={(e) =>
                              setNewBomPart({ ...newBomPart, partCode: e.target.value })
                            }
                            className="w-full px-3 py-2 rounded-lg bg-white border border-indigo-200"
                          />
                        </div>
                        <div>
                          <label className="block text-xs font-medium text-slate-700 mb-1">
                            분류
                          </label>
                          <select
                            value={newBomPart.category}
                            onChange={(e) =>
                              setNewBomPart({
                                ...newBomPart,
                                category: e.target.value as PartCategory,
                              })
                            }
                            className="w-full px-3 py-2 rounded-lg bg-white border border-indigo-200 font-medium"
                          >
                            {PART_CATEGORIES.map((c) => (
                              <option key={c} value={c}>
                                {c}
                              </option>
                            ))}
                          </select>
                        </div>
                        <div className="sm:col-span-2">
                          <label className="block text-xs font-medium text-slate-700 mb-1">
                            부품명 (필수)
                          </label>
                          <input
                            type="text"
                            placeholder="예: 예비용 토너 카트리지"
                            value={newBomPart.partName}
                            onChange={(e) =>
                              setNewBomPart({ ...newBomPart, partName: e.target.value })
                            }
                            className="w-full px-3 py-2 rounded-lg bg-white border border-indigo-200"
                          />
                        </div>
                        <div className="sm:col-span-2">
                          <label className="block text-xs font-medium text-slate-700 mb-1">
                            상세 규격
                          </label>
                          <input
                            type="text"
                            placeholder="예: 대용량 정품 토너"
                            value={newBomPart.spec}
                            onChange={(e) => setNewBomPart({ ...newBomPart, spec: e.target.value })}
                            className="w-full px-3 py-2 rounded-lg bg-white border border-indigo-200"
                          />
                        </div>
                        <div>
                          <label className="block text-xs font-medium text-slate-700 mb-1">
                            필요수량 / 단위
                          </label>
                          <div className="flex gap-1.5">
                            <input
                              type="number"
                              min={1}
                              value={newBomPart.grossRequiredQty}
                              onChange={(e) =>
                                setNewBomPart({
                                  ...newBomPart,
                                  grossRequiredQty: Number(e.target.value) || 1,
                                })
                              }
                              className="w-2/3 px-3 py-2 rounded-lg bg-white border border-indigo-200 font-medium"
                            />
                            <input
                              type="text"
                              value={newBomPart.unit}
                              onChange={(e) =>
                                setNewBomPart({ ...newBomPart, unit: e.target.value })
                              }
                              className="w-1/3 px-2 py-2 rounded-lg bg-white border border-indigo-200 text-center"
                            />
                          </div>
                        </div>
                        <div>
                          <label className="block text-xs font-medium text-slate-700 mb-1">
                            매입 발주처 선택
                          </label>
                          <select
                            value={newBomPart.supplierId}
                            onChange={(e) =>
                              setNewBomPart({ ...newBomPart, supplierId: e.target.value })
                            }
                            className="w-full px-3 py-2 rounded-lg bg-white border border-indigo-200 font-medium"
                          >
                            {supplierPartners.map((s) => (
                              <option key={s.id} value={s.id}>
                                {s.name}
                              </option>
                            ))}
                          </select>
                        </div>
                      </div>

                      <div className="flex justify-end gap-2">
                        <button
                          type="button"
                          onClick={() => setShowAddBomModal(false)}
                          className="px-4 py-1.5 rounded-xl text-xs font-medium bg-white text-slate-600 border border-slate-300 cursor-pointer"
                        >
                          취소
                        </button>
                        <button
                          type="button"
                          onClick={handleAddCustomBomItem}
                          className="px-4 py-1.5 rounded-xl text-xs font-semibold bg-indigo-600 text-white cursor-pointer"
                        >
                          목록에 추가
                        </button>
                      </div>
                    </div>
                  )}

                  {/* Category Filter Bar */}
                  <div className="flex items-center justify-between flex-wrap gap-2">
                    <div className="flex items-center gap-1.5 flex-wrap">
                      {CATEGORIES.map((cat) => (
                        <button
                          key={cat}
                          type="button"
                          onClick={() => setSelectedCategory(cat)}
                          className={`px-3 py-1.5 rounded-xl text-xs sm:text-sm font-medium transition-colors cursor-pointer ${
                            selectedCategory === cat
                              ? 'bg-indigo-600 text-white'
                              : 'bg-slate-100 text-slate-600 hover:bg-slate-200/80'
                          }`}
                        >
                          {cat}
                        </button>
                      ))}
                    </div>

                    {(Object.keys(manualOverrides).length > 0 ||
                      deletedPartCodes.length > 0 ||
                      customAddedBom.length > 0 ||
                      Object.keys(partEdits).length > 0) && (
                      <button
                        type="button"
                        onClick={() => {
                          setManualOverrides({})
                          setDeletedPartCodes([])
                          setCustomAddedBom([])
                          setPartEdits({})
                          setEditingPartCode(null)
                          showToast('자재 수량 변경 사항이 초기 상태로 복원되었습니다.')
                        }}
                        className="text-xs sm:text-sm font-medium text-indigo-600 hover:text-indigo-800 underline cursor-pointer"
                      >
                        편집 내역 초기화
                      </button>
                    )}
                  </div>

                  {/* BOM Table */}
                  <div className="overflow-x-auto rounded-xl border border-slate-200">
                    <table className="w-full min-w-[1020px] text-left border-collapse text-sm">
                      <thead>
                        <tr className="bg-slate-100/80 text-slate-600 border-b border-slate-200 whitespace-nowrap">
                          <th className="py-3 px-4 font-medium w-[145px]">부품코드 / 분류</th>
                          <th className="py-3 px-4 font-medium min-w-[230px]">부품명 및 상세 규격</th>
                          <th className="py-3 px-4 font-medium min-w-[180px]">산출 근거 (적용 모델)</th>
                          <th className="py-3 px-4 text-right font-medium w-[110px]">총 필요수량</th>
                          <th className="py-3 px-4 text-right font-medium w-[110px]">창고 현재고</th>
                          <th className="py-3 px-4 text-center font-medium w-[135px]">실제 발주수량</th>
                          <th className="py-3 px-4 font-medium min-w-[190px]">매입 발주처 (공급사)</th>
                          <th className="py-3 px-3 text-center font-medium w-[90px]">관리</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-200">
                        {filteredBom.length === 0 ? (
                          <tr>
                            <td colSpan={8} className="py-12 px-4 text-center text-slate-400">
                              <div className="flex flex-col items-center gap-2.5">
                                <p className="text-sm text-slate-600">
                                  산출된 소요 자재 내역이 없습니다.
                                </p>
                                <p className="text-xs text-slate-400">
                                  먼저 <span className="font-medium text-slate-700">발주서 접수</span> 화면에서 발주서 파일을 업로드하거나 주문 키오스크 품목을 입력해 주세요.
                                </p>
                                <button
                                  type="button"
                                  onClick={() => setActiveTab('ORDER_INTAKE')}
                                  className="mt-1 px-4 py-2 rounded-lg bg-[#0E8A5F] hover:bg-[#0B704D] text-white text-xs font-semibold cursor-pointer"
                                >
                                  발주서 접수 화면으로 이동
                                </button>
                              </div>
                            </td>
                          </tr>
                        ) : (
                          filteredBom.map((part) => {
                            const isEditing = editingPartCode === part.partCode
                            return (
                              <tr key={part.partCode} className="hover:bg-slate-50/90 transition-colors">
                                <td className="py-3.5 px-4 whitespace-nowrap align-middle">
                                  <div className="font-mono font-medium text-[#0E8A5F] text-xs sm:text-sm">
                                    {part.partCode}
                                  </div>
                                  <span className="inline-block mt-1 px-2 py-0.5 rounded text-xs font-normal bg-slate-100 text-slate-600 whitespace-nowrap">
                                    {part.category}
                                  </span>
                                </td>

                                <td className="py-3.5 px-4 align-middle break-keep">
                                  {isEditing ? (
                                    <div className="space-y-1.5">
                                      <input
                                        type="text"
                                        value={part.partName}
                                        onChange={(e) =>
                                          handleUpdateBomField(part.partCode, 'partName', e.target.value)
                                        }
                                        className="w-full px-2.5 py-1 rounded-lg bg-white border border-emerald-500 font-medium text-slate-900"
                                      />
                                      <input
                                        type="text"
                                        value={part.spec}
                                        onChange={(e) =>
                                          handleUpdateBomField(part.partCode, 'spec', e.target.value)
                                        }
                                        className="w-full px-2.5 py-1 rounded-lg bg-white border border-slate-300 text-xs text-slate-700"
                                      />
                                    </div>
                                  ) : (
                                    <>
                                      <div className="font-medium text-slate-900 text-sm sm:text-base break-keep">
                                        {part.partName}
                                      </div>
                                      <div className="text-xs text-slate-500 mt-0.5 break-keep">
                                        {part.spec}
                                      </div>
                                    </>
                                  )}
                                </td>

                                <td className="py-3.5 px-4 align-middle">
                                  <div className="flex flex-wrap gap-1.5">
                                    {part.sourceModels.map((m) => (
                                      <button
                                        key={m.modelCode}
                                        type="button"
                                        title="클릭하여 해당 모델의 BOM 관리 화면으로 이동"
                                        onClick={() => {
                                          if (m.modelCode !== '수동추가') {
                                            setSelectedMasterModelCode(m.modelCode)
                                            setActiveTab('MANAGE_BOM')
                                          }
                                        }}
                                        className="px-2.5 py-1 rounded-lg bg-slate-100 hover:bg-emerald-50 text-slate-700 hover:text-[#0E8A5F] border border-slate-200 font-normal text-xs whitespace-nowrap transition-colors cursor-pointer"
                                      >
                                        {m.modelCode}: {m.orderQty}대 × {m.qtyPerUnit ?? 1}
                                        {part.unit} = <span className="font-medium">{m.subTotalQty}{part.unit}</span>
                                      </button>
                                    ))}
                                  </div>
                                </td>

                                <td className="py-3.5 px-4 text-right font-mono font-medium text-slate-800 text-sm sm:text-base whitespace-nowrap align-middle">
                                  {isEditing ? (
                                    <input
                                      type="number"
                                      min={0}
                                      value={part.grossRequiredQty}
                                      onChange={(e) =>
                                        handleUpdateBomField(
                                          part.partCode,
                                          'grossRequiredQty',
                                          Math.max(0, Number(e.target.value) || 0)
                                        )
                                      }
                                      className="w-20 text-right px-2 py-1 rounded-lg bg-white border border-emerald-500 font-medium"
                                    />
                                  ) : (
                                    <span>
                                      {part.grossRequiredQty.toLocaleString()}{' '}
                                      <span className="text-xs font-normal text-slate-500">{part.unit}</span>
                                    </span>
                                  )}
                                </td>

                                <td className="py-3.5 px-4 text-right font-mono text-sm whitespace-nowrap align-middle">
                                  {isEditing ? (
                                    <input
                                      type="number"
                                      min={0}
                                      value={part.stockQty}
                                      onChange={(e) =>
                                        handleUpdateBomField(
                                          part.partCode,
                                          'stockQty',
                                          Math.max(0, Number(e.target.value) || 0)
                                        )
                                      }
                                      className="w-16 text-right px-2 py-1 rounded-lg bg-white border border-emerald-400 font-medium"
                                    />
                                  ) : (
                                    <span className="inline-flex items-center justify-end gap-1 px-2.5 py-1 rounded-lg bg-emerald-50 border border-emerald-200/80 text-emerald-700 font-medium whitespace-nowrap">
                                      <span>{deductStock ? `-${part.stockQty}` : part.stockQty}</span>
                                      <span className="text-xs font-normal">{part.unit}</span>
                                    </span>
                                  )}
                                </td>

                                <td className="py-3.5 px-4 whitespace-nowrap align-middle">
                                  <div className="flex items-center justify-center gap-1.5">
                                    <input
                                      type="number"
                                      min={0}
                                      value={part.adjustedOrderQty}
                                      onChange={(e) =>
                                        setManualOverrides((prev) => ({
                                          ...prev,
                                          [part.partCode]: Math.max(0, Number(e.target.value) || 0),
                                        }))
                                      }
                                      className="w-20 text-center py-1.5 rounded-xl bg-emerald-50/70 border border-emerald-300 text-[#0F2E26] font-semibold text-base focus:outline-none focus:border-[#0E8A5F]"
                                    />
                                    <span className="text-slate-500 text-xs whitespace-nowrap">
                                      {part.unit}
                                    </span>
                                  </div>
                                </td>

                                <td className="py-3.5 px-4 align-middle whitespace-nowrap">
                                  {isEditing ? (
                                    <select
                                      value={part.supplierId}
                                      onChange={(e) =>
                                        handleUpdateBomField(part.partCode, 'supplierId', e.target.value)
                                      }
                                      className="w-full px-2.5 py-1.5 rounded-lg bg-white border border-emerald-500 font-medium text-slate-900 text-sm"
                                    >
                                      {supplierPartners.map((s) => (
                                        <option key={s.id} value={s.id}>
                                          {s.name}
                                        </option>
                                      ))}
                                    </select>
                                  ) : (
                                    <>
                                      <div className="font-medium text-slate-900">{part.supplierName}</div>
                                      <div className="text-xs text-slate-500 mt-0.5">
                                        {part.supplierManager} ({part.supplierPhone}) · 납기{' '}
                                        {part.leadTimeDays}일
                                      </div>
                                    </>
                                  )}
                                </td>

                                <td className="py-3.5 px-3 text-center whitespace-nowrap align-middle">
                                  <div className="flex items-center justify-center gap-1">
                                    <button
                                      type="button"
                                      title={isEditing ? '수정 완료' : '부품 정보 수정'}
                                      onClick={() =>
                                        setEditingPartCode(isEditing ? null : part.partCode)
                                      }
                                      className={`p-2 rounded-lg transition-colors cursor-pointer ${
                                        isEditing
                                          ? 'bg-emerald-600 text-white'
                                          : 'hover:bg-slate-100 text-slate-500 hover:text-[#0E8A5F]'
                                      }`}
                                    >
                                      {isEditing ? (
                                        <Check className="w-4 h-4" />
                                      ) : (
                                        <Pencil className="w-4 h-4" />
                                      )}
                                    </button>
                                    <button
                                      type="button"
                                      title="항목 삭제"
                                      onClick={() => handleDeleteBomItem(part.partCode, part.partName)}
                                      className="p-2 rounded-lg hover:bg-rose-50 text-slate-400 hover:text-rose-600 transition-colors cursor-pointer"
                                    >
                                      <Trash2 className="w-4 h-4" />
                                    </button>
                                  </div>
                                </td>
                              </tr>
                            )
                          })
                        )}
                      </tbody>
                    </table>
                  </div>
                </section>
              )}

              {/* Part B: 발주처별 매입 발주서(PO) 발행 및 전송 */}
              {(materialSubView === 'ALL' || materialSubView === 'PO_ONLY') && (
                <section className="bg-white border border-slate-200 rounded-2xl overflow-hidden shadow-2xs space-y-6 p-6">
                  {/* Header */}
                  <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 border-b border-slate-200 pb-4">
                    <div>
                      <div className="flex items-center gap-2.5">
                        <FileText className="w-5 h-5 text-[#0E8A5F]" />
                        <h3 className="text-base sm:text-lg font-semibold text-slate-900">
                          발주처별 구매발주서(PO) 발행 및 전송
                        </h3>
                      </div>
                      <p className="text-xs sm:text-sm text-slate-500 mt-1">
                        위 소요 자재 수량에 따라 공급업체별로 자동 분류된 발주서입니다. 양식 보기, PDF/엑셀 저장, 인쇄 및 이메일 발송을 지원합니다.
                      </p>
                    </div>

                    <div className="flex flex-wrap items-center gap-2">
                      <button
                        type="button"
                        onClick={handleDownloadAllExcel}
                        className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs sm:text-sm font-medium bg-emerald-50 hover:bg-emerald-100 text-[#0E8A5F] border border-emerald-200 transition-all cursor-pointer"
                      >
                        <FileSpreadsheet className="w-4 h-4" />
                        전체 엑셀(.xlsx) 일괄 저장
                      </button>
                      <button
                        type="button"
                        onClick={handleSendAllPdfEmails}
                        className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs sm:text-sm font-semibold bg-[#0E8A5F] hover:bg-[#0B704D] text-white shadow-2xs transition-all cursor-pointer"
                      >
                        <Send className="w-4 h-4" />
                        전체 공급처로 PDF 발주서 일괄 전송
                      </button>
                    </div>
                  </div>

                  {/* Generated PO Cards Grid */}
                  {purchaseOrders.length === 0 ? (
                    <div className="py-12 px-4 text-center rounded-xl border border-dashed border-slate-200 text-slate-400">
                      <p className="text-sm text-slate-600">발행할 구매발주서가 없습니다.</p>
                      <p className="text-xs text-slate-400 mt-1">
                        발주서 접수 화면에서 주문 키오스크를 입력하면 공급처별 구매발주서가 자동 생성됩니다.
                      </p>
                    </div>
                  ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                      {purchaseOrders.map((po) => (
                        <div
                          key={po.poNumber}
                          className="flex flex-col justify-between rounded-2xl bg-white border border-slate-200 hover:border-emerald-300 transition-all overflow-hidden shadow-2xs"
                        >
                          <div className="h-1 w-full bg-[#0E8A5F]" />

                          <div className="p-5 space-y-4 flex-1">
                            {/* Card Header */}
                            <div className="flex items-start justify-between gap-3">
                              <div className="flex items-center gap-3 min-w-0">
                                <div className="p-2.5 rounded-xl bg-emerald-50 text-[#0E8A5F] border border-emerald-100 shrink-0">
                                  <FileText className="w-5 h-5" />
                                </div>
                                <div className="min-w-0">
                                  <div className="flex items-center gap-2 text-xs text-slate-500">
                                    <span className="font-mono font-medium text-[#0E8A5F]">
                                      {po.poNumber}
                                    </span>
                                    <span>|</span>
                                    <span>납기요청: {po.requestedDeliveryDate}</span>
                                  </div>
                                  <h4 className="text-base font-semibold text-slate-900 truncate mt-0.5">
                                    {po.supplierName} 귀하
                                  </h4>
                                </div>
                              </div>

                              <span
                                className={`px-2.5 py-0.5 rounded-full text-xs font-medium shrink-0 ${
                                  po.status === 'SENT'
                                    ? 'bg-emerald-50 text-[#0E8A5F] border border-emerald-200'
                                    : po.status === 'DOWNLOADED'
                                      ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                                      : 'bg-slate-100 text-slate-700 border border-slate-200'
                                }`}
                              >
                                {po.status === 'SENT'
                                  ? '전송 완료'
                                  : po.status === 'DOWNLOADED'
                                    ? '저장 완료'
                                    : '발행 준비'}
                              </span>
                            </div>

                            {/* Supplier Metadata */}
                            <div className="text-xs sm:text-sm text-slate-600 grid grid-cols-1 sm:grid-cols-2 gap-1.5 bg-slate-50 p-3 rounded-xl border border-slate-200/70">
                              <div>
                                담당자:{' '}
                                <span className="font-medium text-slate-900">
                                  {po.supplierManager}
                                </span>
                              </div>
                              <div>
                                연락처:{' '}
                                <span className="font-medium text-slate-900">
                                  {po.supplierPhone}
                                </span>
                              </div>
                              <div className="sm:col-span-2">
                                이메일:{' '}
                                <span className="font-mono text-[#0E8A5F]">{po.supplierEmail}</span>
                              </div>
                            </div>

                            {/* Included BOM Parts Table inside PO Card */}
                            <div className="space-y-1.5">
                              <div className="flex items-center justify-between text-xs sm:text-sm font-medium text-slate-700">
                                <span>발주 품목</span>
                                <span className="text-[#0E8A5F]">
                                  합계 {po.totalOrderQty.toLocaleString()}개
                                </span>
                              </div>
                              <div className="border border-slate-200 rounded-xl overflow-hidden">
                                <table className="w-full text-left border-collapse text-xs sm:text-sm">
                                  <thead>
                                    <tr className="bg-slate-50 text-slate-500 border-b border-slate-200 text-xs">
                                      <th className="py-2 px-3 font-medium">부품코드</th>
                                      <th className="py-2 px-3 font-medium">품목명</th>
                                      <th className="py-2 px-3 font-medium text-right">발주수량</th>
                                    </tr>
                                  </thead>
                                  <tbody className="divide-y divide-slate-200/70">
                                    {po.items.map((item) => (
                                      <tr key={item.partCode} className="bg-white">
                                        <td className="py-2 px-3 font-mono text-[#0E8A5F] text-xs">
                                          {item.partCode}
                                        </td>
                                        <td className="py-2 px-3 text-slate-800 truncate max-w-[200px]">
                                          {item.partName}
                                        </td>
                                        <td className="py-2 px-3 text-right font-mono font-semibold text-slate-900">
                                          {item.adjustedOrderQty.toLocaleString()} {item.unit}
                                        </td>
                                      </tr>
                                    ))}
                                  </tbody>
                                </table>
                              </div>
                            </div>
                          </div>

                          {/* Card Footer Action Buttons */}
                          <div className="px-5 py-3.5 bg-slate-50 border-t border-slate-200 space-y-2">
                            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                              <button
                                type="button"
                                onClick={() => setPreviewPo(po)}
                                className="inline-flex items-center justify-center gap-1.5 py-2 px-2.5 rounded-xl text-xs sm:text-sm font-medium bg-white hover:bg-slate-100 text-slate-700 border border-slate-300 transition-colors cursor-pointer"
                              >
                                <Eye className="w-4 h-4 text-[#0E8A5F]" />
                                양식 보기
                              </button>
                              <button
                                type="button"
                                onClick={() => handlePrintPo(po)}
                                className="inline-flex items-center justify-center gap-1.5 py-2 px-2.5 rounded-xl text-xs sm:text-sm font-medium bg-white hover:bg-slate-100 text-slate-700 border border-slate-300 transition-colors cursor-pointer"
                              >
                                <Printer className="w-4 h-4 text-slate-600" />
                                프린트
                              </button>
                              <button
                                type="button"
                                onClick={() => handleDownloadPdf(po)}
                                className="inline-flex items-center justify-center gap-1.5 py-2 px-2.5 rounded-xl text-xs sm:text-sm font-medium bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 transition-colors cursor-pointer"
                              >
                                <Download className="w-4 h-4" />
                                PDF 저장
                              </button>
                              <button
                                type="button"
                                onClick={() => handleDownloadExcel(po)}
                                className="inline-flex items-center justify-center gap-1.5 py-2 px-2.5 rounded-xl text-xs sm:text-sm font-medium bg-emerald-50 hover:bg-emerald-100 text-emerald-700 border border-emerald-200 transition-colors cursor-pointer"
                              >
                                <FileSpreadsheet className="w-4 h-4" />
                                엑셀 저장
                              </button>
                            </div>

                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                              <button
                                type="button"
                                onClick={() => handleSendPoPdfEmail(po)}
                                className="w-full inline-flex items-center justify-center gap-1.5 py-2 px-3 rounded-xl text-xs sm:text-sm font-semibold bg-[#0E8A5F] hover:bg-[#0B704D] text-white transition-colors cursor-pointer"
                              >
                                <Send className="w-3.5 h-3.5" />
                                PDF 발주서 이메일 전송
                              </button>

                              <button
                                type="button"
                                onClick={() => handleReceivePoItems(po)}
                                disabled={Boolean(poReceivedMap[po.poNumber])}
                                className={`w-full inline-flex items-center justify-center gap-1.5 py-2 px-3 rounded-xl text-xs font-medium border transition-colors cursor-pointer ${
                                  poReceivedMap[po.poNumber]
                                    ? 'bg-emerald-50 text-emerald-700 border-emerald-200 cursor-default'
                                    : 'bg-amber-50 hover:bg-amber-100 text-amber-800 border-amber-200'
                                }`}
                              >
                                <PackageCheck className="w-3.5 h-3.5" />
                                {poReceivedMap[po.poNumber]
                                  ? '창고 입고 반영됨'
                                  : '입고 완료 처리'}
                              </button>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </section>
              )}
            </div>
          )}

          {/* =====================================================================
              3. 재고 관리 (MANAGE_INVENTORY: 부품 창고 현재고 및 입·출고 관리)
          ===================================================================== */}
          {activeTab === 'MANAGE_INVENTORY' && (
            <div className="space-y-6">
              <section className="bg-white border border-slate-200 rounded-2xl overflow-hidden shadow-2xs space-y-6 p-6">
                {/* Header */}
                <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 border-b border-slate-200 pb-5">
                  <div>
                    <h2 className="text-xl font-bold text-slate-900">재고 관리</h2>
                    <p className="text-sm text-slate-500 mt-1">
                      부품별 창고 현재고와 안전재고 기준을 관리합니다. 이곳의 현재고 수량이 자재 발주 화면의 현재고 차감 계산에 실시간으로 반영됩니다.
                    </p>
                  </div>

                  <div className="flex flex-wrap items-center gap-2">
                    <button
                      type="button"
                      onClick={() => setActiveTab('MATERIAL_ORDER')}
                      className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs sm:text-sm font-medium bg-slate-100 hover:bg-slate-200 text-slate-700 transition-colors cursor-pointer"
                    >
                      자재 발주 화면으로 이동
                    </button>
                    <button
                      type="button"
                      onClick={() => setShowAddInventoryPartForm((v) => !v)}
                      className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs sm:text-sm font-semibold bg-amber-600 hover:bg-amber-500 text-white shadow-2xs transition-colors cursor-pointer"
                    >
                      <Plus className="w-4 h-4" />
                      신규 재고 부품 등록
                    </button>
                  </div>
                </div>

                {/* Status Filter Tabs (Only Item Titles, No Fixed Numbers Below) */}
                <div className="flex items-center gap-2 flex-wrap">
                  {(
                    [
                      { key: 'ALL', label: '전체 관리 부품' },
                      { key: 'NORMAL', label: '정상 보유 (안전재고 이상)' },
                      { key: 'LOW', label: '재고 부족 (안전재고 미달)' },
                      { key: 'EMPTY', label: '품절 품목 (현재고 0)' },
                    ] as const
                  ).map((st) => (
                    <button
                      key={st.key}
                      type="button"
                      onClick={() => setInventoryStatusFilter(st.key)}
                      className={`px-4 py-2 rounded-xl text-xs sm:text-sm font-medium border transition-all cursor-pointer ${
                        inventoryStatusFilter === st.key
                          ? 'bg-[#0E8A5F] text-white border-[#0E8A5F] shadow-2xs'
                          : 'bg-slate-50 hover:bg-slate-100 border-slate-200 text-slate-700'
                      }`}
                    >
                      {st.label}
                    </button>
                  ))}
                </div>

                {/* Add New Inventory Part Form */}
                {showAddInventoryPartForm && (
                  <div className="p-5 rounded-2xl bg-amber-50/60 border border-amber-200 space-y-4">
                    <div className="flex items-center justify-between">
                      <h3 className="text-sm font-semibold text-amber-950 flex items-center gap-2">
                        <Package className="w-4 h-4 text-amber-600" />
                        창고 신규 재고 부품 등록
                      </h3>
                      <button
                        type="button"
                        onClick={() => setShowAddInventoryPartForm(false)}
                        className="text-slate-400 hover:text-slate-700 cursor-pointer"
                      >
                        <X className="w-5 h-5" />
                      </button>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-4 gap-3 text-sm">
                      <div>
                        <label className="block text-xs font-medium text-slate-700 mb-1">
                          부품코드
                        </label>
                        <input
                          type="text"
                          placeholder="예: TAP-ETC-002"
                          value={newInventoryPart.partCode}
                          onChange={(e) =>
                            setNewInventoryPart({ ...newInventoryPart, partCode: e.target.value })
                          }
                          className="w-full px-3 py-2 rounded-xl bg-white border border-amber-300"
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-medium text-slate-700 mb-1">
                          카테고리
                        </label>
                        <select
                          value={newInventoryPart.category}
                          onChange={(e) =>
                            setNewInventoryPart({
                              ...newInventoryPart,
                              category: e.target.value as PartCategory,
                            })
                          }
                          className="w-full px-3 py-2 rounded-xl bg-white border border-amber-300 font-medium"
                        >
                          {PART_CATEGORIES.map((c) => (
                            <option key={c} value={c}>
                              {c}
                            </option>
                          ))}
                        </select>
                      </div>
                      <div className="sm:col-span-2">
                        <label className="block text-xs font-medium text-slate-700 mb-1">
                          부품명 (필수)
                        </label>
                        <input
                          type="text"
                          placeholder="예: CAT.6 기가비트 랜 케이블 (3M)"
                          value={newInventoryPart.partName}
                          onChange={(e) =>
                            setNewInventoryPart({ ...newInventoryPart, partName: e.target.value })
                          }
                          className="w-full px-3 py-2 rounded-xl bg-white border border-amber-300"
                        />
                      </div>
                      <div className="sm:col-span-2">
                        <label className="block text-xs font-medium text-slate-700 mb-1">
                          상세 규격
                        </label>
                        <input
                          type="text"
                          placeholder="예: STP 차폐, RJ45 커넥터"
                          value={newInventoryPart.spec}
                          onChange={(e) =>
                            setNewInventoryPart({ ...newInventoryPart, spec: e.target.value })
                          }
                          className="w-full px-3 py-2 rounded-xl bg-white border border-amber-300"
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-medium text-slate-700 mb-1">
                          기초 현재고 / 안전재고
                        </label>
                        <div className="flex gap-1.5">
                          <input
                            type="number"
                            min={0}
                            placeholder="현재고"
                            value={newInventoryPart.stockQty}
                            onChange={(e) =>
                              setNewInventoryPart({
                                ...newInventoryPart,
                                stockQty: Number(e.target.value) || 0,
                              })
                            }
                            className="w-1/2 px-3 py-2 rounded-xl bg-white border border-amber-300 font-medium"
                          />
                          <input
                            type="number"
                            min={0}
                            placeholder="안전재고"
                            value={newInventoryPart.safetyStockQty}
                            onChange={(e) =>
                              setNewInventoryPart({
                                ...newInventoryPart,
                                safetyStockQty: Number(e.target.value) || 0,
                              })
                            }
                            className="w-1/2 px-3 py-2 rounded-xl bg-white border border-amber-300 font-medium"
                          />
                        </div>
                      </div>
                      <div>
                        <label className="block text-xs font-medium text-slate-700 mb-1">
                          주 발주처
                        </label>
                        <select
                          value={newInventoryPart.supplierId}
                          onChange={(e) =>
                            setNewInventoryPart({ ...newInventoryPart, supplierId: e.target.value })
                          }
                          className="w-full px-3 py-2 rounded-xl bg-white border border-amber-300 font-medium"
                        >
                          {supplierPartners.map((s) => (
                            <option key={s.id} value={s.id}>
                              {s.name}
                            </option>
                          ))}
                        </select>
                      </div>
                    </div>

                    <div className="flex justify-end gap-2">
                      <button
                        type="button"
                        onClick={() => setShowAddInventoryPartForm(false)}
                        className="px-4 py-1.5 rounded-xl text-xs font-medium bg-white border border-slate-300 cursor-pointer"
                      >
                        취소
                      </button>
                      <button
                        type="button"
                        onClick={handleAddWarehousePart}
                        className="px-4 py-1.5 rounded-xl text-xs font-semibold bg-amber-600 text-white cursor-pointer"
                      >
                        등록하기
                      </button>
                    </div>
                  </div>
                )}

                {/* Filter & Search Bar */}
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
                  <div className="flex items-center gap-1.5 flex-wrap">
                    {CATEGORIES.map((cat) => (
                      <button
                        key={cat}
                        type="button"
                        onClick={() => setInventoryCategory(cat)}
                        className={`px-3 py-1.5 rounded-xl text-xs sm:text-sm font-medium transition-colors cursor-pointer ${
                          inventoryCategory === cat
                            ? 'bg-amber-600 text-white'
                            : 'bg-slate-100 text-slate-600 hover:bg-slate-200/80'
                        }`}
                      >
                        {cat}
                      </button>
                    ))}
                  </div>

                  <div className="relative w-full md:w-72">
                    <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                    <input
                      type="text"
                      placeholder="부품코드, 부품명, 공급사 검색..."
                      value={inventorySearch}
                      onChange={(e) => setInventorySearch(e.target.value)}
                      className="w-full pl-9 pr-4 py-2 rounded-xl bg-slate-50 border border-slate-300 text-sm focus:outline-none focus:border-amber-500 focus:bg-white"
                    />
                  </div>
                </div>

                {/* Inventory Table */}
                <div className="overflow-x-auto rounded-xl border border-slate-200">
                  <table className="w-full min-w-[1040px] text-left border-collapse text-sm">
                    <thead>
                      <tr className="bg-slate-100/80 text-slate-600 border-b border-slate-200 whitespace-nowrap">
                        <th className="py-3 px-4 font-medium w-[145px]">부품코드 / 분류</th>
                        <th className="py-3 px-4 font-medium min-w-[230px]">부품명 및 규격</th>
                        <th className="py-3 px-4 text-center font-medium w-[110px]">재고 상태</th>
                        <th className="py-3 px-4 text-center font-medium w-[210px]">
                          창고 현재고 (입·출고 조정)
                        </th>
                        <th className="py-3 px-4 text-center font-medium w-[110px]">안전재고 기준</th>
                        <th className="py-3 px-4 text-right font-medium w-[130px]">
                          현재 수주 필요량
                        </th>
                        <th className="py-3 px-4 font-medium min-w-[180px]">주 매입 발주처</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-200">
                      {filteredWarehouseInventory.map((part) => (
                        <tr key={part.partCode} className="hover:bg-slate-50/90 transition-colors">
                          <td className="py-3.5 px-4 whitespace-nowrap align-middle">
                            <div className="font-mono font-medium text-indigo-600 text-xs sm:text-sm">
                              {part.partCode}
                            </div>
                            <span className="inline-block mt-1 px-2 py-0.5 rounded text-xs font-normal bg-slate-100 text-slate-600 whitespace-nowrap">
                              {part.category}
                            </span>
                          </td>

                          <td className="py-3.5 px-4 align-middle break-keep">
                            <div className="font-medium text-slate-900 text-sm sm:text-base">
                              {part.partName}
                            </div>
                            <div className="text-xs text-slate-500 mt-0.5">{part.spec}</div>
                            <div className="flex flex-wrap gap-1 mt-1.5">
                              {part.usedInModels.map((mc) => (
                                <span
                                  key={mc}
                                  className="px-2 py-0.5 rounded bg-slate-100 text-slate-600 font-mono text-[11px] whitespace-nowrap"
                                >
                                  {mc}
                                </span>
                              ))}
                            </div>
                          </td>

                          <td className="py-3.5 px-4 text-center whitespace-nowrap align-middle">
                            {part.stockStatus === 'EMPTY' ? (
                              <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium bg-rose-50 text-rose-700 border border-rose-200">
                                품절 (0)
                              </span>
                            ) : part.stockStatus === 'LOW' ? (
                              <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium bg-amber-50 text-amber-800 border border-amber-200">
                                재고 부족
                              </span>
                            ) : (
                              <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium bg-emerald-50 text-emerald-700 border border-emerald-200">
                                정상 보유
                              </span>
                            )}
                          </td>

                          <td className="py-3.5 px-4 whitespace-nowrap align-middle">
                            <div className="flex items-center justify-center gap-1.5">
                              <button
                                type="button"
                                title="1개 출고(-1)"
                                onClick={() =>
                                  handleAdjustWarehouseStock(
                                    part.partCode,
                                    part.stockQty - 1,
                                    '재고 관리에서 -1 출고 차감',
                                    'OUT'
                                  )
                                }
                                className="w-8 h-8 rounded-lg bg-slate-100 hover:bg-rose-50 hover:text-rose-700 text-slate-700 font-medium border border-slate-300 transition-colors cursor-pointer"
                              >
                                -1
                              </button>
                              <input
                                type="number"
                                min={0}
                                value={part.stockQty}
                                onChange={(e) =>
                                  handleAdjustWarehouseStock(
                                    part.partCode,
                                    Math.max(0, Number(e.target.value) || 0),
                                    '창고 재고 수량 직접 수정',
                                    'ADJUST'
                                  )
                                }
                                className="w-18 text-center py-1.5 rounded-xl bg-emerald-50/70 border border-emerald-300 text-emerald-950 font-semibold text-base focus:outline-none focus:border-emerald-600"
                              />
                              <span className="text-xs text-slate-500">{part.unit}</span>
                              <button
                                type="button"
                                title="1개 입고(+1)"
                                onClick={() =>
                                  handleAdjustWarehouseStock(
                                    part.partCode,
                                    part.stockQty + 1,
                                    '재고 관리에서 +1 입고 추가',
                                    'IN'
                                  )
                                }
                                className="w-8 h-8 rounded-lg bg-slate-100 hover:bg-emerald-50 hover:text-emerald-700 text-slate-700 font-medium border border-slate-300 transition-colors cursor-pointer"
                              >
                                +1
                              </button>
                              <button
                                type="button"
                                title="5개 입고(+5)"
                                onClick={() =>
                                  handleAdjustWarehouseStock(
                                    part.partCode,
                                    part.stockQty + 5,
                                    '재고 관리에서 +5 입고 추가',
                                    'IN'
                                  )
                                }
                                className="px-2 h-8 rounded-lg bg-emerald-50 hover:bg-emerald-100 text-emerald-700 font-medium border border-emerald-200 text-xs transition-colors cursor-pointer"
                              >
                                +5
                              </button>
                            </div>
                          </td>

                          <td className="py-3.5 px-4 text-center whitespace-nowrap align-middle">
                            <div className="inline-flex items-center gap-1">
                              <input
                                type="number"
                                min={0}
                                value={part.safetyStockQty}
                                onChange={(e) =>
                                  setSafetyStockMap((prev) => ({
                                    ...prev,
                                    [part.partCode]: Math.max(0, Number(e.target.value) || 0),
                                  }))
                                }
                                className="w-14 text-center py-1 rounded-lg bg-white border border-slate-300 text-slate-700 font-medium text-sm"
                              />
                              <span className="text-xs text-slate-500">{part.unit}</span>
                            </div>
                          </td>

                          <td className="py-3.5 px-4 text-right font-mono whitespace-nowrap align-middle">
                            {part.currentReqQty > 0 ? (
                              <div>
                                <span className="font-semibold text-indigo-700 text-sm sm:text-base">
                                  {part.currentReqQty.toLocaleString()} {part.unit}
                                </span>
                                <div className="text-xs text-slate-500">
                                  {part.stockQty >= part.currentReqQty ? (
                                    <span className="text-emerald-600">
                                      재고 충분 (잔여 {part.stockQty - part.currentReqQty})
                                    </span>
                                  ) : (
                                    <span className="text-rose-600 font-medium">
                                      발주 필요 ({part.currentReqQty - part.stockQty} 부족)
                                    </span>
                                  )}
                                </div>
                              </div>
                            ) : (
                              <span className="text-xs text-slate-400">해당없음</span>
                            )}
                          </td>

                          <td className="py-3.5 px-4 whitespace-nowrap align-middle">
                            <div className="font-medium text-slate-900">{part.supplierName}</div>
                            <div className="text-xs text-slate-500 mt-0.5">
                              {part.supplierManager} ({part.supplierPhone})
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </section>

              {/* Recent Inventory In/Out History Log */}
              <section className="bg-white border border-slate-200 rounded-2xl p-6 shadow-2xs space-y-4">
                <div className="flex items-center justify-between border-b border-slate-200 pb-4">
                  <div className="flex items-center gap-2">
                    <History className="w-5 h-5 text-amber-600" />
                    <h3 className="text-base font-semibold text-slate-900">
                      최근 입·출고 및 재고 조정 이력
                    </h3>
                  </div>
                  <span className="text-xs text-slate-500">
                    재고 수량 변경 및 발주서 입고 내역이 자동 기록됩니다
                  </span>
                </div>

                <div className="overflow-x-auto rounded-xl border border-slate-200">
                  <table className="w-full min-w-[760px] text-left border-collapse text-sm">
                    <thead>
                      <tr className="bg-slate-50 text-slate-600 border-b border-slate-200 whitespace-nowrap text-xs">
                        <th className="py-2.5 px-4 font-medium">일시</th>
                        <th className="py-2.5 px-4 font-medium">구분</th>
                        <th className="py-2.5 px-4 font-medium">부품코드 / 부품명</th>
                        <th className="py-2.5 px-4 text-right font-medium">변동 수량</th>
                        <th className="py-2.5 px-4 text-right font-medium">변경 후 현재고</th>
                        <th className="py-2.5 px-4 font-medium">비고 (사유)</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-200">
                      {inventoryLogs.map((log) => (
                        <tr key={log.id} className="hover:bg-slate-50">
                          <td className="py-3 px-4 font-mono text-xs text-slate-500 whitespace-nowrap">
                            {log.timestamp}
                          </td>
                          <td className="py-3 px-4 whitespace-nowrap">
                            <span
                              className={`px-2 py-0.5 rounded text-xs font-medium ${
                                log.type === 'IN'
                                  ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                                  : log.type === 'OUT'
                                    ? 'bg-rose-50 text-rose-700 border border-rose-200'
                                    : 'bg-indigo-50 text-indigo-700 border border-indigo-200'
                              }`}
                            >
                              {log.type === 'IN' ? '입고(+)' : log.type === 'OUT' ? '출고(-)' : '수량조정'}
                            </span>
                          </td>
                          <td className="py-3 px-4 whitespace-nowrap">
                            <span className="font-mono text-xs font-medium text-indigo-600 mr-2">
                              {log.partCode}
                            </span>
                            <span className="font-medium text-slate-900">{log.partName}</span>
                          </td>
                          <td
                            className={`py-3 px-4 text-right font-mono font-semibold whitespace-nowrap ${
                              log.changeQty > 0 ? 'text-emerald-600' : 'text-rose-600'
                            }`}
                          >
                            {log.changeQty > 0 ? `+${log.changeQty}` : log.changeQty} {log.unit}
                          </td>
                          <td className="py-3 px-4 text-right font-mono font-medium text-slate-900 whitespace-nowrap">
                            {log.afterStockQty} {log.unit}
                          </td>
                          <td className="py-3 px-4 text-slate-600 text-xs">{log.note}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </section>
            </div>
          )}

          {/* =====================================================================
              4. 거래처 관리 (MANAGE_PARTNERS: 고객사 및 부품 매입 발주처 관리)
          ===================================================================== */}
          {activeTab === 'MANAGE_PARTNERS' && (
            <section className="bg-white border border-slate-200 rounded-2xl p-6 shadow-2xs space-y-5">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-200 pb-4">
                <div>
                  <h2 className="text-xl font-bold text-slate-900">거래처 관리</h2>
                  <p className="text-sm text-slate-500 mt-1">
                    수주 고객사 및 부품 매입 발주처(공급업체) 정보를 추가·수정·삭제할 수 있습니다.
                  </p>
                </div>

                <div className="flex items-center gap-2 flex-wrap">
                  {(['ALL', 'CLIENT', 'SUPPLIER'] as const).map((type) => (
                    <button
                      key={type}
                      type="button"
                      onClick={() => setPartnerFilter(type)}
                      className={`px-3.5 py-2 rounded-xl text-xs sm:text-sm font-medium cursor-pointer ${
                        partnerFilter === type
                          ? 'bg-[#0F2E26] text-white'
                          : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                      }`}
                    >
                      {type === 'ALL'
                        ? '전체'
                        : type === 'CLIENT'
                          ? '수주 고객사'
                          : '매입 발주처'}
                    </button>
                  ))}
                  <button
                    type="button"
                    onClick={() => setShowNewPartnerForm((v) => !v)}
                    className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs sm:text-sm font-semibold bg-[#0E8A5F] hover:bg-[#0B704D] text-white cursor-pointer"
                  >
                    <Plus className="w-4 h-4" />
                    거래처 추가
                  </button>
                </div>
              </div>

              {showNewPartnerForm && (
                <div className="p-5 rounded-2xl bg-indigo-50/60 border border-indigo-200 space-y-4">
                  <div className="text-sm font-semibold text-indigo-950">신규 거래처 등록</div>
                  <div className="grid grid-cols-1 sm:grid-cols-4 gap-3 text-sm">
                    <select
                      value={newPartner.type}
                      onChange={(e) =>
                        setNewPartner({
                          ...newPartner,
                          type: e.target.value as 'CLIENT' | 'SUPPLIER',
                        })
                      }
                      className="px-3 py-2 rounded-xl bg-white border border-indigo-200 font-medium"
                    >
                      <option value="SUPPLIER">매입 발주처 (부품 공급사)</option>
                      <option value="CLIENT">수주 고객사 (발주처)</option>
                    </select>
                    <input
                      type="text"
                      placeholder="업체명 (필수)"
                      value={newPartner.name}
                      onChange={(e) => setNewPartner({ ...newPartner, name: e.target.value })}
                      className="px-3 py-2 rounded-xl bg-white border border-indigo-200"
                    />
                    <input
                      type="text"
                      placeholder="사업자등록번호"
                      value={newPartner.bizNo}
                      onChange={(e) => setNewPartner({ ...newPartner, bizNo: e.target.value })}
                      className="px-3 py-2 rounded-xl bg-white border border-indigo-200"
                    />
                    <input
                      type="text"
                      placeholder="담당자명 / 직책"
                      value={newPartner.manager}
                      onChange={(e) => setNewPartner({ ...newPartner, manager: e.target.value })}
                      className="px-3 py-2 rounded-xl bg-white border border-indigo-200"
                    />
                    <input
                      type="text"
                      placeholder="연락처"
                      value={newPartner.phone}
                      onChange={(e) => setNewPartner({ ...newPartner, phone: e.target.value })}
                      className="px-3 py-2 rounded-xl bg-white border border-indigo-200"
                    />
                    <input
                      type="email"
                      placeholder="이메일"
                      value={newPartner.email}
                      onChange={(e) => setNewPartner({ ...newPartner, email: e.target.value })}
                      className="px-3 py-2 rounded-xl bg-white border border-indigo-200"
                    />
                    <input
                      type="text"
                      placeholder="주소"
                      value={newPartner.address}
                      onChange={(e) => setNewPartner({ ...newPartner, address: e.target.value })}
                      className="sm:col-span-2 px-3 py-2 rounded-xl bg-white border border-indigo-200"
                    />
                  </div>
                  <div className="flex justify-end gap-2">
                    <button
                      type="button"
                      onClick={() => setShowNewPartnerForm(false)}
                      className="px-4 py-1.5 rounded-xl text-xs font-medium bg-white border border-slate-300 cursor-pointer"
                    >
                      취소
                    </button>
                    <button
                      type="button"
                      onClick={handleCreatePartner}
                      className="px-4 py-1.5 rounded-xl text-xs font-semibold bg-indigo-600 text-white cursor-pointer"
                    >
                      등록 완료
                    </button>
                  </div>
                </div>
              )}

              <div className="overflow-x-auto rounded-xl border border-slate-200">
                <table className="w-full min-w-[960px] text-left border-collapse text-sm">
                  <thead>
                    <tr className="bg-slate-100/80 text-slate-600 border-b border-slate-200 whitespace-nowrap">
                      <th className="py-3 px-4 font-medium">구분</th>
                      <th className="py-3 px-4 font-medium">업체명</th>
                      <th className="py-3 px-4 font-medium">사업자번호</th>
                      <th className="py-3 px-4 font-medium">담당자 / 연락처</th>
                      <th className="py-3 px-4 font-medium">이메일</th>
                      <th className="py-3 px-4 font-medium">소재지 주소</th>
                      <th className="py-3 px-3 text-center font-medium w-24">관리</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200">
                    {partners
                      .filter((p) => partnerFilter === 'ALL' || p.type === partnerFilter)
                      .map((partner) => {
                        const isEdit = editingPartnerId === partner.id
                        return (
                          <tr key={partner.id} className="hover:bg-slate-50">
                            <td className="py-3.5 px-4 whitespace-nowrap">
                              <span
                                className={`px-2.5 py-0.5 rounded text-xs font-medium whitespace-nowrap ${
                                  partner.type === 'CLIENT'
                                    ? 'bg-indigo-50 text-indigo-700 border border-indigo-200'
                                    : 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                                }`}
                              >
                                {partner.type === 'CLIENT' ? '수주 고객사' : '매입 발주처'}
                              </span>
                            </td>
                            <td className="py-3.5 px-4 font-medium text-slate-900 whitespace-nowrap">
                              {isEdit ? (
                                <input
                                  type="text"
                                  value={partner.name}
                                  onChange={(e) =>
                                    handleUpdatePartner(partner.id, 'name', e.target.value)
                                  }
                                  className="px-2.5 py-1 rounded border border-indigo-400 w-full"
                                />
                              ) : (
                                partner.name
                              )}
                            </td>
                            <td className="py-3.5 px-4 font-mono text-slate-600">
                              {isEdit ? (
                                <input
                                  type="text"
                                  value={partner.bizNo}
                                  onChange={(e) =>
                                    handleUpdatePartner(partner.id, 'bizNo', e.target.value)
                                  }
                                  className="px-2.5 py-1 rounded border border-indigo-400 w-32"
                                />
                              ) : (
                                partner.bizNo
                              )}
                            </td>
                            <td className="py-3.5 px-4">
                              {isEdit ? (
                                <div className="flex gap-1">
                                  <input
                                    type="text"
                                    value={partner.manager}
                                    onChange={(e) =>
                                      handleUpdatePartner(partner.id, 'manager', e.target.value)
                                    }
                                    className="px-2 py-1 rounded border border-indigo-400 w-24"
                                  />
                                  <input
                                    type="text"
                                    value={partner.phone}
                                    onChange={(e) =>
                                      handleUpdatePartner(partner.id, 'phone', e.target.value)
                                    }
                                    className="px-2 py-1 rounded border border-indigo-400 w-28"
                                  />
                                </div>
                              ) : (
                                <span>
                                  <span className="font-medium text-slate-900">{partner.manager}</span>{' '}
                                  <span className="text-slate-500">({partner.phone})</span>
                                </span>
                              )}
                            </td>
                            <td className="py-3.5 px-4 font-mono text-indigo-600">
                              {isEdit ? (
                                <input
                                  type="email"
                                  value={partner.email}
                                  onChange={(e) =>
                                    handleUpdatePartner(partner.id, 'email', e.target.value)
                                  }
                                  className="px-2.5 py-1 rounded border border-indigo-400 w-full"
                                />
                              ) : (
                                partner.email
                              )}
                            </td>
                            <td className="py-3.5 px-4 text-slate-600">
                              {isEdit ? (
                                <input
                                  type="text"
                                  value={partner.address}
                                  onChange={(e) =>
                                    handleUpdatePartner(partner.id, 'address', e.target.value)
                                  }
                                  className="px-2.5 py-1 rounded border border-indigo-400 w-full"
                                />
                              ) : (
                                partner.address
                              )}
                            </td>
                            <td className="py-3.5 px-3 text-center">
                              <div className="flex items-center justify-center gap-1">
                                <button
                                  type="button"
                                  onClick={() =>
                                    setEditingPartnerId(isEdit ? null : partner.id)
                                  }
                                  className={`p-2 rounded-lg cursor-pointer ${
                                    isEdit
                                      ? 'bg-emerald-600 text-white'
                                      : 'hover:bg-slate-100 text-slate-500 hover:text-indigo-600'
                                  }`}
                                >
                                  {isEdit ? (
                                    <Check className="w-4 h-4" />
                                  ) : (
                                    <Edit3 className="w-4 h-4" />
                                  )}
                                </button>
                                <button
                                  type="button"
                                  onClick={() =>
                                    handleDeleteClientPartner(partner.id, partner.name)
                                  }
                                  className="p-2 rounded-lg hover:bg-rose-50 text-slate-400 hover:text-rose-600 cursor-pointer"
                                >
                                  <Trash2 className="w-4 h-4" />
                                </button>
                              </div>
                            </td>
                          </tr>
                        )
                      })}
                  </tbody>
                </table>
              </div>
            </section>
          )}

          {/* =====================================================================
              5. 제품 · BOM 관리 (MANAGE_BOM: 키오스크 모델 및 대당 BOM 구성 관리)
          ===================================================================== */}
          {activeTab === 'MANAGE_BOM' && (
            <section className="bg-white border border-slate-200 rounded-2xl p-6 shadow-2xs space-y-6">
              {/* Top Header */}
              <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 border-b border-slate-200 pb-4">
                <div>
                  <h2 className="text-xl font-bold text-[#0F2E26]">제품 · BOM 관리</h2>
                  <p className="text-sm text-slate-500 mt-1">
                    무인민원발급기 및 키오스크 제품(신제품 등록·품절 전환·규격 수정)과 각 모델 1대당 소요되는 BOM 부품 구성을 관리합니다.
                  </p>
                </div>

                <div className="flex flex-wrap items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setShowAddModelForm((v) => !v)}
                    className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs sm:text-sm font-semibold bg-[#0E8A5F] hover:bg-[#0B704D] text-white shadow-2xs transition-colors cursor-pointer"
                  >
                    <Plus className="w-4 h-4" />
                    신제품(키오스크 모델) 추가
                  </button>
                  <button
                    type="button"
                    onClick={() => setShowAddMasterBomForm((v) => !v)}
                    className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs sm:text-sm font-semibold bg-[#0F2E26] hover:bg-slate-800 text-white shadow-2xs transition-colors cursor-pointer"
                  >
                    <Plus className="w-4 h-4" />[{selectedMasterModelCode}]에 신규 부품 추가
                  </button>
                </div>
              </div>

              {/* Add New Kiosk Product Form */}
              {showAddModelForm && (
                <div className="p-5 rounded-2xl bg-indigo-50/60 border border-indigo-200 space-y-4">
                  <div className="flex items-center justify-between">
                    <div className="text-sm font-semibold text-indigo-950 flex items-center gap-2">
                      <Cpu className="w-4 h-4 text-indigo-600" />
                      신제품 (신규 키오스크 모델) 등록
                    </div>
                    <button
                      type="button"
                      onClick={() => setShowAddModelForm(false)}
                      className="text-slate-400 hover:text-slate-700 cursor-pointer"
                    >
                      <X className="w-5 h-5" />
                    </button>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-4 gap-3 text-sm">
                    <div>
                      <label className="block text-xs font-medium text-slate-700 mb-1">
                        모델코드 (미입력시 자동)
                      </label>
                      <input
                        type="text"
                        placeholder="예: TAPI-9400J"
                        value={newModelForm.modelCode}
                        onChange={(e) =>
                          setNewModelForm({ ...newModelForm, modelCode: e.target.value })
                        }
                        className="w-full px-3 py-2 rounded-xl bg-white border border-indigo-200 font-mono font-medium"
                      />
                    </div>
                    <div className="sm:col-span-2">
                      <label className="block text-xs font-medium text-slate-700 mb-1">
                        키오스크 제품명 (필수)
                      </label>
                      <input
                        type="text"
                        placeholder="예: 차세대 무인민원발급기 TAPI-9400J"
                        value={newModelForm.modelName}
                        onChange={(e) =>
                          setNewModelForm({ ...newModelForm, modelName: e.target.value })
                        }
                        className="w-full px-3 py-2 rounded-xl bg-white border border-indigo-200"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-slate-700 mb-1">
                        초기 판매 상태
                      </label>
                      <select
                        value={newModelForm.status}
                        onChange={(e) =>
                          setNewModelForm({
                            ...newModelForm,
                            status: e.target.value as KioskProductStatus,
                          })
                        }
                        className="w-full px-3 py-2 rounded-xl bg-white border border-indigo-200 font-medium"
                      >
                        <option value="NEW">신제품 (NEW)</option>
                        <option value="ACTIVE">정상 판매중 (ACTIVE)</option>
                        <option value="SOLD_OUT">일시품절 (SOLD OUT)</option>
                      </select>
                    </div>
                    <div className="sm:col-span-2">
                      <label className="block text-xs font-medium text-slate-700 mb-1">
                        제품 상세 규격 및 특징
                      </label>
                      <input
                        type="text"
                        placeholder="예: 32인치 정전식 터치 / 점자·음성 장애인겸용 / 제증명·등기부 통합"
                        value={newModelForm.spec}
                        onChange={(e) => setNewModelForm({ ...newModelForm, spec: e.target.value })}
                        className="w-full px-3 py-2 rounded-xl bg-white border border-indigo-200"
                      />
                    </div>
                    <div className="sm:col-span-2">
                      <label className="block text-xs font-medium text-slate-700 mb-1">
                        기초 BOM 구성 복사해오기
                      </label>
                      <select
                        value={newModelForm.copyFromModelCode}
                        onChange={(e) =>
                          setNewModelForm({ ...newModelForm, copyFromModelCode: e.target.value })
                        }
                        className="w-full px-3 py-2 rounded-xl bg-white border border-indigo-200 font-medium"
                      >
                        <option value="">빈 BOM으로 시작 (직접 부품 추가)</option>
                        {kioskModels.map((m) => (
                          <option key={m.modelCode} value={m.modelCode}>
                            [{m.modelCode}] {m.modelName} (BOM {m.bom.length}종 복사)
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>

                  <div className="flex justify-end gap-2">
                    <button
                      type="button"
                      onClick={() => setShowAddModelForm(false)}
                      className="px-4 py-1.5 rounded-xl text-xs font-medium bg-white border border-slate-300 cursor-pointer"
                    >
                      취소
                    </button>
                    <button
                      type="button"
                      onClick={handleCreateKioskModel}
                      className="px-4 py-1.5 rounded-xl text-xs font-semibold bg-indigo-600 text-white cursor-pointer"
                    >
                      신제품 등록 완료
                    </button>
                  </div>
                </div>
              )}

              {/* Kiosk Models Filter & Search Bar */}
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
                <div className="flex items-center gap-1.5 flex-wrap">
                  {(
                    [
                      { key: 'ALL', label: '전체 제품' },
                      { key: 'ACTIVE', label: '판매중' },
                      { key: 'NEW', label: '신제품' },
                      { key: 'SOLD_OUT', label: '일시품절' },
                    ] as const
                  ).map((tab) => (
                    <button
                      key={tab.key}
                      type="button"
                      onClick={() => setModelStatusFilter(tab.key)}
                      className={`px-3.5 py-1.5 rounded-xl text-xs sm:text-sm font-medium transition-colors cursor-pointer ${
                        modelStatusFilter === tab.key
                          ? 'bg-[#0F2E26] text-white'
                          : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                      }`}
                    >
                      {tab.label}
                    </button>
                  ))}
                </div>

                <div className="relative w-full md:w-72">
                  <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    placeholder="모델코드, 제품명 검색..."
                    value={modelSearch}
                    onChange={(e) => setModelSearch(e.target.value)}
                    className="w-full pl-9 pr-4 py-2 rounded-xl bg-slate-50 border border-slate-300 text-sm focus:outline-none focus:border-[#0E8A5F] focus:bg-white"
                  />
                </div>
              </div>

              {/* Kiosk Models Grid Selector (Clean Title & Code Only, No Fixed Numbers Below) */}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
                {filteredMasterModels.map((m) => {
                  const isSelected = selectedMasterModelCode === m.modelCode
                  const status = m.status || 'ACTIVE'
                  return (
                    <div
                      key={m.modelCode}
                      onClick={() => setSelectedMasterModelCode(m.modelCode)}
                      className={`p-3.5 rounded-xl border text-left transition-all cursor-pointer flex flex-col justify-between gap-2 ${
                        isSelected
                          ? 'bg-emerald-50/70 border-2 border-[#0E8A5F] shadow-2xs'
                          : 'bg-white hover:bg-slate-50 border-slate-200'
                      }`}
                    >
                      <div className="flex items-center justify-between gap-2">
                        <span
                          className={`px-2 py-0.5 rounded font-mono text-xs font-medium ${
                            isSelected
                              ? 'bg-[#0E8A5F] text-white'
                              : 'bg-slate-100 text-slate-700'
                          }`}
                        >
                          {m.modelCode}
                        </span>
                        <span
                          className={`px-2 py-0.5 rounded-full text-[11px] font-medium ${
                            status === 'NEW'
                              ? 'bg-emerald-50 text-[#0E8A5F] border border-emerald-200'
                              : status === 'SOLD_OUT'
                                ? 'bg-rose-50 text-rose-700 border border-rose-200'
                                : 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                          }`}
                        >
                          {status === 'NEW'
                            ? '신제품'
                            : status === 'SOLD_OUT'
                              ? '일시품절'
                              : '판매중'}
                        </span>
                      </div>
                      <div className="font-medium text-slate-900 text-sm line-clamp-1">
                        {m.modelName}
                      </div>
                    </div>
                  )
                })}
              </div>

              {/* Selected Model Details & BOM Management Area */}
              {kioskModels
                .filter((m) => m.modelCode === selectedMasterModelCode)
                .map((model) => {
                  const isEditingModel = editingModelCode === model.modelCode
                  const modelStatus = model.status || 'ACTIVE'
                  const visibleBom =
                    masterBomCategoryFilter === '전체'
                      ? model.bom
                      : model.bom.filter((b) => b.category === masterBomCategoryFilter)

                  return (
                    <div
                      key={model.modelCode}
                      className="rounded-2xl border border-violet-200 overflow-hidden bg-white space-y-0"
                    >
                      {/* Selected Model Header & Product Info Editor */}
                      <div className="p-5 bg-violet-50/50 border-b border-violet-200 space-y-4">
                        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
                          <div className="space-y-1.5 flex-1">
                            <div className="flex flex-wrap items-center gap-2">
                              <span className="px-2.5 py-1 rounded-lg text-xs sm:text-sm font-mono font-semibold bg-violet-600 text-white">
                                {model.modelCode}
                              </span>
                              {isEditingModel ? (
                                <input
                                  type="text"
                                  value={model.modelName}
                                  onChange={(e) =>
                                    handleUpdateKioskModel(
                                      model.modelCode,
                                      'modelName',
                                      e.target.value
                                    )
                                  }
                                  className="px-3 py-1.5 rounded-xl bg-white border border-violet-400 font-semibold text-slate-900 text-base w-full sm:w-96"
                                />
                              ) : (
                                <h3 className="text-base sm:text-lg font-semibold text-slate-900">
                                  {model.modelName}
                                </h3>
                              )}
                              <span className="px-2.5 py-0.5 rounded-full text-xs font-medium bg-white text-violet-700 border border-violet-200">
                                표준 BOM 총 {model.bom.length}종 부품
                              </span>
                            </div>

                            {isEditingModel ? (
                              <input
                                type="text"
                                value={model.spec}
                                onChange={(e) =>
                                  handleUpdateKioskModel(model.modelCode, 'spec', e.target.value)
                                }
                                className="w-full px-3 py-1.5 rounded-xl bg-white border border-violet-400 text-sm text-slate-700"
                              />
                            ) : (
                              <p className="text-xs sm:text-sm text-slate-600">{model.spec}</p>
                            )}
                          </div>

                          {/* Product Status Switcher & Model Edit/Delete Actions */}
                          <div className="flex flex-wrap items-center gap-2">
                            <div className="inline-flex items-center rounded-xl bg-white p-1 border border-slate-200">
                              {(
                                [
                                  { code: 'ACTIVE', label: '정상 판매중' },
                                  { code: 'NEW', label: '신제품' },
                                  { code: 'SOLD_OUT', label: '일시품절' },
                                ] as const
                              ).map((st) => (
                                <button
                                  key={st.code}
                                  type="button"
                                  onClick={() =>
                                    handleUpdateKioskModel(model.modelCode, 'status', st.code)
                                  }
                                  className={`px-3 py-1 rounded-lg text-xs font-medium transition-colors cursor-pointer ${
                                    modelStatus === st.code
                                      ? st.code === 'SOLD_OUT'
                                        ? 'bg-rose-600 text-white'
                                        : st.code === 'NEW'
                                          ? 'bg-indigo-600 text-white'
                                          : 'bg-emerald-600 text-white'
                                      : 'text-slate-600 hover:bg-slate-100'
                                  }`}
                                >
                                  {st.label}
                                </button>
                              ))}
                            </div>

                            <button
                              type="button"
                              onClick={() =>
                                setEditingModelCode(isEditingModel ? null : model.modelCode)
                              }
                              className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-medium border transition-colors cursor-pointer ${
                                isEditingModel
                                  ? 'bg-emerald-600 text-white border-emerald-600'
                                  : 'bg-white hover:bg-slate-100 text-slate-700 border-slate-300'
                              }`}
                            >
                              {isEditingModel ? (
                                <>
                                  <Check className="w-3.5 h-3.5" />
                                  수정 완료
                                </>
                              ) : (
                                <>
                                  <Pencil className="w-3.5 h-3.5" />
                                  제품명·규격 수정
                                </>
                              )}
                            </button>

                            <button
                              type="button"
                              onClick={() =>
                                handleDeleteKioskModel(model.modelCode, model.modelName)
                              }
                              className="inline-flex items-center gap-1 px-3 py-1.5 rounded-xl text-xs font-medium bg-white hover:bg-rose-50 text-rose-600 border border-rose-200 transition-colors cursor-pointer"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                              삭제
                            </button>
                          </div>
                        </div>

                        {/* Quick Bar: Add from Existing Warehouse Inventory */}
                        <div className="pt-3 border-t border-violet-200/70 flex flex-col lg:flex-row lg:items-center justify-between gap-3">
                          <div className="flex flex-wrap items-center gap-2 flex-1">
                            <span className="text-xs font-medium text-violet-900 whitespace-nowrap">
                              창고 등록 부품에서 선택해 추가:
                            </span>
                            <select
                              value={selectedExistingPartCode}
                              onChange={(e) => setSelectedExistingPartCode(e.target.value)}
                              className="px-3 py-1.5 rounded-xl bg-white border border-violet-300 text-xs sm:text-sm text-slate-800 flex-1 min-w-[220px]"
                            >
                              <option value="">
                                -- 창고 부품 선택 (총 {warehouseInventory.length}종) --
                              </option>
                              {warehouseInventory.map((wp) => (
                                <option key={wp.partCode} value={wp.partCode}>
                                  [{wp.partCode}] {wp.partName} (현재고: {wp.stockQty}
                                  {wp.unit} / {wp.supplierName})
                                </option>
                              ))}
                            </select>
                            <div className="inline-flex items-center gap-1 bg-white px-2.5 py-1.5 rounded-xl border border-violet-300">
                              <span className="text-xs text-slate-600">1대당 소요량:</span>
                              <input
                                type="number"
                                min={1}
                                value={existingPartAddQty}
                                onChange={(e) =>
                                  setExistingPartAddQty(Math.max(1, Number(e.target.value) || 1))
                                }
                                className="w-12 text-center font-semibold text-sm text-violet-900 focus:outline-none"
                              />
                            </div>
                            <button
                              type="button"
                              onClick={handleAddExistingPartToModelBom}
                              className="px-3.5 py-1.5 rounded-xl text-xs sm:text-sm font-semibold bg-violet-600 hover:bg-violet-500 text-white cursor-pointer whitespace-nowrap"
                            >
                              + BOM에 연결
                            </button>
                          </div>

                          <div className="flex items-center gap-1 flex-wrap">
                            {CATEGORIES.map((cat) => (
                              <button
                                key={cat}
                                type="button"
                                onClick={() => setMasterBomCategoryFilter(cat)}
                                className={`px-2.5 py-1 rounded-lg text-xs font-medium cursor-pointer ${
                                  masterBomCategoryFilter === cat
                                    ? 'bg-violet-700 text-white'
                                    : 'bg-white text-slate-600 hover:bg-slate-100 border border-slate-200'
                                }`}
                              >
                                {cat}
                              </button>
                            ))}
                          </div>
                        </div>
                      </div>

                      {/* Add Brand-New Master BOM Part Form */}
                      {showAddMasterBomForm && (
                        <div className="p-5 bg-emerald-50/60 border-b border-emerald-200 space-y-4">
                          <div className="flex items-center justify-between">
                            <div className="text-sm font-semibold text-emerald-950">
                              [{model.modelCode}] 모델에 새로운 BOM 부품 직접 등록
                            </div>
                            <button
                              type="button"
                              onClick={() => setShowAddMasterBomForm(false)}
                              className="text-slate-400 hover:text-slate-700 cursor-pointer"
                            >
                              <X className="w-5 h-5" />
                            </button>
                          </div>
                          <div className="grid grid-cols-1 sm:grid-cols-4 gap-3 text-sm">
                            <input
                              type="text"
                              placeholder="부품코드 (미입력시 자동)"
                              value={newMasterPart.partCode}
                              onChange={(e) =>
                                setNewMasterPart({ ...newMasterPart, partCode: e.target.value })
                              }
                              className="px-3 py-2 rounded-xl bg-white border border-emerald-300 font-mono"
                            />
                            <select
                              value={newMasterPart.category}
                              onChange={(e) =>
                                setNewMasterPart({
                                  ...newMasterPart,
                                  category: e.target.value as PartCategory,
                                })
                              }
                              className="px-3 py-2 rounded-xl bg-white border border-emerald-300 font-medium"
                            >
                              {PART_CATEGORIES.map((c) => (
                                <option key={c} value={c}>
                                  {c}
                                </option>
                              ))}
                            </select>
                            <input
                              type="text"
                              placeholder="부품명 (필수)"
                              value={newMasterPart.partName}
                              onChange={(e) =>
                                setNewMasterPart({ ...newMasterPart, partName: e.target.value })
                              }
                              className="sm:col-span-2 px-3 py-2 rounded-xl bg-white border border-emerald-300"
                            />
                            <input
                              type="text"
                              placeholder="상세 규격"
                              value={newMasterPart.spec}
                              onChange={(e) =>
                                setNewMasterPart({ ...newMasterPart, spec: e.target.value })
                              }
                              className="sm:col-span-2 px-3 py-2 rounded-xl bg-white border border-emerald-300"
                            />
                            <div className="flex gap-1.5">
                              <input
                                type="number"
                                min={1}
                                placeholder="1대당 소요량"
                                value={newMasterPart.qtyPerUnit}
                                onChange={(e) =>
                                  setNewMasterPart({
                                    ...newMasterPart,
                                    qtyPerUnit: Number(e.target.value) || 1,
                                  })
                                }
                                className="w-1/2 px-3 py-2 rounded-xl bg-white border border-emerald-300 font-medium"
                              />
                              <input
                                type="number"
                                min={0}
                                placeholder="기초 현재고"
                                value={newMasterPart.stockQty}
                                onChange={(e) =>
                                  setNewMasterPart({
                                    ...newMasterPart,
                                    stockQty: Number(e.target.value) || 0,
                                  })
                                }
                                className="w-1/2 px-3 py-2 rounded-xl bg-white border border-emerald-300 font-medium"
                              />
                            </div>
                            <select
                              value={newMasterPart.supplierId}
                              onChange={(e) =>
                                setNewMasterPart({ ...newMasterPart, supplierId: e.target.value })
                              }
                              className="px-3 py-2 rounded-xl bg-white border border-emerald-300 font-medium"
                            >
                              {supplierPartners.map((s) => (
                                <option key={s.id} value={s.id}>
                                  {s.name}
                                </option>
                              ))}
                            </select>
                          </div>
                          <div className="flex justify-end gap-2">
                            <button
                              type="button"
                              onClick={() => setShowAddMasterBomForm(false)}
                              className="px-4 py-1.5 rounded-xl text-xs font-medium bg-white border border-slate-300 cursor-pointer"
                            >
                              취소
                            </button>
                            <button
                              type="button"
                              onClick={handleAddMasterBomPart}
                              className="px-4 py-1.5 rounded-xl text-xs font-semibold bg-emerald-600 text-white cursor-pointer"
                            >
                              표준 BOM에 저장
                            </button>
                          </div>
                        </div>
                      )}

                      {/* Model's BOM Parts Table */}
                      <div className="overflow-x-auto">
                        <table className="w-full min-w-[980px] text-left border-collapse text-sm">
                          <thead>
                            <tr className="bg-slate-100/80 text-slate-600 border-b border-slate-200 whitespace-nowrap">
                              <th className="py-3 px-4 font-medium w-[56px] text-center">No</th>
                              <th className="py-3 px-4 font-medium w-[145px]">부품코드 / 분류</th>
                              <th className="py-3 px-4 font-medium min-w-[230px]">부품명 및 상세 규격</th>
                              <th className="py-3 px-4 text-center font-medium w-[165px]">
                                1대당 소요량
                              </th>
                              <th className="py-3 px-4 text-center font-medium w-[125px]">
                                창고 현재고
                              </th>
                              <th className="py-3 px-4 font-medium min-w-[190px]">지정 발주처</th>
                              <th className="py-3 px-3 text-center font-medium w-[90px]">관리</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-slate-200">
                            {visibleBom.map((part, idx) => {
                              const editKey = `${model.modelCode}:${part.partCode}`
                              const isPartEditing = editingMasterPartCode === editKey
                              return (
                                <tr key={part.partCode} className="hover:bg-slate-50/90">
                                  <td className="py-3 px-4 text-center font-mono text-xs text-slate-400">
                                    {idx + 1}
                                  </td>
                                  <td className="py-3 px-4 whitespace-nowrap">
                                    <div className="font-mono text-indigo-600 font-medium text-xs sm:text-sm">
                                      {part.partCode}
                                    </div>
                                    <span className="inline-block mt-1 px-2 py-0.5 rounded bg-slate-100 text-slate-600 text-xs whitespace-nowrap">
                                      {part.category}
                                    </span>
                                  </td>
                                  <td className="py-3 px-4 break-keep">
                                    {isPartEditing ? (
                                      <div className="space-y-1.5">
                                        <input
                                          type="text"
                                          value={part.partName}
                                          onChange={(e) =>
                                            handleUpdateMasterBomPart(
                                              model.modelCode,
                                              part.partCode,
                                              'partName',
                                              e.target.value
                                            )
                                          }
                                          className="w-full px-2.5 py-1 rounded-lg bg-white border border-violet-400 font-medium text-slate-900"
                                        />
                                        <input
                                          type="text"
                                          value={part.spec}
                                          onChange={(e) =>
                                            handleUpdateMasterBomPart(
                                              model.modelCode,
                                              part.partCode,
                                              'spec',
                                              e.target.value
                                            )
                                          }
                                          className="w-full px-2.5 py-1 rounded-lg bg-white border border-slate-300 text-xs text-slate-700"
                                        />
                                      </div>
                                    ) : (
                                      <>
                                        <div className="font-medium text-slate-900">
                                          {part.partName}
                                        </div>
                                        <div className="text-xs text-slate-500">{part.spec}</div>
                                      </>
                                    )}
                                  </td>
                                  <td className="py-3 px-4 text-center whitespace-nowrap">
                                    <div className="inline-flex items-center justify-center gap-1.5">
                                      <button
                                        type="button"
                                        onClick={() =>
                                          handleUpdateMasterBomPart(
                                            model.modelCode,
                                            part.partCode,
                                            'qtyPerUnit',
                                            Math.max(1, part.qtyPerUnit - 1)
                                          )
                                        }
                                        className="w-7 h-7 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 font-medium border border-slate-300 cursor-pointer"
                                      >
                                        -
                                      </button>
                                      <input
                                        type="number"
                                        min={1}
                                        value={part.qtyPerUnit}
                                        onChange={(e) =>
                                          handleUpdateMasterBomPart(
                                            model.modelCode,
                                            part.partCode,
                                            'qtyPerUnit',
                                            Math.max(1, Number(e.target.value) || 1)
                                          )
                                        }
                                        className="w-14 text-center py-1 rounded-lg bg-violet-50/70 border border-violet-300 font-semibold text-violet-950 text-sm"
                                      />
                                      <button
                                        type="button"
                                        onClick={() =>
                                          handleUpdateMasterBomPart(
                                            model.modelCode,
                                            part.partCode,
                                            'qtyPerUnit',
                                            part.qtyPerUnit + 1
                                          )
                                        }
                                        className="w-7 h-7 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 font-medium border border-slate-300 cursor-pointer"
                                      >
                                        +
                                      </button>
                                      <span className="text-xs text-slate-500">
                                        {part.unit}
                                      </span>
                                    </div>
                                  </td>
                                  <td className="py-3 px-4 text-center whitespace-nowrap">
                                    {isPartEditing ? (
                                      <input
                                        type="number"
                                        min={0}
                                        value={part.stockQty}
                                        onChange={(e) =>
                                          handleUpdateMasterBomPart(
                                            model.modelCode,
                                            part.partCode,
                                            'stockQty',
                                            Math.max(0, Number(e.target.value) || 0)
                                          )
                                        }
                                        className="w-16 text-center py-1 rounded-lg bg-emerald-50 border border-emerald-400 font-medium text-emerald-900"
                                      />
                                    ) : (
                                      <button
                                        type="button"
                                        title="클릭하여 재고 관리 화면으로 이동"
                                        onClick={() => setActiveTab('MANAGE_INVENTORY')}
                                        className="px-2.5 py-1 rounded-lg bg-emerald-50 hover:bg-emerald-100 text-emerald-700 border border-emerald-200 font-mono font-medium text-xs cursor-pointer"
                                      >
                                        {part.stockQty} {part.unit}
                                      </button>
                                    )}
                                  </td>
                                  <td className="py-3 px-4 whitespace-nowrap">
                                    {isPartEditing ? (
                                      <select
                                        value={part.supplierId}
                                        onChange={(e) =>
                                          handleUpdateMasterBomPart(
                                            model.modelCode,
                                            part.partCode,
                                            'supplierId',
                                            e.target.value
                                          )
                                        }
                                        className="w-full px-2.5 py-1.5 rounded-lg bg-white border border-violet-400 font-medium text-slate-900 text-xs"
                                      >
                                        {supplierPartners.map((s) => (
                                          <option key={s.id} value={s.id}>
                                            {s.name}
                                          </option>
                                        ))}
                                      </select>
                                    ) : (
                                      <>
                                        <div className="font-medium text-slate-800">
                                          {part.supplierName}
                                        </div>
                                        <div className="text-xs text-slate-500">
                                          {part.supplierManager} ({part.supplierPhone})
                                        </div>
                                      </>
                                    )}
                                  </td>
                                  <td className="py-3 px-3 text-center whitespace-nowrap">
                                    <div className="flex items-center justify-center gap-1">
                                      <button
                                        type="button"
                                        title={isPartEditing ? '수정 완료' : '부품 상세 수정'}
                                        onClick={() =>
                                          setEditingMasterPartCode(isPartEditing ? null : editKey)
                                        }
                                        className={`p-2 rounded-lg transition-colors cursor-pointer ${
                                          isPartEditing
                                            ? 'bg-emerald-600 text-white'
                                            : 'hover:bg-violet-100 text-slate-500 hover:text-violet-700'
                                        }`}
                                      >
                                        {isPartEditing ? (
                                          <Check className="w-4 h-4" />
                                        ) : (
                                          <Pencil className="w-4 h-4" />
                                        )}
                                      </button>
                                      <button
                                        type="button"
                                        title="이 모델 BOM에서 제거"
                                        onClick={() =>
                                          handleDeleteMasterBomPart(
                                            model.modelCode,
                                            part.partCode,
                                            part.partName
                                          )
                                        }
                                        className="p-2 rounded-lg hover:bg-rose-50 text-slate-400 hover:text-rose-600 cursor-pointer"
                                      >
                                        <Trash2 className="w-4 h-4" />
                                      </button>
                                    </div>
                                  </td>
                                </tr>
                              )
                            })}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  )
                })}
            </section>
          )}
        </main>
      </div>

      {/* Bottom Creator Footer */}
      <footer className="border-t border-slate-200 bg-white py-5 px-4 text-center mt-auto">
        <div className="max-w-[1440px] mx-auto flex flex-col sm:flex-row items-center justify-between gap-2 text-xs sm:text-sm text-slate-500">
          <span className="font-medium text-[#0F2E26]">키오스크 발주 관리 시스템</span>
          <p className="text-slate-700 tracking-wide">
            <span className="text-slate-300">|</span>
            <span className="mx-2 font-medium text-[#0F2E26]">AI아이</span>
            <span className="text-slate-300 mr-2.5">|</span>
            <span>김동준 · 최재혁 · 김여원 · 김서연</span>
          </p>
        </div>
      </footer>

      {/* Purchase Order Preview Modal */}
      <PurchaseOrderModal
        po={previewPo}
        clientOrder={clientOrder}
        onClose={() => setPreviewPo(null)}
        onDownloadPdf={handleDownloadPdf}
        onDownloadExcel={handleDownloadExcel}
        onPrint={handlePrintPo}
        onSendEmailPdf={handleSendPoPdfEmail}
      />
    </div>
  )
}

export default App
