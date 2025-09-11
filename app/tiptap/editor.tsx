"use client";

import NotificationsPopover from "../notifications-popover";
import { useEditor, EditorContent, Editor } from "@tiptap/react";
import {
  useLiveblocksExtension,
  FloatingComposer,
  FloatingThreads,
  AnchoredThreads,
  Toolbar,
  FloatingToolbar,
} from "@liveblocks/react-tiptap";
import StarterKit from "@tiptap/starter-kit";
import { useThreads } from "@liveblocks/react";
import { useIsMobile } from "./use-is-mobile";
import VersionsDialog from "../version-history-dialog";
import { AssemblyAI } from "assemblyai";
import { Readable } from "stream";
import dynamic from "next/dynamic";
import React, { useState, useRef ,useEffect} from "react";
const API_KEY = "6ba0b65b6f404cb285e0c3f372633b9b";

const API_ENDPOINT_BASE_URL = "wss://streaming.assemblyai.com/v3/ws";
const SOCKET_URL = `${API_ENDPOINT_BASE_URL}?sample_rate=16000&format_turns=true&end_of_turn_confidence_threshold=0.7&min_end_of_turn_silence_when_confident=160&max_turn_silence=2400&token=${API_KEY}`;


export default function TiptapEditor() {
  const [transcript, setTranscript] = useState("");
  const liveblocks = useLiveblocksExtension();
  const audioContextRef = useRef<AudioContext | null>(null);
  const sourceNodeRef = useRef<MediaStreamAudioSourceNode | null>(null);
  const processorRef = useRef<ScriptProcessorNode | null>(null);
  const webSocketRef = useRef<WebSocket | null>(null);
  const [isRecording, setIsRecording] = useState(false);
  const [transcripts, setTranscripts] = useState<string[]>([]);
  const [status, setStatus] = useState<string>('Ready');
  const [trancribingText, setTranscribingText] = useState<string>('');

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
          if(res.transcript && !res.turn_is_formatted){
            setTranscribingText(res.transcript);
          }
          if (res.transcript && res.turn_is_formatted) {
            //setTranscripts((prev) => [...prev, res.transcript]);
            if (editor) {
              editor
                .chain()
                .focus()
                .insertContent(res.transcript)
                .run();
              // setTranscribingText('');
            }
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

  const editor = useEditor({
    editorProps: {
      attributes: {
        // Add styles to editor element
        class: "outline-none flex-1 transition-all",
      },
    },
    extensions: [
      StarterKit.configure({
        history: false,
      }),
      liveblocks,
    ],
  });


  const start = async () => {

    if (editor) {
      editor
        .chain()
        .focus()
        .insertContent("🚀 Hello from button click!")
        .run();
    }
   
  };

  return (
    <div className="relative min-h-screen flex flex-col">  
          <p className="text-center font-medium text-gray-700 mb-2">
            Status: <span className="font-bold">{status}</span>
          </p>
          <p>
            {isRecording && trancribingText ? `Transcribing: ${trancribingText}` : null}
          </p>
      <div className="h-[60px] flex items-center justify-end px-4 border-b border-border/80 bg-background">
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
        <VersionsDialog editor={editor} />
        <NotificationsPopover />
      </div>
      <div className="border-b border-border/80 bg-background">
        <Toolbar editor={editor} className="w-full" />
      </div>
      <div className="relative flex flex-row justify-between w-full py-16 xl:pl-[250px] pl-[100px] gap-[50px]">
        <div className="relative flex flex-1 flex-col gap-2">
          <EditorContent editor={editor} />
          <FloatingComposer editor={editor} className="w-[350px]" />
          <FloatingToolbar editor={editor} />
        </div>
        

        <div className="xl:[&:not(:has(.lb-tiptap-anchored-threads))]:pr-[200px] [&:not(:has(.lb-tiptap-anchored-threads))]:pr-[50px]">
          <Threads editor={editor} />
        </div>
      </div>
    </div>
  );
}

function Threads({ editor }: { editor: Editor | null }) {
  const { threads } = useThreads();
  const isMobile = useIsMobile();

  if (!threads || !editor) {
    return null;
  }

  return isMobile ? (
    <FloatingThreads threads={threads} editor={editor} />
  ) : (
    <AnchoredThreads
      threads={threads}
      editor={editor}
      className="w-[350px] xl:mr-[100px] mr-[50px]"
    />
  );
}
