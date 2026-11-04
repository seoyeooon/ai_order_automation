import {
  Download,
  FileSpreadsheet,
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
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#0F2E26]/40 backdrop-blur-xs p-4 overflow-y-auto">
      <div className="relative w-full max-w-5xl bg-white text-[#0F2E26] rounded-lg shadow-xl border border-slate-200 overflow-hidden my-6">
        {/* Top Action Bar */}
        <div className="flex flex-wrap items-center justify-between px-6 py-4 bg-[#0F2E26] text-white gap-3">
          <div>
            <div className="flex items-center gap-2.5">
              <span className="font-semibold text-base text-white">{po.pdfFileName}</span>
              <span className="text-xs px-2 py-0.5 rounded bg-[#0E8A5F] text-white font-medium">
                공식 발주서 양식
              </span>
            </div>
            <p className="text-xs text-slate-300 mt-0.5">
              수신 업체: {po.supplierName} ({po.supplierManager} · {po.supplierEmail})
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => onPrint(po)}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-md text-xs font-medium bg-white/10 hover:bg-white/20 text-white border border-white/15 transition-colors cursor-pointer"
            >
              <Printer className="w-3.5 h-3.5" />
              인쇄
            </button>
            <button
              type="button"
              onClick={() => onDownloadPdf(po)}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-md text-xs font-medium bg-white text-[#0F2E26] hover:bg-slate-100 transition-colors cursor-pointer"
            >
              <Download className="w-3.5 h-3.5 text-[#0E8A5F]" />
              PDF 저장
            </button>
            <button
              type="button"
              onClick={() => onDownloadExcel(po)}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-md text-xs font-medium bg-white text-[#0F2E26] hover:bg-slate-100 transition-colors cursor-pointer"
            >
              <FileSpreadsheet className="w-3.5 h-3.5 text-[#0E8A5F]" />
              엑셀(.xlsx) 저장
            </button>
            <button
              type="button"
              onClick={() => onSendEmailPdf(po)}
              className="inline-flex items-center gap-1.5 px-4 py-2 rounded-md text-xs font-semibold bg-[#0E8A5F] hover:bg-[#0B704D] text-white transition-colors cursor-pointer"
            >
              <Send className="w-3.5 h-3.5" />
              PDF 발주서 전송
            </button>
            <button
              type="button"
              onClick={onClose}
              className="p-1.5 rounded-md text-slate-300 hover:text-white hover:bg-white/10 transition-colors cursor-pointer ml-1"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Document Preview Area */}
        <div className="p-6 md:p-10 bg-[#F7FAF8] max-h-[82vh] overflow-y-auto">
          <div className="max-w-4xl mx-auto bg-white rounded-lg shadow-xs border border-slate-200 p-8 md:p-10 space-y-7">
            {/* Top Solid Green Strip */}
            <div className="h-1.5 w-full bg-[#0E8A5F]" />

            {/* Document Title + Approval Stamp Box */}
            <div className="flex flex-col md:flex-row md:items-start justify-between border-b-2 border-[#0F2E26] pb-6 gap-6">
              <div>
                <p className="text-xs font-semibold tracking-widest text-[#0E8A5F] uppercase">
                  PURCHASE ORDER
                </p>
                <h2 className="text-3xl md:text-4xl font-bold tracking-[0.18em] text-[#0F2E26] mt-1">
                  구 매 발 주 서
                </h2>
                <div className="mt-3 space-y-1 text-sm text-slate-600">
                  <div>
                    발주번호: <strong className="font-mono text-[#0F2E26]">{po.poNumber}</strong>
                    <span className="mx-2 text-slate-300">|</span>
                    발주일자: <strong className="text-[#0F2E26]">{po.issueDate}</strong>
                  </div>
                  <div>
                    입고 납기요청일:{' '}
                    <strong className="text-[#0E8A5F] font-semibold">
                      {po.requestedDeliveryDate}
                    </strong>
                  </div>
                </div>
              </div>

              {/* Formal Approval Box (결재란) */}
              <div className="shrink-0">
                <table className="border-collapse text-xs text-center border border-slate-300">
                  <thead>
                    <tr className="bg-slate-50 text-slate-700 font-semibold">
                      <th
                        rowSpan={2}
                        className="border border-slate-300 px-2.5 py-2 bg-slate-100 text-[#0F2E26] w-8 leading-tight"
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
                      <td className="border border-slate-300 py-3 px-3 font-semibold text-[#0F2E26]">
                        자동발주
                        <div className="text-[10px] font-normal text-slate-400 mt-0.5">
                          {po.issueDate.slice(5)}
                        </div>
                      </td>
                      <td className="border border-slate-300 py-3 px-3 font-semibold text-[#0F2E26]">
                        구매팀장
                        <div className="text-[10px] font-normal text-[#0E8A5F] mt-0.5">
                          승인필
                        </div>
                      </td>
                      <td className="border border-slate-300 py-3 px-3 font-semibold text-[#0E8A5F]">
                        대표이사
                        <div className="text-[10px] font-normal text-[#0E8A5F] mt-0.5">날인필</div>
                      </td>
                    </tr>
                  </thead>
                </table>
              </div>
            </div>

            {/* Two-column Party Info (Supplier vs Buyer) */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Supplier Box */}
              <div className="rounded-lg border border-slate-200 bg-[#F7FAF8] p-5 space-y-2.5">
                <div className="flex items-center justify-between border-b border-slate-200 pb-2">
                  <span className="text-xs font-semibold text-[#0E8A5F]">
                    수신처 (공급사 / 매입 발주처)
                  </span>
                  <span className="text-xs font-mono text-slate-500">
                    사업자: {po.supplierBizNo}
                  </span>
                </div>
                <div className="text-lg font-bold text-[#0F2E26]">
                  {po.supplierName} <span className="text-sm font-normal text-slate-500">귀하</span>
                </div>
                <div className="text-sm text-slate-600 space-y-1 pt-0.5">
                  <div>
                    담당자: <strong className="font-medium text-[#0F2E26]">{po.supplierManager}</strong> ({po.supplierPhone})
                  </div>
                  <div>
                    이메일: <span className="font-mono text-xs sm:text-sm text-[#0F2E26]">{po.supplierEmail}</span>
                  </div>
                </div>
              </div>

              {/* Buyer Box */}
              <div className="rounded-lg border border-slate-200 bg-[#F7FAF8] p-5 space-y-2.5 relative">
                <div className="flex items-center justify-between border-b border-slate-200 pb-2">
                  <span className="text-xs font-semibold text-slate-700">
                    발신처 (발주 기업)
                  </span>
                  <span className="text-xs font-mono text-slate-500">
                    사업자: 129-86-77012
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <div className="text-lg font-bold text-[#0F2E26]">
                    (주)에이아이키오스크 테크놀로지
                  </div>
                  <span className="inline-flex items-center justify-center w-12 h-12 rounded-full border border-[#0E8A5F] bg-emerald-50 text-[#0E8A5F] text-[10px] font-semibold leading-tight text-center select-none">
                    법인인감
                    <br />
                    날인필
                  </span>
                </div>
                <div className="text-sm text-slate-600 space-y-1">
                  <div>입고장소: {po.deliveryPlace}</div>
                  <div className="text-[#0E8A5F] font-medium">
                    연계 수주처: {clientOrder.clientName || '-'} {clientOrder.orderNo ? `(${clientOrder.orderNo})` : ''}
                  </div>
                </div>
              </div>
            </div>

            {/* Summary Banner */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between px-5 py-3.5 rounded-lg bg-[#F3F8F5] border border-[#CFE5D8] gap-2">
              <span className="text-sm font-medium text-[#0F2E26]">
                아래와 같이 키오스크 제조용 자재(BOM)를 발주하오니 납기일 내 납품하여 주시기 바랍니다.
              </span>
              <div className="flex items-center gap-4 text-right shrink-0">
                <span className="text-sm text-slate-600">
                  발주 품목 <strong className="text-[#0F2E26] font-semibold">{po.totalItemTypes}종</strong>
                </span>
                <span className="text-sm text-slate-600">
                  총 발주 수량{' '}
                  <strong className="text-[#0E8A5F] text-base font-bold">
                    {po.totalOrderQty.toLocaleString()} {po.items[0]?.unit || 'EA'}
                  </strong>
                </span>
              </div>
            </div>

            {/* Parts Table */}
            <div className="border border-slate-200 rounded-lg overflow-hidden">
              <table className="w-full text-left border-collapse text-sm">
                <thead>
                  <tr className="bg-[#0F2E26] text-white">
                    <th className="py-3 px-3 font-medium text-center w-12">No</th>
                    <th className="py-3 px-3 font-medium">부품코드</th>
                    <th className="py-3 px-3 font-medium">분류</th>
                    <th className="py-3 px-3 font-medium">품목명 / 상세 규격</th>
                    <th className="py-3 px-3 font-medium">적용 키오스크 (산출 근거)</th>
                    <th className="py-3 px-3 font-medium text-center">단위</th>
                    <th className="py-3 px-3 font-medium text-right">발주수량</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200">
                  {po.items.map((item, idx) => (
                    <tr key={item.partCode} className="even:bg-[#F7FAF8] hover:bg-emerald-50/40">
                      <td className="py-3 px-3 text-center text-slate-500">
                        {idx + 1}
                      </td>
                      <td className="py-3 px-3 font-mono font-medium text-[#0E8A5F]">
                        {item.partCode}
                      </td>
                      <td className="py-3 px-3">
                        <span className="px-2 py-0.5 rounded bg-slate-100 text-slate-700 text-xs">
                          {item.category}
                        </span>
                      </td>
                      <td className="py-3 px-3">
                        <div className="font-medium text-[#0F2E26]">{item.partName}</div>
                        <div className="text-xs text-slate-500 mt-0.5">{item.spec}</div>
                      </td>
                      <td className="py-3 px-3 text-xs text-[#0E8A5F] font-medium">
                        {item.sourceModels
                          .map((m) => `${m.modelCode}(${m.orderQty}대→${m.subTotalQty}${item.unit})`)
                          .join(', ')}
                      </td>
                      <td className="py-3 px-3 text-center text-slate-600">
                        {item.unit}
                      </td>
                      <td className="py-3 px-3 text-right font-semibold text-[#0F2E26] text-base">
                        {item.adjustedOrderQty.toLocaleString()}
                      </td>
                    </tr>
                  ))}
                </tbody>
                <tfoot className="bg-[#F7FAF8] border-t-2 border-[#0F2E26] font-semibold text-[#0F2E26]">
                  <tr>
                    <td colSpan={5} className="py-3 px-4 text-right text-slate-600">
                      발주 수량 총 합계 (품목 {po.totalItemTypes}종)
                    </td>
                    <td className="py-3 px-3 text-center text-slate-600">합계</td>
                    <td className="py-3 px-3 text-right font-bold text-[#0E8A5F] text-lg">
                      {po.totalOrderQty.toLocaleString()}
                    </td>
                  </tr>
                </tfoot>
              </table>
            </div>

            {/* Footer Notes */}
            <div className="text-xs sm:text-sm text-slate-600 bg-[#F7FAF8] p-4 rounded-lg border border-slate-200 space-y-1">
              <p className="font-semibold text-[#0F2E26]">※ 특기사항 및 납품 안내</p>
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
