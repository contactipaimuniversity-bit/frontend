"use client";

import { useEffect, useRef, useState } from "react";
import { Modal } from "@/components/ui-kit";

// Lecture d'un QR code avec la caméra de l'appareil. « extract » ne retient que
// les codes attendus (fiche d'anonymat, carte d'étudiant...) : les autres sont ignorés.
export function CameraScanner({ title, hint, extract, onCode, onClose }: { title: string; hint: string; extract: (raw: string) => string | null; onCode: (code: string) => void; onClose: () => void }) {
  const video = useRef<HTMLVideoElement>(null);
  const [error, setError] = useState("");
  const found = useRef(onCode);
  const decode = useRef(extract);
  useEffect(() => { found.current = onCode; decode.current = extract; });
  useEffect(() => {
    let active = true;
    let stream: MediaStream | null = null;
    let frame = 0;
    const canvas = document.createElement("canvas");
    void (async () => {
      try {
        if (!navigator.mediaDevices?.getUserMedia) throw new Error("indisponible");
        const jsQR = (await import("jsqr")).default;
        // La caméra arrière sur un téléphone ; la webcam sur un ordinateur.
        stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: { ideal: "environment" } }, audio: false });
        if (!active || !video.current) { stream.getTracks().forEach((track) => track.stop()); return; }
        video.current.srcObject = stream;
        await video.current.play();
        const context = canvas.getContext("2d", { willReadFrequently: true });
        const read = () => {
          const source = video.current;
          if (!active || !source || !context) return;
          if (source.videoWidth) {
            canvas.width = source.videoWidth;
            canvas.height = source.videoHeight;
            context.drawImage(source, 0, 0);
            const result = jsQR(context.getImageData(0, 0, canvas.width, canvas.height).data, canvas.width, canvas.height);
            const code = result ? decode.current(result.data) : null;
            if (code) { found.current(code); return; }
          }
          frame = requestAnimationFrame(read);
        };
        read();
      } catch (failure) {
        if (!active) return;
        const name = failure instanceof DOMException ? failure.name : "";
        setError(
          name === "NotAllowedError"
            ? "L'accès à la caméra a été refusé. Autorisez-le dans le navigateur, ou tapez le code à la main."
            : name === "NotFoundError"
              ? "Aucune caméra n'a été trouvée sur cet appareil. Tapez le code à la main."
              : "La caméra n'est pas disponible ici (elle exige une connexion sécurisée en https). Tapez le code à la main.",
        );
      }
    })();
    return () => {
      active = false;
      cancelAnimationFrame(frame);
      stream?.getTracks().forEach((track) => track.stop());
    };
  }, []);
  return (
    <Modal title={title} onClose={onClose}>
      <div className="camera-scan">
        {error ? <p className="form-error">{error}</p> : (
          <>
            <video ref={video} muted playsInline aria-label="Image de la caméra" />
            <p className="panel-subtitle">{hint}</p>
          </>
        )}
        <div className="form-actions"><button type="button" className="secondary-button" onClick={onClose}>Fermer</button></div>
      </div>
    </Modal>
  );
}
