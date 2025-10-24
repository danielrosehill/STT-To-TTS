
import React, { useEffect, useState, useCallback } from 'react';
import { decode, decodeAudioData } from '../utils/audioUtils';

interface AudioPlayerProps {
    base64Audio: string;
    onReset: () => void;
}

const AudioPlayer: React.FC<AudioPlayerProps> = ({ base64Audio, onReset }) => {
    const [audioUrl, setAudioUrl] = useState<string | null>(null);
    const [audioBlob, setAudioBlob] = useState<Blob | null>(null);

    const createAudioObjects = useCallback(async () => {
        try {
            const outputAudioContext = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: 24000 });
            const decodedBytes = decode(base64Audio);
            const audioBuffer = await decodeAudioData(decodedBytes, outputAudioContext, 24000, 1);
            
            // Convert AudioBuffer to WAV Blob
            const wavBlob = bufferToWav(audioBuffer);
            setAudioBlob(wavBlob);

            const url = URL.createObjectURL(wavBlob);
            setAudioUrl(url);

            return () => {
                if (url) {
                    URL.revokeObjectURL(url);
                }
            };
        } catch (error) {
            console.error("Failed to decode or create audio URL:", error);
        }
    }, [base64Audio]);


    useEffect(() => {
        const cleanupPromise = createAudioObjects();
        return () => {
            cleanupPromise.then(cleanup => cleanup && cleanup());
        };
    }, [createAudioObjects]);

    const handleDownload = () => {
        if (!audioBlob) return;
        const url = URL.createObjectURL(audioBlob);
        const a = document.createElement('a');
        a.style.display = 'none';
        a.href = url;
        a.download = 'echo-scribe-memo.wav';
        document.body.appendChild(a);
        a.click();
        window.URL.revokeObjectURL(url);
        document.body.removeChild(a);
    };

    // Helper to convert AudioBuffer to a WAV file blob
    const bufferToWav = (buffer: AudioBuffer): Blob => {
        const numOfChan = buffer.numberOfChannels,
            len = buffer.length * numOfChan * 2,
            wavHeader = new ArrayBuffer(44);
        let view = new DataView(wavHeader),
            channels = [],
            i, sample,
            offset = 0;
        
        view.setUint32(0, 0x46464952, true); // "RIFF"
        view.setUint32(4, 36 + len, true);   // file size - 8
        view.setUint32(8, 0x45564157, true); // "WAVE"
        view.setUint32(12, 0x20746d66, true); // "fmt " chunk
        view.setUint32(16, 16, true);         // format chunk size
        view.setUint16(20, 1, true);          // sample format (1 = PCM)
        view.setUint16(22, numOfChan, true);
        view.setUint32(24, buffer.sampleRate, true);
        view.setUint32(28, buffer.sampleRate * 2 * numOfChan, true); // byte rate
        view.setUint16(32, numOfChan * 2, true); // block align
        view.setUint16(34, 16, true);        // bits per sample

        view.setUint32(36, 0x61746164, true); // "data" chunk
        view.setUint32(40, len, true);       // data chunk size

        const pcm = new Int16Array(buffer.length);
        const channelData = buffer.getChannelData(0);
        for(i = 0; i < buffer.length; i++){
            sample = Math.max(-1, Math.min(1, channelData[i]));
            pcm[i] = sample < 0 ? sample * 0x8000 : sample * 0x7FFF;
        }

        const wavBytes = new Uint8Array(44 + pcm.byteLength);
        wavBytes.set(new Uint8Array(wavHeader), 0);
        wavBytes.set(new Uint8Array(pcm.buffer), 44);

        return new Blob([wavBytes], { type: 'audio/wav' });
    };

    if (!audioUrl) {
        return <div className="text-center text-gray-400">Preparing audio...</div>;
    }

    return (
        <div className="w-full flex flex-col items-center space-y-6 bg-gray-800 p-6 rounded-lg shadow-xl">
            <h3 className="text-lg font-semibold text-white">Your new memo is ready!</h3>
            <audio controls src={audioUrl} className="w-full" />
            <div className="flex space-x-4 w-full">
                <button
                    onClick={handleDownload}
                    className="flex-1 bg-green-500 hover:bg-green-600 text-white font-bold py-3 px-4 rounded-lg transition-colors duration-200 flex items-center justify-center space-x-2"
                >
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M3 17a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zm3.293-7.707a1 1 0 011.414 0L9 10.586V3a1 1 0 112 0v7.586l1.293-1.293a1 1 0 111.414 1.414l-3 3a1 1 0 01-1.414 0l-3-3a1 1 0 010-1.414z" clipRule="evenodd" /></svg>
                    <span>Download</span>
                </button>
                <button
                    onClick={onReset}
                    className="flex-1 bg-indigo-500 hover:bg-indigo-600 text-white font-bold py-3 px-4 rounded-lg transition-colors duration-200 flex items-center justify-center space-x-2"
                >
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M4 2a1 1 0 011 1v2.101a7.002 7.002 0 0111.601 2.566 1 1 0 11-1.885.666A5.002 5.002 0 005.999 7H9a1 1 0 010 2H4a1 1 0 01-1-1V3a1 1 0 011-1zm.008 9.057a1 1 0 011.276.61A5.002 5.002 0 0014.001 13H11a1 1 0 110-2h5a1 1 0 011 1v5a1 1 0 11-2 0v-2.101a7.002 7.002 0 01-11.601-2.566 1 1 0 01.61-1.276z" clipRule="evenodd" /></svg>
                    <span>New Memo</span>
                </button>
            </div>
        </div>
    );
};

export default AudioPlayer;

