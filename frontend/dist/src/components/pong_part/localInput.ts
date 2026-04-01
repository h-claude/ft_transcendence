export type ControlsState = {
  leftUp: boolean;
  leftDown: boolean;
  rightUp: boolean;
  rightDown: boolean;
};

const INITIAL_STATE: ControlsState = {
  leftUp: false,
  leftDown: false,
  rightUp: false,
  rightDown: false,
};

let controls: ControlsState = { ...INITIAL_STATE };
let downListener: ((e: KeyboardEvent) => void) | null = null;
let upListener: ((e: KeyboardEvent) => void) | null = null;

const keyMap: Record<string, keyof ControlsState> = {
  w: "leftUp",
  W: "leftUp",
  s: "leftDown",
  S: "leftDown",
  ArrowUp: "rightUp",
  ArrowDown: "rightDown",
};

/**
 * Installe les listeners clavier pour la partie locale et renvoie
 * un getter sur l'état courant des touches.
 */
export function initLocalInputs(): () => ControlsState {
  if (!downListener) {
    downListener = (event: KeyboardEvent) => {
      const key = keyMap[event.key];
      if (!key) return;
      controls[key] = true;
    };
    document.addEventListener("keydown", downListener);
  }

  if (!upListener) {
    upListener = (event: KeyboardEvent) => {
      const key = keyMap[event.key];
      if (!key) return;
      controls[key] = false;
    };
    document.addEventListener("keyup", upListener);
  }

  return () => controls;
}

/**
 * Retire les listeners et remet à zéro l'état des touches.
 */
export function destroyLocalInputs(): void {
  if (downListener) {
    document.removeEventListener("keydown", downListener);
    downListener = null;
  }
  if (upListener) {
    document.removeEventListener("keyup", upListener);
    upListener = null;
  }
  controls = { ...INITIAL_STATE };
}
