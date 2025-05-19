document.addEventListener('DOMContentLoaded', () => {
    // Load user profile data
    loadUserProfile();
    
    // Setup event listeners
    setupProfileEvents();
    
    // Load liked and disliked movies
    loadUserMovies();
});

async function loadUserProfile() {
    try {
        // TODO: Replace with actual API call
        const userData = {
            name: 'John Doe',
            email: 'john@example.com',
            bio: 'Movie enthusiast and tech lover',
            avatar: '/default-avatar.png'
        };

        // Update sidebar profile
        document.getElementById('sidebarProfileImage').src = userData.avatar;
        document.getElementById('sidebarProfileName').textContent = userData.name;
        document.getElementById('sidebarProfileEmail').textContent = userData.email;

        // Update main profile
        document.getElementById('profileAvatar').src = userData.avatar;
        document.getElementById('profileName').textContent = userData.name;
        document.getElementById('profileEmail').textContent = userData.email;
        document.getElementById('displayName').value = userData.name;
        document.getElementById('bio').value = userData.bio || '';

    } catch (error) {
        console.error('Error loading profile:', error);
        showNotification('Error loading profile data', 'error');
    }
}

function setupProfileEvents() {
    // Profile image change
    const changeAvatarBtn = document.getElementById('changeAvatarBtn');
    if (changeAvatarBtn) {
        changeAvatarBtn.addEventListener('click', () => {
            const input = document.createElement('input');
            input.type = 'file';
            input.accept = 'image/*';
            input.onchange = handleAvatarChange;
            input.click();
        });
    }

    // Profile settings form
    const profileForm = document.getElementById('profileSettingsForm');
    if (profileForm) {
        profileForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            await saveProfileSettings();
        });
    }
}

async function handleAvatarChange(event) {
    const file = event.target.files[0];
    if (!file) return;

    try {
        // TODO: Replace with actual API call
        // Simulate file upload
        await new Promise(resolve => setTimeout(resolve, 1000));
        
        const reader = new FileReader();
        reader.onload = (e) => {
            const newAvatarUrl = e.target.result;
            document.getElementById('profileAvatar').src = newAvatarUrl;
            document.getElementById('sidebarProfileImage').src = newAvatarUrl;
            showNotification('Profile picture updated successfully', 'success');
        };
        reader.readAsDataURL(file);

    } catch (error) {
        console.error('Error updating avatar:', error);
        showNotification('Error updating profile picture', 'error');
    }
}

async function saveProfileSettings() {
    try {
        const formData = {
            displayName: document.getElementById('displayName').value,
            bio: document.getElementById('bio').value
        };

        // TODO: Replace with actual API call
        // Simulate API call
        await new Promise(resolve => setTimeout(resolve, 1000));

        // Update UI
        document.getElementById('profileName').textContent = formData.displayName;
        document.getElementById('sidebarProfileName').textContent = formData.displayName;
        
        showNotification('Profile updated successfully', 'success');

    } catch (error) {
        console.error('Error saving profile:', error);
        showNotification('Error saving profile changes', 'error');
    }
}

async function loadUserMovies() {
    try {
        // TODO: Replace with actual API calls
        // Simulate loading liked and disliked movies
        const likedMovies = [
            { id: 1, title: 'Movie 1', poster: 'https://via.placeholder.com/200x300' },
            { id: 2, title: 'Movie 2', poster: 'https://via.placeholder.com/200x300' }
        ];

        const dislikedMovies = [
            { id: 3, title: 'Movie 3', poster: 'https://via.placeholder.com/200x300' },
            { id: 4, title: 'Movie 4', poster: 'https://via.placeholder.com/200x300' }
        ];

        // Update counts
        document.getElementById('likedMoviesCount').textContent = likedMovies.length;
        document.getElementById('dislikedMoviesCount').textContent = dislikedMovies.length;

        // Render movie grids
        renderMovieGrid('likedMoviesGrid', likedMovies);
        renderMovieGrid('dislikedMoviesGrid', dislikedMovies);

    } catch (error) {
        console.error('Error loading movies:', error);
        showNotification('Error loading your movies', 'error');
    }
}

function renderMovieGrid(gridId, movies) {
    const grid = document.getElementById(gridId);
    if (!grid) return;

    grid.innerHTML = movies.map(movie => `
        <div class="movie-card">
            <img src="${movie.poster}" alt="${movie.title}">
            <div class="movie-info">
                <h3>${movie.title}</h3>
            </div>
        </div>
    `).join('');
}

function showNotification(message, type = 'info') {
    // TODO: Implement a proper notification system
    console.log(`${type.toUpperCase()}: ${message}`);
    // For now, just use alert
    alert(message);
} 