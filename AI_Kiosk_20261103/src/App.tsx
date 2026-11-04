import { useMemo, useRef, useState } from 'react'
import type { ReactNode } from 'react'
import {
  ArrowRight,
  Building2,
  Check,
  CheckCircle2,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  FileCheck2,
  Layers,
  Package,
  PanelLeftClose,
  PanelLeftOpen,
  Pencil,
  Plus,
  RefreshCw,
  Search,
  Send,
  Trash2,
  UploadCloud,
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

/* ------------------------------------------------------------------
   Shared UI tokens (White · Forest Green · Neutral Charcoal only)
------------------------------------------------------------------ */
const BTN =
  'inline-flex items-center justify-center gap-1.5 h-9 px-3.5 rounded-md text-sm font-medium whitespace-nowrap transition-colors cursor-pointer disabled:opacity-50 disabled:cursor-default'
const BTN_PRIMARY = `${BTN} bg-[#0E8A5F] hover:bg-[#0B704D] text-white`
const BTN_SECONDARY = `${BTN} bg-white hover:bg-slate-50 text-slate-700 border border-slate-200`
const BTN_SM =
  'inline-flex items-center justify-center gap-1 h-7 px-2.5 rounded text-xs font-medium whitespace-nowrap transition-colors cursor-pointer disabled:cursor-default'
const BTN_SM_GHOST = `${BTN_SM} text-slate-600 hover:bg-slate-100 hover:text-[#0F2E26]`
const ICON_BTN =
  'inline-flex items-center justify-center w-8 h-8 rounded-md text-slate-400 hover:text-[#0F2E26] hover:bg-slate-100 transition-colors cursor-pointer'
const INPUT =
  'h-9 w-full px-3 rounded-md border border-slate-200 bg-white text-sm text-[#0F2E26] placeholder:text-slate-400 focus:outline-none focus:border-[#0E8A5F] focus:ring-2 focus:ring-[#0E8A5F]/15'
const INPUT_SM =
  'h-8 px-2 rounded-md border border-slate-200 bg-white text-sm text-[#0F2E26] focus:outline-none focus:border-[#0E8A5F]'
const LABEL = 'block text-xs text-slate-500 mb-1'
const CARD = 'bg-white border border-slate-200 rounded-lg'
const TH = 'py-2.5 px-4 text-left text-xs font-medium text-slate-500 whitespace-nowrap'
const TD = 'py-3 px-4 align-middle'
const TABLE_HEAD_ROW = 'bg-[#F7FAF8] border-b border-slate-200'
const SEG_WRAP = 'inline-flex items-center p-0.5 rounded-md bg-slate-100 shrink-0'
const segBtn = (active: boolean) =>
  `h-8 px-3 rounded text-sm whitespace-nowrap transition-colors cursor-pointer ${
    active ? 'bg-white text-[#0F2E26] font-medium shadow-xs' : 'text-slate-500 hover:text-[#0F2E26]'
  }`
const chip = (active: boolean) =>
  `h-7 px-3 rounded-full text-xs whitespace-nowrap border transition-colors cursor-pointer ${
    active
      ? 'bg-emerald-50 text-[#0E8A5F] border-[#0E8A5F]/40 font-medium'
      : 'bg-white text-slate-600 border-slate-200 hover:border-slate-300'
  }`

const PAGE_SIZE = 10

function paginate<T>(items: T[], page: number) {
  const totalPages = Math.max(1, Math.ceil(items.length / PAGE_SIZE))
  const current = Math.min(Math.max(1, page), totalPages)
  const offset = (current - 1) * PAGE_SIZE
  return {
    rows: items.slice(offset, offset + PAGE_SIZE),
    page: current,
    totalPages,
    total: items.length,
    offset,
  }
}

function Pager({
  page,
  totalPages,
  total,
  onChange,
}: {
  page: number
  totalPages: number
  total: number
  onChange: (p: number) => void
}) {
  if (total === 0) return null
  return (
    <div className="flex items-center justify-between px-4 py-2.5 border-t border-slate-200 text-xs text-slate-500">
      <span>총 {total.toLocaleString()}건</span>
      {totalPages > 1 && (
        <div className="flex items-center gap-1">
          <button
            type="button"
            disabled={page <= 1}
            onClick={() => onChange(page - 1)}
            className="w-7 h-7 inline-flex items-center justify-center rounded text-slate-500 hover:bg-slate-100 disabled:opacity-30 cursor-pointer disabled:cursor-default"
          >
            <ChevronLeft className="w-4 h-4" />
          </button>
          {Array.from({ length: totalPages }, (_, i) => i + 1).map((p) => (
            <button
              key={p}
              type="button"
              onClick={() => onChange(p)}
              className={`min-w-7 h-7 px-1.5 rounded text-xs cursor-pointer ${
                p === page
                  ? 'bg-[#0E8A5F] text-white font-medium'
                  : 'text-slate-600 hover:bg-slate-100'
              }`}
            >
              {p}
            </button>
          ))}
          <button
            type="button"
            disabled={page >= totalPages}
            onClick={() => onChange(page + 1)}
            className="w-7 h-7 inline-flex items-center justify-center rounded text-slate-500 hover:bg-slate-100 disabled:opacity-30 cursor-pointer disabled:cursor-default"
          >
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>
      )}
    </div>
  )
}

function PageHeader({
  title,
  desc,
  actions,
}: {
  title: string
  desc: string
  actions?: ReactNode
}) {
  return (
    <div className="flex flex-col md:flex-row md:items-end justify-between gap-3">
      <div className="min-w-0">
        <h2 className="text-xl font-semibold text-[#0F2E26] tracking-tight">{title}</h2>
        <p className="text-sm text-slate-500 mt-1">{desc}</p>
      </div>
      {actions && <div className="flex items-center gap-2 flex-nowrap shrink-0">{actions}</div>}
    </div>
  )
}

function CardHeader({
  title,
  desc,
  actions,
}: {
  title: string
  desc?: string
  actions?: ReactNode
}) {
  return (
    <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3 px-5 py-4 border-b border-slate-200">
      <div className="min-w-0">
        <h3 className="text-[15px] font-semibold text-[#0F2E26]">{title}</h3>
        {desc && <p className="text-xs text-slate-500 mt-0.5">{desc}</p>}
      </div>
      {actions && (
        <div className="flex items-center gap-2 flex-nowrap overflow-x-auto shrink-0">{actions}</div>
      )}
    </div>
  )
}

function ModelStatusBadge({ status }: { status: KioskProductStatus }) {
  const map: Record<KioskProductStatus, [string, string]> = {
    ACTIVE: ['판매중', 'bg-emerald-50 text-[#0E8A5F]'],
    NEW: ['신제품', 'bg-[#0E8A5F] text-white'],
    SOLD_OUT: ['품절', 'bg-slate-100 text-slate-500'],
  }
  const [label, cls] = map[status]
  return (
    <span className={`inline-flex items-center h-5 px-1.5 rounded text-[11px] font-medium whitespace-nowrap ${cls}`}>
      {label}
    </span>
  )
}

/** "서울특별시 강남구 테헤란로 123" -> "서울 강남구" (시·구·동 단위까지만) */
function shortAddress(addr: string): string {
  if (!addr) return '-'
  const tokens = addr.trim().split(/\s+/)
  const out: string[] = []
  for (const t of tokens) {
    if (out.length < 3 && /(특별시|광역시|특별자치시|특별자치도|도|시|군|구|동|읍|면)$/.test(t)) {
      out.push(t.replace(/(특별시|광역시|특별자치시|특별자치도)$/, '').replace(/^경기도$/, '경기'))
    } else {
      break
    }
  }
  return out.length ? out.join(' ') : tokens.slice(0, 2).join(' ')
}

function Credits({ light = false }: { light?: boolean }) {
  return (
    <p className={`text-sm tracking-wide ${light ? 'text-white/90' : 'text-slate-500'}`}>
      <span className={light ? 'text-white/50' : 'text-slate-300'}>|</span>
      <span className={`mx-2 font-medium ${light ? 'text-white' : 'text-[#0F2E26]'}`}>AI아이</span>
      <span className={`mr-2.5 ${light ? 'text-white/50' : 'text-slate-300'}`}>|</span>
      <span>김동준 · 최재혁 · 김여원 · 김서연</span>
    </p>
  )
}

function KioskSystemIcon({ className = 'w-8 h-8' }: { className?: string }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 36 36"
      fill="none"
      className={className}
      aria-hidden="true"
    >
      {/* Clean Geometric Brand Mark (Deep Forest Charcoal & Green) */}
      <rect x="3" y="3" width="13" height="13" rx="3.5" fill="#0F2E26" />
      <rect x="20" y="3" width="13" height="13" rx="6.5" fill="#0E8A5F" />
      <rect x="3" y="20" width="13" height="13" rx="3.5" fill="#0F2E26" />
      <rect x="20" y="20" width="13" height="13" rx="3.5" fill="#0F2E26" />
      <path
        d="M24 9.5L26 11.5L29.5 8"
        stroke="#FFFFFF"
        strokeWidth="2"
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

  // Layout & list paging states
  const [sidebarOpen, setSidebarOpen] = useState<boolean>(true)
  const [expandedPartnerId, setExpandedPartnerId] = useState<string | null>(null)
  const [orderItemsPage, setOrderItemsPage] = useState<number>(1)
  const [bomPage, setBomPage] = useState<number>(1)
  const [poPage, setPoPage] = useState<number>(1)
  const [invPage, setInvPage] = useState<number>(1)
  const [logPage, setLogPage] = useState<number>(1)
  const [partnerPage, setPartnerPage] = useState<number>(1)
  const [masterBomPage, setMasterBomPage] = useState<number>(1)
  const [modelListPage, setModelListPage] = useState<number>(1)

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

  /* ------------------------------------------------------------------
     Derived paging data
  ------------------------------------------------------------------ */
  const orderItemsPaged = paginate(clientOrder.items, orderItemsPage)
  const bomPaged = paginate(filteredBom, bomPage)
  const poPaged = paginate(purchaseOrders, poPage)
  const invPaged = paginate(filteredWarehouseInventory, invPage)
  const logPaged = paginate(inventoryLogs, logPage)
  const filteredPartners = partners.filter(
    (p) => partnerFilter === 'ALL' || p.type === partnerFilter
  )
  const partnerPaged = paginate(filteredPartners, partnerPage)
  const modelListPaged = paginate(filteredMasterModels, modelListPage)
  const selectedModel = kioskModels.find((m) => m.modelCode === selectedMasterModelCode)
  const selectedModelBom = selectedModel
    ? masterBomCategoryFilter === '전체'
      ? selectedModel.bom
      : selectedModel.bom.filter((b) => b.category === masterBomCategoryFilter)
    : []
  const masterBomPaged = paginate(selectedModelBom, masterBomPage)

  const goWorkspace = (tab: ActiveTab) => {
    setActiveTab(tab)
    setIsHome(false)
  }

  const NAV_ITEMS: { key: ActiveTab; label: string; icon: typeof Layers; group: string }[] = [
    { key: 'ORDER_INTAKE', label: '발주서 접수', icon: FileCheck2, group: '발주 업무' },
    { key: 'MATERIAL_ORDER', label: '자재 발주', icon: Send, group: '발주 업무' },
    { key: 'MANAGE_BOM', label: '제품 · BOM 관리', icon: Layers, group: '관리' },
    { key: 'MANAGE_INVENTORY', label: '재고 관리', icon: Package, group: '관리' },
    { key: 'MANAGE_PARTNERS', label: '거래처 관리', icon: Building2, group: '관리' },
  ]

  /* ==================================================================
     HOME
  ================================================================== */
  if (isHome) {
    return (
      <div className="min-h-screen bg-white text-[#0F2E26] flex flex-col selection:bg-[#0E8A5F] selection:text-white overflow-x-hidden">
        <header className="w-full max-w-6xl mx-auto px-6 py-6 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <KioskSystemIcon className="w-7 h-7" />
            <span className="text-[15px] font-semibold tracking-tight">발주 관리 시스템</span>
          </div>
          <nav className="hidden sm:flex items-center gap-7 text-sm text-slate-600">
            {NAV_ITEMS.slice(0, 4).map((n) => (
              <button
                key={n.key}
                type="button"
                onClick={() => goWorkspace(n.key)}
                className="hover:text-[#0E8A5F] transition-colors cursor-pointer"
              >
                {n.label}
              </button>
            ))}
          </nav>
        </header>

        <main className="flex-1 flex flex-col items-center justify-center max-w-3xl mx-auto px-6 py-16 text-center">
          <p className="text-sm font-medium text-[#0E8A5F] mb-4">발주서 접수부터 구매발주서 발행까지</p>
          <h1 className="text-4xl sm:text-5xl md:text-6xl font-semibold tracking-tight leading-[1.15]">
            발주 관리 시스템
          </h1>
          <p className="mt-5 text-base sm:text-lg text-slate-500 max-w-xl leading-relaxed">
            수주 발주서를 올리면 제품별 소요 자재(BOM)를 계산하고, 공급처별 구매발주서를 바로 만들어 드립니다.
          </p>
          <button
            type="button"
            onClick={() => goWorkspace('ORDER_INTAKE')}
            className="group mt-10 inline-flex items-center gap-2 h-12 px-8 rounded-md bg-[#0E8A5F] hover:bg-[#0B704D] text-white text-base font-medium transition-colors cursor-pointer"
          >
            시작하기
            <ArrowRight className="w-4 h-4 transition-transform group-hover:translate-x-0.5" />
          </button>
        </main>

        <div className="w-full">
          <svg
            viewBox="0 0 1440 54"
            fill="none"
            xmlns="http://www.w3.org/2000/svg"
            className="w-full h-8 sm:h-12 block -mb-px"
            preserveAspectRatio="none"
          >
            <path d="M0 32C320 6 620 0 920 14C1160 25 1330 40 1440 24V54H0V32Z" fill="#0E8A5F" />
          </svg>
          <footer className="bg-[#0E8A5F] text-white pt-8 pb-10 px-6">
            <div className="max-w-5xl mx-auto flex flex-col items-center text-center gap-7">
              <div className="flex flex-wrap items-center justify-center gap-x-10 gap-y-2 text-[15px] font-medium text-white/95">
                <span>발주서 접수</span>
                <span>BOM 자동 산출</span>
                <span>재고 연동</span>
                <span>구매발주서 발행</span>
              </div>
              <div className="w-full pt-6 border-t border-white/15 flex justify-center">
                <Credits light />
              </div>
            </div>
          </footer>
        </div>
      </div>
    )
  }

  /* ==================================================================
     WORKSPACE
  ================================================================== */
  return (
    <div className="min-h-screen bg-[#F7FAF8] text-[#0F2E26] flex flex-col selection:bg-[#0E8A5F] selection:text-white">
      {toastMessage && (
        <div className="fixed bottom-6 right-6 z-50 flex items-center gap-2.5 max-w-md px-4 py-3 rounded-md bg-[#0F2E26] text-white text-sm shadow-lg">
          <CheckCircle2 className="w-4 h-4 text-emerald-300 shrink-0" />
          <span>{toastMessage}</span>
        </div>
      )}

      {/* Top Header */}
      <header className="sticky top-0 z-30 h-14 border-b border-slate-200 bg-white">
        <div className="h-full px-4 flex items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setSidebarOpen((v) => !v)}
              title={sidebarOpen ? '메뉴 접기' : '메뉴 펼치기'}
              className={ICON_BTN}
            >
              {sidebarOpen ? <PanelLeftClose className="w-4 h-4" /> : <PanelLeftOpen className="w-4 h-4" />}
            </button>
            <button
              type="button"
              onClick={() => setIsHome(true)}
              title="홈으로 이동"
              className="flex items-center gap-2.5 cursor-pointer rounded-md px-1.5 py-1 hover:bg-slate-50"
            >
              <KioskSystemIcon className="w-6 h-6" />
              <span className="text-[15px] font-semibold tracking-tight">발주 관리 시스템</span>
            </button>
          </div>
        </div>
      </header>

      <div className="flex-1 flex items-stretch">
        {/* Collapsible Left Sidebar */}
        <aside
          className={`shrink-0 bg-white border-r border-slate-200 transition-[width] duration-200 ${
            sidebarOpen ? 'w-56' : 'w-14'
          }`}
        >
          <nav className="sticky top-14 p-2 space-y-5">
            {['발주 업무', '관리'].map((group) => (
              <div key={group} className="space-y-0.5">
                {sidebarOpen ? (
                  <div className="px-2.5 pt-2 pb-1.5 text-[11px] font-medium text-slate-400">{group}</div>
                ) : (
                  <div className="mx-2.5 my-2 border-t border-slate-100" />
                )}
                {NAV_ITEMS.filter((n) => n.group === group).map((n) => {
                  const Icon = n.icon
                  const active = activeTab === n.key
                  return (
                    <button
                      key={n.key}
                      type="button"
                      title={n.label}
                      onClick={() => setActiveTab(n.key)}
                      className={`w-full flex items-center gap-2.5 h-9 rounded-md text-sm transition-colors cursor-pointer ${
                        sidebarOpen ? 'px-2.5' : 'justify-center'
                      } ${
                        active
                          ? 'bg-emerald-50 text-[#0E8A5F] font-medium'
                          : 'text-slate-600 hover:bg-slate-50 hover:text-[#0F2E26]'
                      }`}
                    >
                      <Icon className="w-4 h-4 shrink-0" />
                      {sidebarOpen && <span className="truncate">{n.label}</span>}
                    </button>
                  )
                })}
              </div>
            ))}

            {sidebarOpen && (
              <div className="mx-2.5 pt-4 border-t border-slate-100 text-xs text-slate-500 leading-relaxed space-y-1.5">
                <p className="font-medium text-slate-600">이용 순서</p>
                <p>1. 발주서 접수에서 파일을 올리거나 주문 제품을 입력합니다.</p>
                <p>2. 자재 발주에서 소요 자재를 확인하고 공급처별 발주서를 발행합니다.</p>
              </div>
            )}
          </nav>
        </aside>

        {/* Main Content */}
        <main className="flex-1 min-w-0 px-4 sm:px-6 lg:px-8 py-7">
          <div className="max-w-[1280px] mx-auto space-y-5">
            {/* ============================================================
                1. 발주서 접수
            ============================================================ */}
            {activeTab === 'ORDER_INTAKE' && (
              <>
                <PageHeader
                  title="발주서 접수"
                  desc="발주서 파일을 올리면 자동으로 입력됩니다. 직접 입력하거나 수정할 수도 있습니다."
                  actions={
                    <>
                      <button type="button" onClick={handleResetClientOrder} className={BTN_SECONDARY}>
                        <RefreshCw className="w-3.5 h-3.5" />
                        초기화
                      </button>
                      <button
                        type="button"
                        onClick={() => setActiveTab('MATERIAL_ORDER')}
                        className={BTN_PRIMARY}
                      >
                        자재 발주
                        <ArrowRight className="w-3.5 h-3.5" />
                      </button>
                    </>
                  }
                />

                {/* Compact Upload Bar */}
                <div
                  onDragOver={(e) => {
                    e.preventDefault()
                    setIsDragging(true)
                  }}
                  onDragLeave={() => setIsDragging(false)}
                  onDrop={(e) => {
                    e.preventDefault()
                    setIsDragging(false)
                    handleFileUpload(e.dataTransfer.files?.[0])
                  }}
                  className={`flex items-center justify-between gap-3 px-4 py-3 rounded-lg border border-dashed transition-colors ${
                    isDragging ? 'border-[#0E8A5F] bg-emerald-50' : 'border-slate-300 bg-white'
                  }`}
                >
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept=".pdf,.png,.jpg,.jpeg,.xlsx,.xls,.csv"
                    className="hidden"
                    onChange={(e) => handleFileUpload(e.target.files?.[0])}
                  />
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    className="flex items-center gap-3 min-w-0 text-left cursor-pointer"
                  >
                    {isScanning ? (
                      <RefreshCw className="w-4 h-4 text-[#0E8A5F] animate-spin shrink-0" />
                    ) : (
                      <UploadCloud className="w-4 h-4 text-[#0E8A5F] shrink-0" />
                    )}
                    <span className="text-sm text-slate-700 truncate">
                      {isScanning ? '파일을 읽는 중입니다…' : '발주서 파일을 끌어오거나 클릭해서 선택하세요'}
                    </span>
                    <span className="hidden md:inline text-xs text-slate-400 whitespace-nowrap">
                      PDF · Excel · CSV · 이미지
                    </span>
                  </button>
                  <div className="flex items-center gap-2 shrink-0">
                    {clientOrder.sourceFileName && (
                      <span className="hidden sm:inline-flex items-center gap-1 h-7 px-2.5 rounded bg-emerald-50 text-xs text-[#0E8A5F] max-w-[220px]">
                        <FileCheck2 className="w-3.5 h-3.5 shrink-0" />
                        <span className="truncate">{clientOrder.sourceFileName}</span>
                      </span>
                    )}
                    {uploadedPreviewUrl && (
                      <a href={uploadedPreviewUrl} target="_blank" rel="noreferrer" className={BTN_SM_GHOST}>
                        원본 보기
                      </a>
                    )}
                    <button
                      type="button"
                      onClick={() => fileInputRef.current?.click()}
                      className={`${BTN_SM} border border-slate-200 bg-white text-slate-700 hover:bg-slate-50`}
                    >
                      파일 선택
                    </button>
                  </div>
                </div>

                {/* Client Info */}
                <section className={CARD}>
                  <CardHeader
                    title="거래처 정보"
                    actions={
                      <button
                        type="button"
                        onClick={() => setShowAddClientForm((v) => !v)}
                        className={`${BTN_SM} border border-slate-200 bg-white text-slate-700 hover:bg-slate-50`}
                      >
                        {showAddClientForm ? '닫기' : <><Plus className="w-3.5 h-3.5" />신규</>}
                      </button>
                    }
                  />
                  <div className="p-5 space-y-4">
                    {clientPartners.length > 0 && (
                      <div className="flex items-center gap-2 overflow-x-auto pb-0.5">
                        <span className="text-xs text-slate-400 whitespace-nowrap">불러오기</span>
                        {clientPartners.map((partner) => (
                          <button
                            key={partner.id}
                            type="button"
                            onClick={() => handleSelectClientPartner(partner)}
                            className={chip(
                              Boolean(clientOrder.clientName) && clientOrder.clientName === partner.name
                            )}
                          >
                            {partner.name}
                          </button>
                        ))}
                      </div>
                    )}

                    {showAddClientForm && (
                      <div className="p-4 rounded-md bg-[#F7FAF8] border border-slate-200 space-y-3">
                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                          {(
                            [
                              ['name', '거래처명 (필수)'],
                              ['bizNo', '사업자번호'],
                              ['manager', '담당자'],
                              ['phone', '연락처'],
                              ['email', '이메일'],
                              ['address', '주소'],
                            ] as const
                          ).map(([key, ph]) => (
                            <input
                              key={key}
                              type="text"
                              placeholder={ph}
                              value={newClientForm[key]}
                              onChange={(e) => setNewClientForm({ ...newClientForm, [key]: e.target.value })}
                              className={INPUT}
                            />
                          ))}
                        </div>
                        <div className="flex justify-end gap-2">
                          <button type="button" onClick={() => setShowAddClientForm(false)} className={BTN_SECONDARY}>
                            취소
                          </button>
                          <button type="button" onClick={handleAddClientPartnerInStep1} className={BTN_PRIMARY}>
                            저장
                          </button>
                        </div>
                      </div>
                    )}

                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-x-4 gap-y-3.5">
                      {(
                        [
                          ['clientName', '거래처명', 'text', '거래처 상호'],
                          ['businessNo', '사업자등록번호', 'text', '000-00-00000'],
                          ['orderNo', '발주번호', 'text', 'PO-YYYYMMDD-000'],
                          ['managerName', '담당자', 'text', '이름 / 직책'],
                          ['managerPhone', '연락처', 'text', '02-0000-0000'],
                          ['managerEmail', '이메일', 'text', 'name@company.co.kr'],
                          ['orderDate', '발주일자', 'date', ''],
                          ['deliveryDate', '납기요청일', 'date', ''],
                          ['deliveryAddress', '납품 장소', 'text', '납품 주소'],
                        ] as const
                      ).map(([key, label, type, ph]) => (
                        <div key={key}>
                          <label className={LABEL}>{label}</label>
                          <input
                            type={type}
                            placeholder={ph}
                            value={clientOrder[key]}
                            onChange={(e) => setClientOrder({ ...clientOrder, [key]: e.target.value })}
                            className={INPUT}
                          />
                        </div>
                      ))}
                    </div>
                  </div>
                </section>

                {/* Ordered Products */}
                <section className={CARD}>
                  <CardHeader
                    title="주문 제품"
                    desc="제품별 BOM 구성에 따라 자재 수량이 자동 계산됩니다."
                    actions={
                      <button type="button" onClick={handleAddOrderItem} className={BTN_PRIMARY}>
                        <Plus className="w-3.5 h-3.5" />
                        추가
                      </button>
                    }
                  />
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className={TABLE_HEAD_ROW}>
                          <th className={`${TH} w-12 text-center`}>No</th>
                          <th className={TH}>제품</th>
                          <th className={TH}>규격</th>
                          <th className={`${TH} text-center w-44`}>수량</th>
                          <th className={`${TH} w-14`} />
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {clientOrder.items.length === 0 ? (
                          <tr>
                            <td colSpan={5} className="py-12 text-center text-sm text-slate-400">
                              주문 제품이 없습니다. 발주서를 올리거나 [추가]를 눌러 입력하세요.
                            </td>
                          </tr>
                        ) : (
                          orderItemsPaged.rows.map((item, idx) => {
                            const matchedModel = kioskModels.find((m) => m.modelCode === item.modelCode)
                            return (
                              <tr key={item.id} className="hover:bg-[#F7FAF8]">
                                <td className={`${TD} text-center text-xs text-slate-400`}>
                                  {orderItemsPaged.offset + idx + 1}
                                </td>
                                <td className={`${TD} min-w-[260px]`}>
                                  <select
                                    value={item.modelCode}
                                    onChange={(e) => handleModelChange(item.id, e.target.value)}
                                    className={INPUT}
                                  >
                                    {kioskModels.map((m) => (
                                      <option key={m.modelCode} value={m.modelCode}>
                                        {m.modelCode} · {m.modelName}
                                        {m.status === 'SOLD_OUT' ? ' (품절)' : m.status === 'NEW' ? ' (신제품)' : ''}
                                      </option>
                                    ))}
                                  </select>
                                  {matchedModel && (
                                    <button
                                      type="button"
                                      onClick={() => {
                                        setSelectedMasterModelCode(matchedModel.modelCode)
                                        setMasterBomPage(1)
                                        setActiveTab('MANAGE_BOM')
                                      }}
                                      className="mt-1 text-xs text-slate-400 hover:text-[#0E8A5F] cursor-pointer"
                                    >
                                      BOM 보기 →
                                    </button>
                                  )}
                                </td>
                                <td className={`${TD} min-w-[220px]`}>
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
                                    className={INPUT}
                                  />
                                </td>
                                <td className={TD}>
                                  <div className="flex items-center justify-center gap-1">
                                    <button
                                      type="button"
                                      onClick={() => handleQuantityChange(item.id, item.quantity - 1)}
                                      className={ICON_BTN}
                                    >
                                      −
                                    </button>
                                    <input
                                      type="number"
                                      min={1}
                                      value={item.quantity}
                                      onChange={(e) => handleQuantityChange(item.id, Number(e.target.value) || 1)}
                                      className={`${INPUT_SM} w-16 text-center`}
                                    />
                                    <button
                                      type="button"
                                      onClick={() => handleQuantityChange(item.id, item.quantity + 1)}
                                      className={ICON_BTN}
                                    >
                                      +
                                    </button>
                                    <span className="text-xs text-slate-400 ml-0.5">대</span>
                                  </div>
                                </td>
                                <td className={`${TD} text-center`}>
                                  <button
                                    type="button"
                                    title="삭제"
                                    onClick={() => handleRemoveOrderItem(item.id)}
                                    className={ICON_BTN}
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
                  <Pager {...orderItemsPaged} onChange={setOrderItemsPage} />
                </section>
              </>
            )}

            {/* ============================================================
                2. 자재 발주
            ============================================================ */}
            {activeTab === 'MATERIAL_ORDER' && (
              <>
                <PageHeader
                  title="자재 발주"
                  desc="주문 수량에 맞춰 계산된 자재를 확인·조정하고, 공급처별 구매발주서를 발행합니다."
                  actions={
                    <div className={SEG_WRAP}>
                      {(
                        [
                          { key: 'ALL', label: '전체' },
                          { key: 'BOM_ONLY', label: '소요 자재' },
                          { key: 'PO_ONLY', label: '발주서' },
                        ] as const
                      ).map((v) => (
                        <button
                          key={v.key}
                          type="button"
                          onClick={() => setMaterialSubView(v.key)}
                          className={segBtn(materialSubView === v.key)}
                        >
                          {v.label}
                        </button>
                      ))}
                    </div>
                  }
                />

                {(materialSubView === 'ALL' || materialSubView === 'BOM_ONLY') && (
                  <section className={CARD}>
                    <CardHeader
                      title="소요 자재"
                      desc="창고 현재고를 차감해 실제 발주 수량을 계산합니다. 수량은 직접 고칠 수 있습니다."
                      actions={
                        <>
                          <label className="inline-flex items-center gap-2 h-9 px-3 rounded-md border border-slate-200 text-sm text-slate-600 cursor-pointer select-none whitespace-nowrap">
                            <input
                              type="checkbox"
                              checked={deductStock}
                              onChange={(e) => setDeductStock(e.target.checked)}
                              className="w-3.5 h-3.5 accent-[#0E8A5F]"
                            />
                            재고 차감
                          </label>
                          <button
                            type="button"
                            onClick={() => setActiveTab('MANAGE_INVENTORY')}
                            className={BTN_SECONDARY}
                          >
                            재고 확인
                          </button>
                          <button
                            type="button"
                            onClick={() => setShowAddBomModal((v) => !v)}
                            className={BTN_PRIMARY}
                          >
                            <Plus className="w-3.5 h-3.5" />
                            추가
                          </button>
                        </>
                      }
                    />

                    {showAddBomModal && (
                      <div className="px-5 py-4 border-b border-slate-200 bg-[#F7FAF8] space-y-3">
                        <div className="grid grid-cols-2 lg:grid-cols-6 gap-2.5">
                          <div>
                            <label className={LABEL}>부품코드</label>
                            <input
                              type="text"
                              placeholder="자동 생성"
                              value={newBomPart.partCode}
                              onChange={(e) => setNewBomPart({ ...newBomPart, partCode: e.target.value })}
                              className={INPUT}
                            />
                          </div>
                          <div>
                            <label className={LABEL}>분류</label>
                            <select
                              value={newBomPart.category}
                              onChange={(e) =>
                                setNewBomPart({ ...newBomPart, category: e.target.value as PartCategory })
                              }
                              className={INPUT}
                            >
                              {PART_CATEGORIES.map((c) => (
                                <option key={c} value={c}>
                                  {c}
                                </option>
                              ))}
                            </select>
                          </div>
                          <div className="col-span-2">
                            <label className={LABEL}>부품명 (필수)</label>
                            <input
                              type="text"
                              value={newBomPart.partName}
                              onChange={(e) => setNewBomPart({ ...newBomPart, partName: e.target.value })}
                              className={INPUT}
                            />
                          </div>
                          <div>
                            <label className={LABEL}>필요수량 / 단위</label>
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
                                className={INPUT}
                              />
                              <input
                                type="text"
                                value={newBomPart.unit}
                                onChange={(e) => setNewBomPart({ ...newBomPart, unit: e.target.value })}
                                className={`${INPUT} w-16 text-center`}
                              />
                            </div>
                          </div>
                          <div>
                            <label className={LABEL}>공급사</label>
                            <select
                              value={newBomPart.supplierId}
                              onChange={(e) => setNewBomPart({ ...newBomPart, supplierId: e.target.value })}
                              className={INPUT}
                            >
                              {supplierPartners.map((s) => (
                                <option key={s.id} value={s.id}>
                                  {s.name}
                                </option>
                              ))}
                            </select>
                          </div>
                          <div className="col-span-2 lg:col-span-4">
                            <label className={LABEL}>규격</label>
                            <input
                              type="text"
                              value={newBomPart.spec}
                              onChange={(e) => setNewBomPart({ ...newBomPart, spec: e.target.value })}
                              className={INPUT}
                            />
                          </div>
                          <div className="col-span-2 flex items-end justify-end gap-2">
                            <button type="button" onClick={() => setShowAddBomModal(false)} className={BTN_SECONDARY}>
                              취소
                            </button>
                            <button type="button" onClick={handleAddCustomBomItem} className={BTN_PRIMARY}>
                              저장
                            </button>
                          </div>
                        </div>
                      </div>
                    )}

                    <div className="flex items-center justify-between gap-3 px-5 py-3 border-b border-slate-100">
                      <div className="flex items-center gap-1.5 overflow-x-auto">
                        {CATEGORIES.map((cat) => (
                          <button
                            key={cat}
                            type="button"
                            onClick={() => {
                              setSelectedCategory(cat)
                              setBomPage(1)
                            }}
                            className={chip(selectedCategory === cat)}
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
                          className={BTN_SM_GHOST}
                        >
                          <RefreshCw className="w-3 h-3" />
                          되돌리기
                        </button>
                      )}
                    </div>

                    <div className="overflow-x-auto">
                      <table className="w-full min-w-[1040px] text-sm">
                        <thead>
                          <tr className={TABLE_HEAD_ROW}>
                            <th className={TH}>부품코드</th>
                            <th className={TH}>부품명 / 규격</th>
                            <th className={TH}>산출 근거</th>
                            <th className={`${TH} text-right`}>필요수량</th>
                            <th className={`${TH} text-right`}>현재고</th>
                            <th className={`${TH} text-center`}>발주수량</th>
                            <th className={TH}>공급사</th>
                            <th className={`${TH} w-20`} />
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                          {filteredBom.length === 0 ? (
                            <tr>
                              <td colSpan={8} className="py-14 text-center">
                                <p className="text-sm text-slate-400">계산된 자재가 없습니다.</p>
                                <button
                                  type="button"
                                  onClick={() => setActiveTab('ORDER_INTAKE')}
                                  className={`${BTN_SECONDARY} mt-3`}
                                >
                                  발주서 접수로 이동
                                </button>
                              </td>
                            </tr>
                          ) : (
                            bomPaged.rows.map((part) => {
                              const isEditing = editingPartCode === part.partCode
                              return (
                                <tr key={part.partCode} className="hover:bg-[#F7FAF8]">
                                  <td className={`${TD} whitespace-nowrap`}>
                                    <div className="font-mono text-xs text-[#0E8A5F]">{part.partCode}</div>
                                    <div className="text-xs text-slate-400 mt-0.5">{part.category}</div>
                                  </td>
                                  <td className={`${TD} min-w-[220px] break-keep`}>
                                    {isEditing ? (
                                      <div className="space-y-1.5">
                                        <input
                                          type="text"
                                          value={part.partName}
                                          onChange={(e) =>
                                            handleUpdateBomField(part.partCode, 'partName', e.target.value)
                                          }
                                          className={INPUT_SM + ' w-full'}
                                        />
                                        <input
                                          type="text"
                                          value={part.spec}
                                          onChange={(e) => handleUpdateBomField(part.partCode, 'spec', e.target.value)}
                                          className={INPUT_SM + ' w-full text-xs'}
                                        />
                                      </div>
                                    ) : (
                                      <>
                                        <div className="text-[#0F2E26]">{part.partName}</div>
                                        <div className="text-xs text-slate-400 mt-0.5">{part.spec}</div>
                                      </>
                                    )}
                                  </td>
                                  <td className={`${TD} text-xs text-slate-500`}>
                                    {part.sourceModels.map((m) => (
                                      <div key={m.modelCode} className="whitespace-nowrap">
                                        {m.modelCode} · {m.orderQty}대 × {m.qtyPerUnit ?? 1} ={' '}
                                        <span className="text-[#0F2E26]">
                                          {m.subTotalQty}
                                          {part.unit}
                                        </span>
                                      </div>
                                    ))}
                                  </td>
                                  <td className={`${TD} text-right whitespace-nowrap tabular-nums`}>
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
                                        className={`${INPUT_SM} w-20 text-right`}
                                      />
                                    ) : (
                                      <>
                                        {part.grossRequiredQty.toLocaleString()}
                                        <span className="text-xs text-slate-400 ml-1">{part.unit}</span>
                                      </>
                                    )}
                                  </td>
                                  <td className={`${TD} text-right whitespace-nowrap tabular-nums text-slate-500`}>
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
                                        className={`${INPUT_SM} w-16 text-right`}
                                      />
                                    ) : (
                                      <>
                                        {deductStock ? `−${part.stockQty}` : part.stockQty}
                                        <span className="text-xs text-slate-400 ml-1">{part.unit}</span>
                                      </>
                                    )}
                                  </td>
                                  <td className={`${TD} text-center whitespace-nowrap`}>
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
                                      className="h-8 w-20 px-2 rounded-md border border-[#0E8A5F]/40 bg-emerald-50/50 text-center font-semibold text-[#0F2E26] focus:outline-none focus:border-[#0E8A5F]"
                                    />
                                  </td>
                                  <td className={`${TD} whitespace-nowrap`}>
                                    {isEditing ? (
                                      <select
                                        value={part.supplierId}
                                        onChange={(e) =>
                                          handleUpdateBomField(part.partCode, 'supplierId', e.target.value)
                                        }
                                        className={INPUT_SM}
                                      >
                                        {supplierPartners.map((s) => (
                                          <option key={s.id} value={s.id}>
                                            {s.name}
                                          </option>
                                        ))}
                                      </select>
                                    ) : (
                                      <>
                                        <div className="text-[#0F2E26]">{part.supplierName}</div>
                                        <div className="text-xs text-slate-400 mt-0.5">
                                          납기 {part.leadTimeDays}일
                                        </div>
                                      </>
                                    )}
                                  </td>
                                  <td className={`${TD} whitespace-nowrap`}>
                                    <div className="flex items-center justify-end">
                                      <button
                                        type="button"
                                        title={isEditing ? '완료' : '수정'}
                                        onClick={() => setEditingPartCode(isEditing ? null : part.partCode)}
                                        className={`${ICON_BTN} ${isEditing ? 'text-[#0E8A5F]' : ''}`}
                                      >
                                        {isEditing ? <Check className="w-4 h-4" /> : <Pencil className="w-3.5 h-3.5" />}
                                      </button>
                                      <button
                                        type="button"
                                        title="삭제"
                                        onClick={() => handleDeleteBomItem(part.partCode, part.partName)}
                                        className={ICON_BTN}
                                      >
                                        <Trash2 className="w-3.5 h-3.5" />
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
                    <Pager {...bomPaged} onChange={setBomPage} />
                  </section>
                )}

                {(materialSubView === 'ALL' || materialSubView === 'PO_ONLY') && (
                  <section className={CARD}>
                    <CardHeader
                      title="공급처별 구매발주서"
                      desc="소요 자재를 공급사별로 묶어 발주서를 만듭니다."
                      actions={
                        <>
                          <button
                            type="button"
                            onClick={handleDownloadAllExcel}
                            disabled={purchaseOrders.length === 0}
                            className={BTN_SECONDARY}
                          >
                            엑셀 일괄 저장
                          </button>
                          <button
                            type="button"
                            onClick={handleSendAllPdfEmails}
                            disabled={purchaseOrders.length === 0}
                            className={BTN_PRIMARY}
                          >
                            <Send className="w-3.5 h-3.5" />
                            일괄 전송
                          </button>
                        </>
                      }
                    />
                    <div className="overflow-x-auto">
                      <table className="w-full min-w-[980px] text-sm">
                        <thead>
                          <tr className={TABLE_HEAD_ROW}>
                            <th className={TH}>발주번호</th>
                            <th className={TH}>공급사</th>
                            <th className={`${TH} text-right`}>품목</th>
                            <th className={`${TH} text-right`}>총 수량</th>
                            <th className={TH}>납기요청일</th>
                            <th className={TH}>상태</th>
                            <th className={`${TH} text-right`}>작업</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                          {purchaseOrders.length === 0 ? (
                            <tr>
                              <td colSpan={7} className="py-12 text-center text-sm text-slate-400">
                                발행할 발주서가 없습니다. 주문 제품을 먼저 입력하세요.
                              </td>
                            </tr>
                          ) : (
                            poPaged.rows.map((po) => {
                              const received = Boolean(poReceivedMap[po.poNumber])
                              return (
                                <tr key={po.poNumber} className="hover:bg-[#F7FAF8]">
                                  <td className={`${TD} font-mono text-xs text-[#0E8A5F] whitespace-nowrap`}>
                                    {po.poNumber}
                                  </td>
                                  <td className={`${TD} whitespace-nowrap`}>
                                    <div className="text-[#0F2E26]">{po.supplierName}</div>
                                    <div className="text-xs text-slate-400 mt-0.5">
                                      {po.supplierManager} · {po.supplierEmail}
                                    </div>
                                  </td>
                                  <td className={`${TD} text-right tabular-nums`}>{po.totalItemTypes}종</td>
                                  <td className={`${TD} text-right tabular-nums font-medium`}>
                                    {po.totalOrderQty.toLocaleString()}
                                  </td>
                                  <td className={`${TD} whitespace-nowrap text-slate-600`}>
                                    {po.requestedDeliveryDate}
                                  </td>
                                  <td className={`${TD} whitespace-nowrap`}>
                                    <span
                                      className={`inline-flex items-center h-5 px-1.5 rounded text-[11px] font-medium ${
                                        po.status === 'SENT'
                                          ? 'bg-[#0E8A5F] text-white'
                                          : po.status === 'DOWNLOADED'
                                            ? 'bg-emerald-50 text-[#0E8A5F]'
                                            : 'bg-slate-100 text-slate-500'
                                      }`}
                                    >
                                      {po.status === 'SENT' ? '전송 완료' : po.status === 'DOWNLOADED' ? '저장됨' : '대기'}
                                    </span>
                                    {received && (
                                      <span className="ml-1 inline-flex items-center h-5 px-1.5 rounded text-[11px] border border-[#0E8A5F]/40 text-[#0E8A5F]">
                                        입고
                                      </span>
                                    )}
                                  </td>
                                  <td className={`${TD} whitespace-nowrap`}>
                                    <div className="flex items-center justify-end gap-0.5">
                                      <button type="button" onClick={() => setPreviewPo(po)} className={BTN_SM_GHOST}>
                                        보기
                                      </button>
                                      <button type="button" onClick={() => handleDownloadPdf(po)} className={BTN_SM_GHOST}>
                                        PDF
                                      </button>
                                      <button type="button" onClick={() => handleDownloadExcel(po)} className={BTN_SM_GHOST}>
                                        엑셀
                                      </button>
                                      <button type="button" onClick={() => handlePrintPo(po)} className={BTN_SM_GHOST}>
                                        인쇄
                                      </button>
                                      <button
                                        type="button"
                                        onClick={() => handleReceivePoItems(po)}
                                        disabled={received}
                                        className={`${BTN_SM_GHOST} disabled:text-slate-300 disabled:hover:bg-transparent`}
                                      >
                                        입고
                                      </button>
                                      <button
                                        type="button"
                                        onClick={() => handleSendPoPdfEmail(po)}
                                        className={`${BTN_SM} ml-1 bg-[#0E8A5F] hover:bg-[#0B704D] text-white`}
                                      >
                                        전송
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
                    <Pager {...poPaged} onChange={setPoPage} />
                  </section>
                )}
              </>
            )}

            {/* ============================================================
                3. 재고 관리
            ============================================================ */}
            {activeTab === 'MANAGE_INVENTORY' && (
              <>
                <PageHeader
                  title="재고 관리"
                  desc="부품별 현재고와 안전재고를 관리합니다. 현재고는 자재 발주 계산에 바로 반영됩니다."
                  actions={
                    <button
                      type="button"
                      onClick={() => setShowAddInventoryPartForm((v) => !v)}
                      className={BTN_PRIMARY}
                    >
                      <Plus className="w-3.5 h-3.5" />
                      부품 등록
                    </button>
                  }
                />

                <section className={CARD}>
                  {showAddInventoryPartForm && (
                    <div className="px-5 py-4 border-b border-slate-200 bg-[#F7FAF8]">
                      <div className="grid grid-cols-2 lg:grid-cols-6 gap-2.5">
                        <div>
                          <label className={LABEL}>부품코드</label>
                          <input
                            type="text"
                            placeholder="자동 생성"
                            value={newInventoryPart.partCode}
                            onChange={(e) => setNewInventoryPart({ ...newInventoryPart, partCode: e.target.value })}
                            className={INPUT}
                          />
                        </div>
                        <div>
                          <label className={LABEL}>분류</label>
                          <select
                            value={newInventoryPart.category}
                            onChange={(e) =>
                              setNewInventoryPart({
                                ...newInventoryPart,
                                category: e.target.value as PartCategory,
                              })
                            }
                            className={INPUT}
                          >
                            {PART_CATEGORIES.map((c) => (
                              <option key={c} value={c}>
                                {c}
                              </option>
                            ))}
                          </select>
                        </div>
                        <div className="col-span-2">
                          <label className={LABEL}>부품명 (필수)</label>
                          <input
                            type="text"
                            value={newInventoryPart.partName}
                            onChange={(e) => setNewInventoryPart({ ...newInventoryPart, partName: e.target.value })}
                            className={INPUT}
                          />
                        </div>
                        <div>
                          <label className={LABEL}>현재고 / 안전재고</label>
                          <div className="flex gap-1.5">
                            <input
                              type="number"
                              min={0}
                              value={newInventoryPart.stockQty}
                              onChange={(e) =>
                                setNewInventoryPart({ ...newInventoryPart, stockQty: Number(e.target.value) || 0 })
                              }
                              className={INPUT}
                            />
                            <input
                              type="number"
                              min={0}
                              value={newInventoryPart.safetyStockQty}
                              onChange={(e) =>
                                setNewInventoryPart({
                                  ...newInventoryPart,
                                  safetyStockQty: Number(e.target.value) || 0,
                                })
                              }
                              className={INPUT}
                            />
                          </div>
                        </div>
                        <div>
                          <label className={LABEL}>공급사</label>
                          <select
                            value={newInventoryPart.supplierId}
                            onChange={(e) => setNewInventoryPart({ ...newInventoryPart, supplierId: e.target.value })}
                            className={INPUT}
                          >
                            {supplierPartners.map((s) => (
                              <option key={s.id} value={s.id}>
                                {s.name}
                              </option>
                            ))}
                          </select>
                        </div>
                        <div className="col-span-2 lg:col-span-4">
                          <label className={LABEL}>규격</label>
                          <input
                            type="text"
                            value={newInventoryPart.spec}
                            onChange={(e) => setNewInventoryPart({ ...newInventoryPart, spec: e.target.value })}
                            className={INPUT}
                          />
                        </div>
                        <div className="col-span-2 flex items-end justify-end gap-2">
                          <button
                            type="button"
                            onClick={() => setShowAddInventoryPartForm(false)}
                            className={BTN_SECONDARY}
                          >
                            취소
                          </button>
                          <button type="button" onClick={handleAddWarehousePart} className={BTN_PRIMARY}>
                            저장
                          </button>
                        </div>
                      </div>
                    </div>
                  )}

                  <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3 px-5 py-3.5 border-b border-slate-200">
                    <div className="flex items-center gap-2 overflow-x-auto">
                      <div className={SEG_WRAP}>
                        {(
                          [
                            { key: 'ALL', label: '전체' },
                            { key: 'NORMAL', label: '정상' },
                            { key: 'LOW', label: '부족' },
                            { key: 'EMPTY', label: '품절' },
                          ] as const
                        ).map((st) => (
                          <button
                            key={st.key}
                            type="button"
                            onClick={() => {
                              setInventoryStatusFilter(st.key)
                              setInvPage(1)
                            }}
                            className={segBtn(inventoryStatusFilter === st.key)}
                          >
                            {st.label}
                          </button>
                        ))}
                      </div>
                      <select
                        value={inventoryCategory}
                        onChange={(e) => {
                          setInventoryCategory(e.target.value as '전체' | PartCategory)
                          setInvPage(1)
                        }}
                        className={`${INPUT} w-40 shrink-0`}
                      >
                        {CATEGORIES.map((c) => (
                          <option key={c} value={c}>
                            {c === '전체' ? '분류 전체' : c}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div className="relative w-full lg:w-64">
                      <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                      <input
                        type="text"
                        placeholder="부품코드, 부품명, 공급사"
                        value={inventorySearch}
                        onChange={(e) => {
                          setInventorySearch(e.target.value)
                          setInvPage(1)
                        }}
                        className={`${INPUT} pl-9`}
                      />
                    </div>
                  </div>

                  <div className="overflow-x-auto">
                    <table className="w-full min-w-[1000px] text-sm">
                      <thead>
                        <tr className={TABLE_HEAD_ROW}>
                          <th className={TH}>부품코드</th>
                          <th className={TH}>부품명 / 규격</th>
                          <th className={TH}>상태</th>
                          <th className={`${TH} text-center`}>현재고</th>
                          <th className={`${TH} text-center`}>안전재고</th>
                          <th className={`${TH} text-right`}>이번 수주 필요량</th>
                          <th className={TH}>공급사</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {invPaged.rows.length === 0 ? (
                          <tr>
                            <td colSpan={7} className="py-12 text-center text-sm text-slate-400">
                              조건에 맞는 부품이 없습니다.
                            </td>
                          </tr>
                        ) : (
                          invPaged.rows.map((part) => (
                            <tr key={part.partCode} className="hover:bg-[#F7FAF8]">
                              <td className={`${TD} whitespace-nowrap`}>
                                <div className="font-mono text-xs text-[#0E8A5F]">{part.partCode}</div>
                                <div className="text-xs text-slate-400 mt-0.5">{part.category}</div>
                              </td>
                              <td className={`${TD} min-w-[220px] break-keep`}>
                                <div className="text-[#0F2E26]">{part.partName}</div>
                                <div className="text-xs text-slate-400 mt-0.5">{part.spec}</div>
                              </td>
                              <td className={`${TD} whitespace-nowrap`}>
                                <span
                                  className={`inline-flex items-center h-5 px-1.5 rounded text-[11px] font-medium ${
                                    part.stockStatus === 'EMPTY'
                                      ? 'bg-[#0F2E26] text-white'
                                      : part.stockStatus === 'LOW'
                                        ? 'border border-[#0E8A5F]/50 text-[#0E8A5F]'
                                        : 'bg-emerald-50 text-[#0E8A5F]'
                                  }`}
                                >
                                  {part.stockStatus === 'EMPTY' ? '품절' : part.stockStatus === 'LOW' ? '부족' : '정상'}
                                </span>
                              </td>
                              <td className={`${TD} whitespace-nowrap`}>
                                <div className="flex items-center justify-center gap-1">
                                  <button
                                    type="button"
                                    title="출고 -1"
                                    onClick={() =>
                                      handleAdjustWarehouseStock(part.partCode, part.stockQty - 1, '재고 관리에서 -1 출고', 'OUT')
                                    }
                                    className={ICON_BTN}
                                  >
                                    −
                                  </button>
                                  <input
                                    type="number"
                                    min={0}
                                    value={part.stockQty}
                                    onChange={(e) =>
                                      handleAdjustWarehouseStock(
                                        part.partCode,
                                        Math.max(0, Number(e.target.value) || 0),
                                        '재고 수량 직접 수정',
                                        'ADJUST'
                                      )
                                    }
                                    className={`${INPUT_SM} w-16 text-center font-medium`}
                                  />
                                  <button
                                    type="button"
                                    title="입고 +1"
                                    onClick={() =>
                                      handleAdjustWarehouseStock(part.partCode, part.stockQty + 1, '재고 관리에서 +1 입고', 'IN')
                                    }
                                    className={ICON_BTN}
                                  >
                                    +
                                  </button>
                                  <span className="text-xs text-slate-400">{part.unit}</span>
                                </div>
                              </td>
                              <td className={`${TD} text-center whitespace-nowrap`}>
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
                                  className={`${INPUT_SM} w-14 text-center`}
                                />
                              </td>
                              <td className={`${TD} text-right whitespace-nowrap tabular-nums`}>
                                {part.currentReqQty > 0 ? (
                                  <>
                                    <div className="text-[#0F2E26] font-medium">
                                      {part.currentReqQty.toLocaleString()} {part.unit}
                                    </div>
                                    <div className="text-xs mt-0.5">
                                      {part.stockQty >= part.currentReqQty ? (
                                        <span className="text-slate-400">충분</span>
                                      ) : (
                                        <span className="text-[#0E8A5F] font-medium">
                                          {part.currentReqQty - part.stockQty} 부족
                                        </span>
                                      )}
                                    </div>
                                  </>
                                ) : (
                                  <span className="text-xs text-slate-300">-</span>
                                )}
                              </td>
                              <td className={`${TD} whitespace-nowrap`}>
                                <div className="text-[#0F2E26]">{part.supplierName}</div>
                                <div className="text-xs text-slate-400 mt-0.5">{part.supplierManager}</div>
                              </td>
                            </tr>
                          ))
                        )}
                      </tbody>
                    </table>
                  </div>
                  <Pager {...invPaged} onChange={setInvPage} />
                </section>

                <section className={CARD}>
                  <CardHeader title="입·출고 이력" desc="재고 변경과 발주서 입고 내역이 자동으로 기록됩니다." />
                  <div className="overflow-x-auto">
                    <table className="w-full min-w-[760px] text-sm">
                      <thead>
                        <tr className={TABLE_HEAD_ROW}>
                          <th className={TH}>일시</th>
                          <th className={TH}>구분</th>
                          <th className={TH}>부품</th>
                          <th className={`${TH} text-right`}>변동</th>
                          <th className={`${TH} text-right`}>변경 후</th>
                          <th className={TH}>비고</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {logPaged.rows.map((log) => (
                          <tr key={log.id} className="hover:bg-[#F7FAF8]">
                            <td className={`${TD} font-mono text-xs text-slate-400 whitespace-nowrap`}>
                              {log.timestamp}
                            </td>
                            <td className={`${TD} whitespace-nowrap`}>
                              <span
                                className={`inline-flex items-center h-5 px-1.5 rounded text-[11px] font-medium ${
                                  log.type === 'IN'
                                    ? 'bg-emerald-50 text-[#0E8A5F]'
                                    : log.type === 'OUT'
                                      ? 'bg-slate-100 text-slate-600'
                                      : 'border border-slate-200 text-slate-500'
                                }`}
                              >
                                {log.type === 'IN' ? '입고' : log.type === 'OUT' ? '출고' : '조정'}
                              </span>
                            </td>
                            <td className={`${TD} whitespace-nowrap`}>
                              <span className="font-mono text-xs text-[#0E8A5F] mr-2">{log.partCode}</span>
                              <span className="text-[#0F2E26]">{log.partName}</span>
                            </td>
                            <td
                              className={`${TD} text-right tabular-nums whitespace-nowrap font-medium ${
                                log.changeQty > 0 ? 'text-[#0E8A5F]' : 'text-slate-500'
                              }`}
                            >
                              {log.changeQty > 0 ? `+${log.changeQty}` : log.changeQty} {log.unit}
                            </td>
                            <td className={`${TD} text-right tabular-nums whitespace-nowrap`}>
                              {log.afterStockQty} {log.unit}
                            </td>
                            <td className={`${TD} text-xs text-slate-500`}>{log.note}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                  <Pager {...logPaged} onChange={setLogPage} />
                </section>
              </>
            )}

            {/* ============================================================
                4. 거래처 관리
            ============================================================ */}
            {activeTab === 'MANAGE_PARTNERS' && (
              <>
                <PageHeader
                  title="거래처 관리"
                  desc="고객사와 공급사 정보를 관리합니다. 행을 누르면 상세 정보를 볼 수 있습니다."
                  actions={
                    <>
                      <div className={SEG_WRAP}>
                        {(['ALL', 'CLIENT', 'SUPPLIER'] as const).map((type) => (
                          <button
                            key={type}
                            type="button"
                            onClick={() => {
                              setPartnerFilter(type)
                              setPartnerPage(1)
                            }}
                            className={segBtn(partnerFilter === type)}
                          >
                            {type === 'ALL' ? '전체' : type === 'CLIENT' ? '고객사' : '공급사'}
                          </button>
                        ))}
                      </div>
                      <button
                        type="button"
                        onClick={() => setShowNewPartnerForm((v) => !v)}
                        className={BTN_PRIMARY}
                      >
                        <Plus className="w-3.5 h-3.5" />
                        추가
                      </button>
                    </>
                  }
                />

                <section className={CARD}>
                  {showNewPartnerForm && (
                    <div className="px-5 py-4 border-b border-slate-200 bg-[#F7FAF8] space-y-3">
                      <div className="grid grid-cols-2 lg:grid-cols-4 gap-2.5">
                        <select
                          value={newPartner.type}
                          onChange={(e) =>
                            setNewPartner({ ...newPartner, type: e.target.value as 'CLIENT' | 'SUPPLIER' })
                          }
                          className={INPUT}
                        >
                          <option value="SUPPLIER">공급사</option>
                          <option value="CLIENT">고객사</option>
                        </select>
                        {(
                          [
                            ['name', '업체명 (필수)'],
                            ['bizNo', '사업자번호'],
                            ['manager', '담당자'],
                            ['phone', '연락처'],
                            ['email', '이메일'],
                          ] as const
                        ).map(([key, ph]) => (
                          <input
                            key={key}
                            type="text"
                            placeholder={ph}
                            value={newPartner[key]}
                            onChange={(e) => setNewPartner({ ...newPartner, [key]: e.target.value })}
                            className={INPUT}
                          />
                        ))}
                        <input
                          type="text"
                          placeholder="주소"
                          value={newPartner.address}
                          onChange={(e) => setNewPartner({ ...newPartner, address: e.target.value })}
                          className={`${INPUT} col-span-2`}
                        />
                      </div>
                      <div className="flex justify-end gap-2">
                        <button type="button" onClick={() => setShowNewPartnerForm(false)} className={BTN_SECONDARY}>
                          취소
                        </button>
                        <button type="button" onClick={handleCreatePartner} className={BTN_PRIMARY}>
                          저장
                        </button>
                      </div>
                    </div>
                  )}

                  <div className="overflow-x-auto">
                    <table className="w-full min-w-[760px] text-sm">
                      <thead>
                        <tr className={TABLE_HEAD_ROW}>
                          <th className={TH}>구분</th>
                          <th className={TH}>업체명</th>
                          <th className={TH}>담당자</th>
                          <th className={TH}>연락처</th>
                          <th className={TH}>지역</th>
                          <th className={`${TH} w-10`} />
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {partnerPaged.rows.map((partner) => {
                          const isOpen = expandedPartnerId === partner.id
                          const isEdit = editingPartnerId === partner.id
                          return [
                            <tr
                              key={partner.id}
                              onClick={() => {
                                setExpandedPartnerId(isOpen ? null : partner.id)
                                if (isOpen) setEditingPartnerId(null)
                              }}
                              className={`cursor-pointer ${isOpen ? 'bg-[#F7FAF8]' : 'hover:bg-[#F7FAF8]'}`}
                            >
                              <td className={`${TD} whitespace-nowrap`}>
                                <span
                                  className={`inline-flex items-center h-5 px-1.5 rounded text-[11px] font-medium ${
                                    partner.type === 'CLIENT'
                                      ? 'bg-emerald-50 text-[#0E8A5F]'
                                      : 'bg-slate-100 text-slate-600'
                                  }`}
                                >
                                  {partner.type === 'CLIENT' ? '고객사' : '공급사'}
                                </span>
                              </td>
                              <td className={`${TD} whitespace-nowrap text-[#0F2E26] font-medium`}>{partner.name}</td>
                              <td className={`${TD} whitespace-nowrap text-slate-600`}>{partner.manager}</td>
                              <td className={`${TD} whitespace-nowrap text-slate-600 tabular-nums`}>{partner.phone}</td>
                              <td className={`${TD} whitespace-nowrap text-slate-500`}>{shortAddress(partner.address)}</td>
                              <td className={`${TD} text-slate-400`}>
                                <ChevronDown className={`w-4 h-4 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
                              </td>
                            </tr>,
                            isOpen && (
                              <tr key={`${partner.id}-detail`} className="bg-[#F7FAF8]">
                                <td colSpan={6} className="px-5 pb-5 pt-1">
                                  <div className="rounded-md border border-slate-200 bg-white p-4">
                                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-x-6 gap-y-3">
                                      {(
                                        [
                                          ['name', '업체명'],
                                          ['bizNo', '사업자번호'],
                                          ['manager', '담당자'],
                                          ['phone', '연락처'],
                                          ['email', '이메일'],
                                          ['address', '주소'],
                                        ] as const
                                      ).map(([key, label]) => (
                                        <div key={key} className={key === 'address' ? 'sm:col-span-2 lg:col-span-1' : ''}>
                                          <div className="text-xs text-slate-400 mb-1">{label}</div>
                                          {isEdit ? (
                                            <input
                                              type="text"
                                              value={partner[key]}
                                              onChange={(e) => handleUpdatePartner(partner.id, key, e.target.value)}
                                              className={INPUT}
                                            />
                                          ) : (
                                            <div className="text-sm text-[#0F2E26] break-keep">{partner[key] || '-'}</div>
                                          )}
                                        </div>
                                      ))}
                                    </div>
                                    <div className="flex justify-end gap-2 mt-4 pt-3 border-t border-slate-100">
                                      <button
                                        type="button"
                                        onClick={() => {
                                          handleDeleteClientPartner(partner.id, partner.name)
                                          setExpandedPartnerId(null)
                                        }}
                                        className={BTN_SECONDARY}
                                      >
                                        <Trash2 className="w-3.5 h-3.5" />
                                        삭제
                                      </button>
                                      <button
                                        type="button"
                                        onClick={() => setEditingPartnerId(isEdit ? null : partner.id)}
                                        className={isEdit ? BTN_PRIMARY : BTN_SECONDARY}
                                      >
                                        {isEdit ? <Check className="w-3.5 h-3.5" /> : <Pencil className="w-3.5 h-3.5" />}
                                        {isEdit ? '완료' : '수정'}
                                      </button>
                                    </div>
                                  </div>
                                </td>
                              </tr>
                            ),
                          ]
                        })}
                      </tbody>
                    </table>
                  </div>
                  <Pager {...partnerPaged} onChange={setPartnerPage} />
                </section>
              </>
            )}

            {/* ============================================================
                5. 제품 · BOM 관리 (좌측 제품 목록 → 우측 BOM)
            ============================================================ */}
            {activeTab === 'MANAGE_BOM' && (
              <>
                <PageHeader
                  title="제품 · BOM 관리"
                  desc="왼쪽에서 제품을 고르면 오른쪽에 1대당 필요한 부품(BOM)이 표시됩니다."
                  actions={
                    <button
                      type="button"
                      onClick={() => setShowAddModelForm((v) => !v)}
                      className={BTN_PRIMARY}
                    >
                      <Plus className="w-3.5 h-3.5" />
                      제품 추가
                    </button>
                  }
                />

                {showAddModelForm && (
                  <section className={`${CARD} p-5 space-y-3`}>
                    <div className="grid grid-cols-2 lg:grid-cols-6 gap-2.5">
                      <div>
                        <label className={LABEL}>제품코드</label>
                        <input
                          type="text"
                          placeholder="자동 생성"
                          value={newModelForm.modelCode}
                          onChange={(e) => setNewModelForm({ ...newModelForm, modelCode: e.target.value })}
                          className={INPUT}
                        />
                      </div>
                      <div className="col-span-2">
                        <label className={LABEL}>제품명 (필수)</label>
                        <input
                          type="text"
                          value={newModelForm.modelName}
                          onChange={(e) => setNewModelForm({ ...newModelForm, modelName: e.target.value })}
                          className={INPUT}
                        />
                      </div>
                      <div>
                        <label className={LABEL}>상태</label>
                        <select
                          value={newModelForm.status}
                          onChange={(e) =>
                            setNewModelForm({ ...newModelForm, status: e.target.value as KioskProductStatus })
                          }
                          className={INPUT}
                        >
                          <option value="NEW">신제품</option>
                          <option value="ACTIVE">판매중</option>
                          <option value="SOLD_OUT">품절</option>
                        </select>
                      </div>
                      <div className="col-span-2">
                        <label className={LABEL}>BOM 복사</label>
                        <select
                          value={newModelForm.copyFromModelCode}
                          onChange={(e) => setNewModelForm({ ...newModelForm, copyFromModelCode: e.target.value })}
                          className={INPUT}
                        >
                          <option value="">빈 BOM으로 시작</option>
                          {kioskModels.map((m) => (
                            <option key={m.modelCode} value={m.modelCode}>
                              {m.modelCode} · {m.modelName} ({m.bom.length}종)
                            </option>
                          ))}
                        </select>
                      </div>
                      <div className="col-span-2 lg:col-span-4">
                        <label className={LABEL}>규격</label>
                        <input
                          type="text"
                          value={newModelForm.spec}
                          onChange={(e) => setNewModelForm({ ...newModelForm, spec: e.target.value })}
                          className={INPUT}
                        />
                      </div>
                      <div className="col-span-2 flex items-end justify-end gap-2">
                        <button type="button" onClick={() => setShowAddModelForm(false)} className={BTN_SECONDARY}>
                          취소
                        </button>
                        <button type="button" onClick={handleCreateKioskModel} className={BTN_PRIMARY}>
                          저장
                        </button>
                      </div>
                    </div>
                  </section>
                )}

                <div className="flex flex-col lg:flex-row gap-5 items-start">
                  {/* Left: Product list tabs */}
                  <section className={`${CARD} w-full lg:w-72 shrink-0 overflow-hidden`}>
                    <div className="p-3 border-b border-slate-200 space-y-2">
                      <div className="relative">
                        <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                        <input
                          type="text"
                          placeholder="제품 검색"
                          value={modelSearch}
                          onChange={(e) => {
                            setModelSearch(e.target.value)
                            setModelListPage(1)
                          }}
                          className={`${INPUT} pl-9`}
                        />
                      </div>
                      <select
                        value={modelStatusFilter}
                        onChange={(e) => {
                          setModelStatusFilter(e.target.value as 'ALL' | KioskProductStatus)
                          setModelListPage(1)
                        }}
                        className={INPUT}
                      >
                        <option value="ALL">상태 전체</option>
                        <option value="ACTIVE">판매중</option>
                        <option value="NEW">신제품</option>
                        <option value="SOLD_OUT">품절</option>
                      </select>
                    </div>
                    <ul className="divide-y divide-slate-100">
                      {modelListPaged.rows.length === 0 && (
                        <li className="px-4 py-8 text-center text-sm text-slate-400">제품이 없습니다.</li>
                      )}
                      {modelListPaged.rows.map((m) => {
                        const isSelected = selectedMasterModelCode === m.modelCode
                        return (
                          <li key={m.modelCode}>
                            <button
                              type="button"
                              onClick={() => {
                                setSelectedMasterModelCode(m.modelCode)
                                setMasterBomPage(1)
                                setEditingModelCode(null)
                              }}
                              className={`w-full text-left px-4 py-3 border-l-2 transition-colors cursor-pointer ${
                                isSelected
                                  ? 'border-[#0E8A5F] bg-emerald-50/60'
                                  : 'border-transparent hover:bg-[#F7FAF8]'
                              }`}
                            >
                              <div className="flex items-center justify-between gap-2">
                                <span
                                  className={`font-mono text-xs ${isSelected ? 'text-[#0E8A5F] font-medium' : 'text-slate-500'}`}
                                >
                                  {m.modelCode}
                                </span>
                                <ModelStatusBadge status={m.status || 'ACTIVE'} />
                              </div>
                              <div
                                className={`text-sm mt-1 line-clamp-2 break-keep ${
                                  isSelected ? 'text-[#0F2E26] font-medium' : 'text-slate-700'
                                }`}
                              >
                                {m.modelName}
                              </div>
                              <div className="text-xs text-slate-400 mt-0.5">부품 {m.bom.length}종</div>
                            </button>
                          </li>
                        )
                      })}
                    </ul>
                    {modelListPaged.totalPages > 1 && <Pager {...modelListPaged} onChange={setModelListPage} />}
                  </section>

                  {/* Right: Selected product BOM */}
                  <section className={`${CARD} flex-1 min-w-0 w-full`}>
                    {!selectedModel ? (
                      <div className="py-20 text-center text-sm text-slate-400">왼쪽에서 제품을 선택하세요.</div>
                    ) : (
                      (() => {
                        const model = selectedModel
                        const isEditingModel = editingModelCode === model.modelCode
                        const modelStatus = model.status || 'ACTIVE'
                        return (
                          <>
                            {/* Product header */}
                            <div className="px-5 py-4 border-b border-slate-200 space-y-3">
                              <div className="flex flex-col xl:flex-row xl:items-start justify-between gap-3">
                                <div className="min-w-0 flex-1 space-y-1.5">
                                  <div className="font-mono text-xs text-[#0E8A5F]">{model.modelCode}</div>
                                  {isEditingModel ? (
                                    <>
                                      <input
                                        type="text"
                                        value={model.modelName}
                                        onChange={(e) =>
                                          handleUpdateKioskModel(model.modelCode, 'modelName', e.target.value)
                                        }
                                        className={INPUT}
                                      />
                                      <input
                                        type="text"
                                        value={model.spec}
                                        onChange={(e) => handleUpdateKioskModel(model.modelCode, 'spec', e.target.value)}
                                        className={INPUT}
                                      />
                                    </>
                                  ) : (
                                    <>
                                      <h3 className="text-lg font-semibold text-[#0F2E26] break-keep">
                                        {model.modelName}
                                      </h3>
                                      <p className="text-xs text-slate-500 break-keep">{model.spec}</p>
                                    </>
                                  )}
                                </div>
                                <div className="flex items-center gap-2 flex-nowrap shrink-0">
                                  <div className={SEG_WRAP}>
                                    {(
                                      [
                                        { code: 'ACTIVE', label: '판매중' },
                                        { code: 'NEW', label: '신제품' },
                                        { code: 'SOLD_OUT', label: '품절' },
                                      ] as const
                                    ).map((st) => (
                                      <button
                                        key={st.code}
                                        type="button"
                                        onClick={() => handleUpdateKioskModel(model.modelCode, 'status', st.code)}
                                        className={segBtn(modelStatus === st.code)}
                                      >
                                        {st.label}
                                      </button>
                                    ))}
                                  </div>
                                  <button
                                    type="button"
                                    onClick={() => setEditingModelCode(isEditingModel ? null : model.modelCode)}
                                    className={isEditingModel ? BTN_PRIMARY : BTN_SECONDARY}
                                  >
                                    {isEditingModel ? '완료' : '수정'}
                                  </button>
                                  <button
                                    type="button"
                                    title="제품 삭제"
                                    onClick={() => handleDeleteKioskModel(model.modelCode, model.modelName)}
                                    className={`${BTN_SECONDARY} px-2.5`}
                                  >
                                    <Trash2 className="w-3.5 h-3.5" />
                                  </button>
                                </div>
                              </div>
                            </div>

                            {/* Toolbar: link existing part + category filter */}
                            <div className="flex flex-col xl:flex-row xl:items-center justify-between gap-3 px-5 py-3 border-b border-slate-100">
                              <div className="flex items-center gap-2 flex-nowrap min-w-0">
                                <select
                                  value={selectedExistingPartCode}
                                  onChange={(e) => setSelectedExistingPartCode(e.target.value)}
                                  className={`${INPUT} min-w-0 flex-1 xl:w-72`}
                                >
                                  <option value="">등록된 부품에서 선택</option>
                                  {warehouseInventory.map((wp) => (
                                    <option key={wp.partCode} value={wp.partCode}>
                                      {wp.partCode} · {wp.partName}
                                    </option>
                                  ))}
                                </select>
                                <input
                                  type="number"
                                  min={1}
                                  title="1대당 수량"
                                  value={existingPartAddQty}
                                  onChange={(e) => setExistingPartAddQty(Math.max(1, Number(e.target.value) || 1))}
                                  className={`${INPUT} w-16 text-center shrink-0`}
                                />
                                <button
                                  type="button"
                                  onClick={handleAddExistingPartToModelBom}
                                  className={`${BTN_SECONDARY} shrink-0`}
                                >
                                  연결
                                </button>
                                <button
                                  type="button"
                                  onClick={() => setShowAddMasterBomForm((v) => !v)}
                                  className={`${BTN_PRIMARY} shrink-0`}
                                >
                                  <Plus className="w-3.5 h-3.5" />
                                  새 부품
                                </button>
                              </div>
                              <select
                                value={masterBomCategoryFilter}
                                onChange={(e) => {
                                  setMasterBomCategoryFilter(e.target.value as '전체' | PartCategory)
                                  setMasterBomPage(1)
                                }}
                                className={`${INPUT} xl:w-40 shrink-0`}
                              >
                                {CATEGORIES.map((c) => (
                                  <option key={c} value={c}>
                                    {c === '전체' ? '분류 전체' : c}
                                  </option>
                                ))}
                              </select>
                            </div>

                            {showAddMasterBomForm && (
                              <div className="px-5 py-4 border-b border-slate-200 bg-[#F7FAF8]">
                                <div className="grid grid-cols-2 lg:grid-cols-6 gap-2.5">
                                  <div>
                                    <label className={LABEL}>부품코드</label>
                                    <input
                                      type="text"
                                      placeholder="자동 생성"
                                      value={newMasterPart.partCode}
                                      onChange={(e) => setNewMasterPart({ ...newMasterPart, partCode: e.target.value })}
                                      className={INPUT}
                                    />
                                  </div>
                                  <div>
                                    <label className={LABEL}>분류</label>
                                    <select
                                      value={newMasterPart.category}
                                      onChange={(e) =>
                                        setNewMasterPart({
                                          ...newMasterPart,
                                          category: e.target.value as PartCategory,
                                        })
                                      }
                                      className={INPUT}
                                    >
                                      {PART_CATEGORIES.map((c) => (
                                        <option key={c} value={c}>
                                          {c}
                                        </option>
                                      ))}
                                    </select>
                                  </div>
                                  <div className="col-span-2">
                                    <label className={LABEL}>부품명 (필수)</label>
                                    <input
                                      type="text"
                                      value={newMasterPart.partName}
                                      onChange={(e) => setNewMasterPart({ ...newMasterPart, partName: e.target.value })}
                                      className={INPUT}
                                    />
                                  </div>
                                  <div>
                                    <label className={LABEL}>1대당 / 현재고</label>
                                    <div className="flex gap-1.5">
                                      <input
                                        type="number"
                                        min={1}
                                        value={newMasterPart.qtyPerUnit}
                                        onChange={(e) =>
                                          setNewMasterPart({ ...newMasterPart, qtyPerUnit: Number(e.target.value) || 1 })
                                        }
                                        className={INPUT}
                                      />
                                      <input
                                        type="number"
                                        min={0}
                                        value={newMasterPart.stockQty}
                                        onChange={(e) =>
                                          setNewMasterPart({ ...newMasterPart, stockQty: Number(e.target.value) || 0 })
                                        }
                                        className={INPUT}
                                      />
                                    </div>
                                  </div>
                                  <div>
                                    <label className={LABEL}>공급사</label>
                                    <select
                                      value={newMasterPart.supplierId}
                                      onChange={(e) => setNewMasterPart({ ...newMasterPart, supplierId: e.target.value })}
                                      className={INPUT}
                                    >
                                      {supplierPartners.map((s) => (
                                        <option key={s.id} value={s.id}>
                                          {s.name}
                                        </option>
                                      ))}
                                    </select>
                                  </div>
                                  <div className="col-span-2 lg:col-span-4">
                                    <label className={LABEL}>규격</label>
                                    <input
                                      type="text"
                                      value={newMasterPart.spec}
                                      onChange={(e) => setNewMasterPart({ ...newMasterPart, spec: e.target.value })}
                                      className={INPUT}
                                    />
                                  </div>
                                  <div className="col-span-2 flex items-end justify-end gap-2">
                                    <button
                                      type="button"
                                      onClick={() => setShowAddMasterBomForm(false)}
                                      className={BTN_SECONDARY}
                                    >
                                      취소
                                    </button>
                                    <button type="button" onClick={handleAddMasterBomPart} className={BTN_PRIMARY}>
                                      저장
                                    </button>
                                  </div>
                                </div>
                              </div>
                            )}

                            {/* BOM table */}
                            <div className="overflow-x-auto">
                              <table className="w-full min-w-[860px] text-sm">
                                <thead>
                                  <tr className={TABLE_HEAD_ROW}>
                                    <th className={`${TH} w-12 text-center`}>No</th>
                                    <th className={TH}>부품코드</th>
                                    <th className={TH}>부품명 / 규격</th>
                                    <th className={`${TH} text-center`}>1대당 수량</th>
                                    <th className={`${TH} text-right`}>현재고</th>
                                    <th className={TH}>공급사</th>
                                    <th className={`${TH} w-20`} />
                                  </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-100">
                                  {masterBomPaged.rows.length === 0 ? (
                                    <tr>
                                      <td colSpan={7} className="py-12 text-center text-sm text-slate-400">
                                        등록된 부품이 없습니다.
                                      </td>
                                    </tr>
                                  ) : (
                                    masterBomPaged.rows.map((part, idx) => {
                                      const editKey = `${model.modelCode}:${part.partCode}`
                                      const isPartEditing = editingMasterPartCode === editKey
                                      return (
                                        <tr key={part.partCode} className="hover:bg-[#F7FAF8]">
                                          <td className={`${TD} text-center text-xs text-slate-400`}>
                                            {masterBomPaged.offset + idx + 1}
                                          </td>
                                          <td className={`${TD} whitespace-nowrap`}>
                                            <div className="font-mono text-xs text-[#0E8A5F]">{part.partCode}</div>
                                            <div className="text-xs text-slate-400 mt-0.5">{part.category}</div>
                                          </td>
                                          <td className={`${TD} min-w-[220px] break-keep`}>
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
                                                  className={INPUT_SM + ' w-full'}
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
                                                  className={INPUT_SM + ' w-full text-xs'}
                                                />
                                              </div>
                                            ) : (
                                              <>
                                                <div className="text-[#0F2E26]">{part.partName}</div>
                                                <div className="text-xs text-slate-400 mt-0.5">{part.spec}</div>
                                              </>
                                            )}
                                          </td>
                                          <td className={`${TD} whitespace-nowrap`}>
                                            <div className="flex items-center justify-center gap-1">
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
                                                className={ICON_BTN}
                                              >
                                                −
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
                                                className={`${INPUT_SM} w-14 text-center font-medium`}
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
                                                className={ICON_BTN}
                                              >
                                                +
                                              </button>
                                              <span className="text-xs text-slate-400">{part.unit}</span>
                                            </div>
                                          </td>
                                          <td className={`${TD} text-right whitespace-nowrap tabular-nums`}>
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
                                                className={`${INPUT_SM} w-16 text-right`}
                                              />
                                            ) : (
                                              <button
                                                type="button"
                                                title="재고 관리로 이동"
                                                onClick={() => setActiveTab('MANAGE_INVENTORY')}
                                                className="text-slate-600 hover:text-[#0E8A5F] cursor-pointer"
                                              >
                                                {part.stockQty}
                                                <span className="text-xs text-slate-400 ml-1">{part.unit}</span>
                                              </button>
                                            )}
                                          </td>
                                          <td className={`${TD} whitespace-nowrap`}>
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
                                                className={INPUT_SM}
                                              >
                                                {supplierPartners.map((s) => (
                                                  <option key={s.id} value={s.id}>
                                                    {s.name}
                                                  </option>
                                                ))}
                                              </select>
                                            ) : (
                                              <div className="text-[#0F2E26]">{part.supplierName}</div>
                                            )}
                                          </td>
                                          <td className={`${TD} whitespace-nowrap`}>
                                            <div className="flex items-center justify-end">
                                              <button
                                                type="button"
                                                title={isPartEditing ? '완료' : '수정'}
                                                onClick={() => setEditingMasterPartCode(isPartEditing ? null : editKey)}
                                                className={`${ICON_BTN} ${isPartEditing ? 'text-[#0E8A5F]' : ''}`}
                                              >
                                                {isPartEditing ? (
                                                  <Check className="w-4 h-4" />
                                                ) : (
                                                  <Pencil className="w-3.5 h-3.5" />
                                                )}
                                              </button>
                                              <button
                                                type="button"
                                                title="BOM에서 제거"
                                                onClick={() =>
                                                  handleDeleteMasterBomPart(model.modelCode, part.partCode, part.partName)
                                                }
                                                className={ICON_BTN}
                                              >
                                                <Trash2 className="w-3.5 h-3.5" />
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
                            <Pager {...masterBomPaged} onChange={setMasterBomPage} />
                          </>
                        )
                      })()
                    )}
                  </section>
                </div>
              </>
            )}
          </div>
        </main>
      </div>

      {/* Footer */}
      <footer className="border-t border-slate-200 bg-white py-4 px-6">
        <div className="max-w-[1280px] mx-auto flex flex-col sm:flex-row items-center justify-between gap-2">
          <span className="text-xs text-slate-400">발주 관리 시스템</span>
          <Credits />
        </div>
      </footer>

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
