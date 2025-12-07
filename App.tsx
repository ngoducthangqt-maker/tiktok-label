import React, { useState, useRef } from 'react';
import { Upload, FileText, Download, AlertCircle, Loader2, Sparkles, X } from 'lucide-react';
import { OrderData, ProductItem, ProcessingStats } from './types';
import { generateExcel } from './utils/excelHelper';
import { PrintManager } from './components/PrintManager';
import { GoogleGenAI } from "@google/genai";

// Declare pdfjsLib as it's loaded via CDN in index.html
declare const pdfjsLib: any;

const App: React.FC = () => {
  const [orders, setOrders] = useState<OrderData[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const [progress, setProgress] = useState(0);
  const [fileName, setFileName] = useState('');
  const [error, setError] = useState<string | null>(null);
  
  // AI Assistant State
  const [showAi, setShowAi] = useState(false);
  const [aiPrompt, setAiPrompt] = useState('');
  const [aiResponse, setAiResponse] = useState('');
  const [aiLoading, setAiLoading] = useState(false);

  const fileInputRef = useRef<HTMLInputElement>(null);

  // --- Logic: PDF Processing ---
  const processPDF = async (file: File) => {
    setIsProcessing(true);
    setProgress(0);
    setError(null);
    setOrders([]);
    setFileName(file.name);

    try {
      const arrayBuffer = await file.arrayBuffer();
      const pdf = await pdfjsLib.getDocument(arrayBuffer).promise;
      const totalPages = pdf.numPages;
      const processedOrders: OrderData[] = [];

      for (let i = 1; i <= totalPages; i++) {
        const page = await pdf.getPage(i);
        const textContent = await page.getTextContent();
        const textItems = textContent.items.map((item: any) => item.str).join(' ');
        
        // --- Extraction Heuristics ---
        // 1. Extract Tracking ID (Mã vận đơn)
        // Adjust regex based on common VN shipping label formats. 
        // Often 10-15 digits. Looking for isolated long number strings.
        const trackingMatch = textItems.match(/\b(8\d{10,14})\b/) || textItems.match(/\b(\d{10,15})\b/);
        const trackingId = trackingMatch ? trackingMatch[0] : 'Unknown';

        // 2. Extract Products
        // Pattern: Code followed by asterisk and number (e.g., TP8039*1)
        // Regex looks for: Alphanumeric (uppercase) + * + Number
        const productRegex = /([A-Z0-9]+)\s*\*\s*(\d+)/g;
        let match;
        const products: ProductItem[] = [];
        
        while ((match = productRegex.exec(textItems)) !== null) {
          // Filter out false positives (too short codes)
          if (match[1].length > 3) {
             products.push({
              code: match[1],
              qty: parseInt(match[2], 10),
              raw: `${match[1]}*${match[2]}`
            });
          }
        }

        // --- Business Logic ---
        const totalQty = products.reduce((acc, curr) => acc + curr.qty, 0);
        const isMulti = products.length > 1; // Or check distinct SKUs

        // Generate Note
        let note = '';
        if (isMulti) {
          const detail = products.map(p => `${p.raw}=${p.qty}`).join(', ');
          note = `Đơn ghép ${detail}`;
        }

        processedOrders.push({
          pageNumber: i,
          trackingId,
          products,
          totalQty,
          isMulti,
          note
        });

        setProgress(Math.round((i / totalPages) * 100));
      }

      setOrders(processedOrders);
    } catch (err: any) {
      console.error(err);
      setError(`Lỗi khi đọc file PDF: ${err.message || 'Không xác định'}`);
    } finally {
      setIsProcessing(false);
    }
  };

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file && file.type === 'application/pdf') {
      processPDF(file);
    } else {
      setError('Vui lòng chọn một file PDF hợp lệ.');
    }
  };

  // --- Logic: Stats ---
  const stats: ProcessingStats = {
    totalPages: orders.length,
    totalOrders: orders.length,
    singleOrders: orders.filter(o => !o.isMulti).length,
    multiOrders: orders.filter(o => o.isMulti).length,
  };

  // --- Logic: AI Assistant ---
  const handleAiQuery = async () => {
    if (!aiPrompt.trim() || !process.env.API_KEY) return;
    
    setAiLoading(true);
    setAiResponse('');

    try {
      const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
      
      // Prepare context data (summarized to save tokens)
      const dataContext = orders.map(o => 
        `Page:${o.pageNumber}, Tracking:${o.trackingId}, Items:${o.products.map(p => p.raw).join('+')}`
      ).slice(0, 100).join('\n'); // Limit to first 100 orders for preview context

      const systemPrompt = `
        You are an intelligent logistics assistant analyzing shipping data.
        Data Context (First 100 orders):
        ${dataContext}
        
        User Question: ${aiPrompt}
        
        Answer concisely in Vietnamese. If the user asks for analysis, count based on the provided context.
      `;

      const response = await ai.models.generateContent({
        model: 'gemini-2.5-flash',
        contents: systemPrompt,
      });

      setAiResponse(response.text);
    } catch (err) {
      setAiResponse('Lỗi kết nối Gemini API. Vui lòng kiểm tra API Key.');
    } finally {
      setAiLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 pb-20">
      {/* Header */}
      <header className="bg-white border-b border-slate-200 sticky top-0 z-30">
        <div className="max-w-6xl mx-auto px-4 h-16 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="bg-indigo-600 p-2 rounded-lg">
              <FileText className="w-5 h-5 text-white" />
            </div>
            <h1 className="text-xl font-bold text-slate-800">TikTok Label Master</h1>
          </div>
          <div className="flex items-center gap-4">
             {orders.length > 0 && (
                <button 
                  onClick={() => setShowAi(!showAi)}
                  className="flex items-center gap-2 text-sm font-medium text-indigo-600 hover:bg-indigo-50 px-3 py-1.5 rounded-lg transition-colors"
                >
                  <Sparkles className="w-4 h-4" />
                  AI Assistant
                </button>
             )}
             <a href="#" className="text-sm font-medium text-slate-500 hover:text-indigo-600">Hướng dẫn</a>
          </div>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-4 py-8 space-y-8">
        
        {/* Upload Section */}
        <section className="bg-white rounded-xl shadow-sm border border-slate-200 p-8 text-center">
          <div 
            className={`border-2 border-dashed rounded-xl p-10 transition-all ${isProcessing ? 'border-indigo-300 bg-indigo-50' : 'border-slate-300 hover:border-indigo-400 hover:bg-slate-50'}`}
          >
            <input 
              type="file" 
              accept=".pdf" 
              onChange={handleFileChange} 
              className="hidden" 
              id="pdf-upload"
              ref={fileInputRef}
              disabled={isProcessing}
            />
            
            {isProcessing ? (
              <div className="flex flex-col items-center gap-3">
                <Loader2 className="w-10 h-10 text-indigo-600 animate-spin" />
                <div>
                  <h3 className="text-lg font-semibold text-slate-800">Đang xử lý PDF...</h3>
                  <p className="text-slate-500">Đã đọc {progress}% số trang</p>
                </div>
              </div>
            ) : (
              <label htmlFor="pdf-upload" className="cursor-pointer flex flex-col items-center gap-3">
                <div className="bg-indigo-100 p-4 rounded-full text-indigo-600 mb-2">
                  <Upload className="w-8 h-8" />
                </div>
                <h3 className="text-xl font-semibold text-slate-800">
                  {orders.length > 0 ? 'Tải lên file khác' : 'Tải lên vận đơn PDF'}
                </h3>
                <p className="text-slate-500 max-w-sm mx-auto">
                  Kéo thả hoặc nhấn để chọn file PDF từ TikTok Shop. Hệ thống sẽ tự động bóc tách dữ liệu.
                </p>
                <span className="bg-slate-100 text-slate-600 px-4 py-2 rounded-lg text-sm font-medium mt-2">
                  Chọn File
                </span>
              </label>
            )}
          </div>
          
          {error && (
            <div className="mt-4 p-4 bg-red-50 text-red-700 rounded-lg flex items-center justify-center gap-2">
              <AlertCircle className="w-5 h-5" />
              <span>{error}</span>
            </div>
          )}
        </section>

        {orders.length > 0 && (
          <>
            {/* Stats Dashboard */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
                <p className="text-sm text-slate-500 mb-1">Tổng đơn</p>
                <p className="text-2xl font-bold text-slate-800">{stats.totalOrders}</p>
              </div>
              <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
                <p className="text-sm text-slate-500 mb-1">Đơn lẻ (1 loại)</p>
                <p className="text-2xl font-bold text-green-600">{stats.singleOrders}</p>
              </div>
              <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
                <p className="text-sm text-slate-500 mb-1">Đơn ghép</p>
                <p className="text-2xl font-bold text-orange-600">{stats.multiOrders}</p>
              </div>
               <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm flex flex-col justify-center">
                <button 
                  onClick={() => generateExcel(orders, `Ket_Qua_${fileName.replace('.pdf', '')}.xlsx`)}
                  className="w-full bg-emerald-600 hover:bg-emerald-700 text-white font-medium py-2 px-4 rounded-lg flex items-center justify-center gap-2 transition-colors"
                >
                  <Download className="w-4 h-4" />
                  Xuất Excel
                </button>
              </div>
            </div>

            {/* AI Assistant Modal/Panel */}
            {showAi && (
              <div className="bg-gradient-to-r from-indigo-50 to-purple-50 p-6 rounded-xl border border-indigo-100 shadow-sm animate-in fade-in slide-in-from-top-4">
                 <div className="flex justify-between items-start mb-4">
                    <div className="flex items-center gap-2">
                       <Sparkles className="w-5 h-5 text-indigo-600" />
                       <h3 className="font-semibold text-indigo-900">Gemini AI Assistant</h3>
                    </div>
                    <button onClick={() => setShowAi(false)} className="text-slate-400 hover:text-slate-600"><X className="w-5 h-5"/></button>
                 </div>
                 
                 <div className="space-y-3">
                    <div className="flex gap-2">
                       <input 
                          type="text" 
                          placeholder="Hỏi về đơn hàng (ví dụ: Sản phẩm nào bán chạy nhất?)"
                          className="flex-1 border border-indigo-200 rounded-lg px-4 py-2 focus:ring-2 focus:ring-indigo-500 outline-none"
                          value={aiPrompt}
                          onChange={(e) => setAiPrompt(e.target.value)}
                          onKeyDown={(e) => e.key === 'Enter' && handleAiQuery()}
                       />
                       <button 
                          onClick={handleAiQuery}
                          disabled={aiLoading}
                          className="bg-indigo-600 text-white px-4 py-2 rounded-lg font-medium hover:bg-indigo-700 disabled:opacity-50"
                       >
                          {aiLoading ? <Loader2 className="w-5 h-5 animate-spin" /> : 'Gửi'}
                       </button>
                    </div>
                    {aiResponse && (
                       <div className="bg-white p-4 rounded-lg border border-indigo-100 text-slate-700 text-sm leading-relaxed">
                          {aiResponse}
                       </div>
                    )}
                 </div>
              </div>
            )}

            {/* Print Manager Logic */}
            <PrintManager orders={orders} />

            {/* Preview Table */}
            <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
              <div className="px-6 py-4 border-b border-slate-200 bg-slate-50 flex items-center justify-between">
                <h3 className="font-semibold text-slate-800">Xem trước dữ liệu (100 đơn đầu)</h3>
                <span className="text-xs text-slate-500">Hiển thị {Math.min(100, orders.length)} / {orders.length} dòng</span>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-sm text-left">
                  <thead className="text-xs text-slate-500 uppercase bg-slate-50 border-b border-slate-200">
                    <tr>
                      <th className="px-6 py-3 w-16">Trang</th>
                      <th className="px-6 py-3">Mã vận đơn</th>
                      <th className="px-6 py-3">Sản phẩm</th>
                      <th className="px-6 py-3 w-20 text-center">SL</th>
                      <th className="px-6 py-3">Loại</th>
                      <th className="px-6 py-3">Ghi chú</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {orders.slice(0, 100).map((order) => (
                      <tr key={order.pageNumber} className="hover:bg-slate-50">
                        <td className="px-6 py-3 font-medium text-slate-600">{order.pageNumber}</td>
                        <td className="px-6 py-3 font-mono text-slate-600">{order.trackingId}</td>
                        <td className="px-6 py-3">
                          <div className="space-y-1">
                            {order.products.map((p, idx) => (
                              <div key={idx} className="inline-flex items-center bg-indigo-50 text-indigo-700 px-2 py-0.5 rounded text-xs mr-1 border border-indigo-100">
                                {p.raw}
                              </div>
                            ))}
                          </div>
                        </td>
                        <td className="px-6 py-3 text-center font-medium">{order.totalQty}</td>
                        <td className="px-6 py-3">
                           {order.isMulti ? (
                             <span className="bg-orange-100 text-orange-700 px-2 py-1 rounded text-xs font-medium">Đơn ghép</span>
                           ) : (
                             <span className="bg-green-100 text-green-700 px-2 py-1 rounded text-xs font-medium">Đơn lẻ</span>
                           )}
                        </td>
                        <td className="px-6 py-3 text-slate-500 italic max-w-xs truncate" title={order.note}>
                          {order.note || '-'}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </>
        )}
      </main>
    </div>
  );
};

export default App;
