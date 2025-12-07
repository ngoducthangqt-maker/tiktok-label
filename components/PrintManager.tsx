import React, { useState, useMemo } from 'react';
import { Copy, Printer, Check } from 'lucide-react';
import { OrderData } from '../types';

interface PrintManagerProps {
  orders: OrderData[];
}

export const PrintManager: React.FC<PrintManagerProps> = ({ orders }) => {
  const [selectedProduct, setSelectedProduct] = useState<string>('');
  const [printString, setPrintString] = useState<string>('');
  const [copied, setCopied] = useState(false);

  // Extract unique product codes for the dropdown
  const uniqueProducts = useMemo(() => {
    const codes = new Set<string>();
    orders.forEach(order => {
      order.products.forEach(p => codes.add(p.raw));
    });
    return Array.from(codes).sort();
  }, [orders]);

  // Logic 1: Get pages for specific product
  const handleGetPagesForProduct = () => {
    if (!selectedProduct) return;
    const pages = orders
      .filter(o => o.products.some(p => p.raw === selectedProduct))
      .map(o => o.pageNumber)
      .join(',');
    setPrintString(pages || 'Không tìm thấy trang nào.');
  };

  // Logic 2: Group by product (Descending quantity)
  const handlePrintAllGrouped = () => {
    // 1. Separate Multi vs Single (Prompt implies grouping applies mainly to singles or dominant items)
    // However, the prompt says "Sort orders (not Multi) into groups".
    
    const singleOrders = orders.filter(o => !o.isMulti);
    
    // Group by Raw Product Code
    const groups: Record<string, number[]> = {};
    singleOrders.forEach(order => {
      // Assuming single orders have 1 product line usually
      const key = order.products[0]?.raw || 'Unknown';
      if (!groups[key]) groups[key] = [];
      groups[key].push(order.pageNumber);
    });

    // Sort groups by frequency (descending)
    const sortedKeys = Object.keys(groups).sort((a, b) => groups[b].length - groups[a].length);

    const pages = sortedKeys.flatMap(key => groups[key]);
    setPrintString(pages.join(','));
  };

  // Logic 3: Prioritize Single, then Multi at end
  const handlePrintPrioritySingle = () => {
    // 1. Run Logic 2
    const singleOrders = orders.filter(o => !o.isMulti);
    const groups: Record<string, number[]> = {};
    singleOrders.forEach(order => {
      const key = order.products[0]?.raw || 'Unknown';
      if (!groups[key]) groups[key] = [];
      groups[key].push(order.pageNumber);
    });
    const sortedKeys = Object.keys(groups).sort((a, b) => groups[b].length - groups[a].length);
    const singlePages = sortedKeys.flatMap(key => groups[key]);

    // 2. Get Multi Pages
    const multiPages = orders.filter(o => o.isMulti).map(o => o.pageNumber);

    // 3. Combine
    setPrintString([...singlePages, ...multiPages].join(','));
  };

  const copyToClipboard = () => {
    navigator.clipboard.writeText(printString);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-200 space-y-6">
      <div className="flex items-center gap-2 border-b border-slate-100 pb-4">
        <Printer className="w-5 h-5 text-indigo-600" />
        <h2 className="text-lg font-semibold text-slate-800">Chức Năng In Ấn Thông Minh</h2>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Controls */}
        <div className="space-y-4">
          <div className="space-y-2">
            <label className="text-sm font-medium text-slate-700">In theo sản phẩm</label>
            <div className="flex gap-2">
              <select 
                className="flex-1 border border-slate-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-indigo-500 outline-none"
                value={selectedProduct}
                onChange={(e) => setSelectedProduct(e.target.value)}
              >
                <option value="">-- Chọn Mã Sản Phẩm --</option>
                {uniqueProducts.map(p => (
                  <option key={p} value={p}>{p}</option>
                ))}
              </select>
              <button 
                onClick={handleGetPagesForProduct}
                disabled={!selectedProduct}
                className="bg-indigo-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                Lấy số trang
              </button>
            </div>
          </div>

          <div className="space-y-2 pt-2 border-t border-slate-100">
            <label className="text-sm font-medium text-slate-700">In hàng loạt</label>
            <div className="grid grid-cols-1 gap-2">
              <button 
                onClick={handlePrintAllGrouped}
                className="w-full bg-white border border-slate-300 text-slate-700 px-4 py-2.5 rounded-lg text-sm font-medium hover:bg-slate-50 transition-colors text-left flex items-center justify-between group"
              >
                <span>In toàn bộ (Nhóm theo SP - SL giảm dần)</span>
                <span className="text-xs bg-slate-100 px-2 py-1 rounded text-slate-500 group-hover:bg-slate-200">Chỉ đơn lẻ</span>
              </button>
              <button 
                onClick={handlePrintPrioritySingle}
                className="w-full bg-white border border-slate-300 text-slate-700 px-4 py-2.5 rounded-lg text-sm font-medium hover:bg-slate-50 transition-colors text-left flex items-center justify-between group"
              >
                <span>In toàn bộ (Ưu tiên đơn lẻ)</span>
                <span className="text-xs bg-slate-100 px-2 py-1 rounded text-slate-500 group-hover:bg-slate-200">Đơn lẻ trước, Ghép sau</span>
              </button>
            </div>
          </div>
        </div>

        {/* Output */}
        <div className="space-y-2 flex flex-col">
          <label className="text-sm font-medium text-slate-700 flex justify-between">
            <span>Chuỗi số trang (để Copy)</span>
            {printString && (
               <span className="text-xs text-indigo-600 font-medium">
                 {printString.split(',').length} trang
               </span>
            )}
          </label>
          <div className="relative flex-1">
            <textarea 
              readOnly
              className="w-full h-full min-h-[160px] p-4 bg-slate-50 border border-slate-300 rounded-lg text-sm font-mono text-slate-600 resize-none focus:ring-2 focus:ring-indigo-500 outline-none"
              placeholder="Kết quả sẽ hiện ở đây..."
              value={printString}
            />
            {printString && (
              <button 
                onClick={copyToClipboard}
                className="absolute top-2 right-2 bg-white p-2 rounded-md shadow-sm border border-slate-200 hover:bg-slate-50 text-slate-600 transition-all"
                title="Copy to clipboard"
              >
                {copied ? <Check className="w-4 h-4 text-green-500" /> : <Copy className="w-4 h-4" />}
              </button>
            )}
          </div>
          <p className="text-xs text-slate-500">
            * Copy chuỗi này và dán vào ô "Pages" trong hộp thoại in (Ctrl+P).
          </p>
        </div>
      </div>
    </div>
  );
};
