import { useCallback, useEffect, useRef, useState } from "react";

type CameraStatus = "idle" | "solicitando" | "ativa" | "capturada" | "erro" | "negada";

/**
 * Controla a câmera do dispositivo para a foto obrigatória de check-in.
 * Fluxo: iniciar() abre o stream ao vivo -> capturar() tira a foto (dataURL)
 * -> refazer() descarta e reabre o stream.
 */
export function useCamera() {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const [status, setStatus] = useState<CameraStatus>("idle");
  const [fotoDataUrl, setFotoDataUrl] = useState<string | null>(null);
  const [erro, setErro] = useState<string | null>(null);

  const pararStream = useCallback(() => {
    streamRef.current?.getTracks().forEach((track) => track.stop());
    streamRef.current = null;
  }, []);

  const iniciar = useCallback(async () => {
    setStatus("solicitando");
    setErro(null);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: "user", width: { ideal: 720 }, height: { ideal: 720 } },
        audio: false,
      });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play();
      }
      setStatus("ativa");
    } catch (err) {
      const negada = err instanceof DOMException && err.name === "NotAllowedError";
      setStatus(negada ? "negada" : "erro");
      setErro(
        negada
          ? "Permissão de câmera negada. Ative o acesso à câmera para registrar a presença."
          : "Não foi possível acessar a câmera deste dispositivo."
      );
    }
  }, []);

  const capturar = useCallback(() => {
    const video = videoRef.current;
    if (!video) return;

    const canvas = document.createElement("canvas");
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
    const dataUrl = canvas.toDataURL("image/jpeg", 0.85);
    setFotoDataUrl(dataUrl);
    setStatus("capturada");
    pararStream();
  }, [pararStream]);

  const refazer = useCallback(() => {
    setFotoDataUrl(null);
    iniciar();
  }, [iniciar]);

  useEffect(() => () => pararStream(), [pararStream]);

  return {
    videoRef,
    status,
    fotoDataUrl,
    erro,
    iniciar,
    capturar,
    refazer,
    pronto: status === "capturada",
  };
}
