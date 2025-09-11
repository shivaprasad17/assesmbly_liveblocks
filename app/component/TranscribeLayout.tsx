'use client';

import React, { useEffect, useRef, useState } from 'react';


const API_KEY = "6ba0b65b6f404cb285e0c3f372633b9b";

const API_ENDPOINT_BASE_URL = "wss://streaming.assemblyai.com/v3/ws";
const SOCKET_URL = `${API_ENDPOINT_BASE_URL}?sample_rate=16000&format_turns=true&end_of_turn_confidence_threshold=0.7&min_end_of_turn_silence_when_confident=160&max_turn_silence=2400&token=${API_KEY}`;



export default function TranscribeLayout() : JSX.Element {
    const audioContextRef = useRef<AudioContext | null>(null);
    const sourceNodeRef = useRef<MediaStreamAudioSourceNode | null>(null);
    const processorRef = useRef<ScriptProcessorNode | null>(null);
    const webSocketRef = useRef<WebSocket | null>(null);
    const [isRecording, setIsRecording] = useState(false);
    const [transcripts, setTranscripts] = useState<string[]>([]);
    const [status, setStatus] = useState<string>('Ready');
  
    // This effect handles cleanup when the component unmounts
    useEffect(() => {
      return () => {
        if (webSocketRef.current) {
          webSocketRef.current.close();
        }
        if (audioContextRef.current) {
          audioContextRef.current.close();
        }
      };
    }, []);
  
    const startRecording = async () => {
      
  
      if (!navigator.mediaDevices) {
        setStatus('MediaDevices API is not supported in this browser.');
        return;
      }
  
      setStatus('Requesting microphone access...');
  
      try {
        // Get the audio stream from the user's microphone
        const stream = await navigator.mediaDevices.getUserMedia({
          audio: {
            sampleRate: 16000,
            channelCount: 1,
          },
        });
  
        setStatus('Connecting to AssemblyAI...');
        
        // Initialize a new WebSocket connection
        webSocketRef.current = new WebSocket(SOCKET_URL);
  
        // Handle WebSocket events
        webSocketRef.current.onopen = () => {
          console.log('WebSocket connected.');
          setStatus('Recording...');
          setIsRecording(true);
        };
  
        webSocketRef.current.onmessage = (message) => {
          const res = JSON.parse(message.data);
          // console.log('Received message:', res);
          if (res.type === 'Turn') {
            // console.log('Transcript:', res.transcript);
            if (res.transcript && res.turn_is_formatted) {
              setTranscripts((prev) => [...prev, res.transcript]);
            }
          }
        };
  
        webSocketRef.current.onerror = (event) => {
          console.error('WebSocket error:', event);
          setStatus('Error occurred. Please try again.');
          setIsRecording(false);
          stopRecording();
        };
  
        webSocketRef.current.onclose = (event) => {
          console.log(`WebSocket closed: ${event.code} ${event.reason}`);
          setStatus('Connection closed.');
          setIsRecording(false);
        };
  
        // Set up Web Audio API to capture raw PCM data
        audioContextRef.current = new (window.AudioContext)({
          sampleRate: 16000
        });
  
        sourceNodeRef.current = audioContextRef.current.createMediaStreamSource(stream);
        processorRef.current = audioContextRef.current.createScriptProcessor(1024, 1, 1);
  
        processorRef.current.onaudioprocess = (e) => {
          // Get audio data from the buffer
          const inputBuffer = e.inputBuffer.getChannelData(0);
          
          // Convert to 16-bit PCM
          const pcmData = convertFloat32To16BitPCM(inputBuffer);
  
          // Send the raw audio data to the WebSocket
          if (webSocketRef.current && webSocketRef.current.readyState === WebSocket.OPEN) {
            //console.log('Sending audio data:', pcmData);
            webSocketRef.current.send(pcmData);
          }
        };
  
        // Connect nodes
        sourceNodeRef.current.connect(processorRef.current);
        processorRef.current.connect(audioContextRef.current.destination);
  
      } catch (error) {
        console.error('Microphone access denied or error:', error);
        setStatus('Microphone access denied or an error occurred.');
        setIsRecording(false);
      }
    };
  
    const convertFloat32To16BitPCM = (input: Float32Array): Int16Array => {
      const output = new Int16Array(input.length);
      for (let i = 0; i < input.length; i++) {
        const s = Math.max(-1, Math.min(1, input[i]));
        output[i] = s < 0 ? s * 0x8000 : s * 0x7FFF;
      }
      return output;
    };
  
    const stopRecording = () => {
      if (isRecording) {
        if (webSocketRef.current) {
          webSocketRef.current.close();
        }
        if (audioContextRef.current) {
          audioContextRef.current.close();
        }
        setIsRecording(false);
        setStatus('Stopped');
      }
    };
  
    return (
      <div className="flex flex-col items-center justify-center p-8 bg-gray-100 min-h-screen font-sans">
        <div className="bg-white p-8 rounded-xl shadow-lg w-full max-w-2xl">
          <h1 className="text-3xl font-bold mb-4 text-center text-gray-800">
            Live Audio Transcription
          </h1>
          <p className="text-center text-gray-600 mb-6">
            Click "Start Recording" to begin transcribing your voice in real-time.
          </p>
  
          <div className="flex justify-center space-x-4 mb-6">
            <button
              onClick={startRecording}
              disabled={isRecording}
              className={`px-6 py-3 rounded-full font-semibold transition-all duration-200 ${
                isRecording
                  ? 'bg-gray-400 cursor-not-allowed'
                  : 'bg-green-500 hover:bg-green-600 text-white shadow-md'
              }`}
            >
              Start Recording
            </button>
            <button
              onClick={stopRecording}
              disabled={!isRecording}
              className={`px-6 py-3 rounded-full font-semibold transition-all duration-200 ${
                !isRecording
                  ? 'bg-gray-400 cursor-not-allowed'
                  : 'bg-red-500 hover:bg-red-600 text-white shadow-md'
              }`}
            >
              Stop Recording
            </button>
          </div>
  
          <p className="text-center font-medium text-gray-700 mb-6">
            Status: <span className="font-bold">{status}</span>
          </p>
  
          <div className="bg-gray-50 p-6 rounded-lg border border-gray-200 h-64 overflow-y-auto">
            <h2 className="text-xl font-bold mb-2 text-gray-800">Transcripts</h2>
            {transcripts.length === 0 ? (
              <p className="text-gray-500 italic">No transcripts yet.</p>
            ) : (
              <ul className="list-disc list-inside space-y-2 text-gray-700">
                {transcripts.map((t, index) => (
                  <li key={index}>{t}</li>
                ))}
              </ul>
            )}
          </div>
        </div>
      </div>
    );

}