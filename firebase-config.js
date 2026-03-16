// firebase-config.js
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-app.js";
import { getDatabase } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-database.js";

// 🔥 INI YANG BENER - SUDAH LENGKAP!
const firebaseConfig = {
    apiKey: "AIzaSyBxHmU3UUcX755QcOqJPXCoBq9dHpnpiEc",
    authDomain: "lempar-bola.firebaseapp.com",
    databaseURL: "https://lempar-bola-default-rtdb.asia-southeast1.firebasedatabase.app", // ✅ UDAH DIISI!
    projectId: "lempar-bola",
    storageBucket: "lempar-bola.firebasestorage.app",
    messagingSenderId: "962793485388",
    appId: "1:962793485388:web:e4d0ea8e0939cd8615f0e9"
};

let database;
try {
    const app = initializeApp(firebaseConfig);
    database = getDatabase(app);
} catch (error) {
    console.error('❌ Firebase gagal:', error);
}

export { database };