// GlobalExport.js

import * as TargetJS from './Export.js';

if (typeof window !== 'undefined') {
  window.TargetJS = TargetJS;
}

export default TargetJS;
