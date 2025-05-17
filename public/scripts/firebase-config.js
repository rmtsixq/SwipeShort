// Firebase yapılandırması (CDN uyumlu)
const firebaseConfig = {
    apiKey: "AIzaSyD8j28cQp0DhootMBlLeYb16QivnN57SxE",
    authDomain: "swipeshort-a81b8.firebaseapp.com",
    projectId: "swipeshort-a81b8",
    storageBucket: "swipeshort-a81b8.firebasestorage.app",
    messagingSenderId: "1033268225190",
    appId: "1:1033268225190:web:38d3d3b61764b819c2c067",
    measurementId: "G-XKBGWT2BHH"
};

// Firebase'i başlat (tekrar başlatmayı önle)
if (!firebase.apps.length) {
    firebase.initializeApp(firebaseConfig);
} 