import { NextRequest, NextResponse } from 'next/server';
import ExcelJS from 'exceljs';
import path from 'path';
import fs from 'fs';

export async function POST(req: NextRequest) {
  // ▼ 1. 總時間計時開始
  console.time("⏱️ 總執行時間");

  try {
    // ----------------------------------------------------
    // Step 1: 解析請求 (Body Parsing)
    // ----------------------------------------------------
    console.time("Step 1: 解析 JSON");
    // 注意：req.json() 只能呼叫這一次
    const body = await req.json();
    const { applicantName, vendorName, vendorRep, contactPerson, phone, workers } = body;
    console.timeEnd("Step 1: 解析 JSON");

    // ----------------------------------------------------
    // Step 2: 資料庫查詢 (你的邏輯目前不需要這段，故跳過)
    // ----------------------------------------------------
    // 如果未來需要查 DB，請加在這裡

    // ----------------------------------------------------
    // Step 3: Excel 製作
    // ----------------------------------------------------
    console.time("Step 3: Excel 產生與寫入");

    // 1. 檢查並讀取模板
    const filePath = path.join(process.cwd(), 'public', 'template.xlsx');
    
    if (!fs.existsSync(filePath)) {
      console.timeEnd("Step 3: Excel 產生與寫入"); // 提早結束也要關計時
      console.timeEnd("⏱️ 總執行時間");
      return NextResponse.json({ error: 'Template file not found' }, { status: 500 });
    }

    const workbook = new ExcelJS.Workbook();
    // 讀取檔案是 I/O 操作，可能是效能瓶頸之一
    await workbook.xlsx.readFile(filePath);

    const worksheet = workbook.getWorksheet(1);
    if (!worksheet) {
      throw new Error('Worksheet not found');
    }

    // ==========================================
    // 🛠️ 設定：欄寬與小幫手
    // ==========================================
    worksheet.columns = [
      { key: 'A', width: 9 },      
      { key: 'B', width: 30.00 },  
      { key: 'C', width: 23.50 },  
      { key: 'D', width: 9 },      
      { key: 'E', width: 13.13 },  
      { key: 'F', width: 14 },     
      { key: 'G', width: 14 },     
      { key: 'H', width: 33.00 },  
    ];

    const appendToCell = (cellAddress: string, dataToAppend: string) => {
      const cell = worksheet.getCell(cellAddress);
      // 這裡加個檢查，避免 cell.value 為 null 時報錯
      const originalText = cell.value ? cell.value.toString().trim() : '';
      cell.value = `${originalText}${dataToAppend || ''}`;
    };

    const writeToCell = (cellAddress: string, data: string) => {
      const cell = worksheet.getCell(cellAddress);
      cell.value = data || '';
    };

    // 2. 填寫表頭資料
    appendToCell('C2', applicantName);
    appendToCell('A3', vendorName);
    appendToCell('C3', vendorRep);
    appendToCell('A4', contactPerson);
    appendToCell('C4', phone);

    // 3. 填寫員工列表 (迴圈)
    const workersList = Array.isArray(workers) ? workers : [];
    const startRow = 6;
    const maxRow = 15;

    workersList.forEach((worker: any, index: number) => {
      const currentRow = startRow + index;
      if (currentRow > maxRow) return;

      writeToCell(`B${currentRow}`, worker.name);
      writeToCell(`C${currentRow}`, worker.idNumber);
      writeToCell(`D${currentRow}`, worker.bloodType);

      // 設定生日
      const birthdayCell = worksheet.getCell(`E${currentRow}`);
      birthdayCell.value = worker.birthday ? worker.birthday.replace(/-/g, '/') : '';
      birthdayCell.font = { name: 'Calibri', size: 12, bold: false };
      birthdayCell.alignment = { vertical: 'middle', horizontal: 'center' };
    });

    // 4. 輸出檔案 Buffer
    const buffer = await workbook.xlsx.writeBuffer();
    
    // 計時結束：Step 3
    console.timeEnd("Step 3: Excel 產生與寫入");

    // ----------------------------------------------------
    // 結束與回應
    // ----------------------------------------------------
    
    const filename = `ee-4411-11供應商工安認證申請表_${applicantName || 'Export'}.xlsx`;
    console.log('正在下載檔案:', filename);

    // ▼ 2. 總時間計時結束
    console.timeEnd("⏱️ 總執行時間");

    // 🔴 補上這一行：定義 encodedFilename
    const encodedFilename = encodeURIComponent(filename);

    return new NextResponse(buffer, {
      headers: {
        'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'Content-Disposition': `attachment; filename="${encodedFilename}"; filename*=UTF-8''${encodedFilename}`,
      },
    });

  } catch (error) {
    console.error("錯誤:", error);
    // 發生錯誤也要確保計時器結束，避免 Log 混亂
    try { console.timeEnd("Step 1: 解析 JSON"); } catch {}
    try { console.timeEnd("Step 3: Excel 產生與寫入"); } catch {}
    try { console.timeEnd("⏱️ 總執行時間"); } catch {}
    
    return NextResponse.json({ error: 'Failed to generate excel' }, { status: 500 });
  }
}