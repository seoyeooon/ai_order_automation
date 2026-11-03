import { useMemo, useRef, useState } from 'react'
import {
  AlertTriangle,
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
  ScanLine,
  Search,
  Send,
  Sparkles,
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

type ActiveTab = 'STEP1_SCAN' | 'STEP2_BOM' | 'STEP3_PO' | 'STEP4_INVENTORY' | 'STEP4_MASTER'

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

function App() {
  const [activeTab, setActiveTab] = useState<ActiveTab>('STEP1_SCAN')
  const logSeqRef = useRef<number>(200)

  // Master states (editable in-app!)
  const [partners, setPartners] = useState<PartnerCompany[]>(INITIAL_PARTNERS)
  const [kioskModels, setKioskModels] = useState<KioskModelMaster[]>(KIOSK_MODELS)

  // Step 1: Client Order state
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

  // AI Scanning states
  const [isScanning, setIsScanning] = useState<boolean>(false)
  const [scanProgress, setScanProgress] = useState<number>(100)
  const [scanStageText, setScanStageText] = useState<string>(
    'AI 스캔 완료 · 거래처 정보 및 수주 품목이 추출되었습니다.'
  )
  const [uploadedPreviewUrl, setUploadedPreviewUrl] = useState<string | null>(null)
  const [isDragging, setIsDragging] = useState<boolean>(false)
  const fileInputRef = useRef<HTMLInputElement | null>(null)

  // Step 2: BOM Options & CRUD states
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

  // Step 3: PO Modal & Download states
  const [previewPo, setPreviewPo] = useState<GeneratedPurchaseOrder | null>(null)
  const [poStatusMap, setPoStatusMap] = useState<Record<string, 'READY' | 'DOWNLOADED' | 'SENT'>>({})
  const [poReceivedMap, setPoReceivedMap] = useState<Record<string, boolean>>({})

  // Step 4 (Inventory): Warehouse Inventory Management states
  const [inventoryCategory, setInventoryCategory] = useState<'전체' | PartCategory>('전체')
  const [inventoryStatusFilter, setInventoryStatusFilter] = useState<
    'ALL' | 'NORMAL' | 'LOW' | 'EMPTY'
  >('ALL')
  const [inventorySearch, setInventorySearch] = useState<string>('')
  const [safetyStockMap, setSafetyStockMap] = useState<Record<string, number>>({
    'DSP-32-4K': 5,
    'CPU-I5-12G': 5,
    'PAY-IC-EMV': 5,
    'PRT-3IN-80': 5,
    'SCN-2D-QR': 5,
    'ENC-32-STL': 3,
    'PWR-SMPS-24': 8,
    'NET-ROUT-5G': 5,
    'DSP-24-FHD': 5,
    'CPU-J6412': 5,
    'ENC-24-DSK': 3,
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
      partCode: 'PWR-SMPS-24',
      partName: '듀얼 채널 산업용 SMPS 파워서플라이',
      changeQty: 12,
      afterStockQty: 12,
      unit: 'EA',
      note: '정기 안전재고 보충 입고 ((주)대성파워일렉트로닉스)',
    },
    {
      id: 'LOG-102',
      timestamp: '2026-11-02 16:15',
      partCode: 'PRT-3IN-80',
      partName: '3인치 고속 감열식 영수증 프린터 모듈',
      type: 'IN',
      changeQty: 8,
      afterStockQty: 8,
      unit: 'EA',
      note: '창고 실사 및 기초 재고 등록',
    },
    {
      id: 'LOG-101',
      timestamp: '2026-11-02 14:00',
      partCode: 'DSP-32-4K',
      partName: '32인치 4K 정전식 터치 디스플레이 모듈',
      type: 'OUT',
      changeQty: -2,
      afterStockQty: 4,
      unit: 'EA',
      note: '샘플 쇼룸 키오스크 2대 조립 출고',
    },
  ])

  // Step 4: Master management states
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
  const [showAddMasterBomForm, setShowAddMasterBomForm] = useState<boolean>(false)
  const [newMasterPart, setNewMasterPart] = useState({
    partCode: '',
    partName: '',
    category: '디스플레이/터치' as PartCategory,
    spec: '',
    unit: 'EA',
    qtyPerUnit: 1,
    stockQty: 0,
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

  // Real File Upload & AI Document Parsing (Excel / PDF / Image OCR)
  const handleFileUpload = async (file: File | undefined) => {
    if (!file) return
    setIsScanning(true)
    setScanProgress(10)
    setScanStageText(`"${file.name}" 파일 분석 시작...`)
    setManualOverrides({})
    setCustomAddedBom([])
    setDeletedPartCodes([])
    setPartEdits({})
    setPoStatusMap({})

    try {
      const parsed = await parseUploadedOrderDocument(file, kioskModels, (pct, msg) => {
        setScanProgress(pct)
        setScanStageText(msg)
      })

      setClientOrder(parsed.order)
      setUploadedPreviewUrl(parsed.previewImageUrl || null)
      setScanProgress(100)
      setIsScanning(false)
      setScanStageText(
        `스캔 완료 (${file.name}) → 거래처: ${parsed.order.clientName} / 품목 ${parsed.order.items.length}건 추출됨`
      )

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
        `"${file.name}" 스캔 성공! [${parsed.order.clientName} / ${parsed.order.items
          .map((i) => `${i.modelCode} ${i.quantity}대`)
          .join(', ')}] 정보가 반영되었습니다.`
      )
    } catch (err) {
      console.error('Document parse error:', err)
      setIsScanning(false)
      setScanProgress(100)
      setScanStageText('문서 분석 중 일부 항목을 기본값으로 대체했습니다.')
      showToast('파일 스캔 중 오류가 발생하여 기본 양식으로 불러왔습니다.')
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

  const totalKioskCount = useMemo(
    () => clientOrder.items.reduce((sum, item) => sum + item.quantity, 0),
    [clientOrder.items]
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

  const inventoryStats = useMemo(() => {
    const total = warehouseInventory.length
    const normal = warehouseInventory.filter((p) => p.stockStatus === 'NORMAL').length
    const low = warehouseInventory.filter((p) => p.stockStatus === 'LOW').length
    const empty = warehouseInventory.filter((p) => p.stockStatus === 'EMPTY').length
    return { total, normal, low, empty, alertCount: low + empty }
  }, [warehouseInventory])

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
          quantity: 5,
        },
      ],
    }))
  }

  const handleRemoveOrderItem = (itemId: string) => {
    if (clientOrder.items.length <= 1) {
      showToast('최소 1개 이상의 수주 품목이 필요합니다.')
      return
    }
    setClientOrder((prev) => ({
      ...prev,
      items: prev.items.filter((it) => it.id !== itemId),
    }))
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
  }

  const handleAddMasterBomPart = () => {
    if (!newMasterPart.partName.trim()) {
      showToast('부품명을 입력해 주세요.')
      return
    }
    const sup =
      supplierPartners.find((s) => s.id === newMasterPart.supplierId) || supplierPartners[0]
    const part: BomPart = {
      partCode:
        newMasterPart.partCode.trim() || `PRT-${Math.floor(100 + Math.random() * 899)}`,
      partName: newMasterPart.partName.trim(),
      category: newMasterPart.category,
      spec: newMasterPart.spec.trim() || '표준 규격',
      unit: newMasterPart.unit || 'EA',
      qtyPerUnit: newMasterPart.qtyPerUnit || 1,
      stockQty: newMasterPart.stockQty || 0,
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
      stockQty: 0,
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

  return (
    <div className="min-h-screen bg-slate-50 text-slate-800 flex flex-col selection:bg-indigo-600 selection:text-white">
      {/* Toast Notification */}
      {toastMessage && (
        <div className="fixed bottom-6 right-6 z-50 flex items-center gap-3 px-5 py-3.5 rounded-2xl bg-slate-900 text-white text-base font-semibold shadow-2xl border border-slate-700">
          <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0" />
          <span>{toastMessage}</span>
        </div>
      )}

      {/* Top Header & Prominent Tab Navigation */}
      <header className="sticky top-0 z-30 border-b border-slate-200 bg-white/95 backdrop-blur-md shadow-xs">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-4 pb-3 space-y-4">
          {/* Brand Title Row */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="flex items-center gap-3.5">
              <div className="w-11 h-11 rounded-2xl bg-gradient-to-br from-indigo-600 to-violet-600 flex items-center justify-center shadow-md shadow-indigo-500/20">
                <Cpu className="w-6 h-6 text-white" />
              </div>
              <div>
                <div className="flex items-center gap-2.5">
                  <h1 className="text-lg sm:text-xl font-extrabold tracking-tight text-slate-900">
                    AI 키오스크 발주 자동화 시스템
                  </h1>
                  <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-bold bg-indigo-50 text-indigo-700 border border-indigo-200">
                    <Sparkles className="w-3.5 h-3.5" />
                    OCR 스캔 · BOM · PO 자동화
                  </span>
                </div>
                <p className="text-sm text-slate-500">
                  수주 발주서 스캔부터 BOM 자동 전개, 발주처별 PDF·엑셀 구매발주서 생성까지 한눈에 관리하세요
                </p>
              </div>
            </div>

            {/* Active Client Pill */}
            <div className="flex items-center gap-2 px-4 py-2 rounded-xl bg-slate-100 border border-slate-200 text-sm">
              <Building2 className="w-4 h-4 text-indigo-600 shrink-0" />
              <span className="text-slate-500">현재 수주처:</span>
              <strong className="text-slate-900">{clientOrder.clientName}</strong>
              <span className="text-indigo-600 font-bold">({totalKioskCount}대)</span>
            </div>
          </div>

          {/* 5 Main Step Tabs (One-Click Full Screen Switch) */}
          <nav className="grid grid-cols-2 lg:grid-cols-5 gap-2.5">
            <button
              type="button"
              onClick={() => setActiveTab('STEP1_SCAN')}
              className={`flex items-center justify-between px-4 py-3 rounded-xl text-left transition-all cursor-pointer border ${
                activeTab === 'STEP1_SCAN'
                  ? 'bg-indigo-600 text-white border-indigo-600 shadow-md shadow-indigo-600/20'
                  : 'bg-slate-50 hover:bg-slate-100 text-slate-700 border-slate-200'
              }`}
            >
              <div className="flex items-center gap-3 min-w-0">
                <span
                  className={`w-7 h-7 rounded-lg text-sm font-extrabold flex items-center justify-center shrink-0 ${
                    activeTab === 'STEP1_SCAN'
                      ? 'bg-white text-indigo-600'
                      : 'bg-indigo-100 text-indigo-700'
                  }`}
                >
                  1
                </span>
                <div className="truncate">
                  <div className="text-sm sm:text-base font-extrabold truncate">
                    수주 발주서 스캔·입력
                  </div>
                  <div
                    className={`text-xs truncate ${
                      activeTab === 'STEP1_SCAN' ? 'text-indigo-100' : 'text-slate-500'
                    }`}
                  >
                    거래처·주문 모델 ({clientOrder.items.length}종)
                  </div>
                </div>
              </div>
              <ArrowRight className="w-4 h-4 shrink-0 opacity-75 hidden sm:block" />
            </button>

            <button
              type="button"
              onClick={() => setActiveTab('STEP2_BOM')}
              className={`flex items-center justify-between px-4 py-3 rounded-xl text-left transition-all cursor-pointer border ${
                activeTab === 'STEP2_BOM'
                  ? 'bg-violet-600 text-white border-violet-600 shadow-md shadow-violet-600/20'
                  : 'bg-slate-50 hover:bg-slate-100 text-slate-700 border-slate-200'
              }`}
            >
              <div className="flex items-center gap-3 min-w-0">
                <span
                  className={`w-7 h-7 rounded-lg text-sm font-extrabold flex items-center justify-center shrink-0 ${
                    activeTab === 'STEP2_BOM'
                      ? 'bg-white text-violet-600'
                      : 'bg-violet-100 text-violet-700'
                  }`}
                >
                  2
                </span>
                <div className="truncate">
                  <div className="text-sm sm:text-base font-extrabold truncate">
                    BOM 자동 전개·편집
                  </div>
                  <div
                    className={`text-xs truncate ${
                      activeTab === 'STEP2_BOM' ? 'text-violet-100' : 'text-slate-500'
                    }`}
                  >
                    부품 추가·수정·삭제 ({expandedBom.length}종)
                  </div>
                </div>
              </div>
              <ArrowRight className="w-4 h-4 shrink-0 opacity-75 hidden sm:block" />
            </button>

            <button
              type="button"
              onClick={() => setActiveTab('STEP3_PO')}
              className={`flex items-center justify-between px-4 py-3 rounded-xl text-left transition-all cursor-pointer border ${
                activeTab === 'STEP3_PO'
                  ? 'bg-emerald-600 text-white border-emerald-600 shadow-md shadow-emerald-600/20'
                  : 'bg-slate-50 hover:bg-slate-100 text-slate-700 border-slate-200'
              }`}
            >
              <div className="flex items-center gap-3 min-w-0">
                <span
                  className={`w-7 h-7 rounded-lg text-sm font-extrabold flex items-center justify-center shrink-0 ${
                    activeTab === 'STEP3_PO'
                      ? 'bg-white text-emerald-600'
                      : 'bg-emerald-100 text-emerald-700'
                  }`}
                >
                  3
                </span>
                <div className="truncate">
                  <div className="text-sm sm:text-base font-extrabold truncate">
                    매입 발주서(PO) 생성
                  </div>
                  <div
                    className={`text-xs truncate ${
                      activeTab === 'STEP3_PO' ? 'text-emerald-100' : 'text-slate-500'
                    }`}
                  >
                    PDF·엑셀·인쇄·전송 ({purchaseOrders.length}건)
                  </div>
                </div>
              </div>
              <ArrowRight className="w-4 h-4 shrink-0 opacity-75 hidden sm:block" />
            </button>

            <button
              type="button"
              onClick={() => setActiveTab('STEP4_INVENTORY')}
              className={`flex items-center justify-between px-4 py-3 rounded-xl text-left transition-all cursor-pointer border ${
                activeTab === 'STEP4_INVENTORY'
                  ? 'bg-amber-600 text-white border-amber-600 shadow-md shadow-amber-600/20'
                  : 'bg-slate-50 hover:bg-slate-100 text-slate-700 border-slate-200'
              }`}
            >
              <div className="flex items-center gap-3 min-w-0">
                <span
                  className={`w-7 h-7 rounded-lg text-sm font-extrabold flex items-center justify-center shrink-0 ${
                    activeTab === 'STEP4_INVENTORY'
                      ? 'bg-white text-amber-600'
                      : 'bg-amber-100 text-amber-700'
                  }`}
                >
                  4
                </span>
                <div className="truncate">
                  <div className="text-sm sm:text-base font-extrabold truncate flex items-center gap-1.5">
                    <span>창고 재고 관리</span>
                    {inventoryStats.alertCount > 0 && (
                      <span
                        className={`px-1.5 py-0.2 rounded-full text-[11px] font-black ${
                          activeTab === 'STEP4_INVENTORY'
                            ? 'bg-white text-amber-700'
                            : 'bg-amber-500 text-white'
                        }`}
                      >
                        부족 {inventoryStats.alertCount}
                      </span>
                    )}
                  </div>
                  <div
                    className={`text-xs truncate ${
                      activeTab === 'STEP4_INVENTORY' ? 'text-amber-100' : 'text-slate-500'
                    }`}
                  >
                    전체 {inventoryStats.total}종 · 실시간 입출고
                  </div>
                </div>
              </div>
              <Package className="w-4 h-4 shrink-0 opacity-75 hidden sm:block" />
            </button>

            <button
              type="button"
              onClick={() => setActiveTab('STEP4_MASTER')}
              className={`flex items-center justify-between px-4 py-3 rounded-xl text-left transition-all cursor-pointer border ${
                activeTab === 'STEP4_MASTER'
                  ? 'bg-slate-900 text-white border-slate-900 shadow-md'
                  : 'bg-slate-50 hover:bg-slate-100 text-slate-700 border-slate-200'
              }`}
            >
              <div className="flex items-center gap-3 min-w-0">
                <span
                  className={`w-7 h-7 rounded-lg text-sm font-extrabold flex items-center justify-center shrink-0 ${
                    activeTab === 'STEP4_MASTER'
                      ? 'bg-white text-slate-900'
                      : 'bg-slate-200 text-slate-700'
                  }`}
                >
                  5
                </span>
                <div className="truncate">
                  <div className="text-sm sm:text-base font-extrabold truncate">
                    거래처·BOM 마스터
                  </div>
                  <div
                    className={`text-xs truncate ${
                      activeTab === 'STEP4_MASTER' ? 'text-slate-300' : 'text-slate-500'
                    }`}
                  >
                    거래처 {partners.length}곳 · 모델 {kioskModels.length}종
                  </div>
                </div>
              </div>
              <Layers className="w-4 h-4 shrink-0 opacity-75 hidden sm:block" />
            </button>
          </nav>
        </div>
      </header>

      {/* Main Content Area (Single Focused View per Tab) */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-6">
        {/* =====================================================================
            TAB 1: 수주 발주서 스캔·입력 (거래처 수정/추가/삭제 + 주문 품목 관리)
        ===================================================================== */}
        {activeTab === 'STEP1_SCAN' && (
          <section className="bg-white border border-slate-200 rounded-2xl overflow-hidden shadow-xs space-y-6 p-6">
            {/* Section Header */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-200 pb-5">
              <div>
                <div className="flex items-center gap-2.5">
                  <span className="px-3 py-1 rounded-lg text-sm font-extrabold bg-indigo-600 text-white">
                    STEP 1
                  </span>
                  <h2 className="text-xl font-extrabold text-slate-900">
                    거래처 수주 발주서 업로드 & AI 자동 스캔
                  </h2>
                </div>
                <p className="text-sm text-slate-500 mt-1">
                  거래처에서 받은 발주서 파일(PDF·엑셀·이미지)을 업로드하거나, 등록된 거래처 및 주문 키오스크 수량을 확인·수정하세요.
                </p>
              </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
              {/* Left Column: File Upload & AI Scan Status (4 cols) */}
              <div className="lg:col-span-4 flex flex-col justify-between space-y-4">
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
                  onClick={() => fileInputRef.current?.click()}
                  className={`flex-1 flex flex-col items-center justify-center p-7 rounded-2xl border-2 border-dashed transition-all cursor-pointer text-center ${
                    isDragging
                      ? 'border-indigo-500 bg-indigo-50/70'
                      : 'border-slate-300 hover:border-indigo-400 bg-slate-50/70 hover:bg-indigo-50/30'
                  }`}
                >
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept=".pdf,.png,.jpg,.jpeg,.xlsx,.xls,.csv"
                    className="hidden"
                    onChange={(e) => handleFileUpload(e.target.files?.[0])}
                  />
                  <div className="w-16 h-16 rounded-2xl bg-indigo-50 border border-indigo-100 flex items-center justify-center text-indigo-600 mb-4 shadow-2xs">
                    {isScanning ? (
                      <RefreshCw className="w-8 h-8 animate-spin" />
                    ) : (
                      <UploadCloud className="w-8 h-8" />
                    )}
                  </div>
                  <p className="text-base font-extrabold text-slate-900">
                    거래처 발주서 파일을 이곳에 드래그하거나 클릭하여 업로드
                  </p>
                  <p className="text-sm text-slate-500 mt-1.5">
                    지원 포맷: PDF, 이미지(JPG/PNG), Excel(XLSX/CSV)
                  </p>

                  <div className="mt-5 w-full px-4 py-3 rounded-xl bg-white border border-slate-200 flex items-center justify-between text-sm shadow-2xs">
                    <span className="flex items-center gap-2 text-slate-800 font-semibold truncate">
                      <FileCheck2 className="w-4 h-4 text-emerald-600 shrink-0" />
                      <span className="truncate">{clientOrder.sourceFileName}</span>
                    </span>
                    <span className="ml-2 px-2.5 py-0.5 rounded-md bg-emerald-50 text-emerald-700 border border-emerald-200 font-mono font-bold text-xs shrink-0">
                      인식률 {clientOrder.confidenceScore}%
                    </span>
                  </div>
                </div>

                {/* AI OCR Progress Box */}
                <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 space-y-2.5">
                  <div className="flex items-center justify-between text-sm">
                    <span className="font-bold text-indigo-700 flex items-center gap-1.5">
                      <ScanLine className="w-4 h-4" />
                      AI 발주서 스캔 상태
                    </span>
                    <span className="font-mono font-bold text-slate-900">{scanProgress}%</span>
                  </div>
                  <div className="w-full h-2.5 rounded-full bg-slate-200 overflow-hidden">
                    <div
                      className="h-full bg-gradient-to-r from-indigo-600 via-violet-500 to-emerald-500 transition-all duration-300"
                      style={{ width: `${scanProgress}%` }}
                    />
                  </div>
                  <p className="text-xs sm:text-sm text-slate-600 font-medium">{scanStageText}</p>
                </div>

                {/* Uploaded Document Visual Preview (if PDF or Image uploaded) */}
                {uploadedPreviewUrl && (
                  <div className="p-3 rounded-xl bg-white border border-indigo-200 space-y-2 shadow-2xs">
                    <div className="flex items-center justify-between text-xs font-bold text-indigo-700">
                      <span>스캔된 원본 발주서 미리보기</span>
                      <a
                        href={uploadedPreviewUrl}
                        target="_blank"
                        rel="noreferrer"
                        className="underline hover:text-indigo-900"
                      >
                        원본 크게 보기
                      </a>
                    </div>
                    <img
                      src={uploadedPreviewUrl}
                      alt="Uploaded Order Preview"
                      className="w-full max-h-56 object-contain rounded-lg border border-slate-200 bg-slate-50"
                    />
                  </div>
                )}
              </div>

              {/* Right Column: Client Info CRUD & Ordered Kiosks (8 cols) */}
              <div className="lg:col-span-8 space-y-6">
                {/* Client Info Box with Select / Add / Edit / Delete */}
                <div className="p-5 rounded-2xl bg-slate-50/80 border border-slate-200 space-y-4">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <h3 className="text-base font-extrabold text-indigo-900 flex items-center gap-2">
                      <Building2 className="w-5 h-5 text-indigo-600" />
                      발주 거래처(고객사) 정보 (수정·추가·삭제 가능)
                    </h3>
                    <button
                      type="button"
                      onClick={() => setShowAddClientForm((v) => !v)}
                      className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl text-sm font-bold bg-indigo-600 hover:bg-indigo-500 text-white transition-colors cursor-pointer"
                    >
                      <UserPlus className="w-4 h-4" />
                      {showAddClientForm ? '신규 등록 닫기' : '+ 새 거래처 등록'}
                    </button>
                  </div>

                  {/* Saved Client Partners Quick Chips (Select or Delete) */}
                  <div className="flex items-center gap-2 flex-wrap pt-1">
                    <span className="text-xs font-bold text-slate-500">등록된 고객사 선택:</span>
                    {clientPartners.map((partner) => {
                      const isSelected = clientOrder.clientName === partner.name
                      return (
                        <div
                          key={partner.id}
                          className={`inline-flex items-center gap-1.5 pl-3 pr-1.5 py-1 rounded-xl text-xs font-bold border transition-all ${
                            isSelected
                              ? 'bg-indigo-50 text-indigo-700 border-indigo-300'
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
                            <X className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      )
                    })}
                  </div>

                  {/* Optional Quick Add New Client Form */}
                  {showAddClientForm && (
                    <div className="p-4 rounded-xl bg-indigo-50/70 border border-indigo-200 space-y-3">
                      <div className="text-sm font-bold text-indigo-900">
                        신규 고객사(거래처) 빠른 등록
                      </div>
                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-sm">
                        <input
                          type="text"
                          placeholder="거래처명 (필수)"
                          value={newClientForm.name}
                          onChange={(e) =>
                            setNewClientForm({ ...newClientForm, name: e.target.value })
                          }
                          className="px-3 py-2 rounded-lg bg-white border border-indigo-200 text-slate-900"
                        />
                        <input
                          type="text"
                          placeholder="사업자번호 (예: 123-45-67890)"
                          value={newClientForm.bizNo}
                          onChange={(e) =>
                            setNewClientForm({ ...newClientForm, bizNo: e.target.value })
                          }
                          className="px-3 py-2 rounded-lg bg-white border border-indigo-200 text-slate-900"
                        />
                        <input
                          type="text"
                          placeholder="담당자명 / 직책"
                          value={newClientForm.manager}
                          onChange={(e) =>
                            setNewClientForm({ ...newClientForm, manager: e.target.value })
                          }
                          className="px-3 py-2 rounded-lg bg-white border border-indigo-200 text-slate-900"
                        />
                        <input
                          type="text"
                          placeholder="연락처 (예: 02-1234-5678)"
                          value={newClientForm.phone}
                          onChange={(e) =>
                            setNewClientForm({ ...newClientForm, phone: e.target.value })
                          }
                          className="px-3 py-2 rounded-lg bg-white border border-indigo-200 text-slate-900"
                        />
                        <input
                          type="email"
                          placeholder="이메일"
                          value={newClientForm.email}
                          onChange={(e) =>
                            setNewClientForm({ ...newClientForm, email: e.target.value })
                          }
                          className="px-3 py-2 rounded-lg bg-white border border-indigo-200 text-slate-900"
                        />
                        <input
                          type="text"
                          placeholder="기본 납품 주소"
                          value={newClientForm.address}
                          onChange={(e) =>
                            setNewClientForm({ ...newClientForm, address: e.target.value })
                          }
                          className="px-3 py-2 rounded-lg bg-white border border-indigo-200 text-slate-900"
                        />
                      </div>
                      <div className="flex justify-end gap-2">
                        <button
                          type="button"
                          onClick={() => setShowAddClientForm(false)}
                          className="px-3.5 py-1.5 rounded-lg text-sm font-semibold bg-white text-slate-600 border border-slate-300 cursor-pointer"
                        >
                          취소
                        </button>
                        <button
                          type="button"
                          onClick={handleAddClientPartnerInStep1}
                          className="px-4 py-1.5 rounded-lg text-sm font-bold bg-indigo-600 text-white cursor-pointer"
                        >
                          저장 후 현재 발주서에 적용
                        </button>
                      </div>
                    </div>
                  )}

                  {/* Editable Client Info Inputs */}
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3.5 text-sm">
                    <div>
                      <label className="block text-slate-600 font-semibold mb-1">
                        발주 거래처명 (상호)
                      </label>
                      <input
                        type="text"
                        value={clientOrder.clientName}
                        onChange={(e) =>
                          setClientOrder({ ...clientOrder, clientName: e.target.value })
                        }
                        className="w-full px-3.5 py-2.5 rounded-xl bg-white border border-slate-300 text-slate-900 font-bold focus:outline-none focus:border-indigo-500"
                      />
                    </div>
                    <div>
                      <label className="block text-slate-600 font-semibold mb-1">
                        사업자등록번호
                      </label>
                      <input
                        type="text"
                        value={clientOrder.businessNo}
                        onChange={(e) =>
                          setClientOrder({ ...clientOrder, businessNo: e.target.value })
                        }
                        className="w-full px-3.5 py-2.5 rounded-xl bg-white border border-slate-300 text-slate-900 font-mono font-semibold focus:outline-none focus:border-indigo-500"
                      />
                    </div>
                    <div>
                      <label className="block text-slate-600 font-semibold mb-1">
                        문서번호 (발주번호)
                      </label>
                      <input
                        type="text"
                        value={clientOrder.orderNo}
                        onChange={(e) =>
                          setClientOrder({ ...clientOrder, orderNo: e.target.value })
                        }
                        className="w-full px-3.5 py-2.5 rounded-xl bg-white border border-slate-300 text-indigo-700 font-mono font-bold focus:outline-none focus:border-indigo-500"
                      />
                    </div>
                    <div>
                      <label className="block text-slate-600 font-semibold mb-1">담당자명</label>
                      <input
                        type="text"
                        value={clientOrder.managerName}
                        onChange={(e) =>
                          setClientOrder({ ...clientOrder, managerName: e.target.value })
                        }
                        className="w-full px-3.5 py-2.5 rounded-xl bg-white border border-slate-300 text-slate-900 font-semibold focus:outline-none focus:border-indigo-500"
                      />
                    </div>
                    <div>
                      <label className="block text-slate-600 font-semibold mb-1">연락처</label>
                      <input
                        type="text"
                        value={clientOrder.managerPhone}
                        onChange={(e) =>
                          setClientOrder({ ...clientOrder, managerPhone: e.target.value })
                        }
                        className="w-full px-3.5 py-2.5 rounded-xl bg-white border border-slate-300 text-slate-900 focus:outline-none focus:border-indigo-500"
                      />
                    </div>
                    <div>
                      <label className="block text-slate-600 font-semibold mb-1">이메일</label>
                      <input
                        type="text"
                        value={clientOrder.managerEmail}
                        onChange={(e) =>
                          setClientOrder({ ...clientOrder, managerEmail: e.target.value })
                        }
                        className="w-full px-3.5 py-2.5 rounded-xl bg-white border border-slate-300 text-slate-900 font-mono focus:outline-none focus:border-indigo-500"
                      />
                    </div>
                    <div>
                      <label className="block text-slate-600 font-semibold mb-1">발주일자</label>
                      <input
                        type="date"
                        value={clientOrder.orderDate}
                        onChange={(e) =>
                          setClientOrder({ ...clientOrder, orderDate: e.target.value })
                        }
                        className="w-full px-3.5 py-2.5 rounded-xl bg-white border border-slate-300 text-slate-900 focus:outline-none focus:border-indigo-500"
                      />
                    </div>
                    <div>
                      <label className="block text-slate-600 font-semibold mb-1">납기요청일</label>
                      <input
                        type="date"
                        value={clientOrder.deliveryDate}
                        onChange={(e) =>
                          setClientOrder({ ...clientOrder, deliveryDate: e.target.value })
                        }
                        className="w-full px-3.5 py-2.5 rounded-xl bg-white border border-slate-300 text-slate-900 font-semibold text-indigo-700 focus:outline-none focus:border-indigo-500"
                      />
                    </div>
                    <div>
                      <label className="block text-slate-600 font-semibold mb-1">납품 장소</label>
                      <input
                        type="text"
                        value={clientOrder.deliveryAddress}
                        onChange={(e) =>
                          setClientOrder({ ...clientOrder, deliveryAddress: e.target.value })
                        }
                        className="w-full px-3.5 py-2.5 rounded-xl bg-white border border-slate-300 text-slate-900 focus:outline-none focus:border-indigo-500"
                      />
                    </div>
                  </div>
                </div>

                {/* Ordered Kiosk Products Table */}
                <div className="p-5 rounded-2xl bg-slate-50/80 border border-slate-200 space-y-4">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <h3 className="text-base font-extrabold text-indigo-900 flex items-center gap-2">
                      <ClipboardList className="w-5 h-5 text-indigo-600" />
                      스캔된 주문 키오스크 제품 및 수량
                    </h3>
                    <button
                      type="button"
                      onClick={handleAddOrderItem}
                      className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-sm font-bold bg-indigo-50 hover:bg-indigo-100 text-indigo-700 border border-indigo-200 transition-colors cursor-pointer"
                    >
                      <Plus className="w-4 h-4" />
                      주문 키오스크 추가
                    </button>
                  </div>

                  <div className="overflow-x-auto bg-white rounded-xl border border-slate-200">
                    <table className="w-full text-left border-collapse text-sm">
                      <thead>
                        <tr className="bg-slate-100 border-b border-slate-200 text-slate-700">
                          <th className="py-3 px-4 font-bold">키오스크 모델 선택</th>
                          <th className="py-3 px-4 font-bold">규격 및 사양</th>
                          <th className="py-3 px-4 text-center font-bold w-44">주문 수량</th>
                          <th className="py-3 px-3 text-center font-bold w-16">삭제</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-200">
                        {clientOrder.items.map((item) => (
                          <tr key={item.id} className="hover:bg-slate-50">
                            <td className="py-3.5 px-4">
                              <select
                                value={item.modelCode}
                                onChange={(e) => handleModelChange(item.id, e.target.value)}
                                className="w-full px-3 py-2 rounded-xl bg-white border border-slate-300 text-slate-900 font-bold text-sm focus:outline-none focus:border-indigo-500"
                              >
                                {kioskModels.map((m) => (
                                  <option key={m.modelCode} value={m.modelCode}>
                                    [{m.modelCode}] {m.modelName}
                                  </option>
                                ))}
                              </select>
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
                                className="w-full px-3 py-2 rounded-xl bg-white border border-slate-300 text-slate-700 text-sm focus:outline-none focus:border-indigo-500"
                              />
                            </td>
                            <td className="py-3.5 px-4">
                              <div className="flex items-center justify-center gap-1.5">
                                <button
                                  type="button"
                                  onClick={() => handleQuantityChange(item.id, item.quantity - 1)}
                                  className="w-8 h-8 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-800 font-bold cursor-pointer border border-slate-300 text-base"
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
                                  className="w-16 text-center py-1.5 rounded-lg bg-white border border-slate-300 text-slate-900 font-extrabold text-base"
                                />
                                <button
                                  type="button"
                                  onClick={() => handleQuantityChange(item.id, item.quantity + 1)}
                                  className="w-8 h-8 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-800 font-bold cursor-pointer border border-slate-300 text-base"
                                >
                                  +
                                </button>
                                <span className="text-slate-600 font-semibold ml-1">대</span>
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
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>
            </div>

            {/* Bottom Step Navigation Button */}
            <div className="pt-4 border-t border-slate-200 flex justify-end">
              <button
                type="button"
                onClick={() => setActiveTab('STEP2_BOM')}
                className="inline-flex items-center gap-2 px-6 py-3 rounded-xl text-base font-extrabold bg-violet-600 hover:bg-violet-500 text-white shadow-md shadow-violet-600/20 transition-all cursor-pointer"
              >
                <span>다음 단계: BOM 자동 전개 및 편집 ({expandedBom.length}종)</span>
                <ArrowRight className="w-5 h-5" />
              </button>
            </div>
          </section>
        )}

        {/* =====================================================================
            TAB 2: 제품별 BOM 자동 전개·편집 (부품 추가/수정/삭제 지원)
        ===================================================================== */}
        {activeTab === 'STEP2_BOM' && (
          <section className="bg-white border border-slate-200 rounded-2xl overflow-hidden shadow-xs space-y-6 p-6">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-200 pb-5">
              <div>
                <div className="flex items-center gap-2.5">
                  <span className="px-3 py-1 rounded-lg text-sm font-extrabold bg-violet-600 text-white">
                    STEP 2
                  </span>
                  <h2 className="text-xl font-extrabold text-slate-900">
                    제품별 BOM(자재명세서) 자동 전개 및 편집
                  </h2>
                  <span className="text-sm px-3 py-0.5 rounded-full bg-violet-50 text-violet-700 border border-violet-200 font-bold">
                    총 {expandedBom.length}종 부품
                  </span>
                </div>
                <p className="text-sm text-slate-500 mt-1">
                  수주 키오스크({totalKioskCount}대) 기준으로 자동 전개된 부품 목록입니다. 부품을 직접 추가·수정·삭제할 수 있습니다.
                </p>
              </div>

              <div className="flex flex-wrap items-center gap-2.5">
                <label className="inline-flex items-center gap-2 text-sm font-bold text-slate-700 cursor-pointer select-none bg-slate-50 px-4 py-2.5 rounded-xl border border-slate-200">
                  <input
                    type="checkbox"
                    checked={deductStock}
                    onChange={(e) => setDeductStock(e.target.checked)}
                    className="rounded accent-violet-600 w-4 h-4"
                  />
                  <span>창고 현재고 자동 차감</span>
                </label>

                <button
                  type="button"
                  onClick={() => setActiveTab('STEP4_INVENTORY')}
                  className="inline-flex items-center gap-1.5 px-4 py-2.5 rounded-xl text-sm font-bold bg-amber-50 hover:bg-amber-100 text-amber-800 border border-amber-200 transition-colors cursor-pointer"
                >
                  <Package className="w-4 h-4 text-amber-600" />
                  창고 재고 관리 (현재고 조정)
                </button>

                <button
                  type="button"
                  onClick={() => setShowAddBomModal((v) => !v)}
                  className="inline-flex items-center gap-1.5 px-4 py-2.5 rounded-xl text-sm font-bold bg-violet-600 hover:bg-violet-500 text-white shadow-xs transition-colors cursor-pointer"
                >
                  <Plus className="w-4 h-4" />
                  + BOM 부품 항목 추가
                </button>
              </div>
            </div>

            {/* Add Custom BOM Item Inline Form */}
            {showAddBomModal && (
              <div className="p-5 rounded-2xl bg-violet-50/70 border border-violet-200 space-y-4">
                <div className="flex items-center justify-between">
                  <h3 className="text-base font-extrabold text-violet-950 flex items-center gap-2">
                    <Boxes className="w-5 h-5 text-violet-600" />
                    신규 BOM 부품 항목 추가
                  </h3>
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
                    <label className="block text-slate-700 font-semibold mb-1">부품코드</label>
                    <input
                      type="text"
                      placeholder="예: CBL-HDMI-2M (미입력시 자동)"
                      value={newBomPart.partCode}
                      onChange={(e) =>
                        setNewBomPart({ ...newBomPart, partCode: e.target.value })
                      }
                      className="w-full px-3 py-2 rounded-lg bg-white border border-violet-200"
                    />
                  </div>
                  <div>
                    <label className="block text-slate-700 font-semibold mb-1">카테고리</label>
                    <select
                      value={newBomPart.category}
                      onChange={(e) =>
                        setNewBomPart({
                          ...newBomPart,
                          category: e.target.value as PartCategory,
                        })
                      }
                      className="w-full px-3 py-2 rounded-lg bg-white border border-violet-200 font-semibold"
                    >
                      {PART_CATEGORIES.map((c) => (
                        <option key={c} value={c}>
                          {c}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className="sm:col-span-2">
                    <label className="block text-slate-700 font-semibold mb-1">
                      부품명 (필수)
                    </label>
                    <input
                      type="text"
                      placeholder="예: 산업용 고내구성 HDMI 2.1 케이블"
                      value={newBomPart.partName}
                      onChange={(e) =>
                        setNewBomPart({ ...newBomPart, partName: e.target.value })
                      }
                      className="w-full px-3 py-2 rounded-lg bg-white border border-violet-200 font-semibold"
                    />
                  </div>
                  <div className="sm:col-span-2">
                    <label className="block text-slate-700 font-semibold mb-1">상세 규격</label>
                    <input
                      type="text"
                      placeholder="예: 2M, 골드플레이트, 노이즈 차폐 필터"
                      value={newBomPart.spec}
                      onChange={(e) => setNewBomPart({ ...newBomPart, spec: e.target.value })}
                      className="w-full px-3 py-2 rounded-lg bg-white border border-violet-200"
                    />
                  </div>
                  <div>
                    <label className="block text-slate-700 font-semibold mb-1">
                      총 필요수량 / 단위
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
                        className="w-2/3 px-3 py-2 rounded-lg bg-white border border-violet-200 font-bold"
                      />
                      <input
                        type="text"
                        value={newBomPart.unit}
                        onChange={(e) => setNewBomPart({ ...newBomPart, unit: e.target.value })}
                        className="w-1/3 px-2 py-2 rounded-lg bg-white border border-violet-200 text-center font-semibold"
                      />
                    </div>
                  </div>
                  <div>
                    <label className="block text-slate-700 font-semibold mb-1">
                      매입 발주처 선택
                    </label>
                    <select
                      value={newBomPart.supplierId}
                      onChange={(e) =>
                        setNewBomPart({ ...newBomPart, supplierId: e.target.value })
                      }
                      className="w-full px-3 py-2 rounded-lg bg-white border border-violet-200 font-semibold"
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
                    className="px-4 py-2 rounded-xl text-sm font-semibold bg-white text-slate-600 border border-slate-300 cursor-pointer"
                  >
                    취소
                  </button>
                  <button
                    type="button"
                    onClick={handleAddCustomBomItem}
                    className="px-5 py-2 rounded-xl text-sm font-bold bg-violet-600 text-white cursor-pointer"
                  >
                    BOM 목록에 추가하기
                  </button>
                </div>
              </div>
            )}

            {/* Category Filter Bar */}
            <div className="flex items-center justify-between flex-wrap gap-2">
              <div className="flex items-center gap-2 flex-wrap">
                {CATEGORIES.map((cat) => (
                  <button
                    key={cat}
                    type="button"
                    onClick={() => setSelectedCategory(cat)}
                    className={`px-3.5 py-2 rounded-xl text-sm font-bold transition-colors cursor-pointer ${
                      selectedCategory === cat
                        ? 'bg-violet-600 text-white shadow-2xs'
                        : 'bg-slate-100 text-slate-700 hover:bg-slate-200/80'
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
                    showToast('BOM 변경 사항이 초기 상태로 복원되었습니다.')
                  }}
                  className="text-sm font-bold text-violet-600 hover:text-violet-800 underline cursor-pointer"
                >
                  편집/삭제 내역 초기화
                </button>
              )}
            </div>

            {/* BOM Table */}
            <div className="overflow-x-auto rounded-xl border border-slate-200">
              <table className="w-full min-w-[1040px] text-left border-collapse text-sm">
                <thead>
                  <tr className="bg-slate-100 text-slate-700 border-b border-slate-200 whitespace-nowrap">
                    <th className="py-3.5 px-4 font-bold w-[150px]">부품코드 / 분류</th>
                    <th className="py-3.5 px-4 font-bold min-w-[240px]">부품명 및 상세 규격</th>
                    <th className="py-3.5 px-4 font-bold min-w-[180px]">산출 근거 (적용 키오스크)</th>
                    <th className="py-3.5 px-4 text-right font-bold w-[115px]">총 필요수량</th>
                    <th className="py-3.5 px-4 text-right font-bold w-[110px]">창고 현재고</th>
                    <th className="py-3.5 px-4 text-center font-bold w-[140px]">실제 발주수량</th>
                    <th className="py-3.5 px-4 font-bold min-w-[200px]">매입 발주처 (공급사)</th>
                    <th className="py-3.5 px-3 text-center font-bold w-[96px]">수정·삭제</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200">
                  {filteredBom.map((part) => {
                    const isEditing = editingPartCode === part.partCode
                    return (
                      <tr key={part.partCode} className="hover:bg-slate-50/90 transition-colors">
                        <td className="py-4 px-4 whitespace-nowrap align-middle">
                          <div className="font-mono font-bold text-indigo-600 text-sm">
                            {part.partCode}
                          </div>
                          <span className="inline-block mt-1 px-2.5 py-0.5 rounded-md text-xs font-semibold bg-slate-100 text-slate-700 whitespace-nowrap">
                            {part.category}
                          </span>
                        </td>

                        <td className="py-4 px-4 align-middle break-keep">
                          {isEditing ? (
                            <div className="space-y-1.5">
                              <input
                                type="text"
                                value={part.partName}
                                onChange={(e) =>
                                  handleUpdateBomField(part.partCode, 'partName', e.target.value)
                                }
                                className="w-full px-2.5 py-1.5 rounded-lg bg-white border border-violet-400 font-bold text-slate-900"
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
                              <div className="font-bold text-slate-900 text-base break-keep">
                                {part.partName}
                              </div>
                              <div className="text-xs sm:text-sm text-slate-500 mt-0.5 break-keep">
                                {part.spec}
                              </div>
                            </>
                          )}
                        </td>

                        <td className="py-4 px-4 align-middle">
                          <div className="flex flex-wrap gap-1.5">
                            {part.sourceModels.map((m) => (
                              <span
                                key={m.modelCode}
                                className="px-2.5 py-1 rounded-lg bg-indigo-50 text-indigo-700 border border-indigo-100 font-semibold text-xs whitespace-nowrap"
                              >
                                {m.modelCode}: {m.orderQty}대 → {m.subTotalQty} {part.unit}
                              </span>
                            ))}
                          </div>
                        </td>

                        <td className="py-4 px-4 text-right font-mono font-bold text-slate-800 text-base whitespace-nowrap align-middle">
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
                              className="w-20 text-right px-2 py-1 rounded-lg bg-white border border-violet-400 font-bold"
                            />
                          ) : (
                            <span>
                              {part.grossRequiredQty.toLocaleString()}{' '}
                              <span className="text-xs font-semibold text-slate-500">{part.unit}</span>
                            </span>
                          )}
                        </td>

                        <td className="py-4 px-4 text-right font-mono font-bold text-emerald-600 text-sm whitespace-nowrap align-middle">
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
                              className="w-16 text-right px-2 py-1 rounded-lg bg-white border border-emerald-400 font-bold"
                            />
                          ) : (
                            <span className="inline-flex items-center justify-end gap-1 px-2.5 py-1 rounded-lg bg-emerald-50 border border-emerald-200/80 text-emerald-700 whitespace-nowrap">
                              <span>{deductStock ? `-${part.stockQty}` : part.stockQty}</span>
                              <span className="text-xs font-semibold">{part.unit}</span>
                            </span>
                          )}
                        </td>

                        <td className="py-4 px-4 whitespace-nowrap align-middle">
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
                              className="w-20 text-center py-1.5 rounded-xl bg-violet-50 border border-violet-300 text-violet-950 font-black text-base focus:outline-none focus:border-violet-600"
                            />
                            <span className="text-slate-600 font-semibold text-xs whitespace-nowrap">
                              {part.unit}
                            </span>
                          </div>
                        </td>

                        <td className="py-4 px-4 align-middle whitespace-nowrap">
                          {isEditing ? (
                            <select
                              value={part.supplierId}
                              onChange={(e) =>
                                handleUpdateBomField(part.partCode, 'supplierId', e.target.value)
                              }
                              className="w-full px-2.5 py-1.5 rounded-lg bg-white border border-violet-400 font-bold text-slate-900 text-sm"
                            >
                              {supplierPartners.map((s) => (
                                <option key={s.id} value={s.id}>
                                  {s.name}
                                </option>
                              ))}
                            </select>
                          ) : (
                            <>
                              <div className="font-bold text-slate-900">{part.supplierName}</div>
                              <div className="text-xs text-slate-500 mt-0.5">
                                {part.supplierManager} ({part.supplierPhone}) · 납기{' '}
                                {part.leadTimeDays}일
                              </div>
                            </>
                          )}
                        </td>

                        <td className="py-4 px-3 text-center whitespace-nowrap align-middle">
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
                                  : 'hover:bg-violet-100 text-slate-500 hover:text-violet-700'
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
                              title="BOM 항목 삭제"
                              onClick={() => handleDeleteBomItem(part.partCode, part.partName)}
                              className="p-2 rounded-lg hover:bg-rose-50 text-slate-400 hover:text-rose-600 transition-colors cursor-pointer"
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

            {/* Bottom Step Navigation */}
            <div className="pt-4 border-t border-slate-200 flex items-center justify-between">
              <button
                type="button"
                onClick={() => setActiveTab('STEP1_SCAN')}
                className="px-5 py-2.5 rounded-xl text-sm font-bold bg-slate-100 hover:bg-slate-200 text-slate-700 cursor-pointer"
              >
                ← 이전: 수주 발주서 스캔 화면
              </button>
              <button
                type="button"
                onClick={() => setActiveTab('STEP3_PO')}
                className="inline-flex items-center gap-2 px-6 py-3 rounded-xl text-base font-extrabold bg-emerald-600 hover:bg-emerald-500 text-white shadow-md shadow-emerald-600/20 transition-all cursor-pointer"
              >
                <span>다음 단계: 생성된 매입 발주서({purchaseOrders.length}건) 확인 및 발송</span>
                <ArrowRight className="w-5 h-5" />
              </button>
            </div>
          </section>
        )}

        {/* =====================================================================
            TAB 3: 발주처별 매입 발주서(PO) 생성·인쇄·PDF/엑셀 다운로드·PDF 전송
        ===================================================================== */}
        {activeTab === 'STEP3_PO' && (
          <section className="bg-white border border-slate-200 rounded-2xl overflow-hidden shadow-xs space-y-6 p-6">
            <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 border-b border-slate-200 pb-5">
              <div>
                <div className="flex items-center gap-2.5">
                  <span className="px-3 py-1 rounded-lg text-sm font-extrabold bg-emerald-600 text-white">
                    STEP 3
                  </span>
                  <h2 className="text-xl font-extrabold text-slate-900">
                    발주처별 매입 발주서(PO) 자동 생성 및 발송
                  </h2>
                  <span className="text-sm px-3 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200 font-bold">
                    총 {purchaseOrders.length}개 발주처 파일
                  </span>
                </div>
                <p className="text-sm text-slate-500 mt-1">
                  업체별로 자동 작성된 구매발주서입니다. <strong>PDF 다운로드</strong>, <strong>엑셀(.xlsx) 다운로드</strong>, <strong>프린트(인쇄)</strong> 및 <strong>PDF 파일 이메일 전송</strong>을 지원합니다.
                </p>
              </div>

              <div className="flex flex-wrap items-center gap-2.5">
                <button
                  type="button"
                  onClick={handleDownloadAllExcel}
                  className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-bold bg-emerald-50 hover:bg-emerald-100 text-emerald-700 border border-emerald-200 transition-all cursor-pointer"
                >
                  <FileSpreadsheet className="w-4 h-4" />
                  전체 엑셀(.xlsx) 일괄 다운로드
                </button>
                <button
                  type="button"
                  onClick={handleSendAllPdfEmails}
                  className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-extrabold bg-indigo-600 hover:bg-indigo-500 text-white shadow-sm shadow-indigo-600/20 transition-all cursor-pointer"
                >
                  <Send className="w-4 h-4" />
                  전체 발주처로 PDF 발주서 일괄 전송 ({purchaseOrders.length}곳)
                </button>
              </div>
            </div>

            {/* Generated PO Cards Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {purchaseOrders.map((po) => (
                <div
                  key={po.poNumber}
                  className="flex flex-col justify-between rounded-2xl bg-white border-2 border-slate-200 hover:border-indigo-400 transition-all overflow-hidden shadow-xs"
                >
                  {/* Top Decorative Strip */}
                  <div className="h-1.5 w-full bg-gradient-to-r from-indigo-600 via-violet-500 to-emerald-500" />

                  <div className="p-6 space-y-4 flex-1">
                    {/* Card Header */}
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex items-center gap-3 min-w-0">
                        <div className="p-3 rounded-xl bg-indigo-50 text-indigo-600 border border-indigo-100 shrink-0">
                          <FileText className="w-6 h-6" />
                        </div>
                        <div className="min-w-0">
                          <div className="flex items-center gap-2">
                            <span className="text-xs font-mono font-bold text-indigo-600">
                              {po.poNumber}
                            </span>
                            <span className="text-xs text-slate-400">|</span>
                            <span className="text-xs font-semibold text-slate-600">
                              납기요청: {po.requestedDeliveryDate}
                            </span>
                          </div>
                          <h3 className="text-lg font-extrabold text-slate-900 truncate mt-0.5">
                            {po.supplierName} 귀하
                          </h3>
                        </div>
                      </div>

                      <span
                        className={`px-3 py-1 rounded-full text-xs font-extrabold shrink-0 ${
                          po.status === 'SENT'
                            ? 'bg-indigo-50 text-indigo-700 border border-indigo-200'
                            : po.status === 'DOWNLOADED'
                              ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                              : 'bg-amber-50 text-amber-700 border border-amber-200'
                        }`}
                      >
                        {po.status === 'SENT'
                          ? 'PDF 전송 완료'
                          : po.status === 'DOWNLOADED'
                            ? '다운로드 완료'
                            : '발주서 생성됨'}
                      </span>
                    </div>

                    {/* PDF & Excel File Names */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
                      <div className="px-3 py-2 rounded-xl bg-rose-50/70 border border-rose-200/80 text-rose-800 font-mono font-semibold truncate flex items-center gap-1.5">
                        <FileText className="w-4 h-4 text-rose-600 shrink-0" />
                        <span className="truncate">{po.pdfFileName}</span>
                      </div>
                      <div className="px-3 py-2 rounded-xl bg-emerald-50/70 border border-emerald-200/80 text-emerald-800 font-mono font-semibold truncate flex items-center gap-1.5">
                        <FileSpreadsheet className="w-4 h-4 text-emerald-600 shrink-0" />
                        <span className="truncate">{po.excelFileName}</span>
                      </div>
                    </div>

                    {/* Supplier Metadata */}
                    <div className="text-sm text-slate-600 grid grid-cols-1 sm:grid-cols-2 gap-2 bg-slate-50 p-3.5 rounded-xl border border-slate-200/80">
                      <div>
                        • 담당자: <strong className="text-slate-900">{po.supplierManager}</strong>
                      </div>
                      <div>
                        • 연락처: <strong className="text-slate-900">{po.supplierPhone}</strong>
                      </div>
                      <div className="sm:col-span-2">
                        • 수신 이메일:{' '}
                        <strong className="font-mono text-indigo-700">{po.supplierEmail}</strong>
                      </div>
                    </div>

                    {/* Included BOM Parts Table inside PO Card */}
                    <div className="space-y-2">
                      <div className="flex items-center justify-between text-sm font-bold text-slate-700">
                        <span>발주 품목 내역 ({po.totalItemTypes}종)</span>
                        <span className="text-indigo-700">
                          총 발주수량 {po.totalOrderQty.toLocaleString()}개
                        </span>
                      </div>
                      <div className="border border-slate-200 rounded-xl overflow-hidden">
                        <table className="w-full text-left border-collapse text-sm">
                          <thead>
                            <tr className="bg-slate-100 text-slate-600 border-b border-slate-200 text-xs">
                              <th className="py-2 px-3 font-bold">부품코드</th>
                              <th className="py-2 px-3 font-bold">품목명</th>
                              <th className="py-2 px-3 font-bold text-right">발주수량</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-slate-200/70">
                            {po.items.map((item) => (
                              <tr key={item.partCode} className="bg-white">
                                <td className="py-2 px-3 font-mono font-bold text-indigo-600 text-xs">
                                  {item.partCode}
                                </td>
                                <td className="py-2 px-3 font-semibold text-slate-800 truncate max-w-[200px]">
                                  {item.partName}
                                </td>
                                <td className="py-2 px-3 text-right font-mono font-extrabold text-slate-900">
                                  {item.adjustedOrderQty.toLocaleString()} {item.unit}
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  </div>

                  {/* Card Footer Action Buttons (Preview, Print, PDF, Excel, Send PDF) */}
                  <div className="px-6 py-4 bg-slate-50 border-t border-slate-200 space-y-2.5">
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                      <button
                        type="button"
                        onClick={() => setPreviewPo(po)}
                        className="inline-flex items-center justify-center gap-1.5 py-2.5 px-3 rounded-xl text-sm font-bold bg-white hover:bg-slate-100 text-slate-800 border border-slate-300 transition-colors cursor-pointer"
                      >
                        <Eye className="w-4 h-4 text-indigo-600" />
                        양식 보기
                      </button>
                      <button
                        type="button"
                        onClick={() => handlePrintPo(po)}
                        className="inline-flex items-center justify-center gap-1.5 py-2.5 px-3 rounded-xl text-sm font-bold bg-white hover:bg-slate-100 text-slate-800 border border-slate-300 transition-colors cursor-pointer"
                      >
                        <Printer className="w-4 h-4 text-slate-700" />
                        프린트
                      </button>
                      <button
                        type="button"
                        onClick={() => handleDownloadPdf(po)}
                        className="inline-flex items-center justify-center gap-1.5 py-2.5 px-3 rounded-xl text-sm font-bold bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 transition-colors cursor-pointer"
                      >
                        <Download className="w-4 h-4" />
                        PDF 저장
                      </button>
                      <button
                        type="button"
                        onClick={() => handleDownloadExcel(po)}
                        className="inline-flex items-center justify-center gap-1.5 py-2.5 px-3 rounded-xl text-sm font-bold bg-emerald-50 hover:bg-emerald-100 text-emerald-700 border border-emerald-200 transition-colors cursor-pointer"
                      >
                        <FileSpreadsheet className="w-4 h-4" />
                        엑셀 저장
                      </button>
                    </div>

                    <button
                      type="button"
                      onClick={() => handleSendPoPdfEmail(po)}
                      className="w-full inline-flex items-center justify-center gap-2 py-2.5 px-4 rounded-xl text-sm font-extrabold bg-indigo-600 hover:bg-indigo-500 text-white shadow-xs transition-colors cursor-pointer"
                    >
                      <Send className="w-4 h-4" />
                      업체({po.supplierName})로 PDF 발주서 파일 전송
                    </button>

                    <button
                      type="button"
                      onClick={() => handleReceivePoItems(po)}
                      disabled={Boolean(poReceivedMap[po.poNumber])}
                      className={`w-full inline-flex items-center justify-center gap-2 py-2 px-4 rounded-xl text-xs font-extrabold border transition-colors cursor-pointer ${
                        poReceivedMap[po.poNumber]
                          ? 'bg-emerald-50 text-emerald-700 border-emerald-200 cursor-default'
                          : 'bg-amber-50 hover:bg-amber-100 text-amber-800 border-amber-200'
                      }`}
                    >
                      <PackageCheck className="w-4 h-4" />
                      {poReceivedMap[po.poNumber]
                        ? '자재 입고 완료됨 (창고 현재고에 +반영됨)'
                        : `자재 입고 완료 처리 (창고 현재고 +${po.totalOrderQty}개 자동 반영)`}
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </section>
        )}

        {/* =====================================================================
            TAB 4: 창고 재고 및 입출고 관리 (STEP 2 현재고와 100% 실시간 연동)
        ===================================================================== */}
        {activeTab === 'STEP4_INVENTORY' && (
          <div className="space-y-6">
            <section className="bg-white border border-slate-200 rounded-2xl overflow-hidden shadow-xs space-y-6 p-6">
              {/* Header */}
              <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 border-b border-slate-200 pb-5">
                <div>
                  <div className="flex items-center gap-2.5">
                    <span className="px-3 py-1 rounded-lg text-sm font-extrabold bg-amber-600 text-white">
                      STEP 4 · 재고 관리
                    </span>
                    <h2 className="text-xl font-extrabold text-slate-900">
                      부품 창고 현재고 및 입·출고 통합 관리
                    </h2>
                  </div>
                  <p className="text-sm text-slate-500 mt-1">
                    이곳에서 관리하는 부품별 <strong>창고 현재고</strong> 숫자가{' '}
                    <strong className="text-violet-700">STEP 2 (BOM 자동 전개)</strong>의 현재고 칸에 100% 실시간으로 연동되어 실제 발주수량을 계산합니다.
                  </p>
                </div>

                <div className="flex flex-wrap items-center gap-2.5">
                  <button
                    type="button"
                    onClick={() => setActiveTab('STEP2_BOM')}
                    className="inline-flex items-center gap-1.5 px-4 py-2.5 rounded-xl text-sm font-bold bg-violet-50 hover:bg-violet-100 text-violet-700 border border-violet-200 transition-colors cursor-pointer"
                  >
                    ← STEP 2 (BOM 화면)에서 연동 확인
                  </button>
                  <button
                    type="button"
                    onClick={() => setShowAddInventoryPartForm((v) => !v)}
                    className="inline-flex items-center gap-1.5 px-4 py-2.5 rounded-xl text-sm font-extrabold bg-amber-600 hover:bg-amber-500 text-white shadow-xs transition-colors cursor-pointer"
                  >
                    <Plus className="w-4 h-4" />+ 신규 재고 부품 등록
                  </button>
                </div>
              </div>

              {/* 4 Summary Cards */}
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                <button
                  type="button"
                  onClick={() => setInventoryStatusFilter('ALL')}
                  className={`p-4 rounded-2xl border text-left transition-all cursor-pointer ${
                    inventoryStatusFilter === 'ALL'
                      ? 'bg-slate-900 text-white border-slate-900 shadow-sm'
                      : 'bg-slate-50 hover:bg-slate-100 border-slate-200 text-slate-800'
                  }`}
                >
                  <div
                    className={`text-xs font-bold ${
                      inventoryStatusFilter === 'ALL' ? 'text-slate-300' : 'text-slate-500'
                    }`}
                  >
                    전체 관리 부품
                  </div>
                  <div className="text-2xl font-black mt-1">{inventoryStats.total}종</div>
                  <div
                    className={`text-xs mt-1 ${
                      inventoryStatusFilter === 'ALL' ? 'text-slate-300' : 'text-slate-500'
                    }`}
                  >
                    키오스크 표준 BOM 연동 품목
                  </div>
                </button>

                <button
                  type="button"
                  onClick={() => setInventoryStatusFilter('NORMAL')}
                  className={`p-4 rounded-2xl border text-left transition-all cursor-pointer ${
                    inventoryStatusFilter === 'NORMAL'
                      ? 'bg-emerald-600 text-white border-emerald-600 shadow-sm'
                      : 'bg-emerald-50/60 hover:bg-emerald-50 border-emerald-200 text-emerald-950'
                  }`}
                >
                  <div
                    className={`text-xs font-bold ${
                      inventoryStatusFilter === 'NORMAL' ? 'text-emerald-100' : 'text-emerald-700'
                    }`}
                  >
                    정상 보유 품목 (안전재고 이상)
                  </div>
                  <div className="text-2xl font-black mt-1">{inventoryStats.normal}종</div>
                  <div
                    className={`text-xs mt-1 ${
                      inventoryStatusFilter === 'NORMAL' ? 'text-emerald-100' : 'text-emerald-600'
                    }`}
                  >
                    즉시 조립 투입 가능
                  </div>
                </button>

                <button
                  type="button"
                  onClick={() => setInventoryStatusFilter('LOW')}
                  className={`p-4 rounded-2xl border text-left transition-all cursor-pointer ${
                    inventoryStatusFilter === 'LOW'
                      ? 'bg-amber-500 text-white border-amber-500 shadow-sm'
                      : 'bg-amber-50/70 hover:bg-amber-50 border-amber-200 text-amber-950'
                  }`}
                >
                  <div
                    className={`text-xs font-bold flex items-center gap-1 ${
                      inventoryStatusFilter === 'LOW' ? 'text-amber-100' : 'text-amber-700'
                    }`}
                  >
                    <AlertTriangle className="w-3.5 h-3.5" />
                    재고 부족 (안전재고 미달)
                  </div>
                  <div className="text-2xl font-black mt-1">{inventoryStats.low}종</div>
                  <div
                    className={`text-xs mt-1 ${
                      inventoryStatusFilter === 'LOW' ? 'text-amber-100' : 'text-amber-700'
                    }`}
                  >
                    선제적 보충 발주 권장
                  </div>
                </button>

                <button
                  type="button"
                  onClick={() => setInventoryStatusFilter('EMPTY')}
                  className={`p-4 rounded-2xl border text-left transition-all cursor-pointer ${
                    inventoryStatusFilter === 'EMPTY'
                      ? 'bg-rose-600 text-white border-rose-600 shadow-sm'
                      : 'bg-rose-50/70 hover:bg-rose-50 border-rose-200 text-rose-950'
                  }`}
                >
                  <div
                    className={`text-xs font-bold ${
                      inventoryStatusFilter === 'EMPTY' ? 'text-rose-100' : 'text-rose-700'
                    }`}
                  >
                    품절 품목 (현재고 0)
                  </div>
                  <div className="text-2xl font-black mt-1">{inventoryStats.empty}종</div>
                  <div
                    className={`text-xs mt-1 ${
                      inventoryStatusFilter === 'EMPTY' ? 'text-rose-100' : 'text-rose-600'
                    }`}
                  >
                    긴급 매입 발주 필요
                  </div>
                </button>
              </div>

              {/* Add New Inventory Part Form */}
              {showAddInventoryPartForm && (
                <div className="p-5 rounded-2xl bg-amber-50/70 border border-amber-200 space-y-4">
                  <div className="flex items-center justify-between">
                    <h3 className="text-base font-extrabold text-amber-950 flex items-center gap-2">
                      <Package className="w-5 h-5 text-amber-600" />
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
                      <label className="block text-slate-700 font-semibold mb-1">부품코드</label>
                      <input
                        type="text"
                        placeholder="예: CBL-LAN-CAT6"
                        value={newInventoryPart.partCode}
                        onChange={(e) =>
                          setNewInventoryPart({ ...newInventoryPart, partCode: e.target.value })
                        }
                        className="w-full px-3 py-2 rounded-xl bg-white border border-amber-300"
                      />
                    </div>
                    <div>
                      <label className="block text-slate-700 font-semibold mb-1">카테고리</label>
                      <select
                        value={newInventoryPart.category}
                        onChange={(e) =>
                          setNewInventoryPart({
                            ...newInventoryPart,
                            category: e.target.value as PartCategory,
                          })
                        }
                        className="w-full px-3 py-2 rounded-xl bg-white border border-amber-300 font-bold"
                      >
                        {PART_CATEGORIES.map((c) => (
                          <option key={c} value={c}>
                            {c}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div className="sm:col-span-2">
                      <label className="block text-slate-700 font-semibold mb-1">
                        부품명 (필수)
                      </label>
                      <input
                        type="text"
                        placeholder="예: CAT.6 기가비트 랜 케이블 (3M)"
                        value={newInventoryPart.partName}
                        onChange={(e) =>
                          setNewInventoryPart({ ...newInventoryPart, partName: e.target.value })
                        }
                        className="w-full px-3 py-2 rounded-xl bg-white border border-amber-300 font-bold"
                      />
                    </div>
                    <div className="sm:col-span-2">
                      <label className="block text-slate-700 font-semibold mb-1">상세 규격</label>
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
                      <label className="block text-slate-700 font-semibold mb-1">
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
                          className="w-1/2 px-3 py-2 rounded-xl bg-white border border-amber-300 font-bold"
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
                          className="w-1/2 px-3 py-2 rounded-xl bg-white border border-amber-300 font-bold"
                        />
                      </div>
                    </div>
                    <div>
                      <label className="block text-slate-700 font-semibold mb-1">주 발주처</label>
                      <select
                        value={newInventoryPart.supplierId}
                        onChange={(e) =>
                          setNewInventoryPart({ ...newInventoryPart, supplierId: e.target.value })
                        }
                        className="w-full px-3 py-2 rounded-xl bg-white border border-amber-300 font-bold"
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
                      className="px-4 py-2 rounded-xl text-sm font-semibold bg-white border border-slate-300 cursor-pointer"
                    >
                      취소
                    </button>
                    <button
                      type="button"
                      onClick={handleAddWarehousePart}
                      className="px-5 py-2 rounded-xl text-sm font-bold bg-amber-600 text-white cursor-pointer"
                    >
                      창고 재고에 등록
                    </button>
                  </div>
                </div>
              )}

              {/* Filter & Search Bar */}
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
                <div className="flex items-center gap-2 flex-wrap">
                  {CATEGORIES.map((cat) => (
                    <button
                      key={cat}
                      type="button"
                      onClick={() => setInventoryCategory(cat)}
                      className={`px-3.5 py-2 rounded-xl text-sm font-bold transition-colors cursor-pointer ${
                        inventoryCategory === cat
                          ? 'bg-amber-600 text-white shadow-2xs'
                          : 'bg-slate-100 text-slate-700 hover:bg-slate-200/80'
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
                <table className="w-full min-w-[1080px] text-left border-collapse text-sm">
                  <thead>
                    <tr className="bg-slate-100 text-slate-700 border-b border-slate-200 whitespace-nowrap">
                      <th className="py-3.5 px-4 font-bold w-[150px]">부품코드 / 분류</th>
                      <th className="py-3.5 px-4 font-bold min-w-[230px]">부품명 및 규격</th>
                      <th className="py-3.5 px-4 text-center font-bold w-[110px]">재고 상태</th>
                      <th className="py-3.5 px-4 text-center font-bold w-[220px]">
                        창고 현재고 (실시간 입·출고 조정)
                      </th>
                      <th className="py-3.5 px-4 text-center font-bold w-[110px]">안전재고 기준</th>
                      <th className="py-3.5 px-4 text-right font-bold w-[130px]">
                        현재 수주 필요량
                      </th>
                      <th className="py-3.5 px-4 font-bold min-w-[190px]">주 매입 발주처</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200">
                    {filteredWarehouseInventory.map((part) => (
                      <tr key={part.partCode} className="hover:bg-slate-50/90 transition-colors">
                        <td className="py-4 px-4 whitespace-nowrap align-middle">
                          <div className="font-mono font-bold text-indigo-600 text-sm">
                            {part.partCode}
                          </div>
                          <span className="inline-block mt-1 px-2.5 py-0.5 rounded-md text-xs font-semibold bg-slate-100 text-slate-700 whitespace-nowrap">
                            {part.category}
                          </span>
                        </td>

                        <td className="py-4 px-4 align-middle break-keep">
                          <div className="font-bold text-slate-900 text-base">{part.partName}</div>
                          <div className="text-xs text-slate-500 mt-0.5">{part.spec}</div>
                          <div className="flex flex-wrap gap-1 mt-1.5">
                            {part.usedInModels.map((mc) => (
                              <span
                                key={mc}
                                className="px-2 py-0.5 rounded bg-slate-100 text-slate-600 font-mono text-[11px] font-semibold whitespace-nowrap"
                              >
                                {mc}
                              </span>
                            ))}
                          </div>
                        </td>

                        <td className="py-4 px-4 text-center whitespace-nowrap align-middle">
                          {part.stockStatus === 'EMPTY' ? (
                            <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs font-extrabold bg-rose-100 text-rose-700 border border-rose-200">
                              품절 (0)
                            </span>
                          ) : part.stockStatus === 'LOW' ? (
                            <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs font-extrabold bg-amber-100 text-amber-800 border border-amber-200">
                              재고 부족
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs font-extrabold bg-emerald-100 text-emerald-800 border border-emerald-200">
                              정상 보유
                            </span>
                          )}
                        </td>

                        <td className="py-4 px-4 whitespace-nowrap align-middle">
                          <div className="flex items-center justify-center gap-1.5">
                            <button
                              type="button"
                              title="1개 출고(-1)"
                              onClick={() =>
                                handleAdjustWarehouseStock(
                                  part.partCode,
                                  part.stockQty - 1,
                                  '창고 재고 관리에서 -1 출고 차감',
                                  'OUT'
                                )
                              }
                              className="w-8 h-8 rounded-lg bg-slate-100 hover:bg-rose-100 hover:text-rose-700 text-slate-700 font-extrabold border border-slate-300 transition-colors cursor-pointer"
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
                              className="w-20 text-center py-1.5 rounded-xl bg-emerald-50 border border-emerald-300 text-emerald-950 font-black text-base focus:outline-none focus:border-emerald-600"
                            />
                            <span className="text-xs font-bold text-slate-500">{part.unit}</span>
                            <button
                              type="button"
                              title="1개 입고(+1)"
                              onClick={() =>
                                handleAdjustWarehouseStock(
                                  part.partCode,
                                  part.stockQty + 1,
                                  '창고 재고 관리에서 +1 입고 추가',
                                  'IN'
                                )
                              }
                              className="w-8 h-8 rounded-lg bg-slate-100 hover:bg-emerald-100 hover:text-emerald-700 text-slate-700 font-extrabold border border-slate-300 transition-colors cursor-pointer"
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
                                  '창고 재고 관리에서 +5 입고 추가',
                                  'IN'
                                )
                              }
                              className="px-2 h-8 rounded-lg bg-emerald-50 hover:bg-emerald-100 text-emerald-700 font-extrabold border border-emerald-200 text-xs transition-colors cursor-pointer"
                            >
                              +5
                            </button>
                          </div>
                        </td>

                        <td className="py-4 px-4 text-center whitespace-nowrap align-middle">
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
                              className="w-16 text-center py-1 rounded-lg bg-white border border-slate-300 text-slate-700 font-bold text-sm"
                            />
                            <span className="text-xs text-slate-500">{part.unit}</span>
                          </div>
                        </td>

                        <td className="py-4 px-4 text-right font-mono whitespace-nowrap align-middle">
                          {part.currentReqQty > 0 ? (
                            <div>
                              <span className="font-extrabold text-violet-700 text-base">
                                {part.currentReqQty.toLocaleString()} {part.unit}
                              </span>
                              <div className="text-xs text-slate-500">
                                {part.stockQty >= part.currentReqQty ? (
                                  <span className="text-emerald-600 font-semibold">
                                    재고 충분 (잔여 {part.stockQty - part.currentReqQty})
                                  </span>
                                ) : (
                                  <span className="text-rose-600 font-semibold">
                                    발주 필요 ({part.currentReqQty - part.stockQty} 부족)
                                  </span>
                                )}
                              </div>
                            </div>
                          ) : (
                            <span className="text-xs text-slate-400">현재 수주 해당없음</span>
                          )}
                        </td>

                        <td className="py-4 px-4 whitespace-nowrap align-middle">
                          <div className="font-bold text-slate-900">{part.supplierName}</div>
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
            <section className="bg-white border border-slate-200 rounded-2xl p-6 shadow-xs space-y-4">
              <div className="flex items-center justify-between border-b border-slate-200 pb-4">
                <div className="flex items-center gap-2">
                  <History className="w-5 h-5 text-amber-600" />
                  <h3 className="text-lg font-extrabold text-slate-900">
                    최근 창고 입·출고 및 재고 조정 이력
                  </h3>
                </div>
                <span className="text-xs font-semibold text-slate-500">
                  재고 수량 변경 및 STEP 3 발주서 입고 완료 내역이 자동 기록됩니다
                </span>
              </div>

              <div className="overflow-x-auto rounded-xl border border-slate-200">
                <table className="w-full min-w-[780px] text-left border-collapse text-sm">
                  <thead>
                    <tr className="bg-slate-50 text-slate-600 border-b border-slate-200 whitespace-nowrap text-xs">
                      <th className="py-2.5 px-4 font-bold">일시</th>
                      <th className="py-2.5 px-4 font-bold">구분</th>
                      <th className="py-2.5 px-4 font-bold">부품코드 / 부품명</th>
                      <th className="py-2.5 px-4 text-right font-bold">변동 수량</th>
                      <th className="py-2.5 px-4 text-right font-bold">변경 후 현재고</th>
                      <th className="py-2.5 px-4 font-bold">비고 (사유)</th>
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
                            className={`px-2.5 py-0.5 rounded-md text-xs font-extrabold ${
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
                          <span className="font-mono text-xs font-bold text-indigo-600 mr-2">
                            {log.partCode}
                          </span>
                          <strong className="text-slate-900">{log.partName}</strong>
                        </td>
                        <td
                          className={`py-3 px-4 text-right font-mono font-extrabold whitespace-nowrap ${
                            log.changeQty > 0 ? 'text-emerald-600' : 'text-rose-600'
                          }`}
                        >
                          {log.changeQty > 0 ? `+${log.changeQty}` : log.changeQty} {log.unit}
                        </td>
                        <td className="py-3 px-4 text-right font-mono font-bold text-slate-900 whitespace-nowrap">
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
            TAB 4: 거래처(고객사·발주처) 및 표준 BOM 마스터 관리 (추가/수정/삭제)
        ===================================================================== */}
        {activeTab === 'STEP4_MASTER' && (
          <div className="space-y-8">
            {/* 1. Partner Companies Management (CRUD) */}
            <section className="bg-white border border-slate-200 rounded-2xl p-6 shadow-xs space-y-5">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-200 pb-4">
                <div>
                  <h2 className="text-xl font-extrabold text-slate-900 flex items-center gap-2">
                    <Building2 className="w-6 h-6 text-indigo-600" />
                    거래처 (고객사 및 매입 발주처) 통합 관리
                  </h2>
                  <p className="text-sm text-slate-500 mt-1">
                    수주 고객사 및 부품 매입 발주처 정보를 자유롭게 추가·수정·삭제할 수 있습니다.
                  </p>
                </div>

                <div className="flex items-center gap-2">
                  {(['ALL', 'CLIENT', 'SUPPLIER'] as const).map((type) => (
                    <button
                      key={type}
                      type="button"
                      onClick={() => setPartnerFilter(type)}
                      className={`px-3.5 py-2 rounded-xl text-sm font-bold cursor-pointer ${
                        partnerFilter === type
                          ? 'bg-slate-900 text-white'
                          : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                      }`}
                    >
                      {type === 'ALL'
                        ? '전체 거래처'
                        : type === 'CLIENT'
                          ? '수주 고객사'
                          : '매입 발주처'}
                    </button>
                  ))}
                  <button
                    type="button"
                    onClick={() => setShowNewPartnerForm((v) => !v)}
                    className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl text-sm font-bold bg-indigo-600 hover:bg-indigo-500 text-white cursor-pointer"
                  >
                    <Plus className="w-4 h-4" />+ 거래처 추가
                  </button>
                </div>
              </div>

              {showNewPartnerForm && (
                <div className="p-5 rounded-2xl bg-indigo-50/70 border border-indigo-200 space-y-4">
                  <div className="text-base font-extrabold text-indigo-950">
                    신규 거래처 등록
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-4 gap-3 text-sm">
                    <select
                      value={newPartner.type}
                      onChange={(e) =>
                        setNewPartner({
                          ...newPartner,
                          type: e.target.value as 'CLIENT' | 'SUPPLIER',
                        })
                      }
                      className="px-3 py-2.5 rounded-xl bg-white border border-indigo-200 font-bold"
                    >
                      <option value="SUPPLIER">매입 발주처 (부품 공급사)</option>
                      <option value="CLIENT">수주 고객사 (발주처)</option>
                    </select>
                    <input
                      type="text"
                      placeholder="업체명 (필수)"
                      value={newPartner.name}
                      onChange={(e) => setNewPartner({ ...newPartner, name: e.target.value })}
                      className="px-3 py-2.5 rounded-xl bg-white border border-indigo-200 font-bold"
                    />
                    <input
                      type="text"
                      placeholder="사업자등록번호"
                      value={newPartner.bizNo}
                      onChange={(e) => setNewPartner({ ...newPartner, bizNo: e.target.value })}
                      className="px-3 py-2.5 rounded-xl bg-white border border-indigo-200"
                    />
                    <input
                      type="text"
                      placeholder="담당자명 / 직책"
                      value={newPartner.manager}
                      onChange={(e) => setNewPartner({ ...newPartner, manager: e.target.value })}
                      className="px-3 py-2.5 rounded-xl bg-white border border-indigo-200"
                    />
                    <input
                      type="text"
                      placeholder="연락처"
                      value={newPartner.phone}
                      onChange={(e) => setNewPartner({ ...newPartner, phone: e.target.value })}
                      className="px-3 py-2.5 rounded-xl bg-white border border-indigo-200"
                    />
                    <input
                      type="email"
                      placeholder="이메일"
                      value={newPartner.email}
                      onChange={(e) => setNewPartner({ ...newPartner, email: e.target.value })}
                      className="px-3 py-2.5 rounded-xl bg-white border border-indigo-200"
                    />
                    <input
                      type="text"
                      placeholder="주소"
                      value={newPartner.address}
                      onChange={(e) => setNewPartner({ ...newPartner, address: e.target.value })}
                      className="sm:col-span-2 px-3 py-2.5 rounded-xl bg-white border border-indigo-200"
                    />
                  </div>
                  <div className="flex justify-end gap-2">
                    <button
                      type="button"
                      onClick={() => setShowNewPartnerForm(false)}
                      className="px-4 py-2 rounded-xl text-sm font-semibold bg-white border border-slate-300 cursor-pointer"
                    >
                      취소
                    </button>
                    <button
                      type="button"
                      onClick={handleCreatePartner}
                      className="px-5 py-2 rounded-xl text-sm font-bold bg-indigo-600 text-white cursor-pointer"
                    >
                      등록 완료
                    </button>
                  </div>
                </div>
              )}

              <div className="overflow-x-auto rounded-xl border border-slate-200">
                <table className="w-full min-w-[960px] text-left border-collapse text-sm">
                  <thead>
                    <tr className="bg-slate-100 text-slate-700 border-b border-slate-200 whitespace-nowrap">
                      <th className="py-3 px-4 font-bold">구분</th>
                      <th className="py-3 px-4 font-bold">업체명</th>
                      <th className="py-3 px-4 font-bold">사업자번호</th>
                      <th className="py-3 px-4 font-bold">담당자 / 연락처</th>
                      <th className="py-3 px-4 font-bold">이메일</th>
                      <th className="py-3 px-4 font-bold">소재지 주소</th>
                      <th className="py-3 px-3 text-center font-bold w-24">수정·삭제</th>
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
                                className={`px-2.5 py-1 rounded-md text-xs font-bold whitespace-nowrap ${
                                  partner.type === 'CLIENT'
                                    ? 'bg-indigo-50 text-indigo-700 border border-indigo-200'
                                    : 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                                }`}
                              >
                                {partner.type === 'CLIENT' ? '수주 고객사' : '매입 발주처'}
                              </span>
                            </td>
                            <td className="py-3.5 px-4 font-bold text-slate-900 whitespace-nowrap">
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
                                  <strong>{partner.manager}</strong> ({partner.phone})
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

            {/* 2. Standard Kiosk BOM Master Management (CRUD) */}
            <section className="bg-white border border-slate-200 rounded-2xl p-6 shadow-xs space-y-5">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-200 pb-4">
                <div>
                  <h2 className="text-xl font-extrabold text-slate-900 flex items-center gap-2">
                    <Layers className="w-6 h-6 text-violet-600" />
                    키오스크 모델별 표준 BOM 마스터 관리
                  </h2>
                  <p className="text-sm text-slate-500 mt-1">
                    모델별 기본 구성 부품을 추가하거나 삭제할 수 있습니다.
                  </p>
                </div>

                <div className="flex items-center gap-2 flex-wrap">
                  {kioskModels.map((m) => (
                    <button
                      key={m.modelCode}
                      type="button"
                      onClick={() => setSelectedMasterModelCode(m.modelCode)}
                      className={`px-4 py-2 rounded-xl text-sm font-bold cursor-pointer ${
                        selectedMasterModelCode === m.modelCode
                          ? 'bg-violet-600 text-white'
                          : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                      }`}
                    >
                      {m.modelCode} ({m.bom.length}종)
                    </button>
                  ))}
                  <button
                    type="button"
                    onClick={() => setShowAddMasterBomForm((v) => !v)}
                    className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl text-sm font-bold bg-emerald-600 hover:bg-emerald-500 text-white cursor-pointer"
                  >
                    <Plus className="w-4 h-4" />+ 표준 BOM 부품 추가
                  </button>
                </div>
              </div>

              {showAddMasterBomForm && (
                <div className="p-5 rounded-2xl bg-violet-50/70 border border-violet-200 space-y-4">
                  <div className="text-base font-extrabold text-violet-950">
                    [{selectedMasterModelCode}] 모델에 표준 BOM 부품 추가
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-4 gap-3 text-sm">
                    <input
                      type="text"
                      placeholder="부품코드"
                      value={newMasterPart.partCode}
                      onChange={(e) =>
                        setNewMasterPart({ ...newMasterPart, partCode: e.target.value })
                      }
                      className="px-3 py-2.5 rounded-xl bg-white border border-violet-200"
                    />
                    <select
                      value={newMasterPart.category}
                      onChange={(e) =>
                        setNewMasterPart({
                          ...newMasterPart,
                          category: e.target.value as PartCategory,
                        })
                      }
                      className="px-3 py-2.5 rounded-xl bg-white border border-violet-200 font-bold"
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
                      className="sm:col-span-2 px-3 py-2.5 rounded-xl bg-white border border-violet-200 font-bold"
                    />
                    <input
                      type="text"
                      placeholder="상세 규격"
                      value={newMasterPart.spec}
                      onChange={(e) =>
                        setNewMasterPart({ ...newMasterPart, spec: e.target.value })
                      }
                      className="sm:col-span-2 px-3 py-2.5 rounded-xl bg-white border border-violet-200"
                    />
                    <input
                      type="number"
                      min={1}
                      placeholder="대당 소요량"
                      value={newMasterPart.qtyPerUnit}
                      onChange={(e) =>
                        setNewMasterPart({
                          ...newMasterPart,
                          qtyPerUnit: Number(e.target.value) || 1,
                        })
                      }
                      className="px-3 py-2.5 rounded-xl bg-white border border-violet-200 font-bold"
                    />
                    <select
                      value={newMasterPart.supplierId}
                      onChange={(e) =>
                        setNewMasterPart({ ...newMasterPart, supplierId: e.target.value })
                      }
                      className="px-3 py-2.5 rounded-xl bg-white border border-violet-200 font-bold"
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
                      className="px-4 py-2 rounded-xl text-sm font-semibold bg-white border border-slate-300 cursor-pointer"
                    >
                      취소
                    </button>
                    <button
                      type="button"
                      onClick={handleAddMasterBomPart}
                      className="px-5 py-2 rounded-xl text-sm font-bold bg-violet-600 text-white cursor-pointer"
                    >
                      표준 BOM에 저장
                    </button>
                  </div>
                </div>
              )}

              {kioskModels
                .filter((m) => m.modelCode === selectedMasterModelCode)
                .map((model) => (
                  <div
                    key={model.modelCode}
                    className="rounded-xl border border-slate-200 overflow-hidden"
                  >
                    <div className="px-5 py-4 bg-slate-50 border-b border-slate-200 flex items-center justify-between">
                      <div>
                        <span className="px-2.5 py-1 rounded-md text-xs font-mono font-bold bg-violet-100 text-violet-700 mr-2">
                          {model.modelCode}
                        </span>
                        <strong className="text-base font-extrabold text-slate-900">
                          {model.modelName}
                        </strong>
                        <p className="text-sm text-slate-500 mt-0.5">{model.spec}</p>
                      </div>
                    </div>

                    <div className="overflow-x-auto">
                      <table className="w-full min-w-[900px] text-left border-collapse text-sm">
                        <thead>
                          <tr className="bg-slate-100 text-slate-700 border-b border-slate-200 whitespace-nowrap">
                            <th className="py-3 px-4 font-bold">부품코드</th>
                            <th className="py-3 px-4 font-bold">카테고리</th>
                            <th className="py-3 px-4 font-bold">부품명 / 규격</th>
                            <th className="py-3 px-4 text-center font-bold">대당 소요량</th>
                            <th className="py-3 px-4 text-center font-bold">창고 현재고</th>
                            <th className="py-3 px-4 font-bold">지정 발주처</th>
                            <th className="py-3 px-3 text-center font-bold w-16">삭제</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-200">
                          {model.bom.map((part) => (
                            <tr key={part.partCode} className="hover:bg-slate-50">
                              <td className="py-3.5 px-4 font-mono text-indigo-600 font-bold whitespace-nowrap">
                                {part.partCode}
                              </td>
                              <td className="py-3.5 px-4 whitespace-nowrap">
                                <span className="px-2.5 py-0.5 rounded-md bg-slate-100 text-slate-700 font-semibold text-xs whitespace-nowrap">
                                  {part.category}
                                </span>
                              </td>
                              <td className="py-3.5 px-4 break-keep">
                                <div className="font-bold text-slate-900">{part.partName}</div>
                                <div className="text-xs text-slate-500">{part.spec}</div>
                              </td>
                              <td className="py-3.5 px-4 text-center font-extrabold text-slate-900 whitespace-nowrap">
                                {part.qtyPerUnit} {part.unit}
                              </td>
                              <td className="py-3.5 px-4 text-center text-emerald-600 font-bold whitespace-nowrap">
                                {part.stockQty} {part.unit}
                              </td>
                              <td className="py-3.5 px-4 whitespace-nowrap">
                                <div className="font-bold text-slate-800">{part.supplierName}</div>
                                <div className="text-xs text-slate-500">
                                  {part.supplierManager} ({part.supplierPhone})
                                </div>
                              </td>
                              <td className="py-3.5 px-3 text-center">
                                <button
                                  type="button"
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
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                ))}
            </section>
          </div>
        )}
      </main>

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
