// safety/lib/firebase.ts
import { initializeApp, getApps, getApp } from "firebase/app";
import { getFirestore } from "firebase/firestore";

// 你的 Firebase 設定
const firebaseConfig = {
  apiKey: "AIzaSyCh9qcpW28gnnwNx9ANcbD3Hlk6l1fRA8E",
  authDomain: "safety-64887.firebaseapp.com",
  projectId: "safety-64887",
  storageBucket: "safety-64887.firebasestorage.app",
  messagingSenderId: "524155424494",
  appId: "1:524155424494:web:d235d3284c9e0c238d2dff"
};

// 避免 Next.js 在開發模式下重複初始化 Firebase
// 如果已經有 app 就用現有的，沒有才初始化
const app = !getApps().length ? initializeApp(firebaseConfig) : getApp();

export const db = getFirestore(app);