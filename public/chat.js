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
    }

    addWelcomeMessage() {
        const welcomeMessage = {
            role: 'assistant',
            content: "Hi! I'm your movie recommendation assistant. I can help you find the perfect movie or TV show. Just tell me what you're in the mood for!"
        };
        this.addMessage(welcomeMessage);
    }

    async handleSendMessage() {
        const message = this.messageInput.value.trim();
        if (!message) return;

        // Add user message
        this.addMessage({ role: 'user', content: message });
        this.messageInput.value = '';

        // Show typing indicator
        this.showTypingIndicator();

        try {
            const response = await this.getAIResponse(message);
            this.hideTypingIndicator();
            this.addMessage({ role: 'assistant', content: response });
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
            return data.response;
        } catch (error) {
            console.error('Error in getAIResponse:', error);
            throw error;
        }
    }

    addMessage(message) {
        const messageElement = document.createElement('div');
        messageElement.className = `message ${message.role}-message`;
        
        const now = new Date();
        const timeString = now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
        
        messageElement.innerHTML = `
            <div class="message-header">
                <img src="${message.role === 'user' ? '/images/user.jpg' : '/images/face.png'}" 
                     alt="${message.role}" 
                     class="message-avatar">
                <span class="message-sender">${message.role === 'user' ? 'You' : 'MovieBot'}</span>
                <span class="message-time">${timeString}</span>
            </div>
            <div class="message-content">
                ${this.formatMessage(message.content)}
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
        this.typingIndicator.style.display = 'flex';
        this.scrollToBottom();
    }

    hideTypingIndicator() {
        this.typingIndicator.style.display = 'none';
    }

    scrollToBottom() {
        this.messagesContainer.scrollTop = this.messagesContainer.scrollHeight;
    }
}

// Initialize chat when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    new ChatBot();
}); 