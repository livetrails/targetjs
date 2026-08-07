export interface StateCheckpoint {
  key: string;
  capturedAt: number;

  html: string;
  domState: unknown;

  oids: Record<string, unknown>;
  rootSnapshot: unknown;
  loaderSnapshot: unknown;

  visibleOids: string[];

  scrollLeft: number;
  scrollTop: number;

  runSnapshot: unknown;
}

export interface StateManager {
  store(
    key?: string
  ): Promise<StateCheckpoint>;

  restore(
    key?: string
  ): Promise<boolean>;

  toggle(
    key?: string
  ): Promise<StateCheckpoint | boolean>;

  has(
    key?: string
  ): boolean;

  get(
    key?: string
  ): StateCheckpoint | undefined;

  clear(
    key?: string
  ): boolean;

  clearAll(): void;
}

export function state(): StateManager;