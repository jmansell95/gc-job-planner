import React, { useState, useRef, useEffect, useCallback } from 'react';
import { Mic, Square, Loader2 } from 'lucide-react';

/**
 * VoiceToTextButton — a reusable button that uses the Web Speech API
 * to dictate text into a target input/textarea. Appends transcribed
 * text to the linked field. Falls back gracefully on unsupported browsers.
 *
 * Props:
 *   onTranscript: (text: string) => void  — called with each interim/final chunk
 *   disabled?: boolean
 *   className?: string
 */
export default function VoiceToTextButton({ onTranscript, disabled, className = '' }) {
  const [listening, setListening] = useState(false);
  const [supported, setSupported] = useState(true);
  const [error, setError] = useState('');
  const recognitionRef = useRef(null);

  useEffect(() => {
    const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SR) { setSupported(false); return; }
    const rec = new SR();
    rec.continuous = true;
    rec.interimResults = true;
    rec.lang = 'en-GB';

    rec.onresult = (event) => {
      let finalText = '';
      for (let i = event.resultIndex; i < event.results.length; i++) {
        const transcript = event.results[i][0].transcript;
        if (event.results[i].isFinal) finalText += transcript;
      }
      if (finalText && onTranscript) onTranscript(finalText.trim() + ' ');
    };
    rec.onerror = (e) => {
      if (e.error === 'not-allowed') setError('Microphone access denied');
      else setError('Voice error: ' + e.error);
      setListening(false);
    };
    rec.onend = () => setListening(false);

    recognitionRef.current = rec;
    return () => { try { rec.stop(); } catch {} };
  }, [onTranscript]);

  const toggle = useCallback(() => {
    if (!supported || !recognitionRef.current) return;
    if (listening) {
      recognitionRef.current.stop();
      setListening(false);
    } else {
      setError('');
      try {
        recognitionRef.current.start();
        setListening(true);
      } catch (e) {
        setError('Could not start: ' + e.message);
      }
    }
  }, [listening, supported]);

  if (!supported) return null;

  return (
    <div className="inline-flex flex-col">
      <button
        type="button"
        onClick={toggle}
        disabled={disabled}
        className={`inline-flex items-center gap-1.5 text-xs font-medium px-2.5 py-1.5 rounded-lg transition ${
          listening
            ? 'bg-rose-100 text-rose-700 hover:bg-rose-200'
            : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
        } disabled:opacity-50 ${className}`}
        title={listening ? 'Stop dictation' : 'Dictate with voice'}
      >
        {listening ? (
          <>
            <span className="w-2 h-2 bg-rose-500 rounded-full animate-pulse" />
            <Square className="w-3 h-3" /> Stop
          </>
        ) : (
          <>
            <Mic className="w-3.5 h-3.5" /> Voice
          </>
        )}
      </button>
      {error && <p className="text-[10px] text-rose-500 mt-0.5">{error}</p>}
    </div>
  );
}