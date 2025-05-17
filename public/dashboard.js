// Firebase'i başlatmak için config dosyasını ve CDN'i eklediğinden emin olmalısın!
// Bu dosya dashboard.html'de en altta çağrılmalı.

document.addEventListener('DOMContentLoaded', function() {
    // Kullanıcı login mi kontrol et
    firebase.auth().onAuthStateChanged(function(user) {
        if (user) {
            // Kullanıcı adı varsa göster, yoksa email göster
            const name = user.displayName || user.email || 'User';
            document.getElementById('dashboard-username').textContent = name;
        } else {
            // Login yoksa auth.html'e yönlendir
            window.location.href = 'auth.html?tab=login';
        }
    });

    // Logout butonu
    const logoutBtn = document.querySelector('.logout-btn');
    if (logoutBtn) {
        logoutBtn.addEventListener('click', function() {
            firebase.auth().signOut().then(function() {
                window.location.href = 'auth.html?tab=login';
            });
        });
    }
}); 