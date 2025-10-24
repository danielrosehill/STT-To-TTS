
import React, { useState, useRef, useCallback } from 'react';
import { GoogleGenAI, LiveServerMessage, Modality, Blob as GenAI_Blob } from '@google/genai';
import { VoiceOption } from './types';
import { summarizeText, synthesizeSpeech } from './services/geminiService';
import { encode } from './utils/audioUtils';
import VoiceSelector from './components/VoiceSelector';
import AudioPlayer from './components/AudioPlayer';
import Spinner from './components/Spinner';

const App: React.FC = () => {
    const [isRecording, setIsRecording] = useState(false);
    const [isProcessing, setIsProcessing] = useState(false);
    const [processingStep, setProcessingStep] = useState('');
    const [selectedVoice, setSelectedVoice] = useState<VoiceOption>(VoiceOption.Female);
    const [finalAudio, setFinalAudio] = useState<string | null>(null);
    const [error, setError] = useState<string | null>(null);

    const transcriptRef = useRef<string>('');
    const audioContextRef = useRef<AudioContext | null>(null);
    const scriptProcessorRef = useRef<ScriptProcessorNode | null>(null);
    const mediaStreamSourceRef = useRef<MediaStreamAudioSourceNode | null>(null);
    const sessionPromiseRef = useRef<any>(null); // Using any because session type is complex

    const stopRecordingFlow = () => {
        setIsRecording(false);
        if (sessionPromiseRef.current) {
            sessionPromiseRef.current.then((session: any) => session.close());
            sessionPromiseRef.current = null;
        }
        if (mediaStreamSourceRef.current) {
            mediaStreamSourceRef.current.disconnect();
            mediaStreamSourceRef.current = null;
        }
        if (scriptProcessorRef.current) {
            scriptProcessorRef.current.disconnect();
            scriptProcessorRef.current.onaudioprocess = null;
            scriptProcessorRef.current = null;
        }
        if (audioContextRef.current && audioContextRef.current.state !== 'closed') {
            audioContextRef.current.close();
            audioContextRef.current = null;
        }
    };
    
    const handleStartRecording = async () => {
        setError(null);
        setFinalAudio(null);
        transcriptRef.current = '';

        if (isRecording) {
            stopRecordingFlow();
            return;
        }

        try {
            const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
            setIsRecording(true);

            audioContextRef.current = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: 16000 });
            mediaStreamSourceRef.current = audioContextRef.current.createMediaStreamSource(stream);
            scriptProcessorRef.current = audioContextRef.current.createScriptProcessor(4096, 1, 1);
            
            const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

            sessionPromiseRef.current = ai.live.connect({
                model: 'gemini-2.5-flash-native-audio-preview-09-2025',
                callbacks: {
                    onopen: () => console.log('Live session opened.'),
                    onmessage: (message: LiveServerMessage) => {
                        if (message.serverContent?.inputTranscription) {
                            transcriptRef.current += message.serverContent.inputTranscription.text;
                        }
                    },
                    onerror: (e: ErrorEvent) => {
                        console.error('Live session error:', e);
                        setError('A connection error occurred. Please try again.');
                        stopRecordingFlow();
                    },
                    onclose: (e: CloseEvent) => {
                        console.log('Live session closed.');
                        stream.getTracks().forEach(track => track.stop());
                    },
                },
                config: {
                    inputAudioTranscription: {},
                },
            });
            
            scriptProcessorRef.current.onaudioprocess = (audioProcessingEvent) => {
                const inputData = audioProcessingEvent.inputBuffer.getChannelData(0);
                const l = inputData.length;
                const int16 = new Int16Array(l);
                for (let i = 0; i < l; i++) {
                    int16[i] = inputData[i] * 32768;
                }
                const pcmBlob: GenAI_Blob = {
                    data: encode(new Uint8Array(int16.buffer)),
                    mimeType: 'audio/pcm;rate=16000',
                };
                sessionPromiseRef.current.then((session: any) => {
                    session.sendRealtimeInput({ media: pcmBlob });
                });
            };

            mediaStreamSourceRef.current.connect(scriptProcessorRef.current);
            scriptProcessorRef.current.connect(audioContextRef.current.destination);

        } catch (err) {
            console.error("Failed to start recording:", err);
            setError("Could not access the microphone. Please check permissions and try again.");
            setIsRecording(false);
        }
    };
    
    const handleStopRecording = useCallback(async () => {
        if (!isRecording) return;
        
        stopRecordingFlow();

        setIsProcessing(true);
        setError(null);

        try {
            // A short delay to ensure the last transcript part is received
            await new Promise(resolve => setTimeout(resolve, 500));
            
            if (!transcriptRef.current.trim()) {
                setError("No speech was detected. Please try recording again.");
                setIsProcessing(false);
                return;
            }

            setProcessingStep('Cleaning up transcript...');
            const summarizedText = await summarizeText(transcriptRef.current);
            
            setProcessingStep('Synthesizing audio...');
            const audioB64 = await synthesizeSpeech(summarizedText, selectedVoice);
            
            setFinalAudio(audioB64);
        } catch (err: any) {
            console.error("Processing failed:", err);
            setError(err.message || 'An error occurred during processing.');
        } finally {
            setIsProcessing(false);
            setProcessingStep('');
        }
    }, [isRecording, selectedVoice]);

    const handleReset = () => {
        setFinalAudio(null);
        setError(null);
    };

    return (
        <div className="min-h-screen bg-gray-900 text-white flex flex-col items-center justify-center p-4 font-sans">
            <div className="w-full max-w-md mx-auto flex flex-col items-center text-center">
                <header className="mb-8">
                    <h1 className="text-4xl md:text-5xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-indigo-400 to-purple-500">
                        Echo Scribe
                    </h1>
                    <p className="text-gray-400 mt-2">Record. Condense. Synthesize.</p>
                </header>

                <main className="w-full bg-gray-800/50 backdrop-blur-sm p-6 rounded-2xl shadow-2xl border border-gray-700">
                    {finalAudio ? (
                        <AudioPlayer base64Audio={finalAudio} onReset={handleReset} />
                    ) : (
                        <>
                            <div className="mb-6">
                                <h2 className="text-lg font-medium text-gray-200 mb-3">1. Select a Voice</h2>
                                <VoiceSelector selectedVoice={selectedVoice} setSelectedVoice={setSelectedVoice} disabled={isRecording || isProcessing} />
                            </div>

                            <div className="border-t border-gray-700 my-6"></div>

                            <div>
                                <h2 className="text-lg font-medium text-gray-200 mb-4">2. Record Your Memo</h2>
                                <div className="flex flex-col items-center space-y-4">
                                     <button
                                        onClick={isRecording ? handleStopRecording : handleStartRecording}
                                        disabled={isProcessing}
                                        className={`
                                            w-24 h-24 rounded-full flex items-center justify-center transition-all duration-300 ease-in-out
                                            focus:outline-none focus:ring-4 focus:ring-opacity-50
                                            ${isRecording ? 'bg-red-500 hover:bg-red-600 focus:ring-red-400 animate-pulse' : 'bg-indigo-500 hover:bg-indigo-600 focus:ring-indigo-400'}
                                            ${isProcessing ? 'bg-gray-600 cursor-not-allowed' : ''}
                                        `}
                                    >
                                        <div className={`w-10 h-10 transition-all duration-200 ${isRecording ? 'bg-white rounded-md' : 'bg-white rounded-full'}`}></div>
                                    </button>
                                    <span className="h-6 text-sm text-gray-300">
                                        {isRecording ? 'Recording...' : 'Tap to record'}
                                    </span>
                                </div>
                            </div>
                        </>
                    )}
                    
                    {isProcessing && (
                        <div className="absolute inset-0 bg-gray-900 bg-opacity-80 flex flex-col items-center justify-center rounded-2xl z-10">
                            <Spinner />
                            <p className="mt-4 text-lg text-gray-300">{processingStep}</p>
                        </div>
                    )}

                    {error && (
                        <div className="mt-6 p-4 bg-red-500/20 text-red-300 border border-red-500 rounded-lg text-center">
                            <p>{error}</p>
                        </div>
                    )}
                </main>
                 <footer className="mt-8 text-center text-gray-500 text-sm">
                    <p>Powered by Gemini</p>
                </footer>
            </div>
        </div>
    );
};

export default App;
