import {
  Building2,
  Calendar,
  CheckCircle2,
  Download,
  FileSpreadsheet,
  FileText,
  Mail,
  Phone,
  Printer,
  Send,
  X,
} from 'lucide-react'
import type { ClientOrder, GeneratedPurchaseOrder } from '../types/order'

interface PurchaseOrderModalProps {
  po: GeneratedPurchaseOrder | null
  clientOrder: ClientOrder
  onClose: () => void
  onDownloadPdf: (po: GeneratedPurchaseOrder) => void
  onDownloadExcel: (po: GeneratedPurchaseOrder) => void
  onPrint: (po: GeneratedPurchaseOrder) => void
  onSendEmailPdf: (po: GeneratedPurchaseOrder) => void
}

export function PurchaseOrderModal({
  po,
  clientOrder,
  onClose,
  onDownloadPdf,
  onDownloadExcel,
  onPrint,
  onSendEmailPdf,
}: PurchaseOrderModalProps) {
  if (!po) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-xs p-4 overflow-y-auto">
      <div className="relative w-full max-w-5xl bg-white text-slate-900 rounded-2xl shadow-2xl border border-slate-200 overflow-hidden my-6">
        {/* Top Action Bar */}
        <div className="flex flex-wrap items-center justify-between px-6 py-4 bg-slate-900 text-white gap-3">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-indigo-500/20 text-indigo-300 border border-indigo-400/30">
              <FileText className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2.5">
                <span className="font-bold text-base text-white">{po.pdfFileName}</span>
                <span className="text-xs px-2.5 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-400/30 font-semibold">
                  공식 발주서 양식
                </span>
              </div>
              <p className="text-xs text-slate-300 mt-0.5">
                수신 업체: {po.supplierName} ({po.supplierManager} · {po.supplierEmail})
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => onPrint(po)}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-sm font-bold bg-slate-800 hover:bg-slate-700 text-white border border-slate-700 transition-colors cursor-pointer"
            >
              <Printer className="w-4 h-4" />
              프린트 (인쇄)
            </button>
            <button
              type="button"
              onClick={() => onDownloadPdf(po)}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-sm font-bold bg-rose-600 hover:bg-rose-500 text-white transition-colors cursor-pointer shadow-xs"
            >
              <Download className="w-4 h-4" />
              PDF 다운로드
            </button>
            <button
              type="button"
              onClick={() => onDownloadExcel(po)}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-sm font-bold bg-emerald-600 hover:bg-emerald-500 text-white transition-colors cursor-pointer shadow-xs"
            >
              <FileSpreadsheet className="w-4 h-4" />
              엑셀(.xlsx) 다운로드
            </button>
            <button
              type="button"
              onClick={() => onSendEmailPdf(po)}
              className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl text-sm font-bold bg-indigo-600 hover:bg-indigo-500 text-white transition-colors cursor-pointer shadow-xs"
            >
              <Send className="w-4 h-4" />
              PDF 파일로 업체 전송
            </button>
            <button
              type="button"
              onClick={onClose}
              className="p-2 rounded-xl text-slate-400 hover:text-white hover:bg-slate-800 transition-colors cursor-pointer ml-1"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Document Preview Area */}
        <div className="p-6 md:p-10 bg-slate-100 max-h-[82vh] overflow-y-auto">
          <div className="max-w-4xl mx-auto bg-white rounded-2xl shadow-lg border border-slate-200 p-8 md:p-10 space-y-7">
            {/* Top Decorative Gradient Strip */}
            <div className="h-2 w-full rounded-full bg-gradient-to-r from-indigo-600 via-violet-600 to-emerald-500" />

            {/* Document Title + Approval Stamp Box */}
            <div className="flex flex-col md:flex-row md:items-start justify-between border-b-2 border-slate-900 pb-6 gap-6">
              <div>
                <p className="text-xs font-extrabold tracking-widest text-indigo-600 uppercase">
                  OFFICIAL PURCHASE ORDER
                </p>
                <h2 className="text-3xl md:text-4xl font-black tracking-[0.2em] text-slate-900 mt-1">
                  구 매 발 주 서
                </h2>
                <div className="mt-3 space-y-1 text-sm text-slate-600">
                  <div>
                    발주번호: <strong className="font-mono text-slate-900">{po.poNumber}</strong>
                    <span className="mx-2 text-slate-300">|</span>
                    발주일자: <strong className="text-slate-900">{po.issueDate}</strong>
                  </div>
                  <div>
                    입고 납기요청일:{' '}
                    <strong className="text-indigo-600 font-bold">
                      {po.requestedDeliveryDate}
                    </strong>
                  </div>
                </div>
              </div>

              {/* Formal Approval Box (결재란) */}
              <div className="shrink-0">
                <table className="border-collapse text-xs text-center border border-slate-300">
                  <thead>
                    <tr className="bg-slate-100 text-slate-700 font-bold">
                      <th
                        rowSpan={2}
                        className="border border-slate-300 px-2.5 py-2 bg-slate-200/70 text-slate-800 w-8 leading-tight"
                      >
                        결
                        <br />
                        재
                      </th>
                      <th className="border border-slate-300 px-5 py-1.5">담 당</th>
                      <th className="border border-slate-300 px-5 py-1.5">검 토</th>
                      <th className="border border-slate-300 px-5 py-1.5">승 인</th>
                    </tr>
                    <tr className="bg-white">
                      <td className="border border-slate-300 py-3 px-3 font-bold text-indigo-600">
                        AI자동발주
                        <div className="text-[10px] font-normal text-slate-400 mt-0.5">
                          {po.issueDate.slice(5)}
                        </div>
                      </td>
                      <td className="border border-slate-300 py-3 px-3 font-bold text-indigo-600">
                        구매팀장
                        <div className="text-[10px] font-normal text-emerald-600 mt-0.5">
                          승인필
                        </div>
                      </td>
                      <td className="border border-slate-300 py-3 px-3 font-bold text-rose-600">
                        대표이사
                        <div className="text-[10px] font-normal text-rose-500 mt-0.5">날인필</div>
                      </td>
                    </tr>
                  </thead>
                </table>
              </div>
            </div>

            {/* Two-column Party Info (Supplier vs Buyer) */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Supplier Box */}
              <div className="rounded-xl border border-slate-300 bg-slate-50/80 p-5 space-y-3">
                <div className="flex items-center justify-between border-b border-slate-200 pb-2.5">
                  <span className="text-xs font-extrabold text-indigo-600 uppercase tracking-wider flex items-center gap-1.5">
                    <Building2 className="w-4 h-4" />
                    수신처 (공급사 / 매입 발주처)
                  </span>
                  <span className="text-xs font-mono font-semibold text-slate-500">
                    사업자: {po.supplierBizNo}
                  </span>
                </div>
                <div className="text-xl font-extrabold text-slate-900">
                  {po.supplierName} <span className="text-sm font-semibold text-slate-600">귀하</span>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-sm text-slate-700 pt-1">
                  <div className="flex items-center gap-1.5">
                    <CheckCircle2 className="w-4 h-4 text-indigo-500 shrink-0" />
                    <span>
                      담당: <strong className="text-slate-900">{po.supplierManager}</strong>
                    </span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <Phone className="w-4 h-4 text-indigo-500 shrink-0" />
                    <span>{po.supplierPhone}</span>
                  </div>
                  <div className="sm:col-span-2 flex items-center gap-1.5">
                    <Mail className="w-4 h-4 text-indigo-500 shrink-0" />
                    <span className="font-mono text-xs sm:text-sm">{po.supplierEmail}</span>
                  </div>
                </div>
              </div>

              {/* Buyer Box */}
              <div className="rounded-xl border border-slate-300 bg-slate-50/80 p-5 space-y-3 relative">
                <div className="flex items-center justify-between border-b border-slate-200 pb-2.5">
                  <span className="text-xs font-extrabold text-slate-700 uppercase tracking-wider">
                    발신처 (발주 기업)
                  </span>
                  <span className="text-xs font-mono font-semibold text-slate-500">
                    사업자: 129-86-77012
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <div className="text-xl font-extrabold text-slate-900">
                    (주)에이아이키오스크 테크놀로지
                  </div>
                  <span className="inline-flex items-center justify-center w-14 h-14 rounded-full border-2 border-rose-500 bg-rose-50/80 text-rose-600 text-[11px] font-black leading-tight text-center select-none -rotate-6 shadow-2xs">
                    법인인감
                    <br />
                    날인필
                  </span>
                </div>
                <div className="text-sm text-slate-700 space-y-1.5">
                  <div>• 입고장소: {po.deliveryPlace}</div>
                  <div className="flex items-center gap-1.5 text-indigo-700 font-semibold">
                    <Calendar className="w-4 h-4 shrink-0" />
                    <span>
                      연계 수주처: {clientOrder.clientName} ({clientOrder.orderNo})
                    </span>
                  </div>
                </div>
              </div>
            </div>

            {/* Summary Banner */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between px-5 py-4 rounded-xl bg-indigo-50 border border-indigo-200 gap-2">
              <span className="text-sm font-bold text-indigo-950">
                아래와 같이 키오스크 제조용 자재(BOM)를 발주하오니 납기일 내 납품하여 주시기 바랍니다.
              </span>
              <div className="flex items-center gap-4 text-right shrink-0">
                <span className="text-sm font-semibold text-slate-700">
                  발주 품목: <strong className="text-indigo-700 text-base">{po.totalItemTypes}종</strong>
                </span>
                <span className="text-sm font-semibold text-slate-700">
                  총 발주 수량:{' '}
                  <strong className="text-indigo-700 text-lg font-black">
                    {po.totalOrderQty.toLocaleString()} {po.items[0]?.unit || 'EA'}
                  </strong>
                </span>
              </div>
            </div>

            {/* Parts Table */}
            <div className="border border-slate-300 rounded-xl overflow-hidden">
              <table className="w-full text-left border-collapse text-sm">
                <thead>
                  <tr className="bg-slate-800 text-white">
                    <th className="py-3 px-3 font-bold text-center w-12">No</th>
                    <th className="py-3 px-3 font-bold">부품코드</th>
                    <th className="py-3 px-3 font-bold">분류</th>
                    <th className="py-3 px-3 font-bold">품목명 / 상세 규격</th>
                    <th className="py-3 px-3 font-bold">적용 키오스크 (산출 근거)</th>
                    <th className="py-3 px-3 font-bold text-center">단위</th>
                    <th className="py-3 px-3 font-bold text-right">발주수량</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200">
                  {po.items.map((item, idx) => (
                    <tr key={item.partCode} className="even:bg-slate-50/70 hover:bg-indigo-50/40">
                      <td className="py-3.5 px-3 text-center font-semibold text-slate-500">
                        {idx + 1}
                      </td>
                      <td className="py-3.5 px-3 font-mono font-bold text-indigo-700">
                        {item.partCode}
                      </td>
                      <td className="py-3.5 px-3">
                        <span className="px-2.5 py-1 rounded-md bg-slate-100 text-slate-700 font-semibold text-xs">
                          {item.category}
                        </span>
                      </td>
                      <td className="py-3.5 px-3">
                        <div className="font-bold text-slate-900">{item.partName}</div>
                        <div className="text-xs text-slate-500 mt-0.5">{item.spec}</div>
                      </td>
                      <td className="py-3.5 px-3 text-xs text-indigo-600 font-semibold">
                        {item.sourceModels
                          .map((m) => `${m.modelCode}(${m.orderQty}대→${m.subTotalQty}${item.unit})`)
                          .join(', ')}
                      </td>
                      <td className="py-3.5 px-3 text-center text-slate-700 font-semibold">
                        {item.unit}
                      </td>
                      <td className="py-3.5 px-3 text-right font-black text-slate-900 text-base">
                        {item.adjustedOrderQty.toLocaleString()}
                      </td>
                    </tr>
                  ))}
                </tbody>
                <tfoot className="bg-slate-100 border-t-2 border-slate-800 font-bold text-slate-900">
                  <tr>
                    <td colSpan={5} className="py-3.5 px-4 text-right text-slate-700">
                      발주 수량 총 합계 (품목 {po.totalItemTypes}종)
                    </td>
                    <td className="py-3.5 px-3 text-center text-slate-600">합계</td>
                    <td className="py-3.5 px-3 text-right font-black text-indigo-700 text-lg">
                      {po.totalOrderQty.toLocaleString()}
                    </td>
                  </tr>
                </tfoot>
              </table>
            </div>

            {/* Footer Notes & Signature */}
            <div className="text-xs sm:text-sm text-slate-600 bg-slate-50 p-4 rounded-xl border border-slate-200 space-y-1.5">
              <p className="font-bold text-slate-800">※ 특기사항 및 납품 안내</p>
              <p>
                1. 납품 시 본 발주서 번호(<strong>{po.poNumber}</strong>)가 기재된 거래명세서 및 검사성적서를 동봉하여 주시기 바랍니다.
              </p>
              <p>
                2. 지정된 입고 납기요청일(<strong>{po.requestedDeliveryDate}</strong>)까지 당사 지정 입고장소로 납품 바랍니다.
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
