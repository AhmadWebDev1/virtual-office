"use client";

import {
  forwardRef,
  useCallback,
  useEffect,
  useImperativeHandle,
  useRef,
  useState,
  type CSSProperties,
  type ComponentType,
  type SVGProps,
} from "react";
import {
  ROOMS,
  STATUS_META,
  WORLD,
  type Agent,
  type AgentId,
  type AgentStatus,
  type RoomId,
  type ThemeMode,
} from "@/data/agents";
import {
  ChartIcon,
  CrownIcon,
  FitIcon,
  MailIcon,
  PaletteIcon,
  ZoomInIcon,
  ZoomOutIcon,
} from "@/components/icons";
import {
  paintDynamicOffice,
  paintStaticOffice,
  roomAtPoint,
} from "@/components/office/office-scene";

export interface AgentSpeech {
  id: number;
  text: string;
}

export interface OfficeStageProps {
  agents: Agent[];
  filter: AgentStatus | "all";
  theme: ThemeMode;
  speeches: Partial<Record<AgentId, AgentSpeech>>;
  onOpenAgent: (agentId: AgentId) => void;
  onOpenRoom: (roomId: RoomId) => void;
}

export interface OfficeStageHandle {
  focusRoom: (roomId: RoomId) => void;
  fitAll: () => void;
  zoomIn: () => void;
  zoomOut: () => void;
}

interface Camera {
  x: number;
  y: number;
  scale: number;
}

interface Viewport {
  width: number;
  height: number;
  dpr: number;
  fit: number;
  minScale: number;
  maxScale: number;
}

const DEFAULT_VIEWPORT: Viewport = {
  width: 1,
  height: 1,
  dpr: 1,
  fit: 1,
  minScale: 0.4,
  maxScale: 3,
};

const ROOM_ICONS: Record<RoomId, ComponentType<SVGProps<SVGSVGElement>>> = {
  gm: CrownIcon,
  email: MailIcon,
  finance: ChartIcon,
  creative: PaletteIcon,
};

function clamp(value: number, min: number, max: number) {
  return Math.min(Math.max(value, min), max);
}

function fitCameraFor(viewport: Viewport): Camera {
  const scale = viewport.fit;
  return {
    x: (WORLD.width - viewport.width / scale) / 2,
    y: (WORLD.height - viewport.height / scale) / 2,
    scale,
  };
}

function clampCamera(next: Camera, viewport: Viewport): Camera {
  const scale = clamp(next.scale, viewport.minScale, viewport.maxScale);
  const viewWidth = viewport.width / scale;
  const viewHeight = viewport.height / scale;

  const x =
    viewWidth >= WORLD.width
      ? (WORLD.width - viewWidth) / 2
      : clamp(next.x, 0, WORLD.width - viewWidth);
  const y =
    viewHeight >= WORLD.height
      ? (WORLD.height - viewHeight) / 2
      : clamp(next.y, 0, WORLD.height - viewHeight);

  return { x, y, scale };
}

function easeOutCubic(value: number) {
  return 1 - Math.pow(1 - value, 3);
}

const OfficeStage = forwardRef<OfficeStageHandle, OfficeStageProps>(function OfficeStage(
  { agents, filter, theme, speeches, onOpenAgent, onOpenRoom },
  ref,
) {
  const stageRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const cameraRef = useRef<Camera>({ x: 0, y: 0, scale: 1 });
  const viewportRef = useRef<Viewport>(DEFAULT_VIEWPORT);
  const [camera, setCamera] = useState<Camera>({ x: 0, y: 0, scale: 1 });
  const [ready, setReady] = useState(false);
  const initialisedRef = useRef(false);
  const animationRef = useRef<number | null>(null);
  const pointersRef = useRef(
    new Map<number, { x: number; y: number; startX: number; startY: number }>(),
  );
  const dragRef = useRef<{
    startCamera: Camera;
    startX: number;
    startY: number;
    lastX: number;
    lastY: number;
    moved: boolean;
    startedAt: number;
  } | null>(null);
  const pinchRef = useRef<{
    startDistance: number;
    startCenterX: number;
    startCenterY: number;
    startCamera: Camera;
    suppressClick: boolean;
  } | null>(null);
  const suppressClickRef = useRef(false);
  const renderDataRef = useRef({ agents, filter, theme });
  const callbacksRef = useRef({ onOpenAgent, onOpenRoom });
  const staticDirtyRef = useRef(true);

  useEffect(() => {
    renderDataRef.current = { agents, filter, theme };
    if (theme) staticDirtyRef.current = true;
  }, [agents, filter, theme]);

  useEffect(() => {
    callbacksRef.current = { onOpenAgent, onOpenRoom };
  }, [onOpenAgent, onOpenRoom]);

  const commitCamera = useCallback((next: Camera) => {
    cameraRef.current = next;
    setCamera(next);
  }, []);

  const cancelAnimation = useCallback(() => {
    if (animationRef.current !== null) {
      cancelAnimationFrame(animationRef.current);
      animationRef.current = null;
    }
  }, []);

  const animateCameraTo = useCallback(
    (target: Camera, duration = 380) => {
      cancelAnimation();
      const viewport = viewportRef.current;
      const from = cameraRef.current;
      const to = clampCamera(target, viewport);
      const startedAt = performance.now();

      const tick = (now: number) => {
        const progress = clamp((now - startedAt) / duration, 0, 1);
        const eased = easeOutCubic(progress);
        commitCamera({
          x: from.x + (to.x - from.x) * eased,
          y: from.y + (to.y - from.y) * eased,
          scale: from.scale + (to.scale - from.scale) * eased,
        });
        if (progress < 1) {
          animationRef.current = requestAnimationFrame(tick);
        } else {
          animationRef.current = null;
        }
      };
      animationRef.current = requestAnimationFrame(tick);
    },
    [cancelAnimation, commitCamera],
  );

  const fitAll = useCallback(() => {
    const viewport = viewportRef.current;
    animateCameraTo(fitCameraFor(viewport));
  }, [animateCameraTo]);

  const focusRoom = useCallback(
    (roomId: RoomId) => {
      const room = ROOMS.find((entry) => entry.id === roomId);
      if (!room) return;
      const viewport = viewportRef.current;
      const targetScale = clamp(
        Math.max(
          viewport.fit * 1.15,
          Math.min(
            viewport.width / (room.rect.w + 80),
            viewport.height / (room.rect.h + 130),
          ) * 0.86,
        ),
        viewport.minScale,
        viewport.maxScale,
      );
      const centerX = room.rect.x + room.rect.w / 2;
      const centerY = room.rect.y + room.rect.h / 2;
      animateCameraTo({
        x: centerX - viewport.width / (2 * targetScale),
        y: centerY - viewport.height / (2 * targetScale),
        scale: targetScale,
      });
    },
    [animateCameraTo],
  );

  const zoomBy = useCallback(
    (factor: number) => {
      const viewport = viewportRef.current;
      const current = cameraRef.current;
      const nextScale = clamp(
        current.scale * factor,
        viewport.minScale,
        viewport.maxScale,
      );
      const centerWorldX = current.x + viewport.width / (2 * current.scale);
      const centerWorldY = current.y + viewport.height / (2 * current.scale);
      animateCameraTo(
        {
          x: centerWorldX - viewport.width / (2 * nextScale),
          y: centerWorldY - viewport.height / (2 * nextScale),
          scale: nextScale,
        },
        220,
      );
    },
    [animateCameraTo],
  );

  const zoomIn = useCallback(() => zoomBy(1.3), [zoomBy]);
  const zoomOut = useCallback(() => zoomBy(1 / 1.3), [zoomBy]);

  useImperativeHandle(
    ref,
    () => ({ focusRoom, fitAll, zoomIn, zoomOut }),
    [fitAll, focusRoom, zoomIn, zoomOut],
  );

  // Set up the pixel renderer, resize observer, wheel and touch gestures.
  useEffect(() => {
    const stage = stageRef.current;
    const canvas = canvasRef.current;
    if (!stage || !canvas) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const staticLayer = document.createElement("canvas");
    staticLayer.width = WORLD.width;
    staticLayer.height = WORLD.height;
    const staticCtx = staticLayer.getContext("2d");

    const composite = document.createElement("canvas");
    composite.width = WORLD.width;
    composite.height = WORLD.height;
    const compositeCtx = composite.getContext("2d");

    if (!staticCtx || !compositeCtx) return;

    let frame = 0;
    let lastPaint = 0;
    let lastWheelAt = 0;

    const resize = () => {
      const rect = stage.getBoundingClientRect();
      const width = Math.max(1, rect.width);
      const height = Math.max(1, rect.height);
      const dpr = Math.min(2, window.devicePixelRatio || 1);
      canvas.width = Math.round(width * dpr);
      canvas.height = Math.round(height * dpr);

      const previousFit = viewportRef.current.fit;
      const fit = Math.min(width / WORLD.width, height / WORLD.height) * 0.96;
      const viewport: Viewport = {
        width,
        height,
        dpr,
        fit,
        minScale: fit * 0.82,
        maxScale: Math.max(2.6, fit * 3.4),
      };
      const wasFitted =
        !initialisedRef.current ||
        (previousFit > 0 && Math.abs(cameraRef.current.scale / previousFit - 0.96) < 0.001) ||
        Math.abs(cameraRef.current.scale / previousFit - 1) < 0.04;

      viewportRef.current = viewport;

      if (wasFitted) {
        const fitted = fitCameraFor(viewport);
        cameraRef.current = fitted;
        setCamera(fitted);
      } else {
        const clamped = clampCamera(cameraRef.current, viewport);
        cameraRef.current = clamped;
        setCamera(clamped);
      }

      initialisedRef.current = true;
      setReady(true);
    };

    const render = (now: number) => {
      frame = requestAnimationFrame(render);
      if (document.hidden) return;
      if (now - lastPaint < 33) return;
      lastPaint = now;

      const { agents: liveAgents, filter: liveFilter, theme: liveTheme } =
        renderDataRef.current;

      if (staticDirtyRef.current) {
        paintStaticOffice(staticCtx, liveTheme);
        staticDirtyRef.current = false;
      }

      compositeCtx.clearRect(0, 0, WORLD.width, WORLD.height);
      compositeCtx.imageSmoothingEnabled = false;
      compositeCtx.drawImage(staticLayer, 0, 0);
      paintDynamicOffice(compositeCtx, {
        agents: liveAgents,
        filter: liveFilter,
        theme: liveTheme,
        time: now,
      });

      const current = cameraRef.current;
      const viewport = viewportRef.current;
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      ctx.setTransform(viewport.dpr, 0, 0, viewport.dpr, 0, 0);
      ctx.fillStyle = liveTheme === "day" ? "#c6b593" : "#0d1717";
      ctx.fillRect(0, 0, viewport.width, viewport.height);
      ctx.imageSmoothingEnabled = false;
      ctx.save();
      ctx.translate(
        Math.round(-current.x * current.scale),
        Math.round(-current.y * current.scale),
      );
      ctx.scale(current.scale, current.scale);
      ctx.drawImage(composite, 0, 0);
      ctx.restore();

      // A faint vignette keeps the scene framed on large screens.
      const frameGradient = ctx.createLinearGradient(0, 0, 0, viewport.height);
      frameGradient.addColorStop(0, "rgba(9, 14, 13, 0.08)");
      frameGradient.addColorStop(0.25, "rgba(9, 14, 13, 0)");
      frameGradient.addColorStop(1, "rgba(9, 14, 13, 0.18)");
      ctx.fillStyle = frameGradient;
      ctx.fillRect(0, 0, viewport.width, viewport.height);
    };

    const onWheel = (event: WheelEvent) => {
      event.preventDefault();
      if (performance.now() - lastWheelAt < 14) return;
      lastWheelAt = performance.now();
      cancelAnimation();
      const viewport = viewportRef.current;
      const rect = stage.getBoundingClientRect();
      const localX = event.clientX - rect.left;
      const localY = event.clientY - rect.top;
      const current = cameraRef.current;
      const worldX = current.x + localX / current.scale;
      const worldY = current.y + localY / current.scale;
      const factor = Math.exp(-event.deltaY * 0.0014);
      const nextScale = clamp(
        current.scale * factor,
        viewport.minScale,
        viewport.maxScale,
      );
      commitCamera(
        clampCamera(
          {
            x: worldX - localX / nextScale,
            y: worldY - localY / nextScale,
            scale: nextScale,
          },
          viewport,
        ),
      );
    };

    const observer = new ResizeObserver(resize);
    observer.observe(stage);
    resize();
    stage.addEventListener("wheel", onWheel, { passive: false });
    frame = requestAnimationFrame(render);

    return () => {
      observer.disconnect();
      stage.removeEventListener("wheel", onWheel);
      cancelAnimationFrame(frame);
    };
  }, [cancelAnimation, commitCamera]);

  const onPointerDown = (event: React.PointerEvent<HTMLCanvasElement>) => {
    if (event.pointerType === "mouse" && event.button !== 0) return;
    cancelAnimation();
    const canvas = canvasRef.current;
    if (!canvas) return;
    canvas.setPointerCapture(event.pointerId);
    pointersRef.current.set(event.pointerId, {
      x: event.clientX,
      y: event.clientY,
      startX: event.clientX,
      startY: event.clientY,
    });

    if (pointersRef.current.size === 1) {
      dragRef.current = {
        startCamera: cameraRef.current,
        startX: event.clientX,
        startY: event.clientY,
        lastX: event.clientX,
        lastY: event.clientY,
        moved: false,
        startedAt: performance.now(),
      };
      pinchRef.current = null;
    } else if (pointersRef.current.size === 2) {
      const points = [...pointersRef.current.values()];
      const [first, second] = points;
      pinchRef.current = {
        startDistance: Math.hypot(second.x - first.x, second.y - first.y),
        startCenterX: (first.x + second.x) / 2,
        startCenterY: (first.y + second.y) / 2,
        startCamera: cameraRef.current,
        suppressClick: true,
      };
      suppressClickRef.current = true;
      dragRef.current = null;
    }
  };

  const onPointerMove = (event: React.PointerEvent<HTMLCanvasElement>) => {
    const point = pointersRef.current.get(event.pointerId);
    if (!point) return;
    point.x = event.clientX;
    point.y = event.clientY;

    if (pointersRef.current.size >= 2 && pinchRef.current) {
      const points = [...pointersRef.current.values()];
      const [first, second] = points;
      const distance = Math.hypot(second.x - first.x, second.y - first.y);
      const centerX = (first.x + second.x) / 2;
      const centerY = (first.y + second.y) / 2;
      const stage = stageRef.current;
      if (!stage) return;
      const rect = stage.getBoundingClientRect();
      const viewport = viewportRef.current;
      const pinch = pinchRef.current;
      const nextScale = clamp(
        pinch.startCamera.scale * (distance / Math.max(1, pinch.startDistance)),
        viewport.minScale,
        viewport.maxScale,
      );
      const worldX =
        pinch.startCamera.x + (pinch.startCenterX - rect.left) / pinch.startCamera.scale;
      const worldY =
        pinch.startCamera.y + (pinch.startCenterY - rect.top) / pinch.startCamera.scale;
      commitCamera(
        clampCamera(
          {
            x: worldX - (centerX - rect.left) / nextScale,
            y: worldY - (centerY - rect.top) / nextScale,
            scale: nextScale,
          },
          viewport,
        ),
      );
      return;
    }

    const drag = dragRef.current;
    if (!drag) return;
    const deltaX = event.clientX - drag.startX;
    const deltaY = event.clientY - drag.startY;
    if (Math.abs(deltaX) + Math.abs(deltaY) > 3) drag.moved = true;
    const viewport = viewportRef.current;
    const next = clampCamera(
      {
        x: drag.startCamera.x - deltaX / drag.startCamera.scale,
        y: drag.startCamera.y - deltaY / drag.startCamera.scale,
        scale: drag.startCamera.scale,
      },
      viewport,
    );
    commitCamera(next);
  };

  const finishPointer = (event: React.PointerEvent<HTMLCanvasElement>) => {
    const point = pointersRef.current.get(event.pointerId);
    pointersRef.current.delete(event.pointerId);
    if (canvasRef.current?.hasPointerCapture(event.pointerId)) {
      canvasRef.current.releasePointerCapture(event.pointerId);
    }

    if (pointersRef.current.size === 0) {
      const drag = dragRef.current;
      const wasPinch = suppressClickRef.current;
      if (
        !wasPinch &&
        drag &&
        !drag.moved &&
        performance.now() - drag.startedAt < 550 &&
        point
      ) {
        const stage = stageRef.current;
        if (!stage) return;
        const rect = stage.getBoundingClientRect();
        const current = cameraRef.current;
        const worldX = current.x + (event.clientX - rect.left) / current.scale;
        const worldY = current.y + (event.clientY - rect.top) / current.scale;
        const clickedAgent = agents.find(
          (agent) =>
            Math.abs(agent.position.x - worldX) <= 18 &&
            worldY >= agent.position.y - 40 &&
            worldY <= agent.position.y + 6,
        );
        if (clickedAgent) {
          callbacksRef.current.onOpenAgent(clickedAgent.id);
        } else {
          const room = roomAtPoint(worldX, worldY);
          if (room) callbacksRef.current.onOpenRoom(room.id);
        }
      }
      dragRef.current = null;
      pinchRef.current = null;
      suppressClickRef.current = false;
    } else if (pointersRef.current.size === 1) {
      // Keep remaining finger steady after a pinch ends.
      const remaining = [...pointersRef.current.values()][0];
      dragRef.current = {
        startCamera: cameraRef.current,
        startX: remaining.x,
        startY: remaining.y,
        lastX: remaining.x,
        lastY: remaining.y,
        moved: true,
        startedAt: performance.now(),
      };
      pinchRef.current = null;
    }
  };

  const overlayScale = clamp(camera.scale / Math.max(0.75, viewportRef.current.fit), 0.72, 1.05);
  const zoomPercent = Math.round((camera.scale / Math.max(0.001, viewportRef.current.fit)) * 100);

  return (
    <div
      ref={stageRef}
      className="office-stage"
      data-theme={theme}
      data-ready={ready ? "true" : "false"}
    >
      <canvas
        ref={canvasRef}
        className="office-canvas"
        aria-label="مخطط ثلاثي الأبعاد علوي لمكتب افتراضي من طابق واحد يضم غرفة المدير العام، الإيميلات، المالية، والإبداع والتسويق. يمكنك سحب الخريطة وتكبيرها، والنقر على وكيل أو غرفة لعرض التفاصيل."
        role="img"
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={finishPointer}
        onPointerCancel={finishPointer}
      />

      <div className="stage-meta" aria-hidden="true">
        <span className="stage-meta-dot" />
        <span>الطابق الأرضي</span>
        <span className="stage-meta-sep">·</span>
        <span>{agents.length} وكلاء</span>
      </div>

      <div className="room-sign-layer">
        {ROOMS.map((room) => {
          const Icon = ROOM_ICONS[room.id];
          const left = (room.rect.x + room.rect.w / 2 - camera.x) * camera.scale;
          const top = (room.rect.y - 10 - camera.y) * camera.scale;
          if (left < -200 || left > viewportRef.current.width + 200) return null;
          return (
            <button
              key={room.id}
              type="button"
              className="room-sign"
              style={
                {
                  left,
                  top,
                  "--room-accent": room.accent,
                } as CSSProperties
              }
              onClick={() => onOpenRoom(room.id)}
              aria-label={`فتح ${room.nameAr}`}
            >
              <span className="room-sign-grip" aria-hidden="true" />
              <span className="room-sign-icon">
                <Icon width={13} height={13} />
              </span>
              <span className="room-sign-name">{room.nameAr}</span>
              <span className="room-sign-code" aria-hidden="true">
                {room.id === "gm" ? "01" : room.id === "creative" ? "02" : room.id === "email" ? "03" : "04"}
              </span>
            </button>
          );
        })}
      </div>

      <div className="agent-label-layer">
        {agents.map((agent) => {
          const left = (agent.position.x - camera.x) * camera.scale;
          const top = (agent.position.y - 42 - camera.y) * camera.scale;
          const speech = speeches[agent.id];
          const meta = STATUS_META[agent.status];
          const dimmed = filter !== "all" && agent.status !== filter;
          const firstName = agent.nameAr.split(" ")[0];
          // Agents near the bottom wall need their bubble below the chip so it never covers the room sign.
          const speechBelow = agent.roomId === "email" || agent.roomId === "finance";
          if (left < -160 || left > viewportRef.current.width + 160) return null;
          return (
            <div
              key={agent.id}
              className="agent-anchor"
              data-speech-below={speechBelow ? "true" : "false"}
              style={{
                left,
                top,
                zIndex: 30 + Math.round(agent.position.y),
              }}
            >
              {speech ? (
                <div key={speech.id} className="speech-bubble" role="status">
                  {speech.text}
                </div>
              ) : null}
              <button
                type="button"
                className="agent-chip"
                data-status={agent.status}
                data-dimmed={dimmed ? "true" : "false"}
                style={
                  {
                    "--chip-scale": overlayScale,
                    "--status-dot": meta.dot,
                    "--status-soft": meta.soft,
                    "--status-ink": meta.text,
                  } as CSSProperties
                }
                onClick={() => onOpenAgent(agent.id)}
                aria-label={`${agent.nameAr}، ${agent.roleAr}، الحالة: ${meta.labelAr}. فتح التفاصيل`}
              >
                <span className="agent-chip-dot" aria-hidden="true" />
                <span className="agent-chip-name">{firstName}</span>
                <span className="agent-chip-status">{meta.labelAr}</span>
                {agent.activeTask && agent.status === "working" ? (
                  <span className="typing-dots" aria-hidden="true">
                    <i />
                    <i />
                    <i />
                  </span>
                ) : null}
                <span
                  className="agent-chip-progress"
                  style={{ width: `${agent.activeTask?.progress ?? 0}%` }}
                  aria-hidden="true"
                />
              </button>
            </div>
          );
        })}
      </div>

      <div className="camera-controls" aria-label="أدوات الكاميرا">
        <button type="button" className="camera-button" onClick={zoomOut} aria-label="تصغير">
          <ZoomOutIcon width={17} height={17} />
        </button>
        <button
          type="button"
          className="camera-button camera-button-fit"
          onClick={fitAll}
          aria-label="إعادة ضبط الكاميرا وعرض المكتب كاملاً"
          title="عرض المكتب كاملاً"
        >
          <FitIcon width={16} height={16} />
          <span>ملاءمة</span>
        </button>
        <button type="button" className="camera-button" onClick={zoomIn} aria-label="تكبير">
          <ZoomInIcon width={17} height={17} />
        </button>
        <span className="camera-zoom" aria-hidden="true">
          {zoomPercent.toString()}%
        </span>
      </div>

      <div className="stage-hint" aria-hidden="true">
        <span className="stage-hint-icon">
          <svg viewBox="0 0 20 20" width="14" height="14" fill="none" stroke="currentColor">
            <path d="M10 2.5v6M10 2.5 7.5 5M10 2.5 12.5 5" strokeWidth="1.5" />
            <rect x="2.5" y="9" width="15" height="8.5" rx="1.5" strokeWidth="1.3" />
            <path d="M10 9v8.5" strokeWidth="1.1" />
          </svg>
        </span>
        اسحب للتنقّل · عجلة الفأرة أو إصبعان للتقريب
      </div>

      {!ready ? (
        <div className="stage-loading" role="status">
          <span className="stage-loading-pixel" />
          جاري تجهيز المكتب…
        </div>
      ) : null}
    </div>
  );
});

export default OfficeStage;
