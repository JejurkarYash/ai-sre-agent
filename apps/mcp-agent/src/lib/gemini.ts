import {GoogleGenAI} from "@google/genai"
import dotenv from "dotenv";
dotenv.config();


export const ai = new GoogleGenAI({
    apiKey: process.env.GEMINI_API_KEY || ""
}); 

export const MODEL = "gemini-2.5-flash"; 

