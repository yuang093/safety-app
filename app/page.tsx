'use client';

import { useState } from 'react';
import Link from 'next/link';
// 確保路徑對應到你剛剛修正的 firebase.ts
import { db } from '../lib/firebase';
import { collection, addDoc } from 'firebase/firestore';

export default function Home() {
  // --- 狀態邏輯 ---
  const [formData, setFormData] = useState({
    applicant: '',
    vendor_name: '',
    vendor_rep: '',
    contact_person: '',
    phone: '',
  });

  const [workers, setWorkers] = useState([
    { name: '', idNumber: '', bloodType: '', birthday: '' }
  ]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleWorkerChange = (index: number, field: string, value: string) => {
    const newWorkers = [...workers];
    // @ts-ignore
    newWorkers[index][field] = value;
    setWorkers(newWorkers);
  };

  const addWorker = () => {
    setWorkers([...workers, { name: '', idNumber: '', bloodType: '', birthday: '' }]);
  };

  const removeWorker = (index: number) => {
    const newWorkers = workers.filter((_, i) => i !== index);
    setWorkers(newWorkers);
  };

  // 送出表單到 Firebase
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    const isConfirmed = confirm("確定要送出申請嗎？");
    if (!isConfirmed) return;

    try {
      // 1. 整理資料
      const fullData = {
        ...formData,
        workers: workers,
        createdAt: new Date().toISOString() // 加上填寫時間
      };

      // 2. 寫入 Firebase 的 'applications' 集合
      await addDoc(collection(db, "applications"), fullData);

      // 3. 成功後提示
      alert("✅ 申請成功！資料已寫入資料庫。");
      
      // 重置表單
      setFormData({
        applicant: '', vendor_name: '', vendor_rep: '', contact_person: '', phone: ''
      });
      setWorkers([{ name: '', idNumber: '', bloodType: '', birthday: '' }]);

    } catch (error) {
      console.error("Error adding document: ", error);
      alert("❌ 發生錯誤，請稍後再試。");
    }
  };

  return (
    <main className="min-h-screen p-4 md:p-8 bg-gradient-to-br from-indigo-100 via-purple-50 to-pink-100 font-sans relative">
      
      {/* 右上角管理後台按鈕 */}
      <Link href="/admin" className="absolute top-4 right-4 md:top-6 md:right-8 group">
        <button className="flex items-center gap-2 bg-white/50 hover:bg-white backdrop-blur px-4 py-2 rounded-full text-gray-500 hover:text-indigo-600 transition-all shadow-sm border border-white hover:shadow-md">
          <span className="text-xl group-hover:rotate-90 transition-transform duration-300">⚙️</span>
          <span className="text-sm font-medium">管理後台</span>
        </button>
      </Link>

      {/* 主表單區域 */}
      <div className="max-w-2xl mx-auto bg-white/80 backdrop-blur-md p-6 md:p-10 rounded-3xl shadow-xl border border-white/50 mt-8">
        <div className="text-center mb-8">
          <span className="text-4xl">🚀</span>
          <h1 className="text-3xl font-bold mt-2 bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent">
            施工申請傳送門
          </h1>
          <p className="text-gray-500 text-sm mt-1">請填寫詳細資料以利審核 ✨</p>
        </div>
        
        <form onSubmit={handleSubmit} className="space-y-8">
          <section className="space-y-4">
            <div className="flex items-center gap-2 text-indigo-600 font-bold text-lg border-b pb-2 border-indigo-100">
              <span>📋</span> 基本資訊
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
              <InputField label="申請人" name="applicant" value={formData.applicant} onChange={handleChange} placeholder="請輸入大名" />
              <InputField label="連絡電話" name="phone" value={formData.phone} onChange={handleChange} placeholder="09xx-xxx-xxx" />
              <InputField label="供應商名稱" name="vendor_name" value={formData.vendor_name} onChange={handleChange} placeholder="公司名稱" />
              <InputField label="供應商負責人" name="vendor_rep" value={formData.vendor_rep} onChange={handleChange} placeholder="負責人姓名" />
              <div className="md:col-span-2">
                <InputField label="現場聯絡人" name="contact_person" value={formData.contact_person} onChange={handleChange} placeholder="現場找誰？" />
              </div>
            </div>
          </section>

          <section className="space-y-4">
            <div className="flex justify-between items-end border-b pb-2 border-indigo-100">
              <div className="flex items-center gap-2 text-indigo-600 font-bold text-lg">
                <span>👷</span> 進場夥伴名單
              </div>
              <button type="button" onClick={addWorker} className="text-sm bg-indigo-100 text-indigo-600 px-4 py-2 rounded-full font-medium hover:bg-indigo-200 transition-colors flex items-center gap-1">
                <span>➕</span> 新增一位
              </button>
            </div>

            <div className="space-y-4">
              {workers.map((worker, index) => (
                <div key={index} className="relative bg-white p-5 rounded-2xl shadow-sm border border-indigo-50 hover:shadow-md transition-shadow group">
                  <div className="absolute -top-3 -left-2 bg-indigo-500 text-white text-xs px-2 py-1 rounded-lg shadow-sm">夥伴 #{index + 1}</div>
                  {workers.length > 1 && (
                    <button type="button" onClick={() => removeWorker(index)} className="absolute -top-2 -right-2 w-8 h-8 bg-red-100 text-red-500 rounded-full flex items-center justify-center hover:bg-red-200 shadow-sm transition-transform hover:scale-110">✕</button>
                  )}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-2">
                    <input placeholder="姓名" value={worker.name} onChange={(e) => handleWorkerChange(index, 'name', e.target.value)} className="w-full bg-gray-50 border-transparent focus:bg-white focus:border-indigo-300 focus:ring-2 focus:ring-indigo-200 rounded-xl px-4 py-2 text-gray-700 placeholder-gray-400 transition-all outline-none" required />
                    <input placeholder="身分證字號" value={worker.idNumber} onChange={(e) => handleWorkerChange(index, 'idNumber', e.target.value)} className="w-full bg-gray-50 border-transparent focus:bg-white focus:border-indigo-300 focus:ring-2 focus:ring-indigo-200 rounded-xl px-4 py-2 text-gray-700 placeholder-gray-400 transition-all outline-none" required />
                    <div className="flex gap-4">
                      <input placeholder="血型" value={worker.bloodType} onChange={(e) => handleWorkerChange(index, 'bloodType', e.target.value)} className="w-1/3 bg-gray-50 border-transparent focus:bg-white focus:border-indigo-300 focus:ring-2 focus:ring-indigo-200 rounded-xl px-4 py-2 text-gray-700 placeholder-gray-400 transition-all outline-none" />
                      <input type="date" value={worker.birthday} onChange={(e) => handleWorkerChange(index, 'birthday', e.target.value)} className="w-2/3 bg-gray-50 border-transparent focus:bg-white focus:border-indigo-300 focus:ring-2 focus:ring-indigo-200 rounded-xl px-4 py-2 text-gray-700 placeholder-gray-400 transition-all outline-none" required />
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </section>

          <button type="submit" className="w-full py-4 px-6 rounded-2xl text-white font-bold text-lg bg-gradient-to-r from-blue-500 to-indigo-600 hover:from-blue-600 hover:to-indigo-700 shadow-lg shadow-indigo-200 transform hover:-translate-y-1 transition-all duration-200 active:scale-95">
            確認送出資料 📨
          </button>
        </form>
      </div>
      <div className="text-center mt-6 text-gray-400 text-xs">© 2026 Safety System | Powered by Cute Tech</div>
    </main>
  );
}

// InputField 元件
function InputField({ label, name, value, onChange, placeholder }: any) {
  return (
    <div className="group">
      <label className="block text-xs font-bold text-gray-500 mb-1 ml-1 uppercase tracking-wide group-focus-within:text-indigo-500 transition-colors">{label}</label>
      <input required name={name} value={value} onChange={onChange} placeholder={placeholder} className="w-full bg-gray-50 border border-gray-100 text-gray-800 text-sm rounded-xl px-4 py-3 focus:bg-white focus:border-indigo-300 focus:ring-4 focus:ring-indigo-100 outline-none transition-all shadow-sm" />
    </div>
  );
}