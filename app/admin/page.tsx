'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
// 請確認路徑是否正確
import ExportExcelBtn, { ApplicationData } from '../../app/components/ExportExcelBtn';

// Firebase 相關引入
import { db } from '../../lib/firebase';
import { collection, getDocs, deleteDoc, doc, query, orderBy, addDoc } from 'firebase/firestore';

const SECRET_PASSWORD = 'amam';

export default function AdminPage() {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [passwordInput, setPasswordInput] = useState('');
  const [errorMsg, setErrorMsg] = useState('');
  
  // 資料狀態
  const [applications, setApplications] = useState<(ApplicationData & { id: string })[]>([]);
  const [loading, setLoading] = useState(false);
  const [importing, setImporting] = useState(false); // 🆕 匯入中的狀態

  // --- 1. 登入成功後，從 Firebase 抓資料 ---
  useEffect(() => {
    if (isAuthenticated) {
      fetchApplications();
    }
  }, [isAuthenticated]);

  const fetchApplications = async () => {
    setLoading(true);
    try {
      // 依照時間排序 (createdAt 欄位若有)
      const q = query(collection(db, "applications")); 
      const querySnapshot = await getDocs(q);
      
      const list: any[] = [];
      querySnapshot.forEach((doc) => {
        list.push({ id: doc.id, ...doc.data() });
      });
      
      // 前端簡單排序：讓新加入的 (ID 比較大或時間比較晚) 排在前面
      // 這裡假設如果沒有 createdAt，就單純顯示
      setApplications(list);
    } catch (error) {
      console.error("讀取錯誤:", error);
      alert("讀取資料失敗");
    } finally {
      setLoading(false);
    }
  };

  // --- 2. 處理登入 ---
  const handleLogin = (e: React.FormEvent) => {
    e.preventDefault();
    if (passwordInput === SECRET_PASSWORD) {
      setIsAuthenticated(true);
      setErrorMsg('');
    } else {
      setErrorMsg('密碼錯誤 🚫');
      setPasswordInput('');
    }
  };

  // --- 3. 刪除資料 (從 Firebase 刪除) ---
  const handleDelete = async (id: string) => {
    if (confirm('確定要永久刪除這筆資料嗎？(無法復原)')) {
      try {
        await deleteDoc(doc(db, "applications", id));
        setApplications(prev => prev.filter(app => app.id !== id));
      } catch (error) {
        console.error("刪除失敗", error);
        alert("刪除失敗");
      }
    }
  };

  // --- 4. 匯出完整 CSV (備份用) ---
  const handleExportCSV = () => {
    const headers = [
      'BackupID(勿改),申請人,電話,供應商,負責人,聯絡人,填表時間,員工姓名,員工身分證,血型,生日'
    ];

    const rows: string[] = [];

    applications.forEach(app => {
      // 處理 undefined 的欄位，避免 CSV 錯位
      const clean = (val: any) => val ? String(val).replace(/,/g, '，') : ''; // 把逗號換全形避免 CSV 爛掉
      const phoneFmt = app.phone ? `'="${app.phone}"` : ''; // Excel 強制文字格式
      const createdAt = app.createdAt || '';

      if (!app.workers || app.workers.length === 0) {
        rows.push(
          `${app.id},${clean(app.applicant)},${phoneFmt},${clean(app.vendor_name)},${clean(app.vendor_rep)},${clean(app.contact_person)},${createdAt},,,,`
        );
      } else {
        app.workers.forEach(worker => {
          rows.push(
            `${app.id},${clean(app.applicant)},${phoneFmt},${clean(app.vendor_name)},${clean(app.vendor_rep)},${clean(app.contact_person)},${createdAt},${clean(worker.name)},${clean(worker.idNumber)},${clean(worker.bloodType)},${clean(worker.birthday)}`
          );
        });
      }
    });
    
    const csvContent = '\uFEFF' + headers.join('\n') + '\n' + rows.join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `Backup_Safety_${new Date().toISOString().slice(0,10)}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  };

// --- 5. 匯入 CSV (還原資料庫) ---
  const handleImportCSV = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!confirm("⚠️ 注意：匯入功能會將 CSV 資料「新增」到資料庫中。\n如果 ID 重複可能會產生兩筆資料。\n確定要開始還原嗎？")) {
      e.target.value = ''; 
      return;
    }

    setImporting(true);
    const reader = new FileReader();
    
    reader.onload = async (event) => {
      try {
        const text = event.target?.result as string;
        const lines = text.split('\n');
        
        const groupedApps = new Map<string, any>();

        // 從第 1 行開始 (跳過標題)
        for (let i = 1; i < lines.length; i++) {
          const line = lines[i].trim();
          if (!line) continue;

          // 🛠️ 修正點：自動判斷是 Tab 還是 逗號
          // 如果這行裡面有 Tab 符號，就用 Tab 切割，否則用逗號
          const cols = line.includes('\t') ? line.split('\t') : line.split(',');
          
          // 欄位對應: 0:ID, 1:申請人, 2:電話, 3:供應商, 4:負責人, 5:聯絡人, 6:填表時間, 7:工名, 8:工ID, 9:血, 10:生
          const backupId = cols[0];
          const applicant = cols[1];

          // 處理 Excel 可能留下的引號 (例如 "=""09xx""")
          // 修正 regex: 移除 ' = " 這些符號
          const phone = cols[2]?.replace(/['="]/g, '').trim() || ''; 
          
          if (!backupId || !applicant) continue;

          // 建立或取得申請單物件
          if (!groupedApps.has(backupId)) {
            groupedApps.set(backupId, {
              applicant: applicant.trim(), // 順手修剪空白
              phone: phone,
              vendor_name: (cols[3] || '').trim(),
              vendor_rep: (cols[4] || '').trim(),
              contact_person: (cols[5] || '').trim(),
              createdAt: (cols[6] || new Date().toISOString()).trim(),
              workers: [] 
            });
          }

          // 如果有員工資料，就塞進去
          if (cols[7] && cols[7].trim() !== '') {
            const worker = {
              name: cols[7].trim(),
              idNumber: (cols[8] || '').trim(),
              bloodType: (cols[9] || '').trim(),
              birthday: (cols[10] || '').trim().replace(/-/g, '/') // 確保生日格式統一
            };
            groupedApps.get(backupId).workers.push(worker);
          }
        }

        console.log(`解析完成，準備寫入 ${groupedApps.size} 筆主資料...`);

        const uploadPromises = Array.from(groupedApps.values()).map(appData => {
          return addDoc(collection(db, "applications"), appData);
        });

        await Promise.all(uploadPromises);

        alert(`✅ 成功還原 ${groupedApps.size} 筆申請單！`);
        fetchApplications(); 

      } catch (err) {
        console.error("匯入錯誤", err);
        alert("❌ 匯入失敗，請檢查 CSV 格式是否正確");
      } finally {
        setImporting(false);
        e.target.value = ''; 
      }
    };

    reader.readAsText(file);
  };

  // --- 畫面渲染 ---
  if (!isAuthenticated) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-indigo-100 via-purple-50 to-pink-100 font-sans p-4">
        <div className="bg-white/80 backdrop-blur-md p-8 rounded-3xl shadow-xl border border-white/50 w-full max-w-md text-center">
          <span className="text-5xl mb-4 block">🔐</span>
          <h1 className="text-2xl font-bold text-gray-800 mb-2">管理員登入</h1>
          <form onSubmit={handleLogin} className="space-y-4 mt-6">
            <input type="password" placeholder="請輸入密碼" value={passwordInput} onChange={(e) => setPasswordInput(e.target.value)} className="w-full bg-gray-50 border border-gray-200 text-center text-lg rounded-xl px-4 py-3 focus:outline-none focus:ring-2 focus:ring-indigo-300" autoFocus />
            {errorMsg && <p className="text-red-500 text-sm font-bold">{errorMsg}</p>}
            <button type="submit" className="w-full py-3 px-6 rounded-xl text-white font-bold bg-gradient-to-r from-blue-500 to-indigo-600 hover:shadow-lg transition-all">解鎖進入 🔓</button>
          </form>
          <Link href="/"><button className="mt-6 text-sm text-gray-400 hover:text-gray-600 underline">回首頁</button></Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 p-6 md:p-12 font-sans">
      <div className="max-w-6xl mx-auto flex justify-between items-center mb-8">
        <div>
          <h1 className="text-3xl font-bold text-gray-800">🛠️ 申請資料管理後台</h1>
          <p className="text-gray-500 text-sm mt-1">目前共有 {applications.length} 筆資料 (來自 Firebase)</p>
        </div>
        <div className="flex gap-3">
          <Link href="/"><button className="px-4 py-2 rounded-lg bg-gray-200 hover:bg-gray-300">🏠 回首頁</button></Link>
          <button onClick={() => setIsAuthenticated(false)} className="px-4 py-2 rounded-lg bg-red-100 text-red-600 hover:bg-red-200">🔒 登出</button>
        </div>
      </div>

      {/* 控制列 */}
      <div className="max-w-6xl mx-auto bg-white p-6 rounded-2xl shadow-sm border border-gray-100 mb-6 flex flex-wrap gap-4 items-center">
        
        {/* 匯出按鈕 */}
        <button onClick={handleExportCSV} className="flex items-center gap-2 px-5 py-2.5 bg-green-50 text-green-700 rounded-xl hover:bg-green-100 border border-green-200 font-medium transition-all active:scale-95">
          <span>📤</span> 備份資料庫 (CSV)
        </button>

        {/* 匯入按鈕 (帶有 Loading 狀態) */}
        <div className="relative">
          <input 
            type="file" 
            accept=".csv" 
            onChange={handleImportCSV} 
            disabled={importing}
            className="absolute inset-0 w-full h-full opacity-0 cursor-pointer disabled:cursor-not-allowed" 
          />
          <button className={`flex items-center gap-2 px-5 py-2.5 rounded-xl border font-medium transition-all ${importing ? 'bg-gray-100 text-gray-400 border-gray-200' : 'bg-blue-50 text-blue-700 hover:bg-blue-100 border-blue-200 active:scale-95'}`}>
            <span>{importing ? '⏳ 還原中...' : '📥 還原資料庫 (CSV)'}</span>
          </button>
        </div>

        <div className="text-xs text-gray-400 ml-auto hidden md:block">
          * 還原功能會將 CSV 內的資料「新增」至資料庫，不會覆蓋現有 ID。
        </div>
      </div>

      {/* 表格區 */}
      <div className="max-w-6xl mx-auto bg-white rounded-2xl shadow-lg overflow-hidden border border-gray-100">
        {loading ? (
          <div className="p-10 text-center text-gray-500">載入中... ⏳</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead>
                <tr className="bg-gray-50 border-b border-gray-100 text-gray-500 text-sm uppercase">
                  <th className="p-4">申請人</th>
                  <th className="p-4">電話</th>
                  <th className="p-4">供應商</th>
                  <th className="p-4">進場人數</th>
                  <th className="p-4">填表時間</th>
                  <th className="p-4 text-center">操作</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {applications.length === 0 ? (
                  <tr><td colSpan={6} className="p-8 text-center text-gray-400">目前沒有資料 📭</td></tr>
                ) : (
                  applications.map((app) => (
                    <tr key={app.id} className="hover:bg-gray-50 group">
                      <td className="p-4 font-medium text-gray-800">{app.applicant}</td>
                      <td className="p-4 text-gray-600">{app.phone}</td>
                      <td className="p-4 text-gray-600">{app.vendor_name}</td>
                      <td className="p-4"><span className="px-2 py-1 rounded-md bg-gray-100 text-xs text-gray-600">{app.workers?.length || 0} 人</span></td>
                      <td className="p-4 text-xs text-gray-400">{app.createdAt?.slice(0, 10) || '-'}</td>
                      <td className="p-4 flex justify-center gap-2">
                        <ExportExcelBtn data={app} />
                        <button onClick={() => handleDelete(app.id)} className="p-2 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-lg" title="刪除">🗑️</button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}