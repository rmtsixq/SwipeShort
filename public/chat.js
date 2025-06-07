// Chat functionality
class ChatBot {
    constructor() {
        this.messagesContainer = document.querySelector('.chat-messages');
        this.messageInput = document.querySelector('.message-input');
        this.sendButton = document.querySelector('.send-button');
        this.typingIndicator = document.querySelector('.typing-indicator');
        
        this.setupEventListeners();
        this.addWelcomeMessage();
    }

    setupEventListeners() {
        this.sendButton.addEventListener('click', () => this.handleSendMessage());
        this.messageInput.addEventListener('keypress', (e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                this.handleSendMessage();
            }
        });

        // Auto-resize textarea
        this.messageInput.addEventListener('input', () => {
            this.messageInput.style.height = 'auto';
            this.messageInput.style.height = (this.messageInput.scrollHeight) + 'px';
        });
    }

    addWelcomeMessage() {
        this.addMessage({
            role: 'assistant',
            content: "Hello! I'm your AI assistant. How can I help you today?"
        });
    }

    async handleSendMessage() {
        const message = this.messageInput.value.trim();
        if (!message) return;

        // Add user message
        this.addMessage({ role: 'user', content: message });
        this.messageInput.value = '';
        this.messageInput.style.height = 'auto';

        // Show typing indicator
        this.showTypingIndicator();

        try {
            const response = await this.getAIResponse(message);
            this.hideTypingIndicator();
            this.addMessage({ 
                role: 'assistant', 
                content: response.response, 
                movieDetails: response.movieDetails 
            });
        } catch (error) {
            console.error('Error getting AI response:', error);
            this.hideTypingIndicator();
            this.addMessage({ 
                role: 'assistant', 
                content: "I'm sorry, I'm having trouble connecting right now. Please try again later." 
            });
        }
    }

    async getAIResponse(message) {
        try {
            const response = await fetch('/api/chat', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ message })
            });

            if (!response.ok) {
                throw new Error('Failed to get response from AI');
            }

            const data = await response.json();
            return data;
        } catch (error) {
            console.error('Error in getAIResponse:', error);
            throw error;
        }
    }

    async addMessage(message) {
        const messageElement = document.createElement('div');
        messageElement.className = `message ${message.role}-message`;
        
        const now = new Date();
        const timeString = now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
        
        let content = this.formatMessage(message.content);
        
        // If there are movie details, display movie posters
        if (message.movieDetails && message.movieDetails.length > 0) {
            const postersContainer = document.createElement('div');
            postersContainer.className = 'movie-posters';
            postersContainer.style.display = 'flex';
            postersContainer.style.gap = '10px';
            postersContainer.style.marginTop = '10px';
            postersContainer.style.overflowX = 'auto';
            postersContainer.style.padding = '10px 0';
            
            for (const movie of message.movieDetails) {
                if (movie.posterPath) {
                    const posterUrl = `https://image.tmdb.org/t/p/w200${movie.posterPath}`;
                    const posterElement = document.createElement('div');
                    posterElement.className = 'movie-poster';
                    posterElement.style.flex = '0 0 auto';
                    posterElement.style.width = '120px';
                    posterElement.style.cursor = 'pointer';
                    posterElement.style.transition = 'transform 0.2s';
                    
                    console.log('Creating poster for:', movie); // Debug log
                    
                    // Create a link element instead of a div
                    const linkElement = document.createElement('a');
                    linkElement.href = movie.mediaType === 'tv' ? `/tv.html?id=${movie.tmdbId}` : `/movie.html?id=${movie.imdbId}`;
                    linkElement.style.textDecoration = 'none';
                    linkElement.style.color = 'inherit';
                    linkElement.style.display = 'block';
                    
                    linkElement.innerHTML = `
                        <img src="${posterUrl}" alt="${movie.title}" style="width: 100%; border-radius: 8px; box-shadow: 0 2px 8px rgba(0,0,0,0.2);">
                        <div style="margin-top: 5px; font-size: 12px; color: #e4e4e7; text-align: center; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">
                            ${movie.title}
                        </div>
                    `;
                    
                    linkElement.addEventListener('click', (e) => {
                        e.preventDefault(); // Prevent default link behavior
                        console.log('Link clicked for:', movie.title, 'Type:', movie.mediaType); // Debug log
                        window.location.href = movie.mediaType === 'tv' ? `/tv.html?id=${movie.tmdbId}` : `/movie.html?id=${movie.imdbId}`;
                    });
                    
                    linkElement.addEventListener('mouseover', () => {
                        linkElement.style.transform = 'scale(1.05)';
                    });
                    
                    linkElement.addEventListener('mouseout', () => {
                        linkElement.style.transform = 'scale(1)';
                    });
                    
                    posterElement.appendChild(linkElement);
                    postersContainer.appendChild(posterElement);
                }
            }
            
            content += postersContainer.outerHTML;
        }
        
        messageElement.innerHTML = `
            <div class="message-header">
                <span class="message-sender">${message.role === 'user' ? 'You' : 'Assistant'}</span>
                <span class="message-time">${timeString}</span>
            </div>
            <div class="message-content">
                ${content}
            </div>
        `;
        
        this.messagesContainer.appendChild(messageElement);
        this.scrollToBottom();
    }

    formatMessage(content) {
        // Convert markdown to HTML
        return marked.parse(content);
    }

    showTypingIndicator() {
        if (this.typingIndicator) {
            this.typingIndicator.style.display = 'flex';
            this.scrollToBottom();
        }
    }

    hideTypingIndicator() {
        if (this.typingIndicator) {
            this.typingIndicator.style.display = 'none';
        }
    }

    scrollToBottom() {
        this.messagesContainer.scrollTop = this.messagesContainer.scrollHeight;
    }
}

// Initialize chat when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    new ChatBot();
}); 