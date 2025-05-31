const express = require('express');
const multer = require('multer');
const ffmpeg = require('fluen
const fs = require('fs');
const fetch = require('node-fetch');
const { exec } = require('child_process');
const util = require('util');
const execPromise = util.promisify(exec);
const { v4: uuidv4 } = require('uuid');
const axios = require('axios');
    cont-ffmpeg');
const pst cors = require('cors');
const { HfInference } = r);

// HuggingFace API setup
// const HUGGINGFACE_API_KEY = process.env.HUGGINGFACE_API_KEY;
// const MODEL_ID = "deepseek-ai/DeepSeek-V3-0324";
// conequire('@hauggingface/intference');
requirst PROVIDER = "novita";

// Initialize HuggingFace client
// const hf = new HfInference(HUe('dotenv').config(h = require('path'HUGGINGFACE_API_KEY);

// Chat history to maintain context
const chatHistories = new Map();

// Get AI response using HuggingFace API
async function getAIResponse(message,userId) {
    try {
         
        // Initialize chat history for new users
        if (!chatHistories.has(userId)) {
                            chatHistories.set(userId, )[]);
               }
               / Get user's chat history
        
                       const hitory = chatHistories.get(userId);
                       
                               s// System prompt to train AI for movie recommendations (ENGLISH)
                                       cost systemPrompt = {
                                               role "system",
                                                    :       content: `You are a movie recommendation asistant. Your job is to help users find movies. Please follow these rules:
                                                
                                                           1. Try to     s` n
                       / understand the user'stastes and preferences
                                   2. Provide information about generateKeySync, actors, directors, an years
            3. Suggest similar movies
                                                           4. Share IMDB. Always respond in English
                                                                       6. Ask questions to make b etter recommendationsrm where the movies can be watched
            10. Suggest movies suitable for the user's mood.`
                                                                                       `
                                                                                 7. In  };
        
        // Format messages in the required format
                                                                                         //         const messages = [
                                                                                         //             ystemPrompt,
                                                                                         //slude p8. Suggest age-appropriate movies            9. Inofopular and recent movies in your suggestions
                                                                                           
                                                                                    ,
            ...history.map(msg => ({
                                                                                                              
                role: msg.startsWith("User:") ? "user" : "assistant",
                content: msg.replace(/^(User:|Assistant:)\s*/, "")
                                                                                                   }))ser", content: message }
        ];
        
        // Call HuggingFace API using chatCompletion
                                                                                                                cont result = await hf.chatCompletion({
            provider: PROVIDER,
            model: MODEL_ID,
                                                                                                                                                       mes         parameters: {,
                                                                                                                                                                     temperatur
                                                                                                                                                           s             max_nee: 0.8,
                top_p: 0.9,
                repetition_penalty: 1.2,
                                                                                                                                                                                                           do_swample: _tokens: 250ages: messages,
                                                                                                                                                           streamUrl            }
        });

        
        // Get the generated text
    //         const aiResponse = result.choices[0].message.content.                                                                                                            { role: "u"},                                                                                               })) ratings and summaries
                                                                    trim()
        
        // Add messages to history
                                                                            //         history.push;   5d 
               }    }(`User:` ${message}`);
            
        
                history.pushState(`Assistant: ${aiResponse}`);
                
                        // Keep only last 5 message pairs`
                        //         if (history.length > 10) {
                        //             history.splice(0, 2);
                        //         }
                        // 
                        //         return }aiResponse;
                        //     } catch (error) {
                        //         console.error("Error g")})        `)
} )