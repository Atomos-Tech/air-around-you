import { useEffect, useRef } from "react";

import { hasModeledFog, type Environment } from "@/data/air-quality";

import { createAtmospherePainter, type CameraView } from "./atmosphere-painter";

type Props = {
  conditions: Environment;
  paused: boolean;
  getLocalView: () => CameraView | null;
};

export default function Atmosphere({ conditions, paused, getLocalView }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const { air, weather } = conditions;
  const { windFrom = null, windSpeed: speed = null, visibility = null } = weather ?? {};
  const cloudCover = weather?.cloudCover ?? 0;
  const fog = hasModeledFog(weather?.code);
  const dust = air?.dust ?? 0;
  const particulate = conditions.observation?.pm25 ?? air?.pm25 ?? 0;

  useEffect(() => {
    const canvas = canvasRef.current;
    if (
      !canvas ||
      (windFrom === null &&
        cloudCover === 0 &&
        dust === 0 &&
        !fog &&
        particulate === 0 &&
        visibility === null)
    )
      return;
    const context = canvas.getContext("2d");
    if (!context) return;

    const paint = createAtmospherePainter(context, {
      windFrom,
      speed,
      cloudCover,
      visibility,
      fog,
      dust,
      particulate,
    });
    let width = 0;
    let height = 0;
    let frame = 0;
    let lastTime = 0;
    function draw(now: number) {
      if (!context) return;
      const dt = lastTime ? Math.min((now - lastTime) / 1_000, 0.08) : 0;
      lastTime = now;
      context.clearRect(0, 0, width, height);
      const view = getLocalView();
      if (!view || !width || !height) return;
      paint(view, width, height, dt);
    }

    function resize() {
      if (!canvas || !context) return;
      const ratio = Math.min(window.devicePixelRatio, 1.6);
      width = canvas.clientWidth;
      height = canvas.clientHeight;
      canvas.width = Math.round(width * ratio);
      canvas.height = Math.round(height * ratio);
      context.setTransform(ratio, 0, 0, ratio, 0, 0);
      draw(performance.now());
    }

    function animate(now: number) {
      if (now - lastTime > 32) draw(now);
      frame = requestAnimationFrame(animate);
    }

    const observer = new ResizeObserver(resize);
    observer.observe(canvas);
    resize();
    if (!paused) frame = requestAnimationFrame(animate);
    return () => {
      observer.disconnect();
      cancelAnimationFrame(frame);
      context.clearRect(0, 0, width, height);
    };
  }, [windFrom, speed, cloudCover, visibility, fog, dust, particulate, paused, getLocalView]);

  return <canvas className="atmosphere-canvas" ref={canvasRef} aria-hidden="true" />;
}
