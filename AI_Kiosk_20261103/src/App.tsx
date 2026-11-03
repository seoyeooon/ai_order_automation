import { useMemo, useRef, useState } from 'react'
import {
  ArrowRight,
  Boxes,
  Building2,
  CheckCircle2,
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
  TrendingUp,
  UploadCloud,
} from 'lucide-react'
import { PurchaseOrderModal } from './components/PurchaseOrderModal'
import { KIOSK_MODELS, SAMPLE_CLIENT_ORDERS } from './data/mockData'
import type { ClientOrder, GeneratedPurchaseOrder, PartCategory } from './types/order'
import {
  downloadPurchaseOrderCsv,
  expandBomFromOrder,
  formatKRW,
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

  // Financial Summary
  const totalSalesSupply = useMemo(
    () => clientOrder.items.reduce((sum, item) => sum + item.quantity * item.unitPrice, 0),
    [clientOrder.items]
  )
  const totalPurchaseSupply = useMemo(
    () => purchaseOrders.reduce((sum, po) => sum + po.supplyAmount, 0),
    [purchaseOrders]
  )
  const totalKioskCount = useMemo(
    () => clientOrder.items.reduce((sum, item) => sum + item.quantity, 0),
    [clientOrder.items]
  )
  const estimatedMarginRate =
    totalSalesSupply > 0
      ? (((totalSalesSupply - totalPurchaseSupply) / totalSalesSupply) * 100).toFixed(1)
      : '0.0'

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
              unitPrice: model.defaultUnitPrice,
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
          unitPrice: defaultModel.defaultUnitPrice,
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
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col selection:bg-indigo-500 selection:text-white">
      {/* Toast Notification */}
      {toastMessage && (
        <div className="fixed bottom-6 right-6 z-50 flex items-center gap-2.5 px-4 py-3 rounded-xl bg-indigo-600 text-white text-sm font-medium shadow-2xl border border-indigo-400/30 animate-bounce">
          <CheckCircle2 className="w-4 h-4 shrink-0" />
          <span>{toastMessage}</span>
        </div>
      )}

      {/* Top Navigation Header */}
      <header className="sticky top-0 z-30 border-b border-slate-800/80 bg-slate-950/90 backdrop-blur-md">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center shadow-lg shadow-indigo-500/20">
              <Cpu className="w-5 h-5 text-white" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-base sm:text-lg font-bold tracking-tight text-white">
                  AI Kiosk SCM Auto-Order
                </h1>
                <span className="hidden sm:inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold bg-indigo-500/15 text-indigo-300 border border-indigo-500/30">
                  <Sparkles className="w-3 h-3" />
                  AI OCR + BOM 엔진
                </span>
              </div>
              <p className="text-xs text-slate-400 hidden sm:block">
                AI 기반 키오스크 매출·매입 발주 자동화 웹 시스템
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setActiveTab('WORKFLOW')}
              className={`px-3.5 py-2 rounded-xl text-xs font-semibold transition-all cursor-pointer ${
                activeTab === 'WORKFLOW'
                  ? 'bg-indigo-600 text-white shadow-md shadow-indigo-600/25'
                  : 'bg-slate-900 text-slate-400 hover:text-slate-200 border border-slate-800'
              }`}
            >
              자동화 발주 워크플로우
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('BOM_MASTER')}
              className={`px-3.5 py-2 rounded-xl text-xs font-semibold transition-all cursor-pointer ${
                activeTab === 'BOM_MASTER'
                  ? 'bg-indigo-600 text-white shadow-md shadow-indigo-600/25'
                  : 'bg-slate-900 text-slate-400 hover:text-slate-200 border border-slate-800'
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
          <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-4 flex items-center justify-between">
            <div>
              <p className="text-xs text-slate-400 font-medium">수주 키오스크 총 수량</p>
              <p className="text-2xl font-extrabold text-white mt-1">
                {totalKioskCount.toLocaleString()}대
              </p>
              <p className="text-[11px] text-indigo-400 mt-1">
                수주 품목 {clientOrder.items.length}개 모델
              </p>
            </div>
            <div className="p-3 rounded-xl bg-indigo-500/10 text-indigo-400 border border-indigo-500/20">
              <FileText className="w-6 h-6" />
            </div>
          </div>

          <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-4 flex items-center justify-between">
            <div>
              <p className="text-xs text-slate-400 font-medium">수주 매출 합계 (공급가)</p>
              <p className="text-xl sm:text-2xl font-extrabold text-white mt-1">
                {formatKRW(totalSalesSupply)}
              </p>
              <p className="text-[11px] text-slate-400 mt-1 truncate max-w-[180px]">
                거래처: {clientOrder.clientName}
              </p>
            </div>
            <div className="p-3 rounded-xl bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
              <TrendingUp className="w-6 h-6" />
            </div>
          </div>

          <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-4 flex items-center justify-between">
            <div>
              <p className="text-xs text-slate-400 font-medium">BOM 부품 매입 발주 총액</p>
              <p className="text-xl sm:text-2xl font-extrabold text-amber-300 mt-1">
                {formatKRW(totalPurchaseSupply)}
              </p>
              <p className="text-[11px] text-emerald-400 mt-1">
                예상 매출원가율 {(100 - Number(estimatedMarginRate)).toFixed(1)}% (이익률{' '}
                {estimatedMarginRate}%)
              </p>
            </div>
            <div className="p-3 rounded-xl bg-amber-500/10 text-amber-400 border border-amber-500/20">
              <Boxes className="w-6 h-6" />
            </div>
          </div>

          <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-4 flex items-center justify-between">
            <div>
              <p className="text-xs text-slate-400 font-medium">자동 생성된 매입 발주서</p>
              <p className="text-2xl font-extrabold text-indigo-300 mt-1">
                {purchaseOrders.length}개 파일
              </p>
              <p className="text-[11px] text-slate-400 mt-1">
                전개된 BOM 부품 {expandedBom.length}종 기준
              </p>
            </div>
            <div className="p-3 rounded-xl bg-purple-500/10 text-purple-400 border border-purple-500/20">
              <FileSpreadsheet className="w-6 h-6" />
            </div>
          </div>
        </section>

        {activeTab === 'BOM_MASTER' ? (
          /* BOM MASTER VIEW */
          <section className="space-y-6">
            <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6">
              <h2 className="text-lg font-bold text-white flex items-center gap-2">
                <Layers className="w-5 h-5 text-indigo-400" />
                키오스크 모델별 표준 BOM (자재명세서) 마스터
              </h2>
              <p className="text-xs text-slate-400 mt-1">
                수주 발주서에서 모델명이 인식되면 아래의 표준 BOM 구성 부품과 지정 발주처(공급사) 정보가 자동으로 매칭되어 전개됩니다.
              </p>

              <div className="mt-6 space-y-6">
                {KIOSK_MODELS.map((model) => {
                  const unitBomCost = model.bom.reduce(
                    (s, p) => s + p.qtyPerUnit * p.unitCost,
                    0
                  )
                  return (
                    <div
                      key={model.modelCode}
                      className="rounded-xl border border-slate-800 bg-slate-950/60 overflow-hidden"
                    >
                      <div className="px-5 py-4 bg-slate-900/90 border-b border-slate-800 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                        <div>
                          <div className="flex items-center gap-2.5">
                            <span className="px-2.5 py-0.5 rounded-md text-xs font-mono font-bold bg-indigo-500/20 text-indigo-300 border border-indigo-500/30">
                              {model.modelCode}
                            </span>
                            <h3 className="font-bold text-white text-sm sm:text-base">
                              {model.modelName}
                            </h3>
                          </div>
                          <p className="text-xs text-slate-400 mt-1">{model.spec}</p>
                        </div>
                        <div className="text-right text-xs space-y-0.5">
                          <div className="text-slate-400">
                            표준 매출단가:{' '}
                            <strong className="text-white">
                              {formatKRW(model.defaultUnitPrice)}
                            </strong>
                          </div>
                          <div className="text-slate-400">
                            1대당 BOM 원가 합계:{' '}
                            <strong className="text-amber-300">{formatKRW(unitBomCost)}</strong>
                          </div>
                        </div>
                      </div>

                      <div className="overflow-x-auto">
                        <table className="w-full text-left border-collapse text-xs">
                          <thead>
                            <tr className="bg-slate-900/40 text-slate-400 border-b border-slate-800">
                              <th className="py-2.5 px-4">부품코드</th>
                              <th className="py-2.5 px-4">카테고리</th>
                              <th className="py-2.5 px-4">부품명 / 규격</th>
                              <th className="py-2.5 px-4 text-center">대당 소요량</th>
                              <th className="py-2.5 px-4 text-right">매입단가</th>
                              <th className="py-2.5 px-4 text-center">현재고</th>
                              <th className="py-2.5 px-4">지정 발주처 (공급사)</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-slate-800/70">
                            {model.bom.map((part) => (
                              <tr key={part.partCode} className="hover:bg-slate-900/40">
                                <td className="py-2.5 px-4 font-mono text-indigo-300 font-medium">
                                  {part.partCode}
                                </td>
                                <td className="py-2.5 px-4">
                                  <span className="px-2 py-0.5 rounded bg-slate-800 text-slate-300 text-[11px]">
                                    {part.category}
                                  </span>
                                </td>
                                <td className="py-2.5 px-4">
                                  <div className="font-medium text-slate-200">{part.partName}</div>
                                  <div className="text-[11px] text-slate-500">{part.spec}</div>
                                </td>
                                <td className="py-2.5 px-4 text-center font-bold text-white">
                                  {part.qtyPerUnit} {part.unit}
                                </td>
                                <td className="py-2.5 px-4 text-right text-slate-300">
                                  {formatKRW(part.unitCost)}
                                </td>
                                <td className="py-2.5 px-4 text-center text-emerald-400 font-medium">
                                  {part.stockQty} {part.unit}
                                </td>
                                <td className="py-2.5 px-4">
                                  <div className="font-medium text-slate-200">
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
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3 bg-slate-900/60 border border-slate-800/90 rounded-2xl p-3">
              <div className="flex items-center gap-3 p-3 rounded-xl bg-indigo-500/10 border border-indigo-500/30">
                <div className="w-8 h-8 rounded-lg bg-indigo-600 text-white font-bold text-sm flex items-center justify-center shrink-0">
                  1
                </div>
                <div className="min-w-0 flex-1">
                  <div className="text-xs font-bold text-indigo-300 uppercase tracking-wide">
                    STEP 1 · 수주 발주서 AI 스캔
                  </div>
                  <div className="text-xs text-slate-300 truncate mt-0.5">
                    거래처 발주서 업로드 → 제품명·수량·정보 추출
                  </div>
                </div>
                <ArrowRight className="w-4 h-4 text-indigo-400 hidden md:block shrink-0" />
              </div>

              <div className="flex items-center gap-3 p-3 rounded-xl bg-purple-500/10 border border-purple-500/30">
                <div className="w-8 h-8 rounded-lg bg-purple-600 text-white font-bold text-sm flex items-center justify-center shrink-0">
                  2
                </div>
                <div className="min-w-0 flex-1">
                  <div className="text-xs font-bold text-purple-300 uppercase tracking-wide">
                    STEP 2 · 제품별 BOM 자동 전개
                  </div>
                  <div className="text-xs text-slate-300 truncate mt-0.5">
                    하위 부품 리스트·소요 수량·단가·발주처 매칭
                  </div>
                </div>
                <ArrowRight className="w-4 h-4 text-purple-400 hidden md:block shrink-0" />
              </div>

              <div className="flex items-center gap-3 p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/30">
                <div className="w-8 h-8 rounded-lg bg-emerald-600 text-white font-bold text-sm flex items-center justify-center shrink-0">
                  3
                </div>
                <div className="min-w-0 flex-1">
                  <div className="text-xs font-bold text-emerald-300 uppercase tracking-wide">
                    STEP 3 · 매입 발주서 파일 자동 생성
                  </div>
                  <div className="text-xs text-slate-300 truncate mt-0.5">
                    발주처별 구매발주서(PO) 파일 일괄 생성·다운로드
                  </div>
                </div>
              </div>
            </div>

            {/* ================= STEP 1: CLIENT ORDER UPLOAD & AI OCR SCAN ================= */}
            <section className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden shadow-xl">
              <div className="px-6 py-4 bg-slate-900 border-b border-slate-800 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div className="flex items-center gap-2.5">
                  <span className="px-2.5 py-1 rounded-lg text-xs font-extrabold bg-indigo-600 text-white">
                    STEP 1
                  </span>
                  <div>
                    <h2 className="text-base font-bold text-white flex items-center gap-2">
                      거래처 수주 발주서 업로드 & AI 자동 스캔
                    </h2>
                    <p className="text-xs text-slate-400">
                      거래처에서 받은 발주서(PDF, 이미지, 엑셀)를 넣으면 AI가 거래처 정보와 제품명·수량을 자동으로 스캔합니다.
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-xs text-slate-400 mr-1">샘플 발주서 테스트:</span>
                  {SAMPLE_CLIENT_ORDERS.map((sample, idx) => (
                    <button
                      key={sample.order.orderNo}
                      type="button"
                      onClick={() => {
                        setSelectedSampleIdx(idx)
                        triggerAiScan(sample.order)
                      }}
                      className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition-all cursor-pointer border ${
                        selectedSampleIdx === idx
                          ? 'bg-indigo-600/20 text-indigo-300 border-indigo-500/50'
                          : 'bg-slate-800/80 text-slate-300 border-slate-700 hover:bg-slate-800'
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
                        ? 'border-indigo-400 bg-indigo-500/15'
                        : 'border-slate-700 hover:border-indigo-500/60 bg-slate-950/60 hover:bg-slate-950'
                    }`}
                  >
                    <input
                      ref={fileInputRef}
                      type="file"
                      accept=".pdf,.png,.jpg,.jpeg,.xlsx,.xls,.csv"
                      className="hidden"
                      onChange={(e) => handleFileUpload(e.target.files?.[0])}
                    />
                    <div className="w-14 h-14 rounded-2xl bg-indigo-500/15 border border-indigo-500/30 flex items-center justify-center text-indigo-400 mb-3">
                      {isScanning ? (
                        <RefreshCw className="w-7 h-7 animate-spin" />
                      ) : (
                        <UploadCloud className="w-7 h-7" />
                      )}
                    </div>
                    <p className="text-sm font-bold text-white">
                      거래처 발주서 파일을 이곳에 드래그하거나 클릭하여 업로드
                    </p>
                    <p className="text-xs text-slate-400 mt-1">
                      지원 포맷: PDF, 이미지(JPG/PNG), Excel(XLSX/CSV)
                    </p>

                    <div className="mt-4 w-full px-3.5 py-2.5 rounded-xl bg-slate-900 border border-slate-800 flex items-center justify-between text-xs">
                      <span className="flex items-center gap-2 text-slate-300 truncate">
                        <FileCheck2 className="w-4 h-4 text-emerald-400 shrink-0" />
                        <span className="truncate">{clientOrder.sourceFileName}</span>
                      </span>
                      <span className="ml-2 px-2 py-0.5 rounded bg-emerald-500/15 text-emerald-300 font-mono text-[11px] shrink-0">
                        인식률 {clientOrder.confidenceScore}%
                      </span>
                    </div>
                  </div>

                  {/* AI OCR Progress Box */}
                  <div className="p-4 rounded-xl bg-slate-950 border border-slate-800 space-y-2.5">
                    <div className="flex items-center justify-between text-xs">
                      <span className="font-semibold text-indigo-300 flex items-center gap-1.5">
                        <ScanLine className="w-4 h-4" />
                        AI 발주서 스캔 상태
                      </span>
                      <span className="font-mono font-bold text-white">{scanProgress}%</span>
                    </div>
                    <div className="w-full h-2 rounded-full bg-slate-800 overflow-hidden">
                      <div
                        className="h-full bg-gradient-to-r from-indigo-500 via-purple-500 to-emerald-400 transition-all duration-300"
                        style={{ width: `${scanProgress}%` }}
                      />
                    </div>
                    <p className="text-[11px] text-slate-400">{scanStageText}</p>
                  </div>
                </div>

                {/* Right: Extracted Client Metadata & Ordered Kiosk Items (8 cols) */}
                <div className="lg:col-span-8 space-y-5">
                  {/* Extracted Client Info Grid */}
                  <div className="p-4 rounded-xl bg-slate-950/80 border border-slate-800 space-y-3">
                    <div className="flex items-center justify-between">
                      <h3 className="text-xs font-bold uppercase tracking-wider text-indigo-400 flex items-center gap-1.5">
                        <Building2 className="w-4 h-4" />
                        스캔된 발주 거래처(고객사) 정보 (수정 가능)
                      </h3>
                      <span className="text-[11px] font-mono text-slate-400">
                        수주번호: {clientOrder.orderNo}
                      </span>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
                      <div>
                        <label className="block text-slate-400 mb-1">발주 거래처명</label>
                        <input
                          type="text"
                          value={clientOrder.clientName}
                          onChange={(e) =>
                            setClientOrder({ ...clientOrder, clientName: e.target.value })
                          }
                          className="w-full px-3 py-2 rounded-lg bg-slate-900 border border-slate-700 text-white font-medium focus:outline-none focus:border-indigo-500"
                        />
                      </div>
                      <div>
                        <label className="block text-slate-400 mb-1">사업자등록번호</label>
                        <input
                          type="text"
                          value={clientOrder.businessNo}
                          onChange={(e) =>
                            setClientOrder({ ...clientOrder, businessNo: e.target.value })
                          }
                          className="w-full px-3 py-2 rounded-lg bg-slate-900 border border-slate-700 text-white font-mono focus:outline-none focus:border-indigo-500"
                        />
                      </div>
                      <div>
                        <label className="block text-slate-400 mb-1">거래처 담당자 / 연락처</label>
                        <input
                          type="text"
                          value={`${clientOrder.managerName} (${clientOrder.managerPhone})`}
                          onChange={(e) =>
                            setClientOrder({ ...clientOrder, managerName: e.target.value })
                          }
                          className="w-full px-3 py-2 rounded-lg bg-slate-900 border border-slate-700 text-white focus:outline-none focus:border-indigo-500"
                        />
                      </div>
                      <div>
                        <label className="block text-slate-400 mb-1">발주일자</label>
                        <input
                          type="date"
                          value={clientOrder.orderDate}
                          onChange={(e) =>
                            setClientOrder({ ...clientOrder, orderDate: e.target.value })
                          }
                          className="w-full px-3 py-2 rounded-lg bg-slate-900 border border-slate-700 text-white focus:outline-none focus:border-indigo-500"
                        />
                      </div>
                      <div>
                        <label className="block text-slate-400 mb-1">납기요청일</label>
                        <input
                          type="date"
                          value={clientOrder.deliveryDate}
                          onChange={(e) =>
                            setClientOrder({ ...clientOrder, deliveryDate: e.target.value })
                          }
                          className="w-full px-3 py-2 rounded-lg bg-slate-900 border border-slate-700 text-white focus:outline-none focus:border-indigo-500"
                        />
                      </div>
                      <div>
                        <label className="block text-slate-400 mb-1">납품 장소</label>
                        <input
                          type="text"
                          value={clientOrder.deliveryAddress}
                          onChange={(e) =>
                            setClientOrder({ ...clientOrder, deliveryAddress: e.target.value })
                          }
                          className="w-full px-3 py-2 rounded-lg bg-slate-900 border border-slate-700 text-white focus:outline-none focus:border-indigo-500"
                        />
                      </div>
                    </div>
                  </div>

                  {/* Extracted Order Products Table */}
                  <div className="p-4 rounded-xl bg-slate-950/80 border border-slate-800 space-y-3">
                    <div className="flex items-center justify-between">
                      <div>
                        <h3 className="text-xs font-bold uppercase tracking-wider text-emerald-400">
                          스캔된 주문 키오스크 제품 및 수량 (수량 변경 시 하단 BOM·발주서 실시간 연동)
                        </h3>
                      </div>
                      <button
                        type="button"
                        onClick={handleAddOrderItem}
                        className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-semibold bg-indigo-600/20 hover:bg-indigo-600/30 text-indigo-300 border border-indigo-500/30 transition-colors cursor-pointer"
                      >
                        <Plus className="w-3.5 h-3.5" />
                        제품 행 추가
                      </button>
                    </div>

                    <div className="overflow-x-auto">
                      <table className="w-full text-left border-collapse text-xs">
                        <thead>
                          <tr className="border-b border-slate-800 text-slate-400">
                            <th className="py-2 px-2">키오스크 모델 선택</th>
                            <th className="py-2 px-2">규격 요약</th>
                            <th className="py-2 px-2 text-center w-32">주문 수량</th>
                            <th className="py-2 px-2 text-right">매출 단가</th>
                            <th className="py-2 px-2 text-right">수주 금액</th>
                            <th className="py-2 px-1 text-center w-10">삭제</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-800/70">
                          {clientOrder.items.map((item) => (
                            <tr key={item.id}>
                              <td className="py-2.5 px-2">
                                <select
                                  value={item.modelCode}
                                  onChange={(e) => handleModelChange(item.id, e.target.value)}
                                  className="px-2.5 py-1.5 rounded-lg bg-slate-900 border border-slate-700 text-white font-semibold focus:outline-none focus:border-indigo-500"
                                >
                                  {KIOSK_MODELS.map((m) => (
                                    <option key={m.modelCode} value={m.modelCode}>
                                      [{m.modelCode}] {m.modelName}
                                    </option>
                                  ))}
                                </select>
                              </td>
                              <td className="py-2.5 px-2 text-slate-400 max-w-[200px] truncate">
                                {item.spec}
                              </td>
                              <td className="py-2.5 px-2">
                                <div className="flex items-center justify-center gap-1">
                                  <button
                                    type="button"
                                    onClick={() => handleQuantityChange(item.id, item.quantity - 1)}
                                    className="w-6 h-6 rounded bg-slate-800 hover:bg-slate-700 text-white font-bold cursor-pointer"
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
                                    className="w-14 text-center py-1 rounded bg-slate-900 border border-slate-700 text-white font-bold"
                                  />
                                  <button
                                    type="button"
                                    onClick={() => handleQuantityChange(item.id, item.quantity + 1)}
                                    className="w-6 h-6 rounded bg-slate-800 hover:bg-slate-700 text-white font-bold cursor-pointer"
                                  >
                                    +
                                  </button>
                                </div>
                              </td>
                              <td className="py-2.5 px-2 text-right text-slate-300 font-mono">
                                {formatKRW(item.unitPrice)}
                              </td>
                              <td className="py-2.5 px-2 text-right font-bold text-emerald-400 font-mono">
                                {formatKRW(item.unitPrice * item.quantity)}
                              </td>
                              <td className="py-2.5 px-1 text-center">
                                <button
                                  type="button"
                                  onClick={() => handleRemoveOrderItem(item.id)}
                                  className="p-1 rounded hover:bg-rose-500/20 text-slate-500 hover:text-rose-400 transition-colors cursor-pointer"
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
            <section className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden shadow-xl">
              <div className="px-6 py-4 bg-slate-900 border-b border-slate-800 flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div className="flex items-center gap-2.5">
                  <span className="px-2.5 py-1 rounded-lg text-xs font-extrabold bg-purple-600 text-white">
                    STEP 2
                  </span>
                  <div>
                    <h2 className="text-base font-bold text-white flex items-center gap-2">
                      제품별 BOM(자재명세서) 자동 전개 및 부품 소요량 산출
                      <span className="text-xs px-2 py-0.5 rounded-full bg-purple-500/20 text-purple-300 border border-purple-500/30">
                        총 {expandedBom.length}종 부품 자동 산출됨
                      </span>
                    </h2>
                    <p className="text-xs text-slate-400">
                      인식된 키오스크 모델과 주문 수량({totalKioskCount}대)에 맞춰 필요한 하위 부품과 지정 발주처가 자동으로 펼쳐집니다.
                    </p>
                  </div>
                </div>

                {/* Stock Deduction Toggle */}
                <div className="flex items-center gap-3">
                  <label className="inline-flex items-center gap-2 text-xs text-slate-300 cursor-pointer select-none bg-slate-950 px-3.5 py-2 rounded-xl border border-slate-800">
                    <input
                      type="checkbox"
                      checked={deductStock}
                      onChange={(e) => setDeductStock(e.target.checked)}
                      className="rounded accent-indigo-500 w-4 h-4"
                    />
                    <span>현재고 자동 차감 (순소요량 계산)</span>
                  </label>
                </div>
              </div>

              {/* Category Filter Bar */}
              <div className="px-6 py-3 bg-slate-950/50 border-b border-slate-800/80 flex items-center justify-between flex-wrap gap-2">
                <div className="flex items-center gap-1.5 flex-wrap">
                  {CATEGORIES.map((cat) => (
                    <button
                      key={cat}
                      type="button"
                      onClick={() => setSelectedCategory(cat)}
                      className={`px-3 py-1 rounded-lg text-xs font-medium transition-colors cursor-pointer ${
                        selectedCategory === cat
                          ? 'bg-purple-600 text-white'
                          : 'bg-slate-900 text-slate-400 hover:text-slate-200 border border-slate-800'
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
                    className="text-xs text-indigo-400 hover:text-indigo-300 underline cursor-pointer"
                  >
                    수량 수동조정 초기화
                  </button>
                )}
              </div>

              {/* BOM Table */}
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse text-xs">
                  <thead>
                    <tr className="bg-slate-950/80 text-slate-400 border-b border-slate-800">
                      <th className="py-3 px-4">부품코드 / 카테고리</th>
                      <th className="py-3 px-4">부품명 및 규격</th>
                      <th className="py-3 px-4">산출 근거 (적용 키오스크)</th>
                      <th className="py-3 px-4 text-right">총 필요수량</th>
                      <th className="py-3 px-4 text-right">창고 현재고</th>
                      <th className="py-3 px-4 text-center w-36">실제 발주수량</th>
                      <th className="py-3 px-4 text-right">매입단가</th>
                      <th className="py-3 px-4 text-right">발주 합계금액</th>
                      <th className="py-3 px-4">매입 발주처 (공급사)</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800/70">
                    {filteredBom.map((part) => (
                      <tr key={part.partCode} className="hover:bg-slate-800/30 transition-colors">
                        <td className="py-3 px-4">
                          <div className="font-mono font-bold text-indigo-300">{part.partCode}</div>
                          <span className="inline-block mt-1 px-2 py-0.5 rounded text-[10px] bg-slate-800 text-slate-300">
                            {part.category}
                          </span>
                        </td>
                        <td className="py-3 px-4">
                          <div className="font-semibold text-white">{part.partName}</div>
                          <div className="text-[11px] text-slate-400 mt-0.5">{part.spec}</div>
                        </td>
                        <td className="py-3 px-4">
                          <div className="flex flex-wrap gap-1">
                            {part.sourceModels.map((m) => (
                              <span
                                key={m.modelCode}
                                className="px-2 py-0.5 rounded bg-indigo-500/10 text-indigo-300 border border-indigo-500/20 text-[11px]"
                              >
                                {m.modelCode}: {m.orderQty}대 × {part.qtyPerUnit} = {m.subTotalQty}
                                {part.unit}
                              </span>
                            ))}
                          </div>
                        </td>
                        <td className="py-3 px-4 text-right font-mono font-semibold text-slate-200">
                          {part.grossRequiredQty.toLocaleString()} {part.unit}
                        </td>
                        <td className="py-3 px-4 text-right font-mono text-emerald-400">
                          {deductStock ? `-${part.stockQty}` : part.stockQty} {part.unit}
                        </td>
                        <td className="py-3 px-4">
                          <div className="flex items-center justify-center gap-1">
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
                              className="w-20 text-center py-1 rounded-lg bg-slate-950 border border-purple-500/50 text-white font-bold focus:outline-none focus:border-purple-400"
                            />
                            <span className="text-slate-400 text-[11px]">{part.unit}</span>
                          </div>
                        </td>
                        <td className="py-3 px-4 text-right font-mono text-slate-300">
                          {formatKRW(part.unitCost)}
                        </td>
                        <td className="py-3 px-4 text-right font-mono font-bold text-amber-300">
                          {formatKRW(part.totalAmount)}
                        </td>
                        <td className="py-3 px-4">
                          <div className="font-semibold text-white">{part.supplierName}</div>
                          <div className="text-[11px] text-slate-400">
                            {part.supplierManager} · 납기 {part.leadTimeDays}일
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>

            {/* ================= STEP 3: GENERATED PURCHASE ORDERS BY SUPPLIER ================= */}
            <section className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden shadow-xl">
              <div className="px-6 py-4 bg-slate-900 border-b border-slate-800 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div className="flex items-center gap-2.5">
                  <span className="px-2.5 py-1 rounded-lg text-xs font-extrabold bg-emerald-600 text-white">
                    STEP 3
                  </span>
                  <div>
                    <h2 className="text-base font-bold text-white flex items-center gap-2">
                      발주처별 매입 발주서(PO) 파일 자동 생성 완료
                      <span className="text-xs px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                        총 {purchaseOrders.length}개 발주처 파일
                      </span>
                    </h2>
                    <p className="text-xs text-slate-400">
                      전개된 BOM 부품들을 각 매입 발주처(공급업체)별로 자동 분류하여 표준 구매발주서 파일을 생성했습니다.
                    </p>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={handleDownloadAllPos}
                  className="inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl text-xs font-bold bg-emerald-600 hover:bg-emerald-500 text-white shadow-lg shadow-emerald-600/25 transition-all cursor-pointer shrink-0"
                >
                  <Download className="w-4 h-4" />
                  생성된 발주서 파일 전체 일괄 다운로드 ({purchaseOrders.length}건)
                </button>
              </div>

              <div className="p-6 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
                {purchaseOrders.map((po) => (
                  <div
                    key={po.poNumber}
                    className="flex flex-col justify-between rounded-2xl bg-slate-950/90 border border-slate-800 hover:border-emerald-500/50 transition-all p-5 space-y-4 shadow-lg"
                  >
                    <div className="space-y-3">
                      {/* File Badge & Status */}
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex items-center gap-2.5 min-w-0">
                          <div className="p-2.5 rounded-xl bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 shrink-0">
                            <FileSpreadsheet className="w-5 h-5" />
                          </div>
                          <div className="min-w-0">
                            <span className="text-[11px] font-mono text-emerald-400 block">
                              {po.poNumber}
                            </span>
                            <h3 className="text-sm font-bold text-white truncate">
                              {po.supplierName}
                            </h3>
                          </div>
                        </div>

                        <span
                          className={`px-2 py-0.5 rounded-full text-[10px] font-bold shrink-0 ${
                            po.status === 'SENT'
                              ? 'bg-indigo-500/20 text-indigo-300 border border-indigo-500/30'
                              : po.status === 'DOWNLOADED'
                                ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                                : 'bg-amber-500/15 text-amber-300 border border-amber-500/30'
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
                      <div className="px-3 py-2 rounded-lg bg-slate-900 border border-slate-800/90 text-[11px] font-mono text-slate-300 truncate flex items-center gap-2">
                        <PackageCheck className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                        <span className="truncate">{po.fileName}</span>
                      </div>

                      {/* Supplier metadata */}
                      <div className="text-xs text-slate-400 space-y-1 bg-slate-900/50 p-3 rounded-xl border border-slate-800/60">
                        <div className="flex justify-between">
                          <span>담당자 / 연락처:</span>
                          <span className="text-slate-200 font-medium">
                            {po.supplierManager} ({po.supplierPhone})
                          </span>
                        </div>
                        <div className="flex justify-between">
                          <span>이메일:</span>
                          <span className="text-slate-300 font-mono">{po.supplierEmail}</span>
                        </div>
                        <div className="flex justify-between">
                          <span>입고 요청 납기일:</span>
                          <span className="text-indigo-300 font-semibold">
                            {po.requestedDeliveryDate}
                          </span>
                        </div>
                      </div>

                      {/* Included BOM Parts List */}
                      <div className="space-y-1.5">
                        <div className="text-[11px] font-semibold text-slate-400">
                          발주 포함 부품 ({po.items.length}종)
                        </div>
                        <div className="space-y-1 max-h-32 overflow-y-auto pr-1">
                          {po.items.map((item) => (
                            <div
                              key={item.partCode}
                              className="flex items-center justify-between text-xs py-1 px-2.5 rounded-lg bg-slate-900/90 border border-slate-800/70"
                            >
                              <span className="truncate text-slate-200 pr-2">{item.partName}</span>
                              <span className="font-mono font-bold text-emerald-400 shrink-0">
                                {item.adjustedOrderQty.toLocaleString()} {item.unit}
                              </span>
                            </div>
                          ))}
                        </div>
                      </div>
                    </div>

                    {/* Footer Total & Action Buttons */}
                    <div className="pt-3 border-t border-slate-800 space-y-3">
                      <div className="flex items-baseline justify-between">
                        <span className="text-xs text-slate-400">발주 합계 (VAT 포함)</span>
                        <span className="text-base font-extrabold text-white font-mono">
                          {formatKRW(po.totalAmount)}
                        </span>
                      </div>

                      <div className="grid grid-cols-3 gap-2">
                        <button
                          type="button"
                          onClick={() => setPreviewPo(po)}
                          className="inline-flex items-center justify-center gap-1 py-2 px-2 rounded-xl text-xs font-semibold bg-slate-800 hover:bg-slate-700 text-slate-200 transition-colors cursor-pointer"
                        >
                          <Eye className="w-3.5 h-3.5" />
                          미리보기
                        </button>
                        <button
                          type="button"
                          onClick={() => handleDownloadSinglePo(po)}
                          className="inline-flex items-center justify-center gap-1 py-2 px-2 rounded-xl text-xs font-semibold bg-emerald-600/20 hover:bg-emerald-600/30 text-emerald-300 border border-emerald-500/30 transition-colors cursor-pointer"
                        >
                          <Download className="w-3.5 h-3.5" />
                          파일저장
                        </button>
                        <button
                          type="button"
                          onClick={() => handleSendPoEmail(po)}
                          className="inline-flex items-center justify-center gap-1 py-2 px-2 rounded-xl text-xs font-semibold bg-indigo-600/20 hover:bg-indigo-600/30 text-indigo-300 border border-indigo-500/30 transition-colors cursor-pointer"
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
