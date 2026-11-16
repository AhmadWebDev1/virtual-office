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
  STATUS_META,
  getWorldDimensions,
  type Agent,
  type AgentId,
  type AgentStatus,
  type FurnitureStyle,
  type Room,
  type RoomId,
  type ThemeMode,
  type WorldDimensions,
  type FloorDataPulse,
} from "@/data/agents";
import {
  ChartIcon,
  CodeIcon,
  CrownIcon,
  FitIcon,
  FullscreenIcon,
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

export interface FlyingPacket {
  id: string;
  fromX: number;
  fromY: number;
  toX: number;
  toY: number;
  progress: number;
  labelAr: string;
}

export interface WalkingMessenger {
  id: string;
  x: number;
  y: number;
  targetRoomId: string;
  labelAr: string;
  step: number;
}

interface OfficeStageProps {
  agents: Agent[];
  rooms: Room[];
  filter: AgentStatus | "all";
  theme: ThemeMode;
  speeches: Partial<Record<AgentId, AgentSpeech>>;
  flyingPackets?: FlyingPacket[];
  walkingMessenger?: WalkingMessenger | null;
  onOpenAgent: (agentId: AgentId) => void;
  onOpenRoom: (roomId: RoomId) => void;
  onOpenRoomSettings?: (roomId: RoomId) => void;
  showCircuitWires?: boolean;
  floorPulses?: FloorDataPulse[];
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

const STYLE_ICONS: Record<FurnitureStyle, ComponentType<SVGProps<SVGSVGElement>>> = {
  admin: CrownIcon,
  tech: CodeIcon,
  finance: ChartIcon,
  creative: PaletteIcon,
};

function clamp(value: number, min: number, max: number) {
  return Math.min(Math.max(value, min), max);
}

function fitCameraFor(viewport: Viewport, world: WorldDimensions): Camera {
  const scale = viewport.fit;
  return {
    x: (world.width - viewport.width / scale) / 2,
    y: (world.height - viewport.height / scale) / 2,
    scale,
  };
}

function clampCamera(next: Camera, viewport: Viewport, world: WorldDimensions): Camera {
  const scale = clamp(next.scale, viewport.minScale, viewport.maxScale);
  const viewWidth = viewport.width / scale;
  const viewHeight = viewport.height / scale;

  const x =
    viewWidth >= world.width
      ? (world.width - viewWidth) / 2
      : clamp(next.x, 0, world.width - viewWidth);
  const y =
    viewHeight >= world.height
      ? (world.height - viewHeight) / 2
      : clamp(next.y, 0, world.height - viewHeight);

  return { x, y, scale };
}

function easeOutCubic(value: number) {
  return 1 - Math.pow(1 - value, 3);
}

const OfficeStage = forwardRef<OfficeStageHandle, OfficeStageProps>(function OfficeStage(
  {
    agents,
    rooms,
    filter,
    theme,
    speeches,
    flyingPackets = [],
    walkingMessenger = null,
    onOpenAgent,
    onOpenRoom,
    onOpenRoomSettings,
    showCircuitWires = false,
    floorPulses = [],
  },
  ref,
) {
  const stageRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const cameraRef = useRef<Camera>({ x: 0, y: 0, scale: 1 });
  const viewportRef = useRef<Viewport>(DEFAULT_VIEWPORT);
  const worldRef = useRef<WorldDimensions>(getWorldDimensions(rooms));
  const [camera, setCamera] = useState<Camera>({ x: 0, y: 0, scale: 1 });
  const [ready, setReady] = useState(false);
  const initialisedRef = useRef(false);
  const animationRef = useRef<number | null>(null);
  const resizeHandlerRef = useRef<((forceFit?: boolean) => void) | null>(null);
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
  const renderDataRef = useRef({ agents, rooms, filter, theme });
  const callbacksRef = useRef({ onOpenAgent, onOpenRoom });
  const staticDirtyRef = useRef(true);
  const prevRoomCountRef = useRef(rooms.length);

  const world = getWorldDimensions(rooms);
  worldRef.current = world;

  useEffect(() => {
    renderDataRef.current = { agents, rooms, filter, theme };
    staticDirtyRef.current = true;
    if (prevRoomCountRef.current !== rooms.length) {
      prevRoomCountRef.current = rooms.length;
      resizeHandlerRef.current?.(true);
    }
  }, [agents, rooms, filter, theme]);

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
      const to = clampCamera(target, viewport, worldRef.current);
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
    animateCameraTo(fitCameraFor(viewport, worldRef.current));
  }, [animateCameraTo]);

  const focusRoom = useCallback(
    (roomId: RoomId) => {
      const room = renderDataRef.current.rooms.find((entry) => entry.id === roomId);
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

  const [isFullscreen, setIsFullscreen] = useState(false);

  useEffect(() => {
    const onFsChange = () => {
      setIsFullscreen(Boolean(document.fullscreenElement));
    };
    document.addEventListener("fullscreenchange", onFsChange);
    return () => document.removeEventListener("fullscreenchange", onFsChange);
  }, []);

  const toggleFullscreen = useCallback(() => {
    if (!document.fullscreenElement) {
      void document.documentElement.requestFullscreen().catch(() => {});
    } else {
      void document.exitFullscreen().catch(() => {});
    }
  }, []);

  useImperativeHandle(
    ref,
    () => ({ focusRoom, fitAll, zoomIn, zoomOut }),
    [fitAll, focusRoom, zoomIn, zoomOut],
  );

  useEffect(() => {
    const stage = stageRef.current;
    const canvas = canvasRef.current;
    if (!stage || !canvas) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const RENDER_SCALE = 2;
    const staticLayer = document.createElement("canvas");
    const composite = document.createElement("canvas");
    const initialWorld = worldRef.current;
    staticLayer.width = initialWorld.width * RENDER_SCALE;
    staticLayer.height = initialWorld.height * RENDER_SCALE;
    composite.width = initialWorld.width * RENDER_SCALE;
    composite.height = initialWorld.height * RENDER_SCALE;

    const staticCtx = staticLayer.getContext("2d");
    const compositeCtx = composite.getContext("2d");

    if (!staticCtx || !compositeCtx) return;

    let frame = 0;
    let lastPaint = 0;
    let lastWheelAt = 0;

    const resize = (forceFit = false) => {
      const rect = stage.getBoundingClientRect();
      const width = Math.max(1, rect.width);
      const height = Math.max(1, rect.height);
      const dpr = Math.min(2, window.devicePixelRatio || 1);
      canvas.width = Math.round(width * dpr);
      canvas.height = Math.round(height * dpr);

      const liveWorld = worldRef.current;
      const previousFit = viewportRef.current.fit;
      const fit = Math.min(width / liveWorld.width, height / liveWorld.height) * 0.96;
      const viewport: Viewport = {
        width,
        height,
        dpr,
        fit,
        minScale: fit * 0.82,
        maxScale: Math.max(2.6, fit * 3.4),
      };
      const wasFitted =
        forceFit ||
        !initialisedRef.current ||
        (previousFit > 0 && Math.abs(cameraRef.current.scale / previousFit - 0.96) < 0.001) ||
        Math.abs(cameraRef.current.scale / previousFit - 1) < 0.04;

      viewportRef.current = viewport;

      if (wasFitted) {
        const fitted = fitCameraFor(viewport, liveWorld);
        cameraRef.current = fitted;
        setCamera(fitted);
      } else {
        const clamped = clampCamera(cameraRef.current, viewport, liveWorld);
        cameraRef.current = clamped;
        setCamera(clamped);
      }

      initialisedRef.current = true;
      setReady(true);
    };

    resizeHandlerRef.current = resize;

    const render = (now: number) => {
      frame = requestAnimationFrame(render);
      if (document.hidden) return;
      if (now - lastPaint < 33) return;
      lastPaint = now;

      const {
        agents: liveAgents,
        rooms: liveRooms,
        filter: liveFilter,
        theme: liveTheme,
      } = renderDataRef.current;
      const liveWorld = getWorldDimensions(liveRooms);
      worldRef.current = liveWorld;

      const targetW = liveWorld.width * RENDER_SCALE;
      const targetH = liveWorld.height * RENDER_SCALE;
      if (staticLayer.width !== targetW || staticLayer.height !== targetH) {
        staticLayer.width = targetW;
        staticLayer.height = targetH;
        composite.width = targetW;
        composite.height = targetH;
        staticDirtyRef.current = true;
      }

      if (staticDirtyRef.current) {
        staticCtx.setTransform(RENDER_SCALE, 0, 0, RENDER_SCALE, 0, 0);
        paintStaticOffice(staticCtx, liveTheme, liveRooms);
        staticDirtyRef.current = false;
      }

      compositeCtx.setTransform(1, 0, 0, 1, 0, 0);
      compositeCtx.clearRect(0, 0, composite.width, composite.height);
      compositeCtx.imageSmoothingEnabled = false;
      compositeCtx.drawImage(staticLayer, 0, 0);
      compositeCtx.setTransform(RENDER_SCALE, 0, 0, RENDER_SCALE, 0, 0);
      paintDynamicOffice(compositeCtx, {
        agents: liveAgents,
        rooms: liveRooms,
        filter: liveFilter,
        theme: liveTheme,
        time: now,
      });

      const current = cameraRef.current;
      const viewport = viewportRef.current;
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      ctx.setTransform(viewport.dpr, 0, 0, viewport.dpr, 0, 0);
      ctx.fillStyle = liveTheme === "day" ? "#c2b08c" : "#0b1516";
      ctx.fillRect(0, 0, viewport.width, viewport.height);
      ctx.imageSmoothingEnabled = false;
      ctx.save();
      ctx.translate(
        Math.round(-current.x * current.scale),
        Math.round(-current.y * current.scale),
      );
      ctx.scale(current.scale, current.scale);
      ctx.drawImage(composite, 0, 0, liveWorld.width, liveWorld.height);
      ctx.restore();

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
          worldRef.current,
        ),
      );
    };

    const observer = new ResizeObserver(() => resize(false));
    observer.observe(stage);
    resize(false);
    stage.addEventListener("wheel", onWheel, { passive: false });
    frame = requestAnimationFrame(render);

    return () => {
      resizeHandlerRef.current = null;
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
          worldRef.current,
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
      worldRef.current,
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
          const room = roomAtPoint(worldX, worldY, rooms);
          if (room) callbacksRef.current.onOpenRoom(room.id);
        }
      }
      dragRef.current = null;
      pinchRef.current = null;
      suppressClickRef.current = false;
    } else if (pointersRef.current.size === 1) {
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
        aria-label="خريطة المقر الافتراضي القابل للتوسع. يمكنك سحب الخريطة وتكبيرها، والنقر على أي وكيل أو غرفة لعرض التفاصيل أو تعديل المهارات والقواعد."
        role="img"
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={finishPointer}
        onPointerCancel={finishPointer}
      />

      <div className="office-scanlines" aria-hidden="true" />
      <span className="office-frame-corner office-frame-tl" aria-hidden="true" />
      <span className="office-frame-corner office-frame-tr" aria-hidden="true" />
      <span className="office-frame-corner office-frame-bl" aria-hidden="true" />
      <span className="office-frame-corner office-frame-br" aria-hidden="true" />

      <div className="room-sign-layer">
        {rooms.map((room, index) => {
          const roomAgent = agents.find((a) => room.agentIds.includes(a.id));
          const Icon =
            roomAgent?.skills.includes("gmail-workspace")
              ? MailIcon
              : STYLE_ICONS[room.furnitureStyle];
          const left = (room.rect.x + room.rect.w / 2 - camera.x) * camera.scale;
          const top = (room.rect.y - 10 - camera.y) * camera.scale;
          if (left < -200 || left > viewportRef.current.width + 200) return null;
          return (
            <div
              key={room.id}
              className="room-sign-wrapper"
              style={
                {
                  position: "absolute",
                  left,
                  top,
                  display: "flex",
                  alignItems: "center",
                  gap: 4,
                  transform: "translateX(-50%)",
                  zIndex: 25,
                } as CSSProperties
              }
            >
              <button
                type="button"
                className="room-sign"
                style={
                  {
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
                  {String(index + 1).padStart(2, "0")}
                </span>
              </button>
              {onOpenRoomSettings && (
                <button
                  type="button"
                  className="room-sign-settings-btn"
                  onClick={(e) => {
                    e.stopPropagation();
                    onOpenRoomSettings(room.id);
                  }}
                  title={`إعدادات وقواعد قسم ${room.nameAr}`}
                  aria-label={`إعدادات ${room.nameAr}`}
                >
                  ⚙
                </button>
              )}
            </div>
          );
        })}
      </div>

      {/* 16-Bit Circuit Wires Floor Overlay */}
      {showCircuitWires && (
        <svg
          className="stage-circuit-svg"
          style={{
            position: "absolute",
            inset: 0,
            width: "100%",
            height: "100%",
            pointerEvents: "none",
            zIndex: 15,
          }}
        >
          <g transform={`translate(${-camera.x * camera.scale}, ${-camera.y * camera.scale}) scale(${camera.scale})`}>
            {/* Spine Bus Wire */}
            <path
              d="M 420 114 L 420 540"
              stroke="#0ea5e9"
              strokeWidth="3"
              strokeDasharray="4 2"
              fill="none"
              opacity="0.85"
            />
            {/* Top Coffee Corner Node */}
            <circle cx="420" cy="114" r="5" fill="#f59e0b" stroke="#78350f" strokeWidth="1.5" />
            <text x="420" y="104" textAnchor="middle" fill="#fef08a" fontSize="8" fontWeight="bold">
              ☕ ركن القهوة
            </text>

            {/* Traces to Agent Desks */}
            {agents.map((agent) => (
              <g key={`circuit-${agent.id}`}>
                <path
                  d={`M 420 ${agent.position.y} L ${agent.position.x} ${agent.position.y}`}
                  stroke="#38bdf8"
                  strokeWidth="2"
                  strokeDasharray="3 2"
                  fill="none"
                  opacity="0.75"
                />
                <circle cx="420" cy={agent.position.y} r="2.5" fill="#38bdf8" />
                <rect
                  x={agent.position.x - 3}
                  y={agent.position.y - 3}
                  width="6"
                  height="6"
                  fill="#0284c7"
                  stroke="#38bdf8"
                  strokeWidth="1"
                />
              </g>
            ))}

            {/* Live Data Pulses Along Wires */}
            {floorPulses.map((pulse) => {
              const midX = 420;
              const t = pulse.progress;
              let px = pulse.fromX;
              let py = pulse.fromY;
              if (t < 0.5) {
                const subT = t / 0.5;
                px = pulse.fromX + (midX - pulse.fromX) * subT;
                py = pulse.fromY;
              } else {
                const subT = (t - 0.5) / 0.5;
                px = midX + (pulse.toX - midX) * subT;
                py = pulse.fromY + (pulse.toY - pulse.fromY) * subT;
              }
              return (
                <g key={pulse.id} className="live-circuit-pulse">
                  <circle cx={px} cy={py} r="5" fill={pulse.color} opacity="0.9" />
                  <circle cx={px} cy={py} r="2" fill="#ffffff" />
                  {pulse.labelAr && (
                    <text x={px} y={py - 7} textAnchor="middle" fill={pulse.color} fontSize="8.5" fontWeight="bold">
                      {pulse.labelAr}
                    </text>
                  )}
                </g>
              );
            })}
          </g>
        </svg>
      )}

      <div className="agent-label-layer">
        {agents.map((agent) => {
          const left = (agent.position.x - camera.x) * camera.scale;
          const top = (agent.position.y - 42 - camera.y) * camera.scale;
          const speech = speeches[agent.id];
          const meta = STATUS_META[agent.status];
          const dimmed = filter !== "all" && agent.status !== filter;
          const firstName = agent.nameAr.split(" ")[0];
          const room = rooms.find((r) => r.id === agent.roomId);
          const speechBelow = room ? room.rect.y > 120 : false;
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
              {/* Emergency Alert Beacon on 3+ Failures or Red Desk LED */}
              {((agent.consecutiveFailures && agent.consecutiveFailures >= 3) || agent.deskLedColor === "red") && (
                <div className="desk-emergency-beacon beacon-pulse-red" role="alert" title="تنبيه: تعثر متكرر في المهام - تصعيد للمدير">
                  <span className="beacon-siren-dot" />
                  <span className="beacon-alert-text">🚨 طوارئ</span>
                </div>
              )}
              {/* Level & Rank Star Badge */}
              {((agent.level && agent.level >= 2) || (agent.rankBadge && agent.rankBadge !== "none")) && (
                <div
                  className="agent-stage-rank-badge"
                  title={`مستوى ${agent.level || 1} - رتبة ${agent.rankBadge === "crown" ? "تاج القيادة" : "نجم التميز"}`}
                >
                  <span>{agent.rankBadge === "crown" ? "👑" : "⭐"}</span>
                  <span className="rank-lvl-num">LV{agent.level || 1}</span>
                </div>
              )}
              {/* Steaming Coffee Break Cooldown Badge */}
              {agent.status === "cooldown" && (
                <div className="agent-stage-cooldown-badge pulse-badge" role="status">
                  <span className="steaming-cup">☕</span>
                  <span className="cooldown-timer">
                    استراحة {Math.max(0, Math.ceil(((agent.cooldownUntil ?? Date.now() + 15000) - Date.now()) / 1000))}ث
                  </span>
                </div>
              )}
              {agent.status === "waiting_approval" && (
                <div className="agent-stage-approval-badge pulse-badge" role="status">
                  <span className="approval-hand">✋</span>
                  <span>موافقة مطلوبة</span>
                </div>
              )}
              {agent.schedule?.enabled && (
                <div className="agent-stage-schedule-badge">
                  <span>⏱</span>
                  <span>
                    {Math.max(
                      0,
                      Math.ceil((agent.schedule.nextRunTimestamp - Date.now()) / 60_000),
                    )} د
                  </span>
                </div>
              )}
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
                {/* Segmented Stamina Mini Bar */}
                <div
                  className="agent-chip-stamina-bar"
                  title={`طاقة الوكيل: ${agent.stamina ?? 100}%`}
                >
                  <div
                    className={`stamina-fill ${(agent.stamina ?? 100) > 60 ? "high" : (agent.stamina ?? 100) > 25 ? "mid" : "low"}`}
                    style={{ width: `${agent.stamina ?? 100}%` }}
                  />
                </div>
              </button>
            </div>
          );
        })}
      </div>

      {/* Walking Messenger Animation Layer */}
      {walkingMessenger && (
        <div
          className="stage-walking-messenger"
          style={{
            left: (walkingMessenger.x - camera.x) * camera.scale,
            top: (walkingMessenger.y - 36 - camera.y) * camera.scale,
            transform: `scale(${camera.scale})`,
            zIndex: 45,
          }}
        >
          <div className="messenger-speech-tag">
            <span>📜 {walkingMessenger.labelAr}</span>
          </div>
          <div className={`messenger-pixel-sprite step-${walkingMessenger.step % 2}`} />
        </div>
      )}

      {/* Flying Data Packets Collaboration Layer */}
      {flyingPackets.map((packet) => {
        const posX = packet.fromX + (packet.toX - packet.fromX) * packet.progress;
        const arc = -Math.sin(packet.progress * Math.PI) * 55;
        const posY = packet.fromY + (packet.toY - packet.fromY) * packet.progress + arc;
        const screenX = (posX - camera.x) * camera.scale;
        const screenY = (posY - camera.y) * camera.scale;

        return (
          <div
            key={packet.id}
            className="flying-packet-wrapper"
            style={{
              left: screenX,
              top: screenY,
              transform: `scale(${camera.scale})`,
              zIndex: 48,
            }}
          >
            <div className="packet-envelope-glow">✉</div>
            <div className="packet-spark-trail" />
            <span className="packet-payload-tag">{packet.labelAr}</span>
          </div>
        );
      })}

      <div
        className="camera-pad pixel-panel"
        role="group"
        aria-label="أدوات الكاميرا"
      >
        <button
          type="button"
          className="camera-button pixel-btn"
          onClick={zoomOut}
          aria-label="تصغير"
          title="تصغير"
        >
          <ZoomOutIcon width={15} height={15} />
        </button>
        <button
          type="button"
          className="camera-button camera-button-fit pixel-btn"
          onClick={fitAll}
          aria-label="إعادة ضبط الكاميرا وعرض المكتب كاملاً"
          title="عرض المكتب كاملاً"
        >
          <FitIcon width={14} height={14} />
          <span>ملاءمة</span>
        </button>
        <button
          type="button"
          className="camera-button camera-button-fullscreen pixel-btn"
          onClick={toggleFullscreen}
          aria-label={isFullscreen ? "إنهاء ملء الشاشة" : "ملء الشاشة"}
          title={isFullscreen ? "إنهاء ملء الشاشة" : "ملء الشاشة"}
        >
          <FullscreenIcon width={13} height={13} />
          <span>{isFullscreen ? "نافذة" : "شاشة كاملة"}</span>
        </button>
        <button
          type="button"
          className="camera-button pixel-btn"
          onClick={zoomIn}
          aria-label="تكبير"
          title="تكبير"
        >
          <ZoomInIcon width={15} height={15} />
        </button>
        <span className="camera-zoom" aria-hidden="true">
          {zoomPercent.toString()}%
        </span>
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
