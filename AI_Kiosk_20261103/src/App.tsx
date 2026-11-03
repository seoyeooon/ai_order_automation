import { useMemo, useRef, useState } from 'react'
import {
  ArrowRight,
  Boxes,
  Building2,
  CheckCircle2,
  ClipboardList,
  Cpu,
  Download,
  Eye,
  FileCheck2,
  FileSpreadsheet,
  FileText,
  Layers,
  Mail,
  PackageCheck,
  Plus,
  RefreshCw,
  ScanLine,
  Sparkles,
  Trash2,
  UploadCloud,
} from 'lucide-react'
import { PurchaseOrderModal } from './components/PurchaseOrderModal'
import { KIOSK_MODELS, SAMPLE_CLIENT_ORDERS } from './data/mockData'
import type { ClientOrder, GeneratedPurchaseOrder, PartCategory } from './types/order'
import {
  downloadPurchaseOrderCsv,
  expandBomFromOrder,
  generatePurchaseOrders,
} from './utils/orderUtils'

const CATEGORIES: ('전체' | PartCategory)[] = [
  '전체',
  '디스플레이/터치',
  '메인보드/PC',
  '결제/리더기',
  '프린터/스캐너',
  '함체/기구물',
  '전원/케이블',
]

function App() {
  const [activeTab, setActiveTab] = useState<'WORKFLOW' | 'BOM_MASTER'>('WORKFLOW')
  const [clientOrder, setClientOrder] = useState<ClientOrder>(SAMPLE_CLIENT_ORDERS[0].order)
  const [selectedSampleIdx, setSelectedSampleIdx] = useState<number>(0)

  // AI Scanning simulation states
  const [isScanning, setIsScanning] = useState<boolean>(false)
  const [scanProgress, setScanProgress] = useState<number>(100)
  const [scanStageText, setScanStageText] = useState<string>(
    'AI 스캔 완료 · BOM 자동 전개 및 매입 발주서 5건 생성됨'
  )
  const [isDragging, setIsDragging] = useState<boolean>(false)
  const fileInputRef = useRef<HTMLInputElement | null>(null)

  // BOM Options
  const [deductStock, setDeductStock] = useState<boolean>(true)
  const [selectedCategory, setSelectedCategory] = useState<'전체' | PartCategory>('전체')
  const [manualOverrides, setManualOverrides] = useState<Record<string, number>>({})

  // PO Modal & Download states
  const [previewPo, setPreviewPo] = useState<GeneratedPurchaseOrder | null>(null)
  const [poStatusMap, setPoStatusMap] = useState<Record<string, 'READY' | 'DOWNLOADED' | 'SENT'>>({})
  const [toastMessage, setToastMessage] = useState<string | null>(null)

  const showToast = (msg: string) => {
    setToastMessage(msg)
    setTimeout(() => {
      setToastMessage((prev) => (prev === msg ? null : prev))
    }, 3200)
  }

  // Trigger simulated AI OCR Scan
  const triggerAiScan = (targetOrder: ClientOrder, customFileName?: string) => {
    setIsScanning(true)
    setScanProgress(12)
    setScanStageText('1/4 문서 레이아웃 및 표 구조 AI 비전 분석 중...')
    setManualOverrides({})
    setPoStatusMap({})

    setTimeout(() => {
      setScanProgress(42)
      setScanStageText('2/4 발주 거래처 정보·납기일·담당자 OCR 추출 중...')
    }, 350)

    setTimeout(() => {
      setScanProgress(76)
      setScanStageText('3/4 수주 키오스크 모델명·수량 매칭 및 하위 BOM 자동 전개 중...')
    }, 700)

    setTimeout(() => {
      const updatedOrder: ClientOrder = customFileName
        ? {
            ...targetOrder,
            sourceFileName: customFileName,
            orderNo: `SO-2026-1103-${Math.floor(10 + Math.random() * 89)}`,
            confidenceScore: Number((98.4 + Math.random() * 1.4).toFixed(1)),
          }
        : targetOrder

      setClientOrder(updatedOrder)
      setScanProgress(100)
      setIsScanning(false)
      setScanStageText(
        `AI 스캔 완료 (${updatedOrder.sourceFileName}) · BOM 전개 및 발주처별 발주서 자동 생성 완료`
      )
      showToast(`"${updatedOrder.sourceFileName}" 스캔 및 BOM·발주서 자동 생성이 완료되었습니다.`)
    }, 1100)
  }

  const handleFileUpload = (file: File | undefined) => {
    if (!file) return
    const matchedSample =
      file.name.includes('병원') || file.name.includes('32')
        ? SAMPLE_CLIENT_ORDERS[1].order
        : file.name.includes('시네마') || file.name.includes('영화')
          ? SAMPLE_CLIENT_ORDERS[2].order
          : SAMPLE_CLIENT_ORDERS[selectedSampleIdx].order

    triggerAiScan(matchedSample, file.name)
  }

  // Derived BOM & PO calculations
  const expandedBom = useMemo(
    () => expandBomFromOrder(clientOrder, KIOSK_MODELS, deductStock, manualOverrides),
    [clientOrder, deductStock, manualOverrides]
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

  // Summary counts
  const totalKioskCount = useMemo(
    () => clientOrder.items.reduce((sum, item) => sum + item.quantity, 0),
    [clientOrder.items]
  )
  const totalGrossBomParts = useMemo(
    () => expandedBom.reduce((sum, item) => sum + item.grossRequiredQty, 0),
    [expandedBom]
  )
  const totalActualOrderParts = useMemo(
    () => expandedBom.reduce((sum, item) => sum + item.adjustedOrderQty, 0),
    [expandedBom]
  )

  // Handlers for editing order items
  const handleQuantityChange = (itemId: string, newQty: number) => {
    const clamped = Math.max(1, Math.min(999, newQty))
    setClientOrder((prev) => ({
      ...prev,
      items: prev.items.map((it) => (it.id === itemId ? { ...it, quantity: clamped } : it)),
    }))
  }

  const handleModelChange = (itemId: string, newModelCode: string) => {
    const model = KIOSK_MODELS.find((m) => m.modelCode === newModelCode)
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
    const defaultModel = KIOSK_MODELS[0]
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

  const handleDownloadSinglePo = (po: GeneratedPurchaseOrder) => {
    downloadPurchaseOrderCsv(po, clientOrder)
    setPoStatusMap((prev) => ({ ...prev, [po.poNumber]: 'DOWNLOADED' }))
    showToast(`${po.fileName} 파일이 다운로드되었습니다.`)
  }

  const handleDownloadAllPos = () => {
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
    showToast(`총 ${purchaseOrders.length}건의 매입 발주서 파일 일괄 다운로드를 시작했습니다.`)
  }

  const handleSendPoEmail = (po: GeneratedPurchaseOrder) => {
    setPoStatusMap((prev) => ({ ...prev, [po.poNumber]: 'SENT' }))
    showToast(`${po.supplierName} (${po.supplierEmail}) 앞으로 발주서 발송 요청이 완료되었습니다.`)
  }

  return (
    <div className="min-h-screen bg-slate-50 text-slate-800 flex flex-col selection:bg-indigo-600 selection:text-white">
      {/* Toast Notification */}
      {toastMessage && (
        <div className="fixed bottom-6 right-6 z-50 flex items-center gap-2.5 px-4 py-3 rounded-xl bg-slate-900 text-white text-sm font-medium shadow-xl border border-slate-700 animate-bounce">
          <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
          <span>{toastMessage}</span>
        </div>
      )}

      {/* Top Navigation Header */}
      <header className="sticky top-0 z-30 border-b border-slate-200/90 bg-white/90 backdrop-blur-md shadow-2xs">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-indigo-600 to-violet-600 flex items-center justify-center shadow-md shadow-indigo-500/20">
              <Cpu className="w-5 h-5 text-white" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-base sm:text-lg font-extrabold tracking-tight text-slate-900">
                  AI Kiosk SCM Auto-Order
                </h1>
                <span className="hidden sm:inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-indigo-50 text-indigo-700 border border-indigo-200">
                  <Sparkles className="w-3 h-3" />
                  AI OCR + BOM 자동화
                </span>
              </div>
              <p className="text-xs text-slate-500 hidden sm:block">
                AI 기반 키오스크 수주 스캔 · BOM 전개 · 매입 발주서 자동 생성 시스템
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setActiveTab('WORKFLOW')}
              className={`px-3.5 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                activeTab === 'WORKFLOW'
                  ? 'bg-indigo-600 text-white shadow-sm shadow-indigo-600/20'
                  : 'bg-white text-slate-600 hover:bg-slate-100 border border-slate-200'
              }`}
            >
              자동화 발주 워크플로우
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('BOM_MASTER')}
              className={`px-3.5 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                activeTab === 'BOM_MASTER'
                  ? 'bg-indigo-600 text-white shadow-sm shadow-indigo-600/20'
                  : 'bg-white text-slate-600 hover:bg-slate-100 border border-slate-200'
              }`}
            >
              표준 키오스크 BOM 마스터 ({KIOSK_MODELS.length}종)
            </button>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-6">
        {/* Top KPI Summary Cards */}
        <section className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="bg-white border border-slate-200/90 rounded-2xl p-4 shadow-2xs flex items-center justify-between">
            <div>
              <p className="text-xs text-slate-500 font-semibold">발주 거래처 (고객사)</p>
              <p className="text-base sm:text-lg font-extrabold text-slate-900 mt-1 truncate max-w-[170px]">
                {clientOrder.clientName}
              </p>
              <p className="text-[11px] text-indigo-600 font-medium mt-1">
                납기요청일: {clientOrder.deliveryDate}
              </p>
            </div>
            <div className="p-3 rounded-xl bg-indigo-50 text-indigo-600 border border-indigo-100">
              <Building2 className="w-6 h-6" />
            </div>
          </div>

          <div className="bg-white border border-slate-200/90 rounded-2xl p-4 shadow-2xs flex items-center justify-between">
            <div>
              <p className="text-xs text-slate-500 font-semibold">수주 키오스크 총 수량</p>
              <p className="text-2xl font-extrabold text-slate-900 mt-1">
                {totalKioskCount.toLocaleString()}대
              </p>
              <p className="text-[11px] text-slate-500 font-medium mt-1">
                주문 모델 {clientOrder.items.length}종
              </p>
            </div>
            <div className="p-3 rounded-xl bg-blue-50 text-blue-600 border border-blue-100">
              <FileText className="w-6 h-6" />
            </div>
          </div>

          <div className="bg-white border border-slate-200/90 rounded-2xl p-4 shadow-2xs flex items-center justify-between">
            <div>
              <p className="text-xs text-slate-500 font-semibold">전개된 BOM 부품 소요량</p>
              <p className="text-2xl font-extrabold text-violet-700 mt-1">
                {totalActualOrderParts.toLocaleString()}개
              </p>
              <p className="text-[11px] text-slate-500 font-medium mt-1">
                부품 {expandedBom.length}종 (총소요 {totalGrossBomParts}개)
              </p>
            </div>
            <div className="p-3 rounded-xl bg-violet-50 text-violet-600 border border-violet-100">
              <Boxes className="w-6 h-6" />
            </div>
          </div>

          <div className="bg-white border border-slate-200/90 rounded-2xl p-4 shadow-2xs flex items-center justify-between">
            <div>
              <p className="text-xs text-slate-500 font-semibold">자동 생성된 매입 발주서</p>
              <p className="text-2xl font-extrabold text-emerald-600 mt-1">
                {purchaseOrders.length}개 파일
              </p>
              <p className="text-[11px] text-emerald-700 font-medium mt-1">
                발주처별 자동 분류 완료
              </p>
            </div>
            <div className="p-3 rounded-xl bg-emerald-50 text-emerald-600 border border-emerald-100">
              <FileSpreadsheet className="w-6 h-6" />
            </div>
          </div>
        </section>

        {activeTab === 'BOM_MASTER' ? (
          /* BOM MASTER VIEW */
          <section className="space-y-6">
            <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-2xs">
              <h2 className="text-lg font-extrabold text-slate-900 flex items-center gap-2">
                <Layers className="w-5 h-5 text-indigo-600" />
                키오스크 모델별 표준 BOM (자재명세서) 마스터
              </h2>
              <p className="text-xs text-slate-500 mt-1">
                수주 발주서에서 모델명이 인식되면 아래의 표준 BOM 구성 부품과 지정 발주처(공급사) 정보가 자동으로 매칭되어 전개됩니다.
              </p>

              <div className="mt-6 space-y-6">
                {KIOSK_MODELS.map((model) => {
                  const totalPartsPerUnit = model.bom.reduce((s, p) => s + p.qtyPerUnit, 0)
                  return (
                    <div
                      key={model.modelCode}
                      className="rounded-xl border border-slate-200 bg-white overflow-hidden"
                    >
                      <div className="px-5 py-4 bg-slate-50 border-b border-slate-200 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                        <div>
                          <div className="flex items-center gap-2.5">
                            <span className="px-2.5 py-0.5 rounded-md text-xs font-mono font-bold bg-indigo-100 text-indigo-700 border border-indigo-200">
                              {model.modelCode}
                            </span>
                            <h3 className="font-bold text-slate-900 text-sm sm:text-base">
                              {model.modelName}
                            </h3>
                          </div>
                          <p className="text-xs text-slate-500 mt-1">{model.spec}</p>
                        </div>
                        <div className="text-right text-xs space-y-0.5">
                          <div className="text-slate-600">
                            구성 부품 종류: <strong className="text-slate-900">{model.bom.length}종</strong>
                          </div>
                          <div className="text-slate-600">
                            1대당 총 투입 수량:{' '}
                            <strong className="text-indigo-600">{totalPartsPerUnit} EA/SET</strong>
                          </div>
                        </div>
                      </div>

                      <div className="overflow-x-auto">
                        <table className="w-full text-left border-collapse text-xs">
                          <thead>
                            <tr className="bg-slate-50/70 text-slate-500 border-b border-slate-200">
                              <th className="py-2.5 px-4 font-semibold">부품코드</th>
                              <th className="py-2.5 px-4 font-semibold">카테고리</th>
                              <th className="py-2.5 px-4 font-semibold">부품명 / 규격</th>
                              <th className="py-2.5 px-4 text-center font-semibold">대당 소요량</th>
                              <th className="py-2.5 px-4 text-center font-semibold">현재고</th>
                              <th className="py-2.5 px-4 font-semibold">지정 발주처 (공급사)</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-slate-200/80">
                            {model.bom.map((part) => (
                              <tr key={part.partCode} className="hover:bg-slate-50/80">
                                <td className="py-3 px-4 font-mono text-indigo-600 font-bold">
                                  {part.partCode}
                                </td>
                                <td className="py-3 px-4">
                                  <span className="px-2 py-0.5 rounded-md bg-slate-100 text-slate-700 font-medium text-[11px]">
                                    {part.category}
                                  </span>
                                </td>
                                <td className="py-3 px-4">
                                  <div className="font-semibold text-slate-900">{part.partName}</div>
                                  <div className="text-[11px] text-slate-500">{part.spec}</div>
                                </td>
                                <td className="py-3 px-4 text-center font-bold text-slate-900">
                                  {part.qtyPerUnit} {part.unit}
                                </td>
                                <td className="py-3 px-4 text-center text-emerald-600 font-semibold">
                                  {part.stockQty} {part.unit}
                                </td>
                                <td className="py-3 px-4">
                                  <div className="font-semibold text-slate-800">
                                    {part.supplierName}
                                  </div>
                                  <div className="text-[11px] text-slate-500">
                                    {part.supplierManager} ({part.supplierPhone}) · 리드타임{' '}
                                    {part.leadTimeDays}일
                                  </div>
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          </section>
        ) : (
          /* AUTOMATION WORKFLOW VIEW */
          <>
            {/* 3-Step Pipeline Banner */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3 bg-white border border-slate-200 rounded-2xl p-3 shadow-2xs">
              <div className="flex items-center gap-3 p-3 rounded-xl bg-indigo-50/70 border border-indigo-100">
                <div className="w-8 h-8 rounded-lg bg-indigo-600 text-white font-bold text-sm flex items-center justify-center shrink-0 shadow-xs">
                  1
                </div>
                <div className="min-w-0 flex-1">
                  <div className="text-xs font-extrabold text-indigo-700 uppercase tracking-wide">
                    STEP 1 · 수주 발주서 AI 스캔
                  </div>
                  <div className="text-xs text-slate-600 truncate mt-0.5">
                    거래처 발주서 업로드 → 제품명·수량·정보 추출
                  </div>
                </div>
                <ArrowRight className="w-4 h-4 text-indigo-400 hidden md:block shrink-0" />
              </div>

              <div className="flex items-center gap-3 p-3 rounded-xl bg-violet-50/70 border border-violet-100">
                <div className="w-8 h-8 rounded-lg bg-violet-600 text-white font-bold text-sm flex items-center justify-center shrink-0 shadow-xs">
                  2
                </div>
                <div className="min-w-0 flex-1">
                  <div className="text-xs font-extrabold text-violet-700 uppercase tracking-wide">
                    STEP 2 · 제품별 BOM 자동 전개
                  </div>
                  <div className="text-xs text-slate-600 truncate mt-0.5">
                    하위 부품 리스트·소요 수량·발주처 자동 매칭
                  </div>
                </div>
                <ArrowRight className="w-4 h-4 text-violet-400 hidden md:block shrink-0" />
              </div>

              <div className="flex items-center gap-3 p-3 rounded-xl bg-emerald-50/70 border border-emerald-100">
                <div className="w-8 h-8 rounded-lg bg-emerald-600 text-white font-bold text-sm flex items-center justify-center shrink-0 shadow-xs">
                  3
                </div>
                <div className="min-w-0 flex-1">
                  <div className="text-xs font-extrabold text-emerald-700 uppercase tracking-wide">
                    STEP 3 · 매입 발주서 파일 자동 생성
                  </div>
                  <div className="text-xs text-slate-600 truncate mt-0.5">
                    발주처별 구매발주서(PO) 파일 일괄 생성·다운로드
                  </div>
                </div>
              </div>
            </div>

            {/* ================= STEP 1: CLIENT ORDER UPLOAD & AI OCR SCAN ================= */}
            <section className="bg-white border border-slate-200 rounded-2xl overflow-hidden shadow-2xs">
              <div className="px-6 py-4 bg-slate-50/80 border-b border-slate-200 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div className="flex items-center gap-2.5">
                  <span className="px-2.5 py-1 rounded-lg text-xs font-extrabold bg-indigo-600 text-white">
                    STEP 1
                  </span>
                  <div>
                    <h2 className="text-base font-extrabold text-slate-900 flex items-center gap-2">
                      거래처 수주 발주서 업로드 & AI 자동 스캔
                    </h2>
                    <p className="text-xs text-slate-500">
                      거래처에서 받은 발주서(PDF, 이미지, 엑셀)를 넣으면 AI가 거래처 정보와 제품명·수량을 자동으로 스캔합니다.
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-xs text-slate-500 font-medium mr-1">샘플 발주서 테스트:</span>
                  {SAMPLE_CLIENT_ORDERS.map((sample, idx) => (
                    <button
                      key={sample.order.orderNo}
                      type="button"
                      onClick={() => {
                        setSelectedSampleIdx(idx)
                        triggerAiScan(sample.order)
                      }}
                      className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer border ${
                        selectedSampleIdx === idx
                          ? 'bg-indigo-600 text-white border-indigo-600 shadow-xs'
                          : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-100'
                      }`}
                    >
                      {sample.badge}
                    </button>
                  ))}
                </div>
              </div>

              <div className="p-6 grid grid-cols-1 lg:grid-cols-12 gap-6">
                {/* Left: Upload Dropzone & AI Scan Status (4 cols) */}
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
                    className={`flex-1 flex flex-col items-center justify-center p-6 rounded-2xl border-2 border-dashed transition-all cursor-pointer text-center ${
                      isDragging
                        ? 'border-indigo-500 bg-indigo-50/70'
                        : 'border-slate-300 hover:border-indigo-400 bg-slate-50/60 hover:bg-indigo-50/30'
                    }`}
                  >
                    <input
                      ref={fileInputRef}
                      type="file"
                      accept=".pdf,.png,.jpg,.jpeg,.xlsx,.xls,.csv"
                      className="hidden"
                      onChange={(e) => handleFileUpload(e.target.files?.[0])}
                    />
                    <div className="w-14 h-14 rounded-2xl bg-indigo-50 border border-indigo-100 flex items-center justify-center text-indigo-600 mb-3 shadow-2xs">
                      {isScanning ? (
                        <RefreshCw className="w-7 h-7 animate-spin" />
                      ) : (
                        <UploadCloud className="w-7 h-7" />
                      )}
                    </div>
                    <p className="text-sm font-bold text-slate-800">
                      거래처 발주서 파일을 이곳에 드래그하거나 클릭하여 업로드
                    </p>
                    <p className="text-xs text-slate-500 mt-1">
                      지원 포맷: PDF, 이미지(JPG/PNG), Excel(XLSX/CSV)
                    </p>

                    <div className="mt-4 w-full px-3.5 py-2.5 rounded-xl bg-white border border-slate-200 flex items-center justify-between text-xs shadow-2xs">
                      <span className="flex items-center gap-2 text-slate-700 font-medium truncate">
                        <FileCheck2 className="w-4 h-4 text-emerald-600 shrink-0" />
                        <span className="truncate">{clientOrder.sourceFileName}</span>
                      </span>
                      <span className="ml-2 px-2 py-0.5 rounded-md bg-emerald-50 text-emerald-700 border border-emerald-200 font-mono font-bold text-[11px] shrink-0">
                        인식률 {clientOrder.confidenceScore}%
                      </span>
                    </div>
                  </div>

                  {/* AI OCR Progress Box */}
                  <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 space-y-2.5">
                    <div className="flex items-center justify-between text-xs">
                      <span className="font-bold text-indigo-700 flex items-center gap-1.5">
                        <ScanLine className="w-4 h-4" />
                        AI 발주서 스캔 상태
                      </span>
                      <span className="font-mono font-bold text-slate-900">{scanProgress}%</span>
                    </div>
                    <div className="w-full h-2 rounded-full bg-slate-200 overflow-hidden">
                      <div
                        className="h-full bg-gradient-to-r from-indigo-600 via-violet-500 to-emerald-500 transition-all duration-300"
                        style={{ width: `${scanProgress}%` }}
                      />
                    </div>
                    <p className="text-[11px] text-slate-600 font-medium">{scanStageText}</p>
                  </div>
                </div>

                {/* Right: Extracted Client Metadata & Ordered Kiosk Items (8 cols) */}
                <div className="lg:col-span-8 space-y-5">
                  {/* Extracted Client Info Grid */}
                  <div className="p-5 rounded-xl bg-slate-50/70 border border-slate-200 space-y-3">
                    <div className="flex items-center justify-between">
                      <h3 className="text-xs font-extrabold uppercase tracking-wider text-indigo-700 flex items-center gap-1.5">
                        <Building2 className="w-4 h-4" />
                        스캔된 발주 거래처(고객사) 정보 (수정 가능)
                      </h3>
                      <span className="text-[11px] font-mono font-semibold text-slate-500">
                        수주번호: {clientOrder.orderNo}
                      </span>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
                      <div>
                        <label className="block text-slate-600 font-medium mb-1">발주 거래처명</label>
                        <input
                          type="text"
                          value={clientOrder.clientName}
                          onChange={(e) =>
                            setClientOrder({ ...clientOrder, clientName: e.target.value })
                          }
                          className="w-full px-3 py-2 rounded-lg bg-white border border-slate-300 text-slate-900 font-semibold focus:outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/15"
                        />
                      </div>
                      <div>
                        <label className="block text-slate-600 font-medium mb-1">사업자등록번호</label>
                        <input
                          type="text"
                          value={clientOrder.businessNo}
                          onChange={(e) =>
                            setClientOrder({ ...clientOrder, businessNo: e.target.value })
                          }
                          className="w-full px-3 py-2 rounded-lg bg-white border border-slate-300 text-slate-900 font-mono focus:outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/15"
                        />
                      </div>
                      <div>
                        <label className="block text-slate-600 font-medium mb-1">
                          거래처 담당자 / 연락처
                        </label>
                        <input
                          type="text"
                          value={`${clientOrder.managerName} (${clientOrder.managerPhone})`}
                          onChange={(e) =>
                            setClientOrder({ ...clientOrder, managerName: e.target.value })
                          }
                          className="w-full px-3 py-2 rounded-lg bg-white border border-slate-300 text-slate-900 focus:outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/15"
                        />
                      </div>
                      <div>
                        <label className="block text-slate-600 font-medium mb-1">발주일자</label>
                        <input
                          type="date"
                          value={clientOrder.orderDate}
                          onChange={(e) =>
                            setClientOrder({ ...clientOrder, orderDate: e.target.value })
                          }
                          className="w-full px-3 py-2 rounded-lg bg-white border border-slate-300 text-slate-900 focus:outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/15"
                        />
                      </div>
                      <div>
                        <label className="block text-slate-600 font-medium mb-1">납기요청일</label>
                        <input
                          type="date"
                          value={clientOrder.deliveryDate}
                          onChange={(e) =>
                            setClientOrder({ ...clientOrder, deliveryDate: e.target.value })
                          }
                          className="w-full px-3 py-2 rounded-lg bg-white border border-slate-300 text-slate-900 focus:outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/15"
                        />
                      </div>
                      <div>
                        <label className="block text-slate-600 font-medium mb-1">납품 장소</label>
                        <input
                          type="text"
                          value={clientOrder.deliveryAddress}
                          onChange={(e) =>
                            setClientOrder({ ...clientOrder, deliveryAddress: e.target.value })
                          }
                          className="w-full px-3 py-2 rounded-lg bg-white border border-slate-300 text-slate-900 focus:outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/15"
                        />
                      </div>
                    </div>
                  </div>

                  {/* Extracted Order Products Table */}
                  <div className="p-5 rounded-xl bg-slate-50/70 border border-slate-200 space-y-3">
                    <div className="flex items-center justify-between">
                      <h3 className="text-xs font-extrabold uppercase tracking-wider text-indigo-700 flex items-center gap-1.5">
                        <ClipboardList className="w-4 h-4" />
                        스캔된 주문 키오스크 제품 및 수량 (수량 변경 시 하단 BOM·발주서 실시간 연동)
                      </h3>
                      <button
                        type="button"
                        onClick={handleAddOrderItem}
                        className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-bold bg-indigo-50 hover:bg-indigo-100 text-indigo-700 border border-indigo-200 transition-colors cursor-pointer"
                      >
                        <Plus className="w-3.5 h-3.5" />
                        제품 행 추가
                      </button>
                    </div>

                    <div className="overflow-x-auto bg-white rounded-xl border border-slate-200">
                      <table className="w-full text-left border-collapse text-xs">
                        <thead>
                          <tr className="bg-slate-50 border-b border-slate-200 text-slate-600">
                            <th className="py-2.5 px-3 font-semibold">키오스크 모델 선택</th>
                            <th className="py-2.5 px-3 font-semibold">규격 및 사양 요약</th>
                            <th className="py-2.5 px-3 text-center font-semibold w-40">주문 수량</th>
                            <th className="py-2.5 px-2 text-center font-semibold w-12">삭제</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-200/80">
                          {clientOrder.items.map((item) => (
                            <tr key={item.id} className="hover:bg-slate-50/70">
                              <td className="py-3 px-3">
                                <select
                                  value={item.modelCode}
                                  onChange={(e) => handleModelChange(item.id, e.target.value)}
                                  className="w-full px-2.5 py-1.5 rounded-lg bg-white border border-slate-300 text-slate-900 font-semibold focus:outline-none focus:border-indigo-500"
                                >
                                  {KIOSK_MODELS.map((m) => (
                                    <option key={m.modelCode} value={m.modelCode}>
                                      [{m.modelCode}] {m.modelName}
                                    </option>
                                  ))}
                                </select>
                              </td>
                              <td className="py-3 px-3 text-slate-600">{item.spec}</td>
                              <td className="py-3 px-3">
                                <div className="flex items-center justify-center gap-1.5">
                                  <button
                                    type="button"
                                    onClick={() => handleQuantityChange(item.id, item.quantity - 1)}
                                    className="w-7 h-7 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold cursor-pointer border border-slate-200"
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
                                    className="w-16 text-center py-1 rounded-lg bg-white border border-slate-300 text-slate-900 font-extrabold"
                                  />
                                  <button
                                    type="button"
                                    onClick={() => handleQuantityChange(item.id, item.quantity + 1)}
                                    className="w-7 h-7 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold cursor-pointer border border-slate-200"
                                  >
                                    +
                                  </button>
                                  <span className="text-slate-500 font-medium ml-0.5">대</span>
                                </div>
                              </td>
                              <td className="py-3 px-2 text-center">
                                <button
                                  type="button"
                                  onClick={() => handleRemoveOrderItem(item.id)}
                                  className="p-1.5 rounded-lg hover:bg-rose-50 text-slate-400 hover:text-rose-600 transition-colors cursor-pointer"
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
            </section>

            {/* ================= STEP 2: AUTOMATIC BOM EXPANSION ================= */}
            <section className="bg-white border border-slate-200 rounded-2xl overflow-hidden shadow-2xs">
              <div className="px-6 py-4 bg-slate-50/80 border-b border-slate-200 flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div className="flex items-center gap-2.5">
                  <span className="px-2.5 py-1 rounded-lg text-xs font-extrabold bg-violet-600 text-white">
                    STEP 2
                  </span>
                  <div>
                    <h2 className="text-base font-extrabold text-slate-900 flex items-center gap-2">
                      제품별 BOM(자재명세서) 자동 전개 및 부품 소요량 산출
                      <span className="text-xs px-2.5 py-0.5 rounded-full bg-violet-50 text-violet-700 border border-violet-200 font-bold">
                        총 {expandedBom.length}종 부품 자동 산출됨
                      </span>
                    </h2>
                    <p className="text-xs text-slate-500">
                      인식된 키오스크 모델과 주문 수량({totalKioskCount}대)에 맞춰 필요한 하위 부품과 지정 발주처가 자동으로 펼쳐집니다.
                    </p>
                  </div>
                </div>

                {/* Stock Deduction Toggle */}
                <div className="flex items-center gap-3">
                  <label className="inline-flex items-center gap-2 text-xs font-semibold text-slate-700 cursor-pointer select-none bg-white px-3.5 py-2 rounded-xl border border-slate-200 shadow-2xs">
                    <input
                      type="checkbox"
                      checked={deductStock}
                      onChange={(e) => setDeductStock(e.target.checked)}
                      className="rounded accent-violet-600 w-4 h-4"
                    />
                    <span>창고 현재고 자동 차감 (순소요량 계산)</span>
                  </label>
                </div>
              </div>

              {/* Category Filter Bar */}
              <div className="px-6 py-3 bg-white border-b border-slate-200 flex items-center justify-between flex-wrap gap-2">
                <div className="flex items-center gap-1.5 flex-wrap">
                  {CATEGORIES.map((cat) => (
                    <button
                      key={cat}
                      type="button"
                      onClick={() => setSelectedCategory(cat)}
                      className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-colors cursor-pointer ${
                        selectedCategory === cat
                          ? 'bg-violet-600 text-white shadow-2xs'
                          : 'bg-slate-100 text-slate-600 hover:bg-slate-200/70'
                      }`}
                    >
                      {cat}
                    </button>
                  ))}
                </div>
                {Object.keys(manualOverrides).length > 0 && (
                  <button
                    type="button"
                    onClick={() => setManualOverrides({})}
                    className="text-xs font-semibold text-violet-600 hover:text-violet-800 underline cursor-pointer"
                  >
                    수량 수동조정 초기화
                  </button>
                )}
              </div>

              {/* BOM Table */}
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse text-xs">
                  <thead>
                    <tr className="bg-slate-50 text-slate-600 border-b border-slate-200">
                      <th className="py-3 px-4 font-semibold">부품코드 / 카테고리</th>
                      <th className="py-3 px-4 font-semibold">부품명 및 규격</th>
                      <th className="py-3 px-4 font-semibold">산출 근거 (적용 키오스크)</th>
                      <th className="py-3 px-4 text-right font-semibold">총 필요수량</th>
                      <th className="py-3 px-4 text-right font-semibold">창고 현재고</th>
                      <th className="py-3 px-4 text-center font-semibold w-40">실제 발주수량</th>
                      <th className="py-3 px-4 font-semibold">매입 발주처 (공급사)</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200/80">
                    {filteredBom.map((part) => (
                      <tr key={part.partCode} className="hover:bg-slate-50/80 transition-colors">
                        <td className="py-3.5 px-4">
                          <div className="font-mono font-bold text-indigo-600">{part.partCode}</div>
                          <span className="inline-block mt-1 px-2 py-0.5 rounded-md text-[10px] font-semibold bg-slate-100 text-slate-600">
                            {part.category}
                          </span>
                        </td>
                        <td className="py-3.5 px-4">
                          <div className="font-bold text-slate-900">{part.partName}</div>
                          <div className="text-[11px] text-slate-500 mt-0.5">{part.spec}</div>
                        </td>
                        <td className="py-3.5 px-4">
                          <div className="flex flex-wrap gap-1">
                            {part.sourceModels.map((m) => (
                              <span
                                key={m.modelCode}
                                className="px-2 py-0.5 rounded-md bg-indigo-50 text-indigo-700 border border-indigo-100 font-medium text-[11px]"
                              >
                                {m.modelCode}: {m.orderQty}대 × {part.qtyPerUnit} = {m.subTotalQty}
                                {part.unit}
                              </span>
                            ))}
                          </div>
                        </td>
                        <td className="py-3.5 px-4 text-right font-mono font-bold text-slate-700">
                          {part.grossRequiredQty.toLocaleString()} {part.unit}
                        </td>
                        <td className="py-3.5 px-4 text-right font-mono font-semibold text-emerald-600">
                          {deductStock ? `-${part.stockQty}` : part.stockQty} {part.unit}
                        </td>
                        <td className="py-3.5 px-4">
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
                              className="w-20 text-center py-1 rounded-lg bg-violet-50/50 border border-violet-300 text-violet-900 font-extrabold focus:outline-none focus:border-violet-600"
                            />
                            <span className="text-slate-500 font-medium text-[11px]">
                              {part.unit}
                            </span>
                          </div>
                        </td>
                        <td className="py-3.5 px-4">
                          <div className="font-bold text-slate-900">{part.supplierName}</div>
                          <div className="text-[11px] text-slate-500">
                            {part.supplierManager} ({part.supplierPhone}) · 리드타임{' '}
                            {part.leadTimeDays}일
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>

            {/* ================= STEP 3: GENERATED PURCHASE ORDERS BY SUPPLIER ================= */}
            <section className="bg-white border border-slate-200 rounded-2xl overflow-hidden shadow-2xs">
              <div className="px-6 py-4 bg-slate-50/80 border-b border-slate-200 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div className="flex items-center gap-2.5">
                  <span className="px-2.5 py-1 rounded-lg text-xs font-extrabold bg-emerald-600 text-white">
                    STEP 3
                  </span>
                  <div>
                    <h2 className="text-base font-extrabold text-slate-900 flex items-center gap-2">
                      발주처별 매입 발주서(PO) 파일 자동 생성 완료
                      <span className="text-xs px-2.5 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200 font-bold">
                        총 {purchaseOrders.length}개 발주처 파일
                      </span>
                    </h2>
                    <p className="text-xs text-slate-500">
                      전개된 BOM 부품들을 각 매입 발주처(공급업체)별로 자동 분류하여 표준 구매발주서 파일을 생성했습니다.
                    </p>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={handleDownloadAllPos}
                  className="inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl text-xs font-bold bg-emerald-600 hover:bg-emerald-500 text-white shadow-sm shadow-emerald-600/20 transition-all cursor-pointer shrink-0"
                >
                  <Download className="w-4 h-4" />
                  생성된 발주서 파일 전체 일괄 다운로드 ({purchaseOrders.length}건)
                </button>
              </div>

              <div className="p-6 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5 bg-slate-50/40">
                {purchaseOrders.map((po) => (
                  <div
                    key={po.poNumber}
                    className="flex flex-col justify-between rounded-2xl bg-white border border-slate-200 hover:border-emerald-400 hover:shadow-md transition-all p-5 space-y-4 shadow-2xs"
                  >
                    <div className="space-y-3">
                      {/* File Badge & Status */}
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex items-center gap-2.5 min-w-0">
                          <div className="p-2.5 rounded-xl bg-emerald-50 text-emerald-600 border border-emerald-100 shrink-0">
                            <FileSpreadsheet className="w-5 h-5" />
                          </div>
                          <div className="min-w-0">
                            <span className="text-[11px] font-mono font-bold text-emerald-600 block">
                              {po.poNumber}
                            </span>
                            <h3 className="text-sm font-extrabold text-slate-900 truncate">
                              {po.supplierName}
                            </h3>
                          </div>
                        </div>

                        <span
                          className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold shrink-0 ${
                            po.status === 'SENT'
                              ? 'bg-indigo-50 text-indigo-700 border border-indigo-200'
                              : po.status === 'DOWNLOADED'
                                ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                                : 'bg-amber-50 text-amber-700 border border-amber-200'
                          }`}
                        >
                          {po.status === 'SENT'
                            ? '발송 완료'
                            : po.status === 'DOWNLOADED'
                              ? '다운로드됨'
                              : '생성 완료'}
                        </span>
                      </div>

                      {/* Generated File Name Pill */}
                      <div className="px-3 py-2 rounded-lg bg-slate-50 border border-slate-200 text-[11px] font-mono font-medium text-slate-700 truncate flex items-center gap-2">
                        <PackageCheck className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                        <span className="truncate">{po.fileName}</span>
                      </div>

                      {/* Supplier metadata */}
                      <div className="text-xs text-slate-500 space-y-1 bg-slate-50/70 p-3 rounded-xl border border-slate-200/80">
                        <div className="flex justify-between">
                          <span>담당자 / 연락처:</span>
                          <span className="text-slate-800 font-semibold">
                            {po.supplierManager} ({po.supplierPhone})
                          </span>
                        </div>
                        <div className="flex justify-between">
                          <span>이메일:</span>
                          <span className="text-slate-700 font-mono">{po.supplierEmail}</span>
                        </div>
                        <div className="flex justify-between">
                          <span>입고 요청 납기일:</span>
                          <span className="text-indigo-600 font-bold">
                            {po.requestedDeliveryDate}
                          </span>
                        </div>
                      </div>

                      {/* Included BOM Parts List */}
                      <div className="space-y-1.5">
                        <div className="flex items-center justify-between text-[11px] font-bold text-slate-600">
                          <span>발주 포함 부품 ({po.totalItemTypes}종)</span>
                          <span className="text-indigo-600">
                            총 {po.totalOrderQty.toLocaleString()}개
                          </span>
                        </div>
                        <div className="space-y-1 max-h-32 overflow-y-auto pr-1">
                          {po.items.map((item) => (
                            <div
                              key={item.partCode}
                              className="flex items-center justify-between text-xs py-1.5 px-2.5 rounded-lg bg-slate-50 border border-slate-200/80"
                            >
                              <span className="truncate text-slate-800 font-medium pr-2">
                                {item.partName}
                              </span>
                              <span className="font-mono font-bold text-emerald-700 shrink-0">
                                {item.adjustedOrderQty.toLocaleString()} {item.unit}
                              </span>
                            </div>
                          ))}
                        </div>
                      </div>
                    </div>

                    {/* Footer Action Buttons */}
                    <div className="pt-3 border-t border-slate-200">
                      <div className="grid grid-cols-3 gap-2">
                        <button
                          type="button"
                          onClick={() => setPreviewPo(po)}
                          className="inline-flex items-center justify-center gap-1 py-2 px-2 rounded-xl text-xs font-bold bg-slate-100 hover:bg-slate-200 text-slate-700 transition-colors cursor-pointer"
                        >
                          <Eye className="w-3.5 h-3.5" />
                          미리보기
                        </button>
                        <button
                          type="button"
                          onClick={() => handleDownloadSinglePo(po)}
                          className="inline-flex items-center justify-center gap-1 py-2 px-2 rounded-xl text-xs font-bold bg-emerald-50 hover:bg-emerald-100 text-emerald-700 border border-emerald-200 transition-colors cursor-pointer"
                        >
                          <Download className="w-3.5 h-3.5" />
                          파일저장
                        </button>
                        <button
                          type="button"
                          onClick={() => handleSendPoEmail(po)}
                          className="inline-flex items-center justify-center gap-1 py-2 px-2 rounded-xl text-xs font-bold bg-indigo-50 hover:bg-indigo-100 text-indigo-700 border border-indigo-200 transition-colors cursor-pointer"
                        >
                          <Mail className="w-3.5 h-3.5" />
                          메일발송
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </section>
          </>
        )}
      </main>

      {/* Purchase Order Preview Modal */}
      <PurchaseOrderModal
        po={previewPo}
        clientOrder={clientOrder}
        onClose={() => setPreviewPo(null)}
        onDownload={handleDownloadSinglePo}
        onSendEmail={handleSendPoEmail}
      />
    </div>
  )
}

export default App
