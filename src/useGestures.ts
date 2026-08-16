import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type PointerEvent as ReactPointerEvent,
  type TransitionEvent as ReactTransitionEvent,
} from 'react';
import { platform } from './platform';

export type GestureDirection = 'down' | 'up' | 'left' | 'right' | null;

export interface GestureState {
  x: number;
  y: number;
  direction: GestureDirection;
  ready: boolean;
  settling: boolean;
  swapping: boolean;
}

interface GestureOptions {
  disabled?: boolean;
  canDown?: boolean;
  canUp?: boolean;
  canLeft?: boolean;
  canRight?: boolean;
  onTap?: () => void;
  onDown: () => void;
  onUp: () => void;
  onLeft: () => void;
  onRight: () => void;
}

const DEAD_ZONE = 10;
const RELEASE_THRESHOLD = 68;
const SETTLE_FALLBACK = 560;
const IDLE: GestureState = { x: 0, y: 0, direction: null, ready: false, settling: false, swapping: false };

export function useGestures(options: GestureOptions) {
  const origin = useRef<{ x: number; y: number; width: number; height: number; pointerId: number } | null>(null);
  const locked = useRef<'horizontal' | 'vertical' | null>(null);
  const crossed = useRef(false);
  const finishing = useRef(false);
  const settleTimer = useRef<number | null>(null);
  const swapFrame = useRef<number | null>(null);
  const pendingAction = useRef<GestureDirection>(null);
  const pendingCommit = useRef(false);
  const dragRef = useRef<GestureState>(IDLE);
  const optionsRef = useRef(options);
  const [drag, setDrag] = useState<GestureState>(IDLE);
  optionsRef.current = options;

  const reset = useCallback(() => {
    if (settleTimer.current !== null) {
      window.clearTimeout(settleTimer.current);
      settleTimer.current = null;
    }
    if (swapFrame.current !== null) {
      window.cancelAnimationFrame(swapFrame.current);
      swapFrame.current = null;
    }
    origin.current = null;
    locked.current = null;
    crossed.current = false;
    dragRef.current = IDLE;
    setDrag(IDLE);
  }, []);

  const completeSettle = useCallback(() => {
    if (!finishing.current || !dragRef.current.settling) return;
    if (settleTimer.current !== null) {
      window.clearTimeout(settleTimer.current);
      settleTimer.current = null;
    }

    const action = pendingAction.current;
    const committed = pendingCommit.current;
    const latest = optionsRef.current;
    origin.current = null;
    locked.current = null;
    crossed.current = false;
    pendingAction.current = null;
    pendingCommit.current = false;
    dragRef.current = committed ? { ...IDLE, swapping: true } : IDLE;
    setDrag(dragRef.current);

    if (action === 'down') latest.onDown();
    if (action === 'up') latest.onUp();
    if (action === 'left') latest.onLeft();
    if (action === 'right') latest.onRight();

    if (!committed) {
      finishing.current = false;
      return;
    }

    // Keep transitions disabled for one painted frame while React swaps the
    // arrived preview into the current-card slot.
    swapFrame.current = window.requestAnimationFrame(() => {
      swapFrame.current = window.requestAnimationFrame(() => {
        swapFrame.current = null;
        dragRef.current = IDLE;
        setDrag(IDLE);
        finishing.current = false;
      });
    });
  }, []);

  const finish = useCallback(
    (commit: boolean) => {
      if (!origin.current || finishing.current) return;
      const gestureOrigin = origin.current;
      finishing.current = true;
      const requestedAction = commit && dragRef.current.ready ? dragRef.current.direction : null;
      const canComplete =
        (requestedAction === 'down' && optionsRef.current.canDown !== false) ||
        (requestedAction === 'up' && optionsRef.current.canUp !== false) ||
        (requestedAction === 'left' && optionsRef.current.canLeft !== false) ||
        (requestedAction === 'right' && optionsRef.current.canRight !== false);
      const action = canComplete ? requestedAction : null;
      const tapped = commit && dragRef.current.direction === null;
      const latest = optionsRef.current;

      if (tapped) {
        reset();
        latest.onTap?.();
        finishing.current = false;
        return;
      }

      const direction = dragRef.current.direction;
      if (!direction) {
        reset();
        finishing.current = false;
        return;
      }

      const completesHorizontally = action === 'left' || action === 'right';
      const completesVertically = action === 'up' || action === 'down';
      const targetX = completesHorizontally
        ? (action === 'left' ? -1 : 1) * gestureOrigin.width
        : 0;
      const targetY = completesVertically
        ? (action === 'up' ? -1 : 1) * gestureOrigin.height
        : 0;
      dragRef.current = {
        x: targetX,
        y: targetY,
        direction,
        ready: Boolean(action),
        settling: true,
        swapping: false,
      };
      setDrag(dragRef.current);
      pendingAction.current = requestedAction;
      pendingCommit.current = Boolean(action);
      // Pointer moves continue as hover events after mouseup. Detach the
      // gesture immediately so they cannot turn a settling card back into a drag.
      origin.current = null;
      locked.current = null;
      crossed.current = false;
      settleTimer.current = window.setTimeout(completeSettle, SETTLE_FALLBACK);
    },
    [completeSettle, reset],
  );

  const onPointerDown = useCallback(
    (event: ReactPointerEvent<HTMLElement>) => {
      if (options.disabled || (event.pointerType === 'mouse' && event.button !== 0)) return;
      if ((event.target as HTMLElement).closest('button, a, input, select, textarea')) return;
      if (finishing.current) return;
      finishing.current = false;
      const bounds = event.currentTarget.getBoundingClientRect();
      origin.current = {
        x: event.clientX,
        y: event.clientY,
        width: bounds.width,
        height: bounds.height,
        pointerId: event.pointerId,
      };
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
    dragRef.current = { x: dx, y: dy, direction, ready, settling: false, swapping: false };
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

  const onTransitionEnd = useCallback((event: ReactTransitionEvent<HTMLElement>) => {
    if (
      event.propertyName === 'transform' &&
      (event.target as HTMLElement).classList.contains('current')
    ) {
      completeSettle();
    }
  }, [completeSettle]);

  useEffect(() => {
    if (options.disabled && origin.current) reset();
  }, [options.disabled, reset]);

  useEffect(() => () => {
    if (settleTimer.current !== null) window.clearTimeout(settleTimer.current);
    if (swapFrame.current !== null) window.cancelAnimationFrame(swapFrame.current);
  }, []);

  return {
    drag,
    bind: { onPointerDown, onPointerMove, onPointerUp, onPointerCancel, onLostPointerCapture, onTransitionEnd },
  };
}
