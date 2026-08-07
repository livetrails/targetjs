import type {
  EasingValue,
  SetTargetMap,
  TargetDefinition,
  TargetInput
} from "./core.js";

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

  parent?: TModel;

  visibleChildren: TModel[];

  $dom?: {
    getScrollTop(): number;
    getScrollLeft?(): number;
  };

  mount(element: string | Element): this;

  val<T = unknown>(
    targetName: string
  ): T;

  val<T = unknown>(
    targetName: string,
    value: T
  ): T;

  pval<T = unknown>(
    targetName: string
  ): T;

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

  getLastChild(): TModel | undefined;

  getWidth(): number;
  getHeight(): number;
  getX(): number;
  getY(): number;

  isVisible(): boolean;

  isTargetVisibleTreeComplete(
    targetName?: string
  ): boolean;

  addChild(
    definition: TargetDefinition | TModel
  ): TModel;

  removeChildren(): void;
}