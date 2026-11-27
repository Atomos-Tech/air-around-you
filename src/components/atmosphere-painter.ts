export type CameraView = { bearing: number; pitch: number; x: number; y: number };
type Particle = { x: number; y: number; depth: number; brightness: number; phase: number };

const particle = (): Particle => ({
  x: Math.random(),
  y: Math.random(),
  depth: 0.5 + Math.random() * 0.75,
  brightness: 0.18 + Math.random() * 0.42,
  phase: Math.random() * Math.PI * 2,
});

const wrap = (value: number) => value - Math.floor(value);

function paintMist(
  context: CanvasRenderingContext2D,
  x: number,
  y: number,
  width: number,
  height: number,
  color: string,
  opacity: number,
) {
  context.save();
  context.translate(x, y);
  context.scale(width, height);
  const mist = context.createRadialGradient(0, 0, 0, 0, 0, 1);
  mist.addColorStop(0, `rgba(${color},${opacity})`);
  mist.addColorStop(0.48, `rgba(${color},${opacity * 0.6})`);
  mist.addColorStop(1, `rgba(${color},0)`);
  context.fillStyle = mist;
  context.fillRect(-1, -1, 2, 2);
  context.restore();
}

function hazeAppearance(visibility: number | null, fog: boolean, particulate: number) {
  const reducedVisibility = visibility === null ? 0 : Math.max(0, 1 - visibility / 9_000);
  const moisture = fog ? 0.1 + reducedVisibility * 0.06 : reducedVisibility * 0.07;
  const particleHaze = Math.min(0.125, (Math.max(0, particulate - 8) / 170) * 0.16);
  return {
    opacity: Math.max(moisture, particleHaze),
    color: fog || moisture >= particleHaze ? "225,237,239" : "179,151,115",
  };
}

type AtmosphereConditions = {
  windFrom: number | null;
  speed: number | null;
  cloudCover: number;
  visibility: number | null;
  fog: boolean;
  dust: number;
  particulate: number;
};

export function createAtmospherePainter(
  context: CanvasRenderingContext2D,
  { windFrom, speed, cloudCover, visibility, fog, dust, particulate }: AtmosphereConditions,
) {
  const velocity = windFrom === null || speed === null ? 0 : Math.min(speed * 3.6, 112);
  const haze = hazeAppearance(visibility, fog, particulate);
  const wind = Array.from({ length: 52 }, particle);
  const dustSpecks = Array.from(
    { length: dust >= 0.25 ? Math.min(56, Math.round(Math.sqrt(dust) * 8)) : 0 },
    particle,
  );
  let driftX = 0;
  let driftY = 0;
  let elapsed = 0;

  return function draw(view: CameraView, width: number, height: number, dt: number) {
    // The provider reports where the wind comes from. Convert that bearing into its direction of travel.
    const heading = (((windFrom ?? 0) + 180 - view.bearing) * Math.PI) / 180;
    const dx = Math.sin(heading) * velocity;
    const dy =
      -Math.cos(heading) * velocity * Math.max(0.33, Math.cos((view.pitch * Math.PI) / 180));
    driftX += dx * dt;
    driftY += dy * dt;
    elapsed += dt;

    if (cloudCover > 4 && view.pitch > 43) {
      // This layer stays above the scene. Cloud coverage controls translucency and wind controls drift.
      for (let index = 0; index < 5; index += 1) {
        const x = (wrap(index * 0.27 + (driftX / width) * 0.22) * 1.42 - 0.21) * width;
        paintMist(
          context,
          x,
          height * (0.06 + (index % 3) * 0.045),
          width * 0.24,
          height * 0.068,
          "230,240,241",
          (cloudCover / 100) * 0.105,
        );
      }
    }

    if (haze.opacity > 0.005) {
      for (let index = 0; index < 3; index += 1) {
        const x = (wrap(index * 0.44 + (driftX / width) * 0.22) * 1.52 - 0.26) * width;
        const y = height * (0.28 + index * 0.105) + Math.max(-28, Math.min(28, driftY * 0.11));
        paintMist(
          context,
          x,
          y,
          width * 0.5,
          height * (0.11 + index * 0.018),
          haze.color,
          haze.opacity,
        );
      }
    }

    // Keep the registered person in clear view as mist passes over the surroundings.
    context.globalCompositeOperation = "destination-out";
    paintMist(context, view.x, view.y - 49, 47, 67, "0,0,0", 0.96);
    context.globalCompositeOperation = "source-over";

    function advance(speck: Particle, multiplier = 1) {
      const gust = 1 + Math.sin(elapsed * 0.8 + speck.phase) * 0.23;
      const curl = Math.sin(elapsed * 1.05 + speck.phase + speck.y * 4) * 0.15;
      const vx = (dx * gust + dy * curl) * multiplier * speck.depth;
      const vy = (dy * gust - dx * curl) * multiplier * speck.depth;
      speck.x = wrap(speck.x + (vx * dt) / width);
      speck.y = wrap(speck.y + (vy * dt) / height);
      return { x: speck.x * width, y: speck.y * height, vx, vy, curl };
    }

    if (velocity > 1) {
      context.lineWidth = 0.67;
      context.lineCap = "round";
      for (const speck of wind) {
        const { x, y, vx, vy, curl } = advance(speck);
        const tail = 0.14 + speck.depth * 0.19;
        const fade = 0.42 + 0.58 * Math.sin(elapsed * 0.47 + speck.phase) ** 2;
        context.strokeStyle = `rgba(74,110,120,${speck.brightness * 0.46 * fade})`;
        context.beginPath();
        context.moveTo(x, y);
        context.quadraticCurveTo(
          x - vx * tail * 0.5 + vy * curl,
          y - vy * tail * 0.5 - vx * curl,
          x - vx * tail,
          y - vy * tail,
        );
        context.stroke();
      }
    }

    for (const speck of dustSpecks) {
      const { x, y } = advance(speck, 0.74);
      const near = Math.max(0, 1 - Math.hypot((x - view.x) / width, (y - view.y) / height));
      const size = 0.38 + speck.depth * 0.71;
      context.beginPath();
      context.fillStyle = `rgba(137,95,58,${speck.brightness * near * 0.83})`;
      context.ellipse(x, y, size * 1.24, size, heading, 0, Math.PI * 2);
      context.fill();
    }
  };
}
