import { OrderData } from '../types';
import * as XLSX from 'xlsx';

export const generateExcel = (orders: OrderData[], fileName: string = 'shipping_data.xlsx') => {
  // Transform data for Excel
  const wsData = [
    ['STT', 'Mã vận đơn', 'Mã sản phẩm', 'Số lượng', 'Ghi chú'], // Header
    ...orders.map(order => [
      order.pageNumber,
      order.trackingId,
      order.products.map(p => p.raw).join('+'),
      order.totalQty,
      order.note
    ])
  ];

  const wb = XLSX.utils.book_new();
  const ws = XLSX.utils.aoa_to_sheet(wsData);

  // Set column widths
  const wscols = [
    { wch: 10 }, // STT
    { wch: 20 }, // Tracking
    { wch: 40 }, // Products
    { wch: 10 }, // Qty
    { wch: 50 }, // Note
  ];
  ws['!cols'] = wscols;

  XLSX.utils.book_append_sheet(wb, ws, "Danh sách đơn hàng");
  XLSX.writeFile(wb, fileName);
};
