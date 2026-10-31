import { TUtil } from "./TUtil.js";
import { getRunScheduler, getAnimationManager } from "./App.js";
import { TargetUtil } from "./TargetUtil.js";

/**
 * 
 * It provides a variety of helping functions for scheduling target execution
 */
class ScheduleUtil {
    
    static scheduleExecution(tmodel, key) {
        const interval = tmodel.getTargetInterval(key);
        const now = TUtil.now();

        if (interval <= 0) {
            return 0;
        }

        if (tmodel.isTargetImperative(key) && tmodel.getTargetStep(key) === 0) {
            tmodel.setScheduleTimeStamp(key, now);
            return 0;
        }

        const remaining = tmodel.getScheduleRemainingTime(key);

        if (TUtil.isDefined(remaining)) {
            tmodel.setScheduleTimeStamp(key, now - Math.max(interval - remaining, 0));
            tmodel.resetScheduleRemainingTime(key);
            return remaining;
        }

        const lastScheduledTime = tmodel.getScheduleTimeStamp(key);

        if (TUtil.isDefined(lastScheduledTime)) {
            const elapsed = now - lastScheduledTime;
            return Math.max(interval - elapsed, 0);
        }

        tmodel.setScheduleTimeStamp(key, now);

        return interval;
    }
    
    static getSchedulingKeys(tmodel) {
        const keys = [];

        for (const [key, targetValue] of Object.entries(tmodel.targetValues)) {
            if (
                TUtil.isDefined(targetValue.scheduleTimeStamp) ||
                TUtil.isDefined(targetValue.scheduleRemainingTime)
            ) {
                keys.push(key);
            }
        }

        return keys;
    }
    
    static pauseResumeSchedule(tmodel) {
        if (tmodel.type === 'BI') {
            return;
        }

        const schedulingKeys = ScheduleUtil.getSchedulingKeys(tmodel);
        
        if (!schedulingKeys.length && !tmodel.animatingMap) {
            return;
        }

        const animatingKeys = new Set(tmodel.animatingMap?.keys() ?? []);
        const keys = new Set([...schedulingKeys, ...animatingKeys]);

        if (!keys.size) {
            return;
        }

        const animationsToPause = new Set();

        for (const key of keys) {
            const shouldPause = ScheduleUtil.shouldPauseTarget(tmodel, key);

            if (shouldPause) {
                if (TUtil.isDefined(tmodel.getScheduleTimeStamp(key))) {
                    ScheduleUtil.pauseSchedule(tmodel, key);
                }

                if (tmodel.animatingMap?.has(key)) {
                    animationsToPause.add(key);
                }

                continue;
            }

            const remaining = tmodel.getScheduleRemainingTime(key);

            if (TUtil.isDefined(remaining)) {
                ScheduleUtil.resumeSchedule(tmodel, key);

                tmodel.addTargetToStatusList(key);

                getRunScheduler().scheduleOnlyIfEarlier(remaining, `resume1-${tmodel.oid}-${key}`);

                continue;
            }

            if (TUtil.isDefined(tmodel.getScheduleTimeStamp(key))) {
                const delay = ScheduleUtil.scheduleExecution(tmodel, key);

                tmodel.addTargetToStatusList(key);

                getRunScheduler().scheduleOnlyIfEarlier(delay, `resume2-${tmodel.oid}-${key}`);
            }
        }

        if (animationsToPause.size) {
            getAnimationManager().pauseAnimations(tmodel, animationsToPause);
        }
    }

    static pauseSchedule(tmodel, key) {
        const interval = tmodel.getTargetInterval(key);
        const lastScheduledTime = tmodel.getScheduleTimeStamp(key);

        if (interval <= 0 || !TUtil.isDefined(lastScheduledTime)) {
            return;
        }

        const now = TUtil.now();
        const elapsed = now - lastScheduledTime;
        const remaining = Math.max(interval - elapsed, 0);

        tmodel.setScheduleRemainingTime(key, remaining);
        tmodel.resetScheduleTimeStamp(key);
    }

    static resumeSchedule(tmodel, key) {
        const remaining = tmodel.getScheduleRemainingTime(key);

        if (!TUtil.isDefined(remaining)) {
            return;
        }

        const now = TUtil.now();

        const interval = tmodel.getTargetInterval(key);
        tmodel.setScheduleTimeStamp(key, now - Math.max(interval - remaining, 0));

        tmodel.resetScheduleRemainingTime(key);
    }   

    
    static shouldPauseTarget(tmodel, key) {
        if (!tmodel.isExecuted(key)) {
            return false;
        }
        
        const t = tmodel.isTargetImperative(key) ? tmodel.targetValues[key] : tmodel.targets[key];

        const pauseOn = t?.pauseOn;

        if (pauseOn === undefined || pauseOn === false) {
            return false;
        }

        if (pauseOn === true) {
            return true;
        }

        if (typeof pauseOn === 'function') {
            return !!pauseOn.call(tmodel, key);
        }

        if (pauseOn === 'hidden') {
            return !tmodel.isVisible();
        }

        if (pauseOn === 'noDom') {
            return !tmodel.hasDom();
        }

        return false;
    }
    
    static advanceTargetByElapsed(tmodel, key) {
        const targetValue = tmodel.targetValues[key];

        if (!targetValue) {
            return {
                step: 0,
                cycle: 0,
                valuePointer: 1,
                done: false
            };
        }

        if (!TUtil.isDefined(targetValue.catchupAt)) {
            const step = tmodel.getTargetStep(key);
            const valuePointer = targetValue.valueList?.length ? tmodel.getValueListPointer(key) : 0;

            return {
                step,
                cycle: tmodel.getTargetCycle(key),
                valuePointer,
                done: !TargetUtil.isTargetUpdating(tmodel, key)
            };
        }

        const now = TUtil.now();
        const elapsedMs = now - targetValue.catchupAt;

        const progress = targetValue.valueList?.length
            ? ScheduleUtil.advanceValueListTargetByElapsed(tmodel, key, elapsedMs)
            : ScheduleUtil.advanceSimpleTargetByElapsed(tmodel, key, elapsedMs);

        if (!progress.done) {
            targetValue.catchupAt = now - progress.remainingMs;
        }

        return progress;
    }

    static advanceSimpleTargetByElapsed(tmodel, key, elapsedMs) {
        const steps = tmodel.getTargetSteps(key);
        const interval = tmodel.getTargetInterval(key) || 8;
        const cycles = tmodel.getTargetCycles(key);

        let step = tmodel.getTargetStep(key);
        let cycle = tmodel.getTargetCycle(key);
        let remainingMs = elapsedMs;

        if (steps <= 0) {
            return {
                step: steps,
                valuePointer: 0,
                cycle: cycles,
                done: true,
                remainingMs: 0
            };
        }

        while (remainingMs > 0 && cycle < cycles) {
            const remainingSteps = Math.max(steps - step, 0);
            const remainingSegmentMs = remainingSteps * interval;

            if (remainingMs >= remainingSegmentMs) {
                remainingMs -= remainingSegmentMs;
                cycle++;

                if (cycle >= cycles) {
                    return {
                        step: steps,
                        valuePointer: 0,
                        cycle: cycles,
                        done: true,
                        remainingMs
                    };
                }

                step = 0;
                continue;
            }

            const advancedSteps = TUtil.limit(
                Math.floor(remainingMs / interval),
                0,
                remainingSteps
            );

            step += advancedSteps;
            remainingMs -= advancedSteps * interval;

            return {
                step,
                steps,
                valuePointer: 0,
                cycle,
                done: false,
                remainingMs
            };
        }

        return {
            step,
            steps,
            valuePointer: 0,
            cycle,
            done: cycle >= cycles,
            remainingMs
        };
    }
    
    static advanceValueListTargetByElapsed(tmodel, key, elapsedMs) {
        const targetValue = tmodel.targetValues[key];

        const valueList = targetValue.valueList;
        const stepList = targetValue.stepList || [1];
        const intervalList = targetValue.intervalList || [targetValue.interval || 8];

        const cycles = tmodel.getTargetCycles(key);

        let cycle = tmodel.getTargetCycle(key);
        let valuePointer = tmodel.getValueListPointer(key);
        let step = tmodel.getTargetStep(key);
        let remainingMs = elapsedMs;

        while (cycle < cycles) {
            while (remainingMs > 0 && valuePointer < valueList.length) {
                const segmentSteps = stepList[(valuePointer - 1) % stepList.length];
                const interval = intervalList[(valuePointer - 1) % intervalList.length] || 8;

                step = TUtil.limit(step, 0, segmentSteps);

                const remainingSteps = Math.max(segmentSteps - step, 0);
                const remainingSegmentMs = remainingSteps * interval;

                if (remainingMs >= remainingSegmentMs) {
                    remainingMs -= remainingSegmentMs;
                    valuePointer++;
                    step = 0;
                    continue;
                }

                const advancedSteps = TUtil.limit(
                    Math.floor(remainingMs / interval),
                    0,
                    remainingSteps
                );

                step += advancedSteps;
                remainingMs -= advancedSteps * interval;

                return {
                    step,
                    steps: segmentSteps,
                    valuePointer,
                    cycle,
                    done: false,
                    remainingMs
                };
            }

            if (valuePointer >= valueList.length) {
                cycle++;

                if (cycle >= cycles) {
                    const finalPointer = valueList.length;
                    const finalStepIndex = Math.max(0, valueList.length - 2);
                    const finalSteps = stepList[finalStepIndex % stepList.length];

                    return {
                        step: finalSteps,
                        steps: finalSteps,
                        valuePointer: finalPointer,
                        cycle: cycles,
                        done: true,
                        remainingMs
                    };
                }

                valuePointer = 1;
                step = 0;

                if (remainingMs <= 0) {
                    break;
                }

                continue;
            }

            break;
        }

        const currentSteps = stepList[(valuePointer - 1) % stepList.length];

        return {
            step,
            steps: currentSteps,
            valuePointer,
            cycle,
            remainingMs,
            done: cycle >= cycles
        };
    }   


}

export { ScheduleUtil };
