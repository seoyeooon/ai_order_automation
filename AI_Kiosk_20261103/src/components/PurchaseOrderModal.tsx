import { Building2, Calendar, CheckCircle2, Download, FileSpreadsheet, Mail, Phone, Printer, X } from 'lucide-react'
import type { ClientOrder, GeneratedPurchaseOrder } from '../types/order'
import { formatKRW } from '../utils/orderUtils'

interface PurchaseOrderModalProps {
  po: GeneratedPurchaseOrder | null
  clientOrder: ClientOrder
  onClose: () => void
  onDownload: (po: GeneratedPurchaseOrder) => void
  onSendEmail: (po: GeneratedPurchaseOrder) => void
}

export function PurchaseOrderModal({
  po,
  clientOrder,
  onClose,
  onDownload,
  onSendEmail,
}: PurchaseOrderModalProps) {
  if (!po) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/75 backdrop-blur-sm p-4 overflow-y-auto">
      <div className="relative w-full max-w-4xl bg-white text-slate-900 rounded-2xl shadow-2xl border border-slate-200 overflow-hidden my-8">
        {/* Top Action Bar */}
        <div className="flex items-center justify-between px-6 py-4 bg-slate-900 text-white">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-indigo-500/20 text-indigo-300">
              <FileSpreadsheet className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="font-semibold text-sm">{po.fileName}</span>
                <span className="text-xs px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                  자동 생성됨
                </span>
              </div>
              <p className="text-xs text-slate-400">
                수신처: {po.supplierName} ({po.supplierManager})
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => window.print()}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-slate-800 hover:bg-slate-700 text-slate-200 transition-colors cursor-pointer"
            >
              <Printer className="w-4 h-4" />
              인쇄 / PDF
            </button>
            <button
              type="button"
              onClick={() => onSendEmail(po)}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-indigo-600 hover:bg-indigo-500 text-white transition-colors cursor-pointer"
            >
              <Mail className="w-4 h-4" />
              발주서 메일 발송
            </button>
            <button
              type="button"
              onClick={() => onDownload(po)}
              className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg text-xs font-semibold bg-emerald-600 hover:bg-emerald-500 text-white transition-colors cursor-pointer"
            >
              <Download className="w-4 h-4" />
              엑셀(CSV) 다운로드
            </button>
            <button
              type="button"
              onClick={onClose}
              className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors cursor-pointer ml-1"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Printable Document Body */}
        <div className="p-8 md:p-10 space-y-6 bg-white max-h-[80vh] overflow-y-auto">
          {/* Document Header */}
          <div className="flex flex-col md:flex-row md:items-end justify-between border-b-2 border-slate-900 pb-6 gap-4">
            <div>
              <p className="text-xs font-bold tracking-widest text-indigo-600 uppercase">
                PURCHASE ORDER · AI SCM AUTOMATION
              </p>
              <h2 className="text-3xl font-extrabold tracking-tight text-slate-900 mt-1">
                구 매 발 주 서
              </h2>
            </div>
            <div className="text-sm space-y-1 text-right">
              <div className="flex items-center justify-end gap-2">
                <span className="text-slate-500">발주번호:</span>
                <span className="font-mono font-bold text-slate-900">{po.poNumber}</span>
              </div>
              <div className="flex items-center justify-end gap-2">
                <span className="text-slate-500">발주일자:</span>
                <span className="font-medium text-slate-800">{po.issueDate}</span>
              </div>
              <div className="flex items-center justify-end gap-2">
                <span className="text-slate-500">납기요청일:</span>
                <span className="font-semibold text-indigo-600">{po.requestedDeliveryDate}</span>
              </div>
            </div>
          </div>

          {/* Two-column Party Info (Supplier vs Buyer) */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Supplier Box */}
            <div className="rounded-xl border border-slate-200 bg-slate-50/70 p-4 space-y-2.5">
              <div className="flex items-center justify-between border-b border-slate-200 pb-2">
                <span className="text-xs font-bold text-indigo-600 uppercase tracking-wider flex items-center gap-1.5">
                  <Building2 className="w-4 h-4" />
                  수신처 (공급사 / 매입처)
                </span>
                <span className="text-xs font-mono text-slate-500">{po.supplierBizNo}</span>
              </div>
              <div className="text-lg font-bold text-slate-900">{po.supplierName} 귀하</div>
              <div className="grid grid-cols-2 gap-2 text-xs text-slate-600 pt-1">
                <div className="flex items-center gap-1.5">
                  <CheckCircle2 className="w-3.5 h-3.5 text-slate-400" />
                  담당: <strong className="text-slate-800">{po.supplierManager}</strong>
                </div>
                <div className="flex items-center gap-1.5">
                  <Phone className="w-3.5 h-3.5 text-slate-400" />
                  {po.supplierPhone}
                </div>
                <div className="col-span-2 flex items-center gap-1.5">
                  <Mail className="w-3.5 h-3.5 text-slate-400" />
                  {po.supplierEmail}
                </div>
              </div>
            </div>

            {/* Buyer Box */}
            <div className="rounded-xl border border-slate-200 bg-slate-50/70 p-4 space-y-2.5">
              <div className="flex items-center justify-between border-b border-slate-200 pb-2">
                <span className="text-xs font-bold text-slate-700 uppercase tracking-wider">
                  발신처 (발주사)
                </span>
                <span className="text-xs font-mono text-slate-500">129-86-77012</span>
              </div>
              <div className="flex items-center justify-between">
                <div className="text-lg font-bold text-slate-900">(주)에이아이키오스크 테크놀로지</div>
                <span className="inline-flex items-center justify-center w-11 h-11 rounded-full border-2 border-rose-500 text-rose-600 text-[10px] font-extrabold leading-tight text-center select-none">
                  법인인감
                  <br />
                  날인필
                </span>
              </div>
              <div className="text-xs text-slate-600 space-y-1">
                <div>입고장소: {po.deliveryPlace}</div>
                <div className="flex items-center gap-1.5 text-indigo-700 font-medium">
                  <Calendar className="w-3.5 h-3.5" />
                  원천 수주: {clientOrder.clientName} ({clientOrder.orderNo})
                </div>
              </div>
            </div>
          </div>

          {/* Total Banner */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between px-5 py-3.5 rounded-xl bg-indigo-50 border border-indigo-200">
            <span className="text-sm font-bold text-indigo-950">
              총 발주 합계금액 (부가세 포함)
            </span>
            <div className="text-right">
              <span className="text-2xl font-extrabold text-indigo-700">
                ₩ {new Intl.NumberFormat('ko-KR').format(po.totalAmount)}
              </span>
              <span className="text-xs text-indigo-600 ml-2">
                (공급가액 {formatKRW(po.supplyAmount)} + 부가세 {formatKRW(po.vatAmount)})
              </span>
            </div>
          </div>

          {/* Parts Table */}
          <div className="border border-slate-200 rounded-xl overflow-hidden">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="bg-slate-100 text-slate-700 border-b border-slate-200">
                  <th className="py-2.5 px-3 font-bold text-center w-10">No</th>
                  <th className="py-2.5 px-3 font-bold">부품코드</th>
                  <th className="py-2.5 px-3 font-bold">품목명 / 규격</th>
                  <th className="py-2.5 px-3 font-bold text-center">단위</th>
                  <th className="py-2.5 px-3 font-bold text-right">발주수량</th>
                  <th className="py-2.5 px-3 font-bold text-right">매입단가</th>
                  <th className="py-2.5 px-3 font-bold text-right">공급가액</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200">
                {po.items.map((item, idx) => (
                  <tr key={item.partCode} className="hover:bg-slate-50">
                    <td className="py-3 px-3 text-center font-medium text-slate-500">
                      {idx + 1}
                    </td>
                    <td className="py-3 px-3 font-mono font-semibold text-slate-800">
                      {item.partCode}
                    </td>
                    <td className="py-3 px-3">
                      <div className="font-semibold text-slate-900">{item.partName}</div>
                      <div className="text-[11px] text-slate-500 mt-0.5">{item.spec}</div>
                      <div className="text-[11px] text-indigo-600 mt-0.5">
                        적용 모델:{' '}
                        {item.sourceModels
                          .map((m) => `${m.modelCode}(${m.orderQty}대→${m.subTotalQty}${item.unit})`)
                          .join(', ')}
                      </div>
                    </td>
                    <td className="py-3 px-3 text-center text-slate-600">{item.unit}</td>
                    <td className="py-3 px-3 text-right font-bold text-slate-900">
                      {item.adjustedOrderQty.toLocaleString()}
                    </td>
                    <td className="py-3 px-3 text-right text-slate-700">
                      {formatKRW(item.unitCost)}
                    </td>
                    <td className="py-3 px-3 text-right font-bold text-slate-900">
                      {formatKRW(item.totalAmount)}
                    </td>
                  </tr>
                ))}
              </tbody>
              <tfoot className="bg-slate-50 border-t-2 border-slate-300 font-semibold text-slate-800">
                <tr>
                  <td colSpan={4} className="py-2.5 px-3 text-right text-slate-500">
                    소계 (품목 {po.items.length}건)
                  </td>
                  <td className="py-2.5 px-3 text-right font-bold">
                    {po.items.reduce((s, i) => s + i.adjustedOrderQty, 0).toLocaleString()}
                  </td>
                  <td className="py-2.5 px-3 text-right text-slate-500">공급가액 합계</td>
                  <td className="py-2.5 px-3 text-right font-bold text-indigo-700">
                    {formatKRW(po.supplyAmount)}
                  </td>
                </tr>
              </tfoot>
            </table>
          </div>

          <div className="text-xs text-slate-500 bg-slate-50 p-3.5 rounded-lg border border-slate-200 space-y-1">
            <p className="font-semibold text-slate-700">※ 특기사항 및 납품 안내</p>
            <p>1. 본 발주서는 AI 키오스크 수주·발주 자동화 시스템에서 BOM 전개 기준으로 자동 산출되었습니다.</p>
            <p>2. 납품 시 거래명세서 및 시험성적서(해당 품목)를 동봉하여 입고장소로 납기일 이전까지 입고 바랍니다.</p>
          </div>
        </div>
      </div>
    </div>
  )
}
