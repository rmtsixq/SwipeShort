# SwipeShort

PLEASE READ FULLY ShortSwipe is a modern movie and series watching platform for free without any ads (EDUCATIONAL PURPOSES ONLY). Users can make friends on the site, message them, and even share the movies they like! The unique catch is this platform is designed for the ones who can't find what to watch; well... now it's EASY! Just go to the Discover section to scroll through film trailers and find one easily. Couldn't find it? Just use the movieBOT; it's a bot that finds the movies you like. Just tell him what you like! (He is shy a lil bit.) Before I explain, I want to be upfront:
The project is for educational purposes only.
It does not host or store any movie files.
All videos are pulled through third-party APIs and embedded.
Why tf I Built This?
I was curious about how movie sites actually work and wanted to explore their flaws. My idea was to create a cleaner, ad-free interface and experiment with API integration.And they wanted us to make 100 hour project in neighborhood event and they let my ass do some pirate shit.
Along the way, I realized something important:
Without content, these kinds of sites are meaningless and boring
With content, they raise serious legal and ethical issues.
My Position
I don’t support piracy.
I built this to learn about API usage, scraping, and frontend/backend integration.
If anything here seems like piracy, the responsibility lies with the third-party API providers, not this project.
Looking back, I might not have chosen this exact path if I had understood the seriousness from the start. But I also don’t regret the 100+ hours I put in — it was a huge learning experience.lol
Thanks for understanding, and I hope people see this project for what it really is

##  Core Features

### **Video Streaming & Sources**
- **Multi-Source Video Streaming**: Access content from Cloudnestra, Vidsrc, Vidplay, and Upcloud
- **Smart Embed URL Management**: Automatic URL refresh and fallback systems for expired links
- **Video Stream Proxy**: Direct video streaming with CORS compatibility and range request support
- **Cloudflare Bypass**: Advanced User-Agent rotation and rate limiting protection

### **AI-Powered Movie Recommendations**
- **HuggingFace AI Integration**: DeepSeek-V3 model for intelligent movie suggestions
- **Contextual Chat System**: Maintains conversation history for personalized recommendations
- **Multi-Platform ID Support**: Automatic IMDB and TMDB ID extraction and linking
- **Smart Content Filtering**: Age-appropriate and mood-based content suggestions

### **Media Management**
- **TMDB Integration**: Comprehensive movie and TV show database access
- **Advanced Search**: Multi-language search with detailed metadata
- **Video Processing**: FFmpeg-powered video splitting and clip generation
- **Upload System**: User video upload with automatic duration-based segmentation

### **Technical Infrastructure**
- **Express.js Backend**: High-performance Node.js server with compression and rate limiting
- **CORS Optimization**: Enhanced cross-origin support for Mac and Apache compatibility
- **Health Monitoring**: Comprehensive debugging endpoints for platform compatibility
- **Error Handling**: Robust error management with detailed logging and fallback systems

##  Getting Started

### Prerequisites
- Node.js (v14 or higher)
- HuggingFace API Key
- TMDB API Key (optional, fallback key provided)

### Installation
```bash
# Clone the repository
git clone <repository-url>
cd SwipeShort

# Install dependencies
npm install

# Set up environment variables
cp .env.example .env
# Edit .env with your API keys

# Start the server
npm start
# or
node server.js
```

### Environment Variables
```env
HUGGINGFACE_API_KEY=your_huggingface_key
TMDB_API_KEY=your_tmdb_key
PORT=8080

```

##  API Endpoints

### Video Streaming
- `GET /api/video-stream` - Direct video streaming proxy
- `GET /api/iframe-proxy` - HTML iframe content proxy
- `GET /proxy/stream` - HLS stream proxy with M3U8 support
- `GET /api/smart-embed` - Intelligent embed URL management

### Movie & TV Content
- `GET /api/movies` - Latest movie listings
- `GET /api/search-movie` - TMDB movie search
- `GET /api/search-tv` - TMDB TV show search
- `GET /api/get-cloudnestra-embed` - Multi-source embed URL fetching

### AI & Chat
- `POST /api/chat` - AI-powered movie recommendation chat
- `GET /config/firebase.json` - Firebase configuration



##  Architecture

### Frontend Structure
- **Static Pages**: HTML/CSS/JS with responsive design
- **Video Player**: Advanced video viewer with multiple source support
- **Dashboard**: Movie browsing and search interface
- **Profile System**: User preferences and history

### Backend Services
- **Express Server**: RESTful API with middleware optimization
- **Video Processing**: FFmpeg integration for content manipulation
- **Proxy System**: Multi-layer proxy for external content access
- **AI Integration**: HuggingFace API for intelligent recommendations

### Data Sources
- **TMDB**: Movie and TV show metadata
- **Vidsrc**: Primary video source provider
- **Cloudnestra**: Secondary video streaming service
- **HuggingFace**: AI model hosting and inference

##  Security Features

- **Rate Limiting**: Express-slow-down integration
- **CORS Protection**: Enhanced cross-origin security
- **Input Validation**: Comprehensive request validation
- **Error Sanitization**: Secure error message handling

## 📱 Platform Compatibility

- **Desktop**: Full feature support with optimized performance
- **Mobile**: Responsive design with touch-friendly interface
- **Cross-Browser**: Chrome, Firefox, Safari, Edge support
- **OS Support**: Windows, macOS, Linux compatibility

## Development & Debugging



**Note**: This platform is designed for educational and personal use. Please ensure compliance with local laws and content provider terms of service.



