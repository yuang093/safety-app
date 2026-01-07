'use client'; 

import React, { useState } from 'react';

// 1. 定義員工 (Worker) 的資料結構
interface Worker {
  name: string;
  idNumber: string;
  bloodType: string;
  birthday: string;
}

// 2. 定義傳入元件的完整資料結構
export interface ApplicationData {
  applicant: string;      // 申請人
  vendor_name: string;    // 供應商名稱
  vendor_rep: string;     // 供應商負責人
  contact_person: string; // 聯絡人
  phone: string;          // 連絡電話
  workers?: Worker[];     // 員工列表

  // ✅ 請補上這一行！加個問號代表它是選填的 (Firebase 舊資料可能沒有)
  createdAt?: string;
}

export default function ExportExcelBtn({ data }: { data: ApplicationData }) {
  const [loading, setLoading] = useState(false);

  const handleDownload = async () => {
    setLoading(true);
    try {
      // 3. 呼叫後端 API
      const response = await fetch('/api/export-excel', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        // 4. 資料對應
        body: JSON.stringify({
          applicantName: data.applicant,
          vendorName: data.vendor_name,
          vendorRep: data.vendor_rep,
          contactPerson: data.contact_person,
          phone: data.phone,
          workers: data.workers || [] 
        }),
      });

      if (!response.ok) {
        throw new Error('Download failed');
      }

      // 5. 處理檔案下載
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;

      // 🔥 修正點在此：修改下載檔名規則
      // 確保這裡的字串格式與你想要的「ee-4411-11...」一致
      const safeName = data.applicant || 'Export';
      a.download = `ee-4411-11供應商工安認證申請表_${safeName}.xlsx`; 
      
      document.body.appendChild(a);
      a.click();
      
      // 清理記憶體
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
      
    } catch (error) {
      console.error('Excel export error:', error);
      alert('產出 Excel 失敗，請檢查後台日誌或稍後再試。');
    } finally {
      setLoading(false);
    }
  };

  return (
    <button 
      onClick={handleDownload}
      disabled={loading}
      className={`
        px-3 py-1 rounded text-sm text-white transition-colors
        ${loading ? 'bg-gray-400 cursor-not-allowed' : 'bg-green-600 hover:bg-green-700'}
      `}
    >
      {loading ? '處理中...' : '下載 Excel'}
    </button>
  );
}