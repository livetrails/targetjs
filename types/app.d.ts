import type { TargetDefinition } from "./core.js";

import type { TModel } from "./tmodel.js";

export function App(targets: TargetDefinition): TModel;

export function App(tmodel: TModel): TModel;

export namespace App { function unmount(): Promise<void>; }

export const tApp: any;

export function tRoot(): TModel | undefined;

export function isRunning(): boolean;

export function getEvents(): any;

export function getPager(): any;

export function getLoader(): any;

export function getManager(): any;

export function getTargetManager(): any;

export function getAnimationManager(): any;

export function getRunScheduler(): any;

export function getLocationManager(): any;

export function getScreenWidth(): number;

export function getScreenHeight(): number;

export function getVisibles(): any;

export function getResizeLastUpdate(): number | undefined;

export function getTModelById(id: string): TModel | undefined;

export function getDomTModelById(id: string): TModel | undefined;

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