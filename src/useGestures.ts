import { useCallback, useEffect, useRef, useState, type PointerEvent as ReactPointerEvent } from 'react';
import { platform } from './platform';

export type GestureDirection = 'down' | 'up' | 'left' | 'right' | null;

export interface GestureState {
  x: number;
  y: number;
  direction: GestureDirection;
  ready: boolean;
}

interface GestureOptions {
  disabled?: boolean;
  onTap?: () => void;
  onDown: () => void;
  onUp: () => void;
  onLeft: () => void;
  onRight: () => void;
}

const DEAD_ZONE = 10;
const RELEASE_THRESHOLD = 68;
const IDLE: GestureState = { x: 0, y: 0, direction: null, ready: false };

export function useGestures(options: GestureOptions) {
  const origin = useRef<{ x: number; y: number; pointerId: number } | null>(null);
  const locked = useRef<'horizontal' | 'vertical' | null>(null);
  const crossed = useRef(false);
  const finishing = useRef(false);
  const dragRef = useRef<GestureState>(IDLE);
  const optionsRef = useRef(options);
  const [drag, setDrag] = useState<GestureState>(IDLE);
  optionsRef.current = options;

  const reset = useCallback(() => {
    origin.current = null;
    locked.current = null;
    crossed.current = false;
    dragRef.current = IDLE;
    setDrag(IDLE);
  }, []);

  const finish = useCallback(
    (commit: boolean) => {
      if (!origin.current || finishing.current) return;
      finishing.current = true;
      const action = commit && dragRef.current.ready ? dragRef.current.direction : null;
      const tapped = commit && dragRef.current.direction === null;
      reset();
      const latest = optionsRef.current;
      if (tapped) latest.onTap?.();
      if (action === 'down') latest.onDown();
      if (action === 'up') latest.onUp();
      if (action === 'left') latest.onLeft();
      if (action === 'right') latest.onRight();
      queueMicrotask(() => {
        finishing.current = false;
      });
    },
    [reset],
  );

  const onPointerDown = useCallback(
    (event: ReactPointerEvent<HTMLElement>) => {
      if (options.disabled || (event.pointerType === 'mouse' && event.button !== 0)) return;
      if ((event.target as HTMLElement).closest('button, a, input, select, textarea')) return;
      finishing.current = false;
      origin.current = { x: event.clientX, y: event.clientY, pointerId: event.pointerId };
      event.currentTarget.setPointerCapture(event.pointerId);
    },
    [options.disabled],
  );

  const onPointerMove = useCallback((event: ReactPointerEvent<HTMLElement>) => {
    if (!origin.current || origin.current.pointerId !== event.pointerId) return;
    event.preventDefault();
    const x = event.clientX - origin.current.x;
    const y = event.clientY - origin.current.y;
    if (!locked.current && Math.max(Math.abs(x), Math.abs(y)) > DEAD_ZONE) {
      locked.current = Math.abs(x) > Math.abs(y) ? 'horizontal' : 'vertical';
    }
    const dx = locked.current === 'horizontal' ? x : 0;
    const dy = locked.current === 'vertical' ? y : 0;
    const distance = Math.max(Math.abs(dx), Math.abs(dy));
    const direction: GestureDirection =
      locked.current === 'horizontal'
        ? dx >= 0
          ? 'right'
          : 'left'
        : locked.current === 'vertical'
          ? dy >= 0
            ? 'down'
            : 'up'
          : null;
    const ready = distance >= RELEASE_THRESHOLD;
    if (ready && !crossed.current) {
      crossed.current = true;
      platform.haptic();
    } else if (!ready) {
      crossed.current = false;
    }
    dragRef.current = { x: dx, y: dy, direction, ready };
    setDrag(dragRef.current);
  }, []);

  const onPointerUp = useCallback(
    (event: ReactPointerEvent<HTMLElement>) => {
      if (!origin.current || origin.current.pointerId !== event.pointerId) return;
      finish(true);
      if (event.currentTarget.hasPointerCapture(event.pointerId)) {
        event.currentTarget.releasePointerCapture(event.pointerId);
      }
    },
    [finish],
  );

  const onPointerCancel = useCallback(() => finish(false), [finish]);
  const onLostPointerCapture = useCallback(() => {
    if (origin.current) finish(false);
  }, [finish]);

  useEffect(() => {
    if (options.disabled && origin.current) reset();
  }, [options.disabled, reset]);

  return {
    drag,
    bind: { onPointerDown, onPointerMove, onPointerUp, onPointerCancel, onLostPointerCapture },
  };
}
