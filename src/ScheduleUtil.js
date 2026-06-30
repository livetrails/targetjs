import { TUtil } from "./TUtil.js";
import { getRunScheduler, getAnimationManager } from "./App.js";

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

                getRunScheduler().scheduleOnlyIfEarlier(remaining, `resume-${tmodel.oid}-${key}`);

                continue;
            }

            if (TUtil.isDefined(tmodel.getScheduleTimeStamp(key))) {
                const delay = ScheduleUtil.scheduleExecution(tmodel, key);

                tmodel.addTargetToStatusList(key);

                getRunScheduler().scheduleOnlyIfEarlier(
                    delay,
                    `resume-${tmodel.oid}-${key}`
                );
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
        tmodel.targetValues[key].pausedAt = TUtil.now();
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

}

export { ScheduleUtil };
