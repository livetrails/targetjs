export type TargetFunction<TResult = unknown> = (
  this: TModel,
  ...args: any[]
) => TResult;

export type EasingFunction = (
  progress: number
) => number;

export type EasingValue =
  | string
  | EasingFunction;

export interface TargetOptions<T = unknown> {
  value?:
    | T
    | readonly T[]
    | TargetFunction<T>;

  list?: readonly T[];

  steps?:
    | number
    | readonly number[];

  interval?:
    | number
    | readonly number[];

  cycles?:
    | number
    | TargetFunction<number>;

  loop?:
    | boolean
    | "passive";

  active?: boolean;

  enabledOn?:
    | boolean
    | string
    | TargetFunction<boolean>;

  pauseOn?:
    | boolean
    | string
    | TargetFunction<boolean>;

  easing?:
    | EasingValue
    | readonly EasingValue[];

  onComplete?: TargetFunction<void>;
  onValueChange?: TargetFunction<void>;
}

export type TargetInput<T = unknown> =
  | T
  | readonly T[]
  | TargetFunction<T>
  | TargetOptions<T>;

export type ExecutionName<TName extends string> =
  | TName
  | `${TName}$`
  | `${TName}$$`;

export type StyleTargetName =
  | "width"
  | "height"
  | "opacity"
  | "x"
  | "y"
  | "z"
  | "scale"
  | "rotate"
  | "backgroundColor"
  | "color";

export type StyleTargets = {
  [TName in ExecutionName<StyleTargetName>]?:
    TargetInput<number | string>;
};

export interface EventTargets {
  onClick?: (
    this: TModel,
    event: MouseEvent
  ) => void;

  onKey?: (
    this: TModel,
    event: KeyboardEvent
  ) => void;

  onKeyDown?: (
    this: TModel,
    event: KeyboardEvent
  ) => void;

  onInput?: (
    this: TModel,
    event: InputEvent
  ) => void;

  onSubmit?: (
    this: TModel,
    event: SubmitEvent
  ) => void;

  onResize?:
    | readonly string[]
    | TargetFunction<void>;

  onEnter?: TargetFunction<void>;
  onLeave?: TargetFunction<void>;
}

export type TargetEntry =
  | string
  | number
  | boolean
  | null
  | undefined
  | readonly unknown[]
  | TargetFunction
  | TargetOptions
  | TargetDefinition
  | readonly TargetDefinition[];

/*
 * Declare TargetDefinition only once.
 */
export type TargetDefinition =
  StyleTargets &
  EventTargets & {
    [targetName: string]: TargetEntry;
  } &
  ThisType<TModel>;

export interface SetTargetMap {
  [targetName: string]: TargetInput;
}

export class TModel<
  TTargets extends TargetDefinition = TargetDefinition
> {
  constructor(
    type: string,
    targets: TTargets,
    oid?: string,
    options?: unknown
  );

  oid: string;
  targets: TTargets;

  mount(element: string | Element): this;

  val<T = unknown>(targetName: string): T;
  val<T = unknown>(targetName: string, value: T): T;

  pval<T = unknown>(targetName: string): T;

  setTarget<T>(
    targetName: string,
    value: TargetInput<T>,
    steps?: number,
    interval?: number,
    easing?: EasingValue
  ): this;

  setTarget(
    targets: SetTargetMap,
    steps?: number,
    interval?: number,
    easing?: EasingValue
  ): this;

  activateTarget(
    targetName: string,
    ...args: any[]
  ): unknown;

  getChild(
    id: string | number
  ): TModel | undefined;

  getParent(): TModel | undefined;

  getWidth(): number;
  getHeight(): number;
  getX(): number;
  getY(): number;

  addChild(
    definition: TargetDefinition | TModel
  ): TModel;

  removeChildren(): void;
}

export function App<
  TTargets extends TargetDefinition
>(
  targets: TTargets & ThisType<TModel<TTargets>>
): TModel<TTargets>;

export function App(
  tmodel: TModel
): TModel;

export namespace App {
  function unmount(): Promise<void>;
}

export interface StateManager {
  store(key?: string): unknown;
  restore(key?: string): Promise<boolean>;
  toggle(key?: string): Promise<unknown>;
}

export function state(): StateManager;

export function tRoot(): TModel | undefined;
export function isRunning(): boolean;

export function getScreenWidth(): number;
export function getScreenHeight(): number;

export function getTModelById(
  id: string
): TModel | undefined;

export function getDomTModelById(
  id: string
): TModel | undefined;

/*
 * These exports exist at runtime. They can be typed more precisely later.
 */
export const tApp: any;

export const Moves: any;
export const SearchUtil: any;
export const TargetData: any;
export const TargetUtil: any;
export const TargetParser: any;
export const TModelUtil: any;
export const TUtil: any;
export const DomInit: any;
export const $Dom: any;
export const Bracket: any;
export const BracketGenerator: any;
export const ColorUtil: any;
export const Easing: any;
export const TargetExecutor: any;
export const AnimationManager: any;
export const AnimationUtil: any;
export const VisibilityUtil: any;
export const ScheduleUtil: any;
export const StateUtil: any;

export function getEvents(): any;
export function getPager(): any;
export function getLoader(): any;
export function getManager(): any;
export function getTargetManager(): any;
export function getAnimationManager(): any;
export function getRunScheduler(): any;
export function getLocationManager(): any;
export function getVisibles(): any;
export function getResizeLastUpdate(): number | undefined;

export function fetch(
  tmodel: TModel,
  url: string,
  query?: unknown,
  cacheId?: string
): unknown;

export function fetchImage(
  tmodel: TModel,
  src: string,
  cacheId?: string
): unknown;

declare const TargetJS: {
  [exportName: string]: any;

  App: typeof App;
  TModel: typeof TModel;
  state: typeof state;

  Moves: typeof Moves;
  Easing: typeof Easing;
  TUtil: typeof TUtil;
  TModelUtil: typeof TModelUtil;
  StateUtil: typeof StateUtil;
};

export default TargetJS;