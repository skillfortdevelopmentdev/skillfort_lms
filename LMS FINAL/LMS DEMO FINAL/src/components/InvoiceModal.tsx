import React from 'react';
import { PaymentReport } from '../types';
import { X, Receipt, Download, FileText, CheckCircle } from 'lucide-react';
import { INITIAL_SETTINGS } from '../data';
import { SkillFortLogo } from './SkillFortLogo';

interface InvoiceModalProps {
  payment: PaymentReport;
  onClose: () => void;
}

export default function InvoiceModal({ payment, onClose }: InvoiceModalProps) {
  const handlePrint = () => {
    window.print();
  };

  // GST math
  const calculatedTaxableBase = Math.round((payment.amountPaid / 1.18) * 100) / 100;
  const centralGST = Math.round((payment.taxAmount / 2) * 100) / 100;
  const stateGST = Math.round((payment.taxAmount / 2) * 100) / 100;

  return (
    <div className="fixed inset-0 bg-black/85 backdrop-blur-sm z-50 flex items-center justify-center p-4 overflow-y-auto">
      <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-2xl overflow-hidden print:border-none print:bg-white print:text-black">
        
        {/* Header - Hidden in Print */}
        <div className="p-6 border-b border-slate-800 flex items-center justify-between print:hidden">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-brand-primary/10 text-brand-primary rounded-lg">
              <Receipt size={22} />
            </div>
            <h3 className="font-display font-semibold text-lg text-white">GST Tax Invoice</h3>
          </div>
          <button 
            type="button"
            onClick={onClose} 
            className="text-slate-400 hover:text-white transition-colors p-1 hover:bg-slate-800 rounded-lg"
          >
            <X size={20} />
          </button>
        </div>

        {/* Invoice Canvas */}
        <div className="p-8 space-y-8" id="printable-invoice">
          {/* Top Metadata */}
          <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
            <div>
              <div className="flex items-center gap-2">
                <SkillFortLogo className="scale-90 origin-left" />
              </div>
              <p className="text-xs text-slate-400 mt-1 print:text-slate-600">Premium Tech Academy Ltd.</p>
              <p className="text-xs text-slate-400 print:text-slate-600">GSTIN: 27AAECT9382M1Z0</p>
            </div>
            <div className="text-left md:text-right">
              <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 mb-2 print:text-emerald-600 print:border-emerald-600">
                <CheckCircle size={12} /> Paid
              </span>
              <p className="text-xs text-slate-400 print:text-slate-600">Invoice No: <span className="text-white font-mono font-medium print:text-black">{payment.invoiceId}</span></p>
              <p className="text-xs text-slate-400 print:text-slate-600">Date: {new Date(payment.createdAt).toLocaleDateString()}</p>
            </div>
          </div>

          <hr className="border-slate-800 print:border-slate-200" />

          {/* Billing Info */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 text-sm">
            <div>
              <p className="text-slate-500 font-medium mb-1 print:text-slate-500">BILLED TO:</p>
              <p className="font-semibold text-white print:text-black">{payment.userName}</p>
              <p className="text-xs text-slate-400 print:text-slate-600">{payment.userEmail}</p>
              <p className="text-xs text-slate-400 print:text-slate-600">Country: India (IGST/CGST/SGST Applicable)</p>
            </div>
            <div className="md:text-right">
              <p className="text-slate-500 font-medium mb-1 print:text-slate-500">TRANSACTION DETAILS:</p>
              <p className="text-xs text-slate-400 print:text-slate-600">Razorpay Order ID: <span className="font-mono text-slate-200 print:text-black">{payment.razorpayOrderId}</span></p>
              <p className="text-xs text-slate-400 print:text-slate-600">Razorpay Payment ID: <span className="font-mono text-slate-200 print:text-black">{payment.razorpayPaymentId}</span></p>
              {payment.couponApplied && (
                <p className="text-xs text-emerald-400 font-medium mt-1">Coupon Used: {payment.couponApplied}</p>
              )}
            </div>
          </div>

          {/* Table */}
          <div className="overflow-x-auto rounded-lg border border-slate-800 print:border-slate-200">
            <table className="w-full text-left border-collapse text-sm">
              <thead>
                <tr className="bg-slate-800/40 text-slate-300 border-b border-slate-800 print:bg-slate-100 print:text-slate-800 print:border-slate-200">
                  <th className="p-3 font-semibold">Course Module / Item description</th>
                  <th className="p-3 font-semibold text-right">Qty</th>
                  <th className="p-3 font-semibold text-right">Original Rate</th>
                  <th className="p-3 font-semibold text-right">Taxable Value</th>
                </tr>
              </thead>
              <tbody>
                <tr className="border-b border-slate-800 text-slate-200 print:border-slate-200 print:text-black">
                  <td className="p-3">
                    <span className="font-medium text-white print:text-black">{payment.courseTitle}</span>
                    <p className="text-xs text-slate-400 mt-0.5 print:text-slate-500">SAC Code: 999249 (Online Education Systems)</p>
                  </td>
                  <td className="p-3 text-right">1</td>
                  <td className="p-3 text-right">₹{payment.originalAmount}</td>
                  <td className="p-3 text-right">₹{calculatedTaxableBase}</td>
                </tr>
              </tbody>
            </table>
          </div>

          {/* Calculation breakups */}
          <div className="flex justify-end text-sm">
            <div className="w-full max-w-xs space-y-2.5">
              <div className="flex justify-between text-slate-400 print:text-slate-600">
                <span>Taxable Amount:</span>
                <span className="font-mono">₹{calculatedTaxableBase}</span>
              </div>
              <div className="flex justify-between text-slate-400 print:text-slate-600 border-b border-slate-800 pb-2 print:border-slate-200">
                <div>
                  <span className="block">Inclusive GST Breakup:</span>
                  <span className="text-xs text-slate-500 font-light block">CGST 9% + SGST 9% (or IGST 18%)</span>
                </div>
                <span className="font-mono text-right">
                  <span className="block">₹{centralGST} CGST</span>
                  <span className="block text-xs">+ ₹{stateGST} SGST</span>
                </span>
              </div>
              <div className="flex justify-between text-lg font-bold text-white print:text-black">
                <span>Grand Total:</span>
                <span className="font-mono text-brand-primary print:text-black">₹{payment.amountPaid}</span>
              </div>
            </div>
          </div>

          <hr className="border-slate-800 print:border-slate-200" />
          
          <div className="text-center text-[11px] text-slate-500 space-y-1 print:text-slate-500">
            <p>This is a computer-generated dynamic tax invoice generated on secure checkout at SkillFort LMS Platform.</p>
            <p>Need help? Contact our Support Desk at {INITIAL_SETTINGS.supportEmail}</p>
          </div>
        </div>

        {/* Footer actions - Hidden in Print */}
        <div className="p-6 border-t border-slate-800 bg-slate-900/50 flex flex-col sm:flex-row gap-3 justify-end print:hidden">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 border border-slate-700 text-slate-300 hover:text-white rounded-xl transition-all font-medium text-xs hover:bg-slate-800"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handlePrint}
            className="px-5 py-2.5 bg-brand-primary text-black font-semibold rounded-xl text-xs hover:bg-brand-primary-light transition-all flex items-center justify-center gap-2"
          >
            <Download size={14} /> Print Invoice
          </button>
        </div>

      </div>
    </div>
  );
}
