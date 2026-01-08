'use client';

import { useState, useEffect, Suspense, useMemo } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';

// 引入元件
import ExportExcelBtn, { ApplicationData } from '../components/ExportExcelBtn';

// Firebase 相關引入
import { db } from '../../lib/firebase';
import { collection, getDocs, deleteDoc, doc, query, addDoc, where, updateDoc } from 'firebase/firestore';

// --- 定義帳號資料型別 ---
interface UserAccount {
  id: string;
  name: string;
  code: string;
  role?: string;
}

// --- 內部組件：包含主要邏輯 ---
function AdminContent() {
  const searchParams = useSearchParams();
  const targetUser = searchParams.get('target'); // 取得網址上的 ?target=xxx 

  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [passwordInput, setPasswordInput] = useState('');
  const [errorMsg, setErrorMsg] = useState('');
   
  // 資料狀態 (申請單)
  const [applications, setApplications] = useState<(ApplicationData & { id: string })[]>([]);
  // 資料狀態 (使用者帳號 - 只有 admin 才會用到)
  const [users, setUsers] = useState<UserAccount[]>([]);
  
  // 🟢 排序狀態設定 (預設依時間降冪)
  const [sortConfig, setSortConfig] = useState<{ key: string; direction: 'asc' | 'desc' }>({ key: 'createdAt', direction: 'desc' });

  const [loading, setLoading] = useState(false);
  const [importing, setImporting] = useState(false); 

  // 新增使用者用的 State
  const [newUser, setNewUser] = useState({ name: '', code: '' });

  // --- 1. 登入成功後，執行資料讀取 ---
  useEffect(() => {
    if (isAuthenticated && targetUser) {
      fetchApplications();
      if (targetUser === 'admin') {
        fetchAccounts();
      }
    }
  }, [isAuthenticated, targetUser]);

  // --- 讀取申請單 (Applications) ---
  const fetchApplications = async () => {
    setLoading(true);
    try {
      let q;
      if (targetUser === 'admin') {
        q = query(collection(db, "applications")); 
      } else {
        q = query(collection(db, "applications"), where("ownerId", "==", targetUser));
      }
      
      const querySnapshot = await getDocs(q);
      const list: any[] = [];
      querySnapshot.forEach((doc) => {
        list.push({ id: doc.id, ...doc.data() as any });
      });
      
      // 移除原本的預設排序，改由前端即時運算 (sortedApplications) 處理
      setApplications(list);
    } catch (error) {
      console.error("讀取申請單錯誤:", error);
    } finally {
      setLoading(false);
    }
  };

  // --- 🟢 處理排序邏輯 ---
  const handleSort = (key: string) => {
    let direction: 'asc' | 'desc' = 'asc';
    // 如果點擊的是同一個欄位，就反轉排序方向
    if (sortConfig.key === key && sortConfig.direction === 'asc') {
      direction = 'desc';
    }
    setSortConfig({ key, direction });
  };

  // --- 🟢 計算排序後的資料 (使用 useMemo 優化效能) ---
  const sortedApplications = useMemo(() => {
    const sortedList = [...applications];
    sortedList.sort((a: any, b: any) => {
      const { key, direction } = sortConfig;
      
      let valA = a[key];
      let valB = b[key];

      // 特殊欄位處理
      if (key === 'workers') {
        valA = a.workers?.length || 0;
        valB = b.workers?.length || 0;
      } else if (key === 'createdAt') {
        valA = valA ? new Date(valA).getTime() : 0;
        valB = valB ? new Date(valB).getTime() : 0;
      } else {
        // 一般字串處理 (避免 null 報錯)
        valA = valA ? String(valA).toLowerCase() : '';
        valB = valB ? String(valB).toLowerCase() : '';
      }

      if (valA < valB) return direction === 'asc' ? -1 : 1;
      if (valA > valB) return direction === 'asc' ? 1 : -1;
      return 0;
    });
    return sortedList;
  }, [applications, sortConfig]);

  // --- 輔助函式：顯示排序箭頭 ---
  const getSortIcon = (key: string) => {
    if (sortConfig.key !== key) return <span className="text-gray-300 ml-1">↕</span>;
    return sortConfig.direction === 'asc' ? <span className="text-blue-600 ml-1">▲</span> : <span className="text-blue-600 ml-1">▼</span>;
  };

  // --- 讀取帳號列表 (Accounts) ---
  const fetchAccounts = async () => {
    try {
      const q = query(collection(db, "accounts"));
      const querySnapshot = await getDocs(q);
      const userList: UserAccount[] = [];
      querySnapshot.forEach((doc) => {
        userList.push({ id: doc.id, ...doc.data() } as UserAccount);
      });
      userList.sort((a, b) => (a.name === 'admin' ? -1 : 1));
      setUsers(userList);
    } catch (error) {
      console.error("讀取帳號錯誤:", error);
    }
  };

  // --- 新增帳號 ---
  const handleAddUser = async () => {
    if (!newUser.name || !newUser.code) {
      alert("請輸入帳號與密碼");
      return;
    }
    if (users.some(u => u.name === newUser.name)) {
      alert("帳號名稱已存在");
      return;
    }

    try {
      await addDoc(collection(db, "accounts"), {
        name: newUser.name,
        code: newUser.code,
        role: 'editor'
      });
      alert(`✅ 帳號 ${newUser.name} 新增成功！`);
      setNewUser({ name: '', code: '' });
      fetchAccounts(); 
    } catch (error) {
      console.error("新增失敗", error);
      alert("新增失敗");
    }
  };

  // --- 刪除帳號 ---
  const handleDeleteUser = async (id: string, name: string) => {
    if (name === 'admin') {
      alert("❌ 不能刪除超級管理員 admin！");
      return;
    }
    if (confirm(`確定要刪除使用者「${name}」嗎？此操作無法復原。`)) {
      try {
        await deleteDoc(doc(db, "accounts", id));
        fetchAccounts();
      } catch (error) {
        console.error("刪除失敗", error);
        alert("刪除失敗");
      }
    }
  };

  // --- 修改密碼 ---
  const handleUpdatePassword = async (id: string, currentName: string) => {
    const newPass = prompt(`請輸入 ${currentName} 的新密碼：`);
    if (newPass && newPass.trim() !== '') {
      try {
        await updateDoc(doc(db, "accounts", id), {
          code: newPass
        });
        alert("✅ 密碼更新成功！");
        fetchAccounts();
      } catch (error) {
        console.error("更新失敗", error);
        alert("更新失敗");
      }
    }
  };

  // --- 處理登入 ---
  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg('驗證中...');

    if (!targetUser) {
      setErrorMsg('網址缺少 target 參數');
      return;
    }

    try {
      const q = query(collection(db, "accounts"), where("name", "==", targetUser));
      const querySnapshot = await getDocs(q);

      if (querySnapshot.empty) {
        setErrorMsg(`找不到使用者: ${targetUser}`);
        return;
      }

      const userData = querySnapshot.docs[0].data();
      if (String(userData.code) === passwordInput) {
        setIsAuthenticated(true);
        setErrorMsg('');
      } else {
        setErrorMsg('密碼錯誤 🚫');
        setPasswordInput('');
      }

    } catch (error) {
      console.error("登入錯誤:", error);
      setErrorMsg('系統錯誤');
    }
  };

  // --- 刪除申請單 ---
  const handleDeleteApp = async (id: string) => {
    if (confirm('確定要永久刪除這筆資料嗎？')) {
      try {
        await deleteDoc(doc(db, "applications", id));
        setApplications(prev => prev.filter(app => app.id !== id));
      } catch (error) {
        console.error("刪除失敗", error);
      }
    }
  };

  // --- 匯出 CSV ---
  const handleExportCSV = () => {
    const headers = ['BackupID(勿改),申請人,電話,供應商,負責人,聯絡人,填表時間,員工姓名,員工身分證,血型,生日,歸屬帳號']; // 🟢 CSV 也加上歸屬帳號
    const rows: string[] = [];
    // 匯出時使用目前的排序結果
    sortedApplications.forEach(app => {
      const clean = (val: any) => val ? String(val).replace(/,/g, '，') : ''; 
      const phoneFmt = app.phone ? `'="${app.phone}"` : ''; 
      const createdAt = app.createdAt || '';
      const owner = clean(app.ownerName || app.ownerId || ''); // 🟢 抓取 owner

      if (!app.workers || app.workers.length === 0) {
        rows.push(`${app.id},${clean(app.applicant)},${phoneFmt},${clean(app.vendor_name)},${clean(app.vendor_rep)},${clean(app.contact_person)},${createdAt},,,,,${owner}`);
      } else {
        app.workers.forEach(worker => {
          rows.push(`${app.id},${clean(app.applicant)},${phoneFmt},${clean(app.vendor_name)},${clean(app.vendor_rep)},${clean(app.contact_person)},${createdAt},${clean(worker.name)},${clean(worker.idNumber)},${clean(worker.bloodType)},${clean(worker.birthday)},${owner}`);
        });
      }
    });
    const csvContent = '\uFEFF' + headers.join('\n') + '\n' + rows.join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `Backup_${targetUser}_${new Date().toISOString().slice(0,10)}.csv`;
    link.click();
  };

  // --- 匯入 CSV ---
  const handleImportCSV = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!confirm(`⚠️ 匯入將寫入至「${targetUser}」。確定？`)) {
      e.target.value = ''; return;
    }
    setImporting(true);
    const reader = new FileReader();
    reader.onload = async (event) => {
      try {
        const text = event.target?.result as string;
        const lines = text.split('\n');
        const groupedApps = new Map<string, any>();

        for (let i = 1; i < lines.length; i++) {
          const line = lines[i].trim();
          if (!line) continue;
          const cols = line.includes('\t') ? line.split('\t') : line.split(',');
          const backupId = cols[0];
          const applicant = cols[1];
          if (!backupId || !applicant) continue;

          if (!groupedApps.has(backupId)) {
            groupedApps.set(backupId, {
              ownerId: targetUser,
              ownerName: targetUser,
              applicant: applicant.trim(),
              phone: cols[2]?.replace(/['="]/g, '').trim() || '',
              vendor_name: (cols[3] || '').trim(),
              vendor_rep: (cols[4] || '').trim(),
              contact_person: (cols[5] || '').trim(),
              createdAt: (cols[6] || new Date().toISOString()).trim(),
              workers: [] 
            });
          }
          if (cols[7] && cols[7].trim() !== '') {
            groupedApps.get(backupId).workers.push({
              name: cols[7].trim(),
              idNumber: (cols[8] || '').trim(),
              bloodType: (cols[9] || '').trim(),
              birthday: (cols[10] || '').trim().replace(/-/g, '/')
            });
          }
        }
        await Promise.all(Array.from(groupedApps.values()).map(d => addDoc(collection(db, "applications"), d)));
        alert("✅ 匯入成功！");
        fetchApplications(); 
      } catch (err) {
        alert("匯入失敗");
      } finally {
        setImporting(false);
        e.target.value = ''; 
      }
    };
    reader.readAsText(file);
  };

  // --- 登入頁面渲染 ---
  if (!isAuthenticated) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-100 font-sans p-4">
        <div className="bg-white p-8 rounded-2xl shadow-xl w-full max-w-md text-center">
          <h1 className="text-2xl font-bold mb-4">管理員登入</h1>
          <p className="bg-blue-100 text-blue-800 px-3 py-1 rounded-full inline-block mb-4 text-sm">User: {targetUser || '未知'}</p>
          <form onSubmit={handleLogin} className="space-y-4">
            <input type="password" placeholder="密碼" value={passwordInput} onChange={(e)=>setPasswordInput(e.target.value)} className="w-full border p-3 rounded-lg text-center" autoFocus />
            {errorMsg && <p className="text-red-500 font-bold">{errorMsg}</p>}
            <button type="submit" className="w-full py-3 bg-blue-600 text-white rounded-lg font-bold hover:bg-blue-700">登入</button>
          </form>
          <Link href="/"><button className="mt-4 text-gray-400 underline text-sm">回首頁</button></Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 p-6 md:p-12 font-sans">
      <div className="max-w-6xl mx-auto flex justify-between items-center mb-8">
        <div>
          <h1 className="text-3xl font-bold text-gray-800">🛠️ 後台管理系統</h1>
          <p className="text-gray-500 text-sm mt-1">目前使用者: <span className="font-bold text-blue-600">{targetUser}</span></p>
        </div>
        <div className="flex gap-2">
           <Link href="/"><button className="px-4 py-2 bg-gray-200 rounded hover:bg-gray-300">🏠 首頁</button></Link>
           <button onClick={() => setIsAuthenticated(false)} className="px-4 py-2 bg-red-100 text-red-600 rounded hover:bg-red-200">🔒 登出</button>
        </div>
      </div>

      {/* ======================================================== */}
      {/* 👑 超級管理員專屬區塊：帳號管理                         */}
      {/* ======================================================== */}
      {targetUser === 'admin' && (
        <div className="max-w-6xl mx-auto bg-white p-6 rounded-2xl shadow-md border-l-4 border-indigo-500 mb-8">
          <h2 className="text-xl font-bold text-gray-800 mb-4 flex items-center">
            👥 帳號管理中心 <span className="ml-2 text-xs bg-indigo-100 text-indigo-600 px-2 py-1 rounded">Super Admin Only</span>
          </h2>
          
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            <div className="md:col-span-2">
              <div className="overflow-hidden rounded-lg border border-gray-200">
                <table className="w-full text-left text-sm">
                  <thead className="bg-gray-100 text-gray-600">
                    <tr>
                      <th className="p-3">帳號 (Name)</th>
                      <th className="p-3">密碼 (Code)</th>
                      <th className="p-3">填表連結</th>
                      <th className="p-3 text-center">操作</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {users.map(u => (
                      <tr key={u.id} className="hover:bg-gray-50">
                        <td className="p-3 font-medium">
                          {u.name} 
                          {u.name === 'admin' && <span className="ml-2 text-xs bg-yellow-100 text-yellow-700 px-1 rounded">Admin</span>}
                        </td>
                        <td className="p-3 font-mono text-gray-400 tracking-widest">••••••</td>
                        <td className="p-3">
                           <a href={`/form/${u.name}`} target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:text-blue-800 underline text-xs flex items-center gap-1">
                             🔗 /form/{u.name}
                           </a>
                        </td>
                        <td className="p-3 flex justify-center gap-2">
                          <button onClick={() => handleUpdatePassword(u.id, u.name)} className="px-2 py-1 bg-blue-50 text-blue-600 rounded hover:bg-blue-100 text-xs">修改密碼</button>
                          {u.name !== 'admin' && (
                            <button onClick={() => handleDeleteUser(u.id, u.name)} className="px-2 py-1 bg-red-50 text-red-600 rounded hover:bg-red-100 text-xs">刪除</button>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
            <div className="bg-gray-50 p-4 rounded-xl border border-gray-200 h-fit">
              <h3 className="font-bold text-gray-700 mb-3">➕ 新增使用者</h3>
              <div className="space-y-3">
                <input type="text" placeholder="帳號名稱 (例如: user1)" className="w-full p-2 border rounded focus:outline-blue-500" value={newUser.name} onChange={e => setNewUser({...newUser, name: e.target.value})} />
                <input type="password" placeholder="設定密碼" className="w-full p-2 border rounded focus:outline-blue-500" value={newUser.code} onChange={e => setNewUser({...newUser, code: e.target.value})} />
                <button onClick={handleAddUser} className="w-full py-2 bg-indigo-600 text-white rounded font-bold hover:bg-indigo-700 shadow-sm">確認新增</button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ======================================================== */}
      {/* 📋 申請單資料列表 (含排序功能)                          */}
      {/* ======================================================== */}
      
      <div className="max-w-6xl mx-auto bg-white p-6 rounded-2xl shadow-sm border border-gray-100 mb-6 flex flex-wrap gap-4 items-center">
        <button onClick={handleExportCSV} className="flex items-center gap-2 px-5 py-2.5 bg-green-50 text-green-700 rounded-xl hover:bg-green-100 border border-green-200 font-medium">
          <span>📤</span> 備份資料庫 (CSV)
        </button>
        <div className="relative">
          <input type="file" accept=".csv" onChange={handleImportCSV} disabled={importing} className="absolute inset-0 w-full h-full opacity-0 cursor-pointer" />
          <button className={`flex items-center gap-2 px-5 py-2.5 rounded-xl border font-medium ${importing ? 'bg-gray-100' : 'bg-blue-50 text-blue-700 hover:bg-blue-100 border-blue-200'}`}>
            <span>{importing ? '⏳ 還原中...' : '📥 還原資料庫 (CSV)'}</span>
          </button>
        </div>
        <div className="text-xs text-gray-400 ml-auto hidden md:block">* 還原將寫入至 {targetUser} 帳戶</div>
      </div>

      <div className="max-w-6xl mx-auto bg-white rounded-2xl shadow-lg overflow-hidden border border-gray-100">
        {loading ? <div className="p-10 text-center text-gray-500">載入中...</div> : (
          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead className="bg-gray-50 text-gray-500 text-sm uppercase">
                <tr>
                  {/* 🟢 可排序的標題群 */}
                  <th className="p-4 cursor-pointer hover:bg-gray-100 select-none" onClick={() => handleSort('ownerName')}>
                    管理者 {getSortIcon('ownerName')}
                  </th>
                  <th className="p-4 cursor-pointer hover:bg-gray-100 select-none" onClick={() => handleSort('applicant')}>
                    申請人 {getSortIcon('applicant')}
                  </th>
                  <th className="p-4 cursor-pointer hover:bg-gray-100 select-none" onClick={() => handleSort('phone')}>
                    電話 {getSortIcon('phone')}
                  </th>
                  <th className="p-4 cursor-pointer hover:bg-gray-100 select-none" onClick={() => handleSort('vendor_name')}>
                    供應商 {getSortIcon('vendor_name')}
                  </th>
                  <th className="p-4 cursor-pointer hover:bg-gray-100 select-none" onClick={() => handleSort('workers')}>
                    進場人數 {getSortIcon('workers')}
                  </th>
                  <th className="p-4 cursor-pointer hover:bg-gray-100 select-none" onClick={() => handleSort('createdAt')}>
                    填表時間 {getSortIcon('createdAt')}
                  </th>
                  
                  <th className="p-4 text-center">操作</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {sortedApplications.length === 0 ? <tr><td colSpan={7} className="p-8 text-center text-gray-400">沒有資料</td></tr> : 
                  sortedApplications.map((app) => (
                    <tr key={app.id} className="hover:bg-gray-50 group">
                      {/* 🟢 顯示管理者名稱 (若無名稱則顯示 ID) */}
                      <td className="p-4 text-indigo-600 font-bold text-xs">{app.ownerName || app.ownerId || '-'}</td>
                      
                      <td className="p-4 font-medium">{app.applicant}</td>
                      <td className="p-4 text-gray-600">{app.phone}</td>
                      <td className="p-4 text-gray-600">{app.vendor_name}</td>
                      <td className="p-4"><span className="bg-gray-100 px-2 py-1 rounded text-xs">{app.workers?.length || 0} 人</span></td>
                      <td className="p-4 text-xs text-gray-400">{app.createdAt?.slice(0, 10) || '-'}</td>
                      <td className="p-4 flex justify-center gap-2">
                        <ExportExcelBtn data={app} />
                        <button onClick={() => handleDeleteApp(app.id)} className="p-2 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-lg">🗑️</button>
                      </td>
                    </tr>
                  ))
                }
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}

export default function AdminPage() {
  return (
    <Suspense fallback={<div>Loading...</div>}>
      <AdminContent />
    </Suspense>
  );
}