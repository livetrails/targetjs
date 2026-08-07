export * from "./styles.js";
export * from "./events.js";
export * from "./attributes.js";
export * from "./core.js";
export * from "./tmodel.js";
export * from "./app.js";
export * from "./state.js";
export * from "./utilities.js";

import {
  App
} from "./app.js";

import {
  state
} from "./state.js";

import {
  TModel
} from "./tmodel.js";

import {
  Easing,
  Moves,
  StateUtil,
  TModelUtil,
  TUtil
} from "./utilities.js";

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