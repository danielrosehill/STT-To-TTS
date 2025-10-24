
import React from 'react';
import { VoiceOption } from '../types';

interface VoiceSelectorProps {
    selectedVoice: VoiceOption;
    setSelectedVoice: (voice: VoiceOption) => void;
    disabled: boolean;
}

const VoiceSelector: React.FC<VoiceSelectorProps> = ({ selectedVoice, setSelectedVoice, disabled }) => {
    return (
        <div className="flex justify-center space-x-4 my-6">
            {(Object.keys(VoiceOption) as Array<keyof typeof VoiceOption>).map((key) => {
                const voice = VoiceOption[key];
                const isSelected = selectedVoice === voice;
                return (
                    <button
                        key={voice}
                        onClick={() => setSelectedVoice(voice)}
                        disabled={disabled}
                        className={`
                            px-6 py-2 rounded-full text-sm font-semibold transition-all duration-200
                            ${isSelected ? 'bg-indigo-500 text-white shadow-lg' : 'bg-gray-700 text-gray-300 hover:bg-gray-600'}
                            ${disabled ? 'opacity-50 cursor-not-allowed' : ''}
                        `}
                    >
                        {voice}
                    </button>
                );
            })}
        </div>
    );
};

export default VoiceSelector;
