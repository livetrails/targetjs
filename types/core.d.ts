import type {
  TModel
} from "./tmodel.js";

import type {
  StyleTargetName
} from "./styles.js";

import type {
  AttributeTargetName,
  AttributeTargetValue
} from "./attributes.js";

import type {
  StandardEventTargetName
} from "./events.js";

export type TargetFunction<TResult = unknown> = (
  this: TModel,
  ...args: any[]
) => TResult;

export type EventTargets = {
  [TName in StandardEventTargetName]?:
    | boolean
    | TargetFunction<unknown>;
} & {
  onResize?:
    | boolean
    | readonly string[]
    | TargetFunction<unknown>;
};

export type EasingFunction = (
  progress: number
) => number;

export type EasingValue =
  | string
  | EasingFunction;

export type TargetOptions<T = unknown> = {
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
    | readonly number[]
    | TargetFunction<number | readonly number[]>;

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
} & ThisType<TModel>;

export type TargetInput<T = unknown> =
  | T
  | readonly T[]
  | TargetFunction<T>
  | TargetOptions<T>;

export type ExecutionName<
  TName extends string
> =
  | TName
  | `${TName}$`
  | `${TName}$$`;

export type StyleTargetValue =
  | string
  | number
  | boolean
  | Record<string, unknown>;

export type StyleTargets = {
  [TName in ExecutionName<StyleTargetName>]?:
    TargetInput<StyleTargetValue>;
};

export type AttributeTargets = {
  [TName in ExecutionName<AttributeTargetName>]?:
    TargetInput<AttributeTargetValue>;
};

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

export type ChildrenTargetOptions =
  Omit<
    TargetOptions<readonly TargetDefinition[]>,
    "value"
  > & {
    value?:
      | readonly TargetDefinition[]
      | TargetFunction<readonly TargetDefinition[]>;

    onVisibleComplete?: TargetFunction<void>;
  } &
  ThisType<TModel>;

export type TargetDefinition =
  StyleTargets &
  AttributeTargets &
  EventTargets & {
    addChildren?: ChildrenTargetOptions;
    children?: ChildrenTargetOptions;

    [targetName: string]: TargetEntry;
  } &
  ThisType<TModel>;

export interface SetTargetMap {
  [targetName: string]: TargetInput;
}