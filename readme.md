# SwipeShort

SwipeShort is a modern movie and video discovery platform inspired by TikTok/YouTube Shorts. Users can swipe through random movie trailers, like and comment on content, and discover new films in a fun, interactive way. The platform also features user profiles, a dashboard, and a responsive, mobile-friendly design.

## Features
- **TikTok-Style Swipeable Feed**: Discover random movie trailers and short clips with smooth vertical swipe navigation (see `discover.html`).
- **Movie & TV Show Dashboard**: Browse, filter, and search for movies and TV shows using TMDB API integration.
- **User Profiles**: View your liked movies/TV shows, stats, and comments in a beautiful profile page.
- **Like & Comment System**: Like your favorite content and see your liked items in your profile.
- **Firebase Auth & Firestore**: Secure authentication and real-time data storage for likes, comments, and user info.
- **Responsive Design**: Works seamlessly on both desktop and mobile devices.
- **Modern UI/UX**: Clean, attractive, and easy-to-use interface.

## Technical Stack
- **Frontend**: HTML, CSS, JavaScript (Vanilla + Swiper.js for swipe feed)
- **Backend**: Node.js, Express
- **Database**: Firebase Firestore
- **APIs**: TMDB API (movie/TV data), YouTube (trailers)
- **Video Processing**: FFmpeg (for advanced features)

## Getting Started
1. Clone the repository
2. Install dependencies: `npm install`
3. Start the server: `node server.js`
4. Open `http://localhost:3000` in your browser

## Requirements
- Node.js
- FFmpeg (for video processing)
- TMDB API Key
- Firebase Project (for Auth & Firestore)

## Project Structure
- `public/` - Frontend files (HTML, CSS, JS)
- `public/discover.html` - TikTok-style swipeable feed
- `public/dashboard.html` - Main dashboard for browsing
- `public/profile.html` - User profile page
- `public/scripts/videoViewer.js` - Advanced video viewer logic
- `server.js` - Express backend

## Future Updates
- Infinite scroll and lazy loading for swipe feed
- Advanced recommendations and personalized feeds
- More social features (comments, shares)
- Pre-downloaded videos for offline viewing

---



