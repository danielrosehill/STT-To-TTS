
import { GoogleGenAI, Modality } from "@google/genai";
import { VoiceOption } from '../types';

if (!process.env.API_KEY) {
    throw new Error("API_KEY environment variable not set");
}

const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

export async function summarizeText(transcript: string): Promise<string> {
    const model = 'gemini-2.5-flash';
    const prompt = `Create a concise, abbreviated version of the following voice message transcript. Clean it up by removing filler words, pauses, and repetitions, but retain the core meaning and tone. Make it as short as possible. Transcript: "${transcript}"`;

    try {
        const response = await ai.models.generateContent({
            model: model,
            contents: prompt,
        });
        return response.text;
    } catch (error) {
        console.error("Error summarizing text:", error);
        throw new Error("Failed to summarize text.");
    }
}

export async function synthesizeSpeech(text: string, voice: VoiceOption): Promise<string> {
    const model = 'gemini-2.5-flash-preview-tts';
    const voiceName = voice === VoiceOption.Male ? 'Puck' : 'Kore';

    try {
        const response = await ai.models.generateContent({
            model: model,
            contents: [{ parts: [{ text: text }] }],
            config: {
                responseModalities: [Modality.AUDIO],
                speechConfig: {
                    voiceConfig: {
                        prebuiltVoiceConfig: { voiceName: voiceName },
                    },
                },
            },
        });
        const base64Audio = response.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data;
        if (!base64Audio) {
            throw new Error("No audio data received from API.");
        }
        return base64Audio;
    } catch (error) {
        console.error("Error synthesizing speech:", error);
        throw new Error("Failed to synthesize speech.");
    }
}
