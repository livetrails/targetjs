import { $Dom } from "./$Dom.js";
import { TUtil } from "./TUtil.js";
import { getRunScheduler } from "./App.js";
import { TargetUtil } from "./TargetUtil.js";
import { StateUtil } from "./StateUtil.js";

/**
 * It provides a central place for managing fetching of external APIs and images. 
 */
class LoadingManager {
    constructor() {
        this.cacheMap = {};
        this.tmodelKeyMap = {};
        this.fetchingAPIMap = {};
        this.fetchingImageMap = {};
        this.targetPageKeyMap = new WeakMap();
        this.fetchSeq = 0;
        this.runtimeEpoch = 0;
    }

    clear() {
        this.runtimeEpoch++;
        this.fetchingAPIMap = {};
        this.fetchingImageMap = {};
    }
    
    clearAll() {
        this.runtimeEpoch++;
        this.cacheMap = {};
        this.tmodelKeyMap = {};
        this.fetchingAPIMap = {};
        this.fetchingImageMap = {};
        this.targetPageKeyMap = new WeakMap();
        this.fetchSeq = 0;
    }
    
    setTargetPageKey(tmodel, targetName, pageKey) {
        let map = this.targetPageKeyMap.get(tmodel);

        if (!map) {
            map = new Map();
            this.targetPageKeyMap.set(tmodel, map);
        }

        map.set(targetName, pageKey);
    }

    getTargetPageKey(tmodel, targetName) {
        return this.targetPageKeyMap.get(tmodel)?.get(targetName) ?? document.URL;
    }
    
    fetchCommon(fetchId, cacheId, tmodel, fetchMap, request, fetchFn) {
        TargetUtil.markFetchAction(tmodel);

        const pageKey = document.URL;
        const targetName = tmodel.key;

        this.setTargetPageKey(tmodel, targetName, pageKey);

        if (!this.isFetched(cacheId)) {
            if (!fetchMap[fetchId]) {
                fetchMap[fetchId] = {
                    fetchId,
                    cacheId,
                    request,
                    startTime: TUtil.now(),
                    epoch: this.runtimeEpoch,
                    targets: [{ tmodel, targetName }],
                    fetchMap
                };

                fetchFn(fetchMap[fetchId]);
            }
        } else if (!fetchMap[fetchId]) {
            fetchMap[fetchId] = {
                fetchId,
                cacheId,
                request,
                startTime: TUtil.now(),
                epoch: this.runtimeEpoch,
                targets: [{ tmodel, targetName }],
                fetchMap
            };
        }

        this.addToTModelKeyMap(tmodel, targetName, fetchId, cacheId, fetchMap);

        return fetchId;
    }

    fetch(tmodel, urlOrConfig, query, cacheId) {
        if (urlOrConfig && typeof urlOrConfig === 'object' && !Array.isArray(urlOrConfig)) {
            const {url, cacheId: cfgCacheId, ...cfgQuery} = urlOrConfig;
            this.fetchOne(tmodel, url, cfgQuery, cfgCacheId ?? cacheId);
            return;
        }

        const urls = Array.isArray(urlOrConfig) ? urlOrConfig : [urlOrConfig];
        urls.forEach(singleUrl => {
            this.fetchOne(tmodel, singleUrl, query, cacheId);
        });
    }

    fetchOne(tmodel, url, query, cacheId) {
        const fetchId = this.getFetchKey(tmodel, url, query);

        const request = {
            type: "api",
            url,
            query: StateUtil.encodeValue(query)
        };

        this.fetchCommon(
            fetchId,
            cacheId,
            tmodel,
            this.fetchingAPIMap,
            request,
            fetchStatus => this.ajaxAPI(url, query, fetchStatus)
        );
    }
    
    fetchImage(tmodel, url, cacheId) {
        const urls = Array.isArray(url) ? url : [url];

        urls.forEach(src => {
            const fetchId = this.getFetchKey(tmodel, src);

            const request = {
                type: "image",
                src
            };

            this.fetchCommon(
                fetchId,
                cacheId,
                tmodel,
                this.fetchingImageMap,
                request,
                fetchStatus => this.loadImage(src, fetchStatus)
            );
        });
    }
    
    getFetchKey(tmodel, url, query) {
        const base = query
            ? `${tmodel.oid}_${url}_${tmodel.getTargetCycle(tmodel.key)}_${JSON.stringify(query)}`
            : `${tmodel.oid}_${url}_${tmodel.getTargetCycle(tmodel.key)}`;

        return `${base}_${++this.fetchSeq}`;
    }
    
    getTModelKey(tmodel, targetName) {
        const pageKey = this.getTargetPageKey(tmodel, targetName);
        return `${pageKey}_${tmodel.oid}_${targetName}`;
    }
    
    createTModelEntry(tmodel, targetName) {
        return {
            pageKey: this.getTargetPageKey(tmodel, targetName),
            oid: tmodel.oid,
            targetName,
            fetchMap: {},
            entryCount: 0,
            resultCount: 0,
            errorCount: 0,
            activeIndex: 0,
            accessIndex: 0
        };
    }

    addToTModelKeyMap(tmodel, targetName, fetchId, cacheId, fetchMap) {
        const key = this.getTModelKey(tmodel, targetName);
        const loadTargetName = TUtil.getLoadTargetName(targetName);
        const loadingComplete = this.isLoadingComplete(tmodel, targetName);

        let modelEntry = this.tmodelKeyMap[key];

        if (loadingComplete || !modelEntry || !Array.isArray(tmodel.val(loadTargetName))) {
            modelEntry = this.createTModelEntry(tmodel, targetName);
            this.tmodelKeyMap[key] = modelEntry;
            tmodel.val(loadTargetName, []);
        }

        modelEntry.fetchMap[fetchId] = {
            fetchId,
            order: modelEntry.entryCount
        };

        modelEntry.entryCount++;
        tmodel.val(loadTargetName).push(undefined);

        if (cacheId && this.isFetched(cacheId)) {
            fetchMap[fetchId].startTime = TUtil.now();
            this.handleSuccess(fetchMap[fetchId], this.cacheMap[cacheId].result);
        }
    }  
    
    getPendingRequestSnapshots(fetchMap) {
        return Object.values(fetchMap).map(fetchStatus => ({
            cacheId: fetchStatus.cacheId,
            request: StateUtil.encodeValue(fetchStatus.request),

            targets: fetchStatus.targets.map(({ tmodel, targetName }) => {
                const key = this.getTModelKey(tmodel, targetName);
                const entry = this.tmodelKeyMap[key];
                const fetchEntry = entry?.fetchMap?.[fetchStatus.fetchId];

                return {
                    oid: tmodel.oid,
                    targetName,
                    order: fetchEntry?.order
                };
            }).filter(target => Number.isFinite(target.order))
        }));
    }

    removeFromTModelKeyMap(tmodel, targetName) {
        const key = this.getTModelKey(tmodel, targetName);
        delete this.tmodelKeyMap[key];
    }

    isLoading(tmodel, targetName) {
        const key = this.getTModelKey(tmodel, targetName);
        return this.tmodelKeyMap[key];
    }

    isLoadingSuccessful(tmodel, targetName) {
        const key = this.getTModelKey(tmodel, targetName);
        return this.tmodelKeyMap[key] && this.tmodelKeyMap[key].resultCount === this.tmodelKeyMap[key].entryCount;
    }

    isLoadingComplete(tmodel, targetName) {
        const key = this.getTModelKey(tmodel, targetName);
        return this.tmodelKeyMap[key] ? this.tmodelKeyMap[key].resultCount === this.tmodelKeyMap[key].entryCount 
                    && this.tmodelKeyMap[key].activeIndex === this.tmodelKeyMap[key].entryCount 
                    && this.tmodelKeyMap[key].resultCount === tmodel.getTargetCycles(targetName) : false;
    }

    resetLoadingError(tmodel, targetName) {
        const key = this.getTModelKey(tmodel, targetName);
        const modelEntry = this.tmodelKeyMap[key];
        if (modelEntry) {
            modelEntry.errorCount = 0;
        }
    }

    nextActiveItem(tmodel, targetName) {
        const key = this.getTModelKey(tmodel, targetName);
        const modelEntry = this.tmodelKeyMap[key];
        if (!modelEntry) {
            return false;
        }
        return modelEntry.activeIndex++;
    }

    isNextLoadingItemSuccessful(tmodel, targetName) {
        const key = this.getTModelKey(tmodel, targetName);
        const modelEntry = this.tmodelKeyMap[key];
        if (!modelEntry) {
            return false;
        }
        const loadTargetName = TUtil.getLoadTargetName(targetName);
        const targetValue = tmodel.val(loadTargetName);

        return Array.isArray(targetValue) && TUtil.isDefined(targetValue[modelEntry.activeIndex]) && TUtil.isDefined(targetValue[modelEntry.accessIndex]);
    }

    getLoadingItemValue(tmodel, prevTargetName, currentTargetName) {
        const key = this.getTModelKey(tmodel, prevTargetName);
        const tmodelEntry = this.tmodelKeyMap[key];
        
        if (!tmodelEntry || tmodelEntry.accessIndex >= tmodelEntry.resultCount) {
            return undefined;
        }

        const loadTargetName = TUtil.getLoadTargetName(prevTargetName);
        const targetValue = tmodel.val(loadTargetName);      
        let result;     

        if (targetValue) {
            if (currentTargetName?.endsWith('$$')) {
                result = targetValue.slice(tmodelEntry.accessIndex, tmodelEntry.resultCount);
                tmodelEntry.accessIndex += result.length;
            } else if (TUtil.isDefined(targetValue[tmodelEntry.accessIndex])) {
                result = targetValue[tmodelEntry.accessIndex];
                tmodelEntry.accessIndex = Math.min(tmodelEntry.accessIndex + 1, tmodelEntry.entryCount);
            }
        }
        
        return result;
    }

    isFetched(cacheId) {
        return this.cacheMap[cacheId]?.success ?? false;
    }

    getFetchingPeriod(fetchId) {
        return this.fetchingAPIMap[fetchId] ? TUtil.now() - this.fetchingAPIMap[fetchId].startTime : undefined;
    }

    fetchCache(cacheId) {
        return this.cacheMap[cacheId];
    }
    
    calculateTargetStatus(tmodel, key) {

        const cycle = tmodel.getTargetCycle(key);
        const cycles = tmodel.getTargetCycles(key);
              
        if (tmodel.isTargetInLoop(key) || cycle < cycles - 1) {
            return 'active'; 
        } else if (!this.isLoadingSuccessful(tmodel, key)) {
            return 'fetching';
        } else {
            return 'done';
        }
    }    

    handleSuccess(fetchStatus, result) {
        if (fetchStatus.epoch !== this.runtimeEpoch) {
            return;
        }
        
        const fetchTime = TUtil.now();
        const { fetchId, cacheId, startTime, targets, fetchMap } = fetchStatus;
        const res = {
            fetchingPeriod: fetchTime - startTime,
            success: true,
            result
        };

        targets.forEach(({ tmodel, targetName }) => {
            const key = this.getTModelKey(tmodel, targetName);
            const tmodelEntry = this.tmodelKeyMap[key];
            const loadTargetName = TUtil.getLoadTargetName(targetName);

            if (!tmodelEntry || !tmodelEntry.fetchMap[fetchId]) {
                return;
            }

            const fetchEntry = tmodelEntry.fetchMap[fetchId];

            this.callOnSuccessHandler(tmodel, targetName, { ...res, order: fetchEntry.order} );

            let targetResults = tmodel.val(loadTargetName);

            if (targetResults) {
                if (!TUtil.isDefined(targetResults[fetchEntry.order])) {
                    tmodelEntry.resultCount++;
                }
                targetResults[fetchEntry.order] = res.result;
            }

            tmodel.val(targetName, res.result);

            const newStatus = this.calculateTargetStatus(tmodel, targetName);
            tmodel.setTargetStatus(targetName, newStatus);  
            tmodel.setLastUpdate(targetName);
            TargetUtil.shouldActivateNextTarget(tmodel, targetName);
        });

        delete fetchMap[fetchId];

        if (cacheId) {
            this.cacheMap[cacheId] = res;
        }
        getRunScheduler().schedule(0, `api_success_${fetchId}`);
    }

    handleError(fetchStatus, error) {
        if (fetchStatus.epoch !== this.runtimeEpoch) {
            return;
        }
        
        const fetchTime = TUtil.now();
        const { fetchId, cacheId, startTime, targets, fetchMap } = fetchStatus;

        targets.forEach(({ tmodel, targetName }) => {
            const key = this.getTModelKey(tmodel, targetName);
            const tmodelEntry = this.tmodelKeyMap[key];
            const loadTargetName = TUtil.getLoadTargetName(targetName);

            if (!tmodelEntry || !tmodelEntry.fetchMap[fetchId]) {
                return;
            }

            const fetchEntry = tmodelEntry.fetchMap[fetchId];

            const res = {
                fetchingPeriod: fetchTime - startTime,
                success: false,
                order: fetchEntry.order,
                error
            };

            let targetResults = tmodel.val(loadTargetName);

            if (targetResults) {
                if (!TUtil.isDefined(targetResults[fetchEntry.order])) {
                    tmodelEntry.resultCount++;
                }
                targetResults[fetchEntry.order] = res;
            }

            tmodel.val(targetName, res);

            tmodelEntry.errorCount++;

            this.callOnErrorHandler(tmodel, targetName);

            const newStatus = this.calculateTargetStatus(tmodel, targetName);
            tmodel.setTargetStatus(targetName, newStatus);  
            tmodel.setLastUpdate(targetName);
            TargetUtil.shouldActivateNextTarget(tmodel, targetName);
        });

        delete fetchMap[fetchId];

        if (cacheId) {
            delete this.cacheMap[cacheId];
        }

        getRunScheduler().schedule(0, `api_error_${fetchId}`);
    }

    callOnSuccessHandler(tmodel, targetName, res) {
        const onSuccess = tmodel.targets[targetName]?.onSuccess;
        if (onSuccess) {
            if (typeof onSuccess === 'function') {
                tmodel.setTargetMethodName(targetName, 'onSuccess');
                onSuccess.call(tmodel, res);
            } else if (Array.isArray(onSuccess)) {
                onSuccess.forEach(t => TargetUtil.activateSingleTarget(tmodel, t));
            } else {
                TargetUtil.activateSingleTarget(tmodel, onSuccess);
            }
        }
    }

    callOnErrorHandler(tmodel, targetName) {
        const onError = tmodel.targets[targetName]?.onError;
        if (onError) {
            if (typeof onError === 'function') {
                tmodel.setTargetMethodName(targetName, 'onError');
                onError.call(tmodel, tmodel.val(targetName));
            } else if (Array.isArray(onError)) {
                onError.forEach(t => TargetUtil.activateSingleTarget(tmodel, t));
            } else {
                TargetUtil.activateSingleTarget(tmodel, onError);
            }
        }
    }

    ajaxAPI(url, query, fetchStatus) {
        const defaults = {
            url: url,
            dataType: "json",
            type: "GET",
            success: dataList => this.handleSuccess(fetchStatus, dataList),
            error: textStatus => this.handleError(fetchStatus, textStatus)
        };

        const isPlainObj = q => q && typeof q === "object" && !Array.isArray(q);
        if (!isPlainObj(query)) {
            $Dom.ajax({...defaults, data: query});
            return;
        }

        const OPTION_KEYS = new Set([
            "data", "type", "method", "requestType", "dataType", "headers", "contentType",
            "timeout", "processData", "cache", "beforeSend", "withCredentials", "xhrFields"
        ]);

        // Split into options vs payload
        const opts = {};
        const dataBag = {};
        for (const [k, v] of Object.entries(query)) {
            if (k === "requestType") {
                opts.type = v; // alias
            } else if (OPTION_KEYS.has(k)) {
                opts[k] = v;
            } else {
                dataBag[k] = v; // treat unknown keys as payload
            }
        }


        const final = {
            ...defaults,
            ...opts,
            type: opts.method ?? opts.type ?? defaults.type,
            dataType: opts.dataType ?? defaults.dataType,
        };

        if (!("data" in final) && Object.keys(dataBag).length) {
            final.data = dataBag;
        }

        $Dom.ajax(final);
    }

    loadImage(src, fetchStatus) {
        const image = new Image();
        image.src = src;

        image.onload = () => {
            const result = {
                width: image.width,
                height: image.height,
                src: image.src
            };
            this.handleSuccess(fetchStatus, result);
        };

        image.onerror = () => {
            this.handleError(fetchStatus, "not found");
        };
    }
    
    createRuntimeSnapshot() {
        return {
            cacheMap: StateUtil.encodeValue(this.cacheMap),

            entries: Object.values(this.tmodelKeyMap).map(entry => ({
                pageKey: entry.pageKey,
                oid: entry.oid,
                targetName: entry.targetName,
                entryCount: entry.entryCount,
                resultCount: entry.resultCount,
                errorCount: entry.errorCount,
                activeIndex: entry.activeIndex,
                accessIndex: entry.accessIndex
            })),

            pendingRequests: [
                ...this.getPendingRequestSnapshots(this.fetchingAPIMap),
                ...this.getPendingRequestSnapshots(this.fetchingImageMap)
            ]
        };
    }
    
    restorePendingRequest(savedRequest, tmodelIdMap) {
        const request = StateUtil.decodeValue(savedRequest.request, tmodelIdMap);
        const targets = [];

        for (const savedTarget of savedRequest.targets || []) {
            const tmodel = tmodelIdMap[savedTarget.oid];

            if (!tmodel) {
                continue;
            }

            const key = this.getTModelKey(tmodel, savedTarget.targetName);
            const modelEntry = this.tmodelKeyMap[key];

            if (!modelEntry) {
                continue;
            }

            targets.push({
                tmodel,
                targetName: savedTarget.targetName,
                order: savedTarget.order
            });
        }

        if (!targets.length) {
            return;
        }

        const fetchId = `restored_${++this.fetchSeq}`;
        const fetchMap = request.type === "image" ? this.fetchingImageMap : this.fetchingAPIMap;

        const fetchStatus = {
            fetchId,
            cacheId: savedRequest.cacheId,
            request,
            startTime: TUtil.now(),
            epoch: this.runtimeEpoch,
            targets: targets.map(({ tmodel, targetName }) => ({
                tmodel,
                targetName
            })),
            fetchMap
        };

        fetchMap[fetchId] = fetchStatus;

        for (const { tmodel, targetName, order } of targets) {
            const key = this.getTModelKey(tmodel, targetName);
            const modelEntry = this.tmodelKeyMap[key];

            modelEntry.fetchMap[fetchId] = {
                fetchId,
                order
            };
        }

        if (savedRequest.cacheId && this.isFetched(savedRequest.cacheId)) {
            this.handleSuccess(fetchStatus, this.cacheMap[savedRequest.cacheId].result);
            return;
        }

        if (request.type === "image") {
            this.loadImage(request.src, fetchStatus);
        } else {
            this.ajaxAPI(request.url, request.query, fetchStatus);
        }
    }

    restoreRuntimeSnapshot(snapshot, tmodelIdMap) {
        this.clear();

        this.cacheMap = StateUtil.decodeValue(snapshot?.cacheMap || {}, tmodelIdMap);
        this.tmodelKeyMap = {};
        this.targetPageKeyMap = new WeakMap();

        for (const savedEntry of snapshot?.entries || []) {
            const tmodel = tmodelIdMap[savedEntry.oid];

            if (!tmodel) {
                continue;
            }

            this.setTargetPageKey(tmodel, savedEntry.targetName, savedEntry.pageKey);

            const key = this.getTModelKey(tmodel, savedEntry.targetName);

            this.tmodelKeyMap[key] = {
                pageKey: savedEntry.pageKey,
                oid: savedEntry.oid,
                targetName: savedEntry.targetName,
                fetchMap: {},
                entryCount: savedEntry.entryCount,
                resultCount: savedEntry.resultCount,
                errorCount: savedEntry.errorCount,
                activeIndex: savedEntry.activeIndex,
                accessIndex: savedEntry.accessIndex
            };
        }

        for (const pendingRequest of snapshot?.pendingRequests || []) {
            this.restorePendingRequest(pendingRequest, tmodelIdMap);
        }
    }
}

export { LoadingManager };
