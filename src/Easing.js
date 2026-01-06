/**
 * It provides easing functions that can be ued smooth the transition of actual values toward target values.
 */
class Easing {
    static LINEAR = "linear";
    static EASE = "ease";
    static EASE_IN = "ease-in";
    static EASE_OUT = "ease-out";
    static EASE_IN_OUT = "ease-in-out";
    static STEP_START = "step-start";
    static STEP_END = "step-end";
    
    static #linear(t) {
        return t;
    }

    static #stepStart(t) {
        return t <= 0 ? 0 : 1;
    }
    static #stepEnd(t) {
        return t < 1 ? 0 : 1;
    }    
    
    static #ease = Easing.cubicBezier(0.25, 0.1, 0.25, 1.0);
    static #easeIn = Easing.cubicBezier(0.42, 0.0, 1.0, 1.0);
    static #easeOut = Easing.cubicBezier(0.0, 0.0, 0.58, 1.0);
    static #easeInOut = Easing.cubicBezier(0.42, 0.0, 0.58, 1.0);

    static easeMap = new Map([
        [Easing.LINEAR, Easing.#linear],
        [Easing.EASE, Easing.#ease],
        [Easing.EASE_IN, Easing.#easeIn],
        [Easing.EASE_OUT, Easing.#easeOut],
        [Easing.EASE_IN_OUT, Easing.#easeInOut],
        [Easing.STEP_START, Easing.#stepStart],
        [Easing.STEP_END, Easing.#stepEnd],
    ]);    

    static easingFunction(easingStr) {
        if (!easingStr) {
            return Easing.#linear;
        }
        
        return Easing.easeMap.get(easingStr) || Easing.#linear;
    }

    static cubicBezier(x1, y1, x2, y2) {
        const clamp01 = (t) => (t <= 0 ? 0 : t >= 1 ? 1 : t);

        const bezierCoord = (t, a1, a2) => {
            const c = 3 * a1;
            const b = 3 * (a2 - a1) - c;
            const a = 1 - c - b;
            return ((a * t + b) * t + c) * t;
        };

        const bezierCoordDerivative = (t, a1, a2) => {
            const c = 3 * a1;
            const b = 3 * (a2 - a1) - c;
            const a = 1 - c - b;
            return (3 * a * t + 2 * b) * t + c;
        };

        const solveTForX = (x) => {
            let t = x;

            // Newton-Raphson
            for (let i = 0; i < 8; i++) {
                const xEst = bezierCoord(t, x1, x2) - x;
                if (Math.abs(xEst) < 1e-6) {
                    return t;
                }

                const dEst = bezierCoordDerivative(t, x1, x2);
                if (Math.abs(dEst) < 1e-6) {
                    break;
                }

                t -= xEst / dEst;
                if (t < 0) {
                    t = 0;
                } else if (t > 1) {
                    t = 1;
                }
            }

            // Bisection fallback
            let lo = 0, hi = 1, mid = 0;
            for (let i = 0; i < 20; i++) {
                mid = (lo + hi) / 2;
                const xEst = bezierCoord(mid, x1, x2);
                if (Math.abs(xEst - x) < 1e-6) {
                    return mid;
                }
                if (xEst < x) {
                    lo = mid;
                } else {
                    hi = mid;
                }
            }
            return mid;
        };

        return (t) => {
            t = clamp01(t);
            const tt = solveTForX(t);
            return bezierCoord(tt, y1, y2);
        };
    }
}

export { Easing };
