"use client";

import { useState, useRef, useCallback, useEffect } from "react";

export type RecorderState =
  | "idle"
  | "requesting"
  | "recording"
  | "paused"
  | "recorded"
  | "error";

export type RecorderSource = "mic" | "screen" | "both";

export interface UseRecorderReturn {
  state: RecorderState;
  source: RecorderSource;
  elapsed: number;
  /** Object URL of the recorded media (audio or video) */
  mediaUrl: string | null;
  /** The recorded file — WebM, uploaded to Gemini */
  recordedFile: File | null;
  /** true when source is "screen" or "both" (file has video track) */
  isVideo: boolean;
  analyserNode: AnalyserNode | null;
  error: string;
  start: (source?: RecorderSource) => Promise<void>;
  stop: () => void;
  pause: () => void;
  resume: () => void;
  reset: () => void;
}

export function useRecorder(maxSeconds = 7200): UseRecorderReturn {
  const [state, setState] = useState<RecorderState>("idle");
  const [source, setSource] = useState<RecorderSource>("mic");
  const [elapsed, setElapsed] = useState(0);
  const [mediaUrl, setMediaUrl] = useState<string | null>(null);
  const [recordedFile, setRecordedFile] = useState<File | null>(null);
  const [isVideo, setIsVideo] = useState(false);
  const [analyserNode, setAnalyserNode] = useState<AnalyserNode | null>(null);
  const [error, setError] = useState("");

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  // All tracks we need to stop on cleanup (mic + screen)
  const tracksRef = useRef<MediaStreamTrack[]>([]);
  const audioContextRef = useRef<AudioContext | null>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const elapsedRef = useRef(0);

  useEffect(() => {
    return () => {
      stopTimer();
      tracksRef.current.forEach((t) => t.stop());
      audioContextRef.current?.close().catch(() => {});
      if (mediaUrl) URL.revokeObjectURL(mediaUrl);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function stopTimer() {
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
  }

  function startTimer() {
    stopTimer();
    timerRef.current = setInterval(() => {
      elapsedRef.current += 1;
      setElapsed(elapsedRef.current);
      if (elapsedRef.current >= maxSeconds) stop();
    }, 1000);
  }

  /**
   * Build the final MediaStream based on chosen source.
   * Throws a tagged error string so the caller can surface a specific message.
   */
  async function buildStream(src: RecorderSource): Promise<{
    stream: MediaStream;
    hasVideo: boolean;
    visualisationStream: MediaStream;
  }> {
    if (src === "mic") {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          sampleRate: 44100,
        },
      });
      return { stream, hasVideo: false, visualisationStream: stream };
    }

    if (src === "screen") {
      // getDisplayMedia with audio → captures tab/system audio (Chrome/Edge)
      const stream = await navigator.mediaDevices.getDisplayMedia({
        video: { frameRate: 30 },
        audio: {
          // Disable processing so meeting audio isn't distorted
          autoGainControl: false,
          echoCancellation: false,
          noiseSuppression: false,
        },
      });

      if (stream.getAudioTracks().length === 0) {
        // User forgot to check "Share tab audio" — stop video and throw
        stream.getTracks().forEach((t) => t.stop());
        throw new Error("no_system_audio");
      }
      return { stream, hasVideo: true, visualisationStream: stream };
    }

    // "both" — mix mic + system audio into a single output stream
    const displayStream = await navigator.mediaDevices.getDisplayMedia({
      video: { frameRate: 30 },
      audio: {
        autoGainControl: false,
        echoCancellation: false,
        noiseSuppression: false,
      },
    });

    if (displayStream.getAudioTracks().length === 0) {
      displayStream.getTracks().forEach((t) => t.stop());
      throw new Error("no_system_audio");
    }

    let micStream: MediaStream;
    try {
      micStream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          sampleRate: 44100,
        },
      });
    } catch (err) {
      displayStream.getTracks().forEach((t) => t.stop());
      throw err;
    }

    // Mix mic + system audio through Web Audio
    const ctx = new AudioContext();
    // Chrome may create AudioContext in "suspended" state — resume it explicitly
    if (ctx.state === "suspended") await ctx.resume();
    const dest = ctx.createMediaStreamDestination();

    const sysSource = ctx.createMediaStreamSource(
      new MediaStream(displayStream.getAudioTracks())
    );
    const micSource = ctx.createMediaStreamSource(micStream);

    sysSource.connect(dest);
    micSource.connect(dest);

    audioContextRef.current = ctx;

    const mixedStream = new MediaStream([
      ...displayStream.getVideoTracks(),
      ...dest.stream.getAudioTracks(),
    ]);

    // Keep originals alive so we can stop them on cleanup
    tracksRef.current.push(
      ...displayStream.getTracks(),
      ...micStream.getTracks()
    );

    return {
      stream: mixedStream,
      hasVideo: true,
      visualisationStream: dest.stream,
    };
  }

  const start = useCallback(
    async (chosenSource: RecorderSource = "mic") => {
      setError("");
      setSource(chosenSource);
      chunksRef.current = [];
      elapsedRef.current = 0;
      setElapsed(0);
      setState("requesting");

      let built: { stream: MediaStream; hasVideo: boolean; visualisationStream: MediaStream };
      try {
        built = await buildStream(chosenSource);
      } catch (err) {
        const name = err instanceof DOMException ? err.name : "";
        const msg = err instanceof Error ? err.message : "";

        if (msg === "no_system_audio") setError("no_system_audio");
        else if (name === "NotAllowedError" || name === "PermissionDeniedError")
          setError(chosenSource === "mic" ? "mic_denied" : "screen_denied");
        else if (name === "NotFoundError" || name === "DevicesNotFoundError")
          setError("mic_not_found");
        else if (name === "NotReadableError" || name === "TrackStartError")
          setError("mic_in_use");
        else setError("mic_error");

        setState("error");
        return;
      }

      const { stream, hasVideo, visualisationStream } = built;

      // Track all the source stream's tracks for cleanup (if not already tracked)
      stream.getTracks().forEach((t) => {
        if (!tracksRef.current.includes(t)) tracksRef.current.push(t);
      });

      // If the user closes the screen-share popover, recorder should stop
      stream.getVideoTracks().forEach((track) => {
        track.onended = () => stop();
      });

      // Set up analyser for visualisation (from audio only)
      try {
        const ctx = audioContextRef.current ?? new AudioContext();
        if (!audioContextRef.current) audioContextRef.current = ctx;
        if (ctx.state === "suspended") await ctx.resume();

        const audioOnly = new MediaStream(visualisationStream.getAudioTracks());
        if (audioOnly.getAudioTracks().length > 0) {
          const vizSource = ctx.createMediaStreamSource(audioOnly);
          const analyser = ctx.createAnalyser();
          analyser.fftSize = 256;
          analyser.smoothingTimeConstant = 0.75;
          vizSource.connect(analyser);
          setAnalyserNode(analyser);
        }
      } catch {
        setAnalyserNode(null);
      }

      // Pick a supported mime type
      const videoCandidates = [
        "video/webm;codecs=vp9,opus",
        "video/webm;codecs=vp8,opus",
        "video/webm",
      ];
      const audioCandidates = [
        "audio/webm;codecs=opus",
        "audio/ogg;codecs=opus",
        "audio/webm",
      ];
      const candidates = hasVideo ? videoCandidates : audioCandidates;
      const mimeType =
        candidates.find((m) => MediaRecorder.isTypeSupported(m)) ??
        (hasVideo ? "video/webm" : "audio/webm");

      const recorder = new MediaRecorder(stream, { mimeType });

      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) chunksRef.current.push(e.data);
      };

      recorder.onstop = () => {
        const baseMime =
          recorder.mimeType.split(";")[0].trim() ||
          (hasVideo ? "video/webm" : "audio/webm");
        const blob = new Blob(chunksRef.current, { type: baseMime });
        const url = URL.createObjectURL(blob);
        const ext = baseMime.includes("ogg")
          ? "ogg"
          : hasVideo
          ? "webm"
          : "webm";
        const prefix = hasVideo ? "meeting" : "recording";
        const file = new File([blob], `${prefix}-${Date.now()}.${ext}`, {
          type: baseMime,
        });

        setMediaUrl(url);
        setRecordedFile(file);
        setIsVideo(hasVideo);
        setState("recorded");

        // Stop all tracks + audio context
        tracksRef.current.forEach((t) => t.stop());
        tracksRef.current = [];
        audioContextRef.current?.close().catch(() => {});
        audioContextRef.current = null;
        setAnalyserNode(null);
      };

      mediaRecorderRef.current = recorder;
      recorder.start(250);
      setState("recording");
      startTimer();
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [maxSeconds]
  );

  const stop = useCallback(() => {
    stopTimer();
    if (
      mediaRecorderRef.current &&
      mediaRecorderRef.current.state !== "inactive"
    ) {
      mediaRecorderRef.current.stop();
    }
  }, []);

  const pause = useCallback(() => {
    if (
      mediaRecorderRef.current &&
      mediaRecorderRef.current.state === "recording"
    ) {
      mediaRecorderRef.current.pause();
      stopTimer();
      setState("paused");
    }
  }, []);

  const resume = useCallback(() => {
    if (
      mediaRecorderRef.current &&
      mediaRecorderRef.current.state === "paused"
    ) {
      mediaRecorderRef.current.resume();
      startTimer();
      setState("recording");
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const reset = useCallback(() => {
    stopTimer();
    mediaRecorderRef.current?.stop();
    tracksRef.current.forEach((t) => t.stop());
    tracksRef.current = [];
    audioContextRef.current?.close().catch(() => {});
    audioContextRef.current = null;

    if (mediaUrl) URL.revokeObjectURL(mediaUrl);

    chunksRef.current = [];
    elapsedRef.current = 0;
    mediaRecorderRef.current = null;

    setMediaUrl(null);
    setRecordedFile(null);
    setIsVideo(false);
    setAnalyserNode(null);
    setElapsed(0);
    setError("");
    setState("idle");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mediaUrl]);

  return {
    state,
    source,
    elapsed,
    mediaUrl,
    recordedFile,
    isVideo,
    analyserNode,
    error,
    start,
    stop,
    pause,
    resume,
    reset,
  };
}
