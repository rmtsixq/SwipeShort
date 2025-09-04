const urlParams = new URLSearchParams(window.location.search);
const tabParam = urlParams.get('tab');
if (tabParam === 'signup' || tabParam === 'login') {
    setTimeout(() => {
        const tabBtn = document.querySelector(`.auth-tab[data-tab="${tabParam}"]`);
        if (tabBtn) tabBtn.click();
    }, 0);
}

const tabs = document.querySelectorAll('.auth-tab');
const forms = document.querySelectorAll('.auth-form');

tabs.forEach(tab => {
    tab.addEventListener('click', () => {
        const target = tab.dataset.tab;
        tabs.forEach(t => t.classList.remove('active'));
        tab.classList.add('active');
        forms.forEach(form => {
            form.classList.remove('active');
            if (form.id === `${target}Form`) {
                form.classList.add('active');
            }
        });
    });
});

const loginForm = document.getElementById('loginForm');
if (loginForm) {
    loginForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const email = document.getElementById('loginEmail').value;
        const password = document.getElementById('loginPassword').value;
        try {
            await firebase.auth().signInWithEmailAndPassword(email, password);
            window.location.href = '/dashboard.html';
        } catch (error) {
            alert(error.message);
        }
    });
}

const signupForm = document.getElementById('signupForm');
if (signupForm) {
    signupForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const username = document.getElementById('signupUsername').value;
        const email = document.getElementById('signupEmail').value;
        const password = document.getElementById('signupPassword').value;
        const confirmPassword = document.getElementById('signupConfirmPassword').value;
        if (password !== confirmPassword) {
            alert('Passwords do not match!');
            return;
        }
        try {
            const userCredential = await firebase.auth().createUserWithEmailAndPassword(email, password);
            await userCredential.user.updateProfile({ displayName: username });
            window.location.href = '/dashboard.html';
        } catch (error) {
            alert(error.message);
        }
    });
}

const googleButtons = document.querySelectorAll('.google-auth-button');
googleButtons.forEach(button => {
    button.addEventListener('click', async () => {
        const provider = new firebase.auth.GoogleAuthProvider();
        try {
            const result = await firebase.auth().signInWithPopup(provider);
            if (!result.user.displayName) {
                let username = prompt('Please enter a username:');
                if (username) {
                    await result.user.updateProfile({ displayName: username });
                }
            }
            window.location.href = '/dashboard.html';
        } catch (error) {
            alert(error.message);
        }
    });
}); 