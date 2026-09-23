import React, { useMemo } from 'react';

type Vec3 = [number, number, number];

interface Box {
  x0: number;
  x1: number;
  y0: number;
  y1: number;
  z0: number;
  z1: number;
  depthKey: number;
  revealIndex: number;
  /** Side face drawn once per flight as a merged `Side` instead, so adjacent steps show no seams. */
  skip?: 'x' | 'y';
}

interface Side {
  face: 'x' | 'y';
  vertices: Vec3[];
  depthKey: number;
  revealIndex: number;
}

interface Figure {
  at: Vec3;
  depthKey: number;
  revealIndex: number;
}

const COS30 = Math.cos(Math.PI / 6);
const RISER = 0.46;
const TREAD = 1;
const WIDTH = 3;
const STEPS_PER_FLIGHT = 9;
const FLIGHTS = 4;
const BASE = -14;
/** The scene is narrower than its container, so its glow must fade out before the SVG edges. */
const EDGE_MASK = 'radial-gradient(ellipse 50% 50% at 50% 50%, #000 62%, transparent 100%)';

function project([x, y, z]: Vec3): [number, number] {
  return [(x - y) * COS30, (x + y) * 0.5 - z];
}

function points(vertices: Vec3[]): string {
  return vertices
    .map((v) => {
      const [px, py] = project(v);
      return `${px.toFixed(3)},${py.toFixed(3)}`;
    })
    .join(' ');
}

function mix(a: string, b: string, t: number): string {
  const pa = [1, 3, 5].map((i) => parseInt(a.slice(i, i + 2), 16));
  const pb = [1, 3, 5].map((i) => parseInt(b.slice(i, i + 2), 16));
  const c = pa.map((v, i) => Math.round(v + (pb[i] - v) * Math.min(1, Math.max(0, t))));
  return `rgb(${c[0]},${c[1]},${c[2]})`;
}

/**
 * A zig-zag of flights climbing away from the viewer: flights alternate between the -x and -y
 * directions so the only faces ever visible are the tops, +x and +y.
 */
function buildScene() {
  const boxes: Box[] = [];
  const sides: Side[] = [];
  let reveal = 0;
  let x = 20;
  let y = 0;
  let z = 0;
  let figure: Figure | null = null;

  for (let flight = 0; flight < FLIGHTS; flight++) {
    const alongX = flight % 2 === 0;
    const firstReveal = reveal;
    const profile: Vec3[] = alongX ? [[x, y + WIDTH, BASE]] : [[x + WIDTH, y, BASE]];
    for (let i = 0; i < STEPS_PER_FLIGHT; i++) {
      const top = z + (i + 1) * RISER;
      const box: Box = alongX
        ? { x0: x - (i + 1) * TREAD, x1: x - i * TREAD, y0: y, y1: y + WIDTH, z0: BASE, z1: top, depthKey: 0, revealIndex: reveal++, skip: 'y' }
        : { x0: x, x1: x + WIDTH, y0: y - (i + 1) * TREAD, y1: y - i * TREAD, z0: BASE, z1: top, depthKey: 0, revealIndex: reveal++, skip: 'x' };
      boxes.push(box);
      if (alongX) profile.push([box.x1, box.y1, top], [box.x0, box.y1, top]);
      else profile.push([box.x1, box.y1, top], [box.x1, box.y0, top]);
      if (flight === 1 && i === 4) {
        figure = {
          at: [x + WIDTH * 0.58, y - (i + 0.5) * TREAD, top],
          depthKey: 0,
          revealIndex: reveal,
        };
      }
    }
    const last = profile[profile.length - 1];
    profile.push([last[0], last[1], BASE]);
    const nearest = boxes[boxes.length - STEPS_PER_FLIGHT];
    sides.push({
      face: alongX ? 'y' : 'x',
      vertices: profile,
      depthKey: (nearest.x0 + nearest.x1) / 2 + (nearest.y0 + nearest.y1) / 2 + 0.01,
      revealIndex: firstReveal + 2,
    });
    z += STEPS_PER_FLIGHT * RISER;
    if (alongX) {
      x -= STEPS_PER_FLIGHT * TREAD;
      boxes.push({ x0: x - WIDTH, x1: x, y0: y, y1: y + WIDTH, z0: BASE, z1: z, depthKey: 0, revealIndex: reveal++ });
      x -= WIDTH;
    } else {
      y -= STEPS_PER_FLIGHT * TREAD;
      boxes.push({ x0: x, x1: x + WIDTH, y0: y - WIDTH, y1: y, z0: BASE, z1: z, depthKey: 0, revealIndex: reveal++ });
      y -= WIDTH;
    }
  }

  // The last flight runs along -y, so the destination wall stands across its far end, facing the climber.
  const topLanding = boxes[boxes.length - 1];
  const wall: Box = {
    x0: topLanding.x0 - 1.6,
    x1: topLanding.x1 + 1.6,
    y0: topLanding.y0 - 1.2,
    y1: topLanding.y0,
    z0: BASE,
    z1: z + 9,
    depthKey: 0,
    revealIndex: reveal++,
  };
  boxes.push(wall);

  const door = {
    x0: topLanding.x0 + 0.75,
    x1: topLanding.x1 - 0.75,
    y: topLanding.y0,
    z0: z,
    z1: z + 5.6,
  };

  for (const box of boxes) box.depthKey = (box.x0 + box.x1) / 2 + (box.y0 + box.y1) / 2;
  if (figure) {
    const f = figure as Figure;
    f.depthKey = f.at[0] + f.at[1] - 0.25;
  }

  return { boxes, sides, figure: figure as Figure | null, door, topZ: z, totalReveal: reveal };
}

interface StaircaseSceneProps {
  className?: string;
  title?: string;
  showFigure?: boolean;
  /** Milliseconds added before the first step rises. */
  startDelayMs?: number;
}

export const StaircaseScene: React.FC<StaircaseSceneProps> = ({
  className = '',
  title = 'A staircase of four flights climbing through darkness toward a lit doorway',
  showFigure = true,
  startDelayMs = 150,
}) => {
  const scene = useMemo(buildScene, []);
  const { boxes, sides, figure, door, topZ, totalReveal } = scene;

  const viewBox = useMemo(() => {
    const all: [number, number][] = [];
    for (const b of boxes) {
      all.push(project([b.x0, b.y0, b.z1]), project([b.x1, b.y1, b.z1]), project([b.x1, b.y0, b.z1]), project([b.x0, b.y1, b.z1]));
    }
    const xs = all.map((p) => p[0]);
    const ys = all.map((p) => p[1]);
    const minX = Math.min(...xs) - 6;
    const maxX = Math.max(...xs) + 6;
    const minY = Math.min(...ys) - 5;
    const groundY = project([20, WIDTH, 0])[1];
    const maxY = groundY + 8;
    return { minX, minY, width: maxX - minX, height: maxY - minY };
  }, [boxes]);

  const drawOrder = useMemo(() => {
    type Item = { kind: 'box'; box: Box } | { kind: 'side'; side: Side } | { kind: 'figure'; figure: Figure };
    const items: Item[] = [
      ...boxes.map((box): Item => ({ kind: 'box', box })),
      ...sides.map((side): Item => ({ kind: 'side', side })),
    ];
    if (showFigure && figure) items.push({ kind: 'figure', figure });
    const key = (item: Item) =>
      item.kind === 'box' ? item.box.depthKey : item.kind === 'side' ? item.side.depthKey : item.figure.depthKey;
    return items.sort((a, b) => key(a) - key(b));
  }, [boxes, sides, figure, showFigure]);

  const delayFor = (index: number) => `${startDelayMs + index * 42}ms`;
  const [doorCx, doorCy] = project([(door.x0 + door.x1) / 2, door.y, door.z0 + 2.4]);
  const topMaxZ = topZ + 9;

  return (
    <svg
      className={className}
      viewBox={`${viewBox.minX} ${viewBox.minY} ${viewBox.width} ${viewBox.height}`}
      preserveAspectRatio="xMidYMid meet"
      role="img"
      aria-label={title}
      style={{ maskImage: EDGE_MASK, WebkitMaskImage: EDGE_MASK }}
    >
      <defs>
        <radialGradient id="stair-halo" cx={doorCx} cy={doorCy} r={viewBox.height * 0.55} gradientUnits="userSpaceOnUse">
          <stop offset="0" stopColor="#F5EBD6" stopOpacity="0.34" />
          <stop offset="0.35" stopColor="#C8A96B" stopOpacity="0.08" />
          <stop offset="1" stopColor="#0B0B0A" stopOpacity="0" />
        </radialGradient>
        <linearGradient id="stair-face-x" x1="0" y1={viewBox.minY} x2="0" y2={viewBox.minY + viewBox.height} gradientUnits="userSpaceOnUse">
          <stop offset="0" stopColor="#C9C6BE" />
          <stop offset="0.55" stopColor="#56544F" />
          <stop offset="1" stopColor="#141413" />
        </linearGradient>
        <linearGradient id="stair-face-y" x1="0" y1={viewBox.minY} x2="0" y2={viewBox.minY + viewBox.height} gradientUnits="userSpaceOnUse">
          <stop offset="0" stopColor="#4B4A46" />
          <stop offset="0.6" stopColor="#1E1E1C" />
          <stop offset="1" stopColor="#0B0B0A" />
        </linearGradient>
        <linearGradient id="stair-floor-fade" x1="0" y1={viewBox.minY + viewBox.height * 0.55} x2="0" y2={viewBox.minY + viewBox.height} gradientUnits="userSpaceOnUse">
          <stop offset="0" stopColor="#0B0B0A" stopOpacity="0" />
          <stop offset="1" stopColor="#0B0B0A" stopOpacity="0.96" />
        </linearGradient>
        <linearGradient id="stair-beam" x1="0" y1={viewBox.minY} x2="0" y2={doorCy + 6} gradientUnits="userSpaceOnUse">
          <stop offset="0" stopColor="#F5F3EC" stopOpacity="0.16" />
          <stop offset="1" stopColor="#F5F3EC" stopOpacity="0" />
        </linearGradient>
        <filter id="stair-door-glow" x="-200%" y="-200%" width="500%" height="500%">
          <feGaussianBlur stdDeviation="1.6" />
        </filter>
      </defs>

      <rect
        className="portal-light"
        style={{ '--stair-delay': delayFor(totalReveal * 0.6) } as React.CSSProperties}
        x={viewBox.minX}
        y={viewBox.minY}
        width={viewBox.width}
        height={viewBox.height}
        fill="url(#stair-halo)"
      />
      <polygon
        className="portal-light"
        style={{ '--stair-delay': delayFor(totalReveal * 0.8) } as React.CSSProperties}
        points={`${doorCx - 3},${viewBox.minY} ${doorCx + 3},${viewBox.minY} ${doorCx + 9},${doorCy + 4} ${doorCx - 9},${doorCy + 4}`}
        fill="url(#stair-beam)"
      />

      {drawOrder.map((item, index) => {
        if (item.kind === 'figure') {
          const [fx, fy] = project(item.figure.at);
          return (
            <g
              key={`figure-${index}`}
              className="stair-piece"
              style={{ '--stair-delay': delayFor(totalReveal + 2) } as React.CSSProperties}
              fill="#0B0B0A"
              aria-hidden="true"
            >
              <circle cx={fx} cy={fy - 2.05} r={0.2} />
              <path d={`M ${fx - 0.21} ${fy - 1.8} L ${fx + 0.21} ${fy - 1.8} L ${fx + 0.17} ${fy - 0.95} L ${fx - 0.17} ${fy - 0.95} Z`} />
              <rect x={fx - 0.16} y={fy - 1} width={0.13} height={1} />
              <rect x={fx + 0.03} y={fy - 1} width={0.13} height={0.98} />
            </g>
          );
        }
        if (item.kind === 'side') {
          const s = item.side;
          const gradient = s.face === 'x' ? 'url(#stair-face-x)' : 'url(#stair-face-y)';
          return (
            <polygon
              key={`side-${index}`}
              className="stair-piece"
              style={{ '--stair-delay': delayFor(s.revealIndex) } as React.CSSProperties}
              points={points(s.vertices)}
              fill={gradient}
              stroke={gradient}
              strokeWidth={0.04}
            />
          );
        }
        const b = item.box;
        const t = Math.max(0, b.z1) / topMaxZ;
        const topFill = mix('#8D8A83', '#F6F3EC', Math.pow(t, 0.75));
        return (
          <g
            key={`box-${index}`}
            className="stair-piece"
            style={{ '--stair-delay': delayFor(b.revealIndex) } as React.CSSProperties}
          >
            {b.skip !== 'x' && (
              <polygon
                points={points([[b.x1, b.y0, b.z0], [b.x1, b.y1, b.z0], [b.x1, b.y1, b.z1], [b.x1, b.y0, b.z1]])}
                fill="url(#stair-face-x)"
                stroke="url(#stair-face-x)"
                strokeWidth={0.04}
              />
            )}
            {b.skip !== 'y' && (
              <polygon
                points={points([[b.x0, b.y1, b.z0], [b.x1, b.y1, b.z0], [b.x1, b.y1, b.z1], [b.x0, b.y1, b.z1]])}
                fill="url(#stair-face-y)"
                stroke="url(#stair-face-y)"
                strokeWidth={0.04}
              />
            )}
            <polygon
              points={points([[b.x0, b.y0, b.z1], [b.x1, b.y0, b.z1], [b.x1, b.y1, b.z1], [b.x0, b.y1, b.z1]])}
              fill={topFill}
              stroke={topFill}
              strokeWidth={0.04}
            />
          </g>
        );
      })}

      <g className="portal-light" style={{ '--stair-delay': delayFor(totalReveal + 4) } as React.CSSProperties}>
        <polygon
          points={points([[door.x0, door.y, door.z0], [door.x1, door.y, door.z0], [door.x1, door.y, door.z1], [door.x0, door.y, door.z1]])}
          fill="#F3DFB2"
          filter="url(#stair-door-glow)"
          opacity={0.9}
        />
        <polygon
          points={points([[door.x0, door.y, door.z0], [door.x1, door.y, door.z0], [door.x1, door.y, door.z1], [door.x0, door.y, door.z1]])}
          fill="#FBF3E2"
        />
      </g>

      <rect x={viewBox.minX} y={viewBox.minY} width={viewBox.width} height={viewBox.height} fill="url(#stair-floor-fade)" pointerEvents="none" />
    </svg>
  );
};
