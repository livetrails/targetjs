import { $Dom } from "./$Dom.js";
import { TUtil } from "./TUtil.js";
import { getRunScheduler } from "./App.js";
import { TargetUtil } from "./TargetUtil.js";

/**
 * It provides a central place for managing fetching of external APIs and images. 
 */
class LoadingManager {
    constructor() {
        this.cacheMap = {};
        
        this.tmodelKeyMap = {};
        this.fetchingAPIMap = {};
        this.fetchingImageMap = {};
    }

    fetchCommon(fetchId, cacheId, tmodel, fetchMap, fetchFn) { 
        TargetUtil.markTargetAction(tmodel, 'fetchAction');
        
        if (!cacheId || !this.isFetched(cacheId)) {
            if (!fetchMap[fetchId]) {
                fetchMap[fetchId] = {
                    fetchId,
                    cacheId,
                    fetchingFlag: true,
                    startTime: TUtil.now(),
                    targets: [{ tmodel, targetName: tmodel.key }],
                    fetchMap
                };            
                fetchFn();
            } else {
                fetchMap[fetchId].targets.push({ tmodel, targetName: tmodel.key });
            }
        } else if (!fetchMap[fetchId]) {
            fetchMap[fetchId] = {
                fetchId,
                cacheId,
                fetchingFlag: true,
                startTime: TUtil.now(),
                targets: [{ tmodel, targetName: tmodel.key }],
                fetchMap
            }; 
        }
        
        this.addToTModelKeyMap(tmodel, tmodel.key, fetchId, cacheId);

        return fetchId;
    }
    
    fetch(tmodel, url, query, cacheId) {
        const fetchId = `${tmodel.oid}_${url}_${JSON.stringify(query)}`;
        this.fetchCommon(fetchId, cacheId, tmodel, this.fetchingAPIMap, () => {
            this.ajaxAPI(url, query, this.fetchingAPIMap[fetchId]);
        });
    }

    fetchImage(tmodel, src, cacheId) {
        const fetchId = `${tmodel.oid}_${src}`;
        return this.fetchCommon(fetchId, cacheId, tmodel, this.fetchingImageMap, () => {
            this.loadImage(src, this.fetchingImageMap[fetchId]);
        });
    }    
    
    getTModelKey(tmodel, targetName) {
        return `${document.URL} ${tmodel.oid} ${targetName}`;
    }
    
    getLoadTargetName(targetName) {
        return `load-${targetName}`;
    }

    addToTModelKeyMap(tmodel, targetName, fetchId, cacheId) {
        const key = this.getTModelKey(tmodel, targetName);
        const loadTargetName = this.getLoadTargetName(targetName);
                 
        if (!this.tmodelKeyMap[key]) {
            this.tmodelKeyMap[key] = { fetchMap: {}, entryCount: 0, resultCount: 0, errorCount: 0, activeIndex: 0, accessIndex: 0 };
            tmodel.val(loadTargetName, []);
        }

        if (!this.tmodelKeyMap[key].fetchMap[fetchId]) {
            this.tmodelKeyMap[key].fetchMap[fetchId] = {
                fetchId, 
                order: this.tmodelKeyMap[key].entryCount
            };
            
            this.tmodelKeyMap[key].entryCount++;
            tmodel.val(loadTargetName).push(undefined);
        }
        
        if (cacheId && this.isFetched(cacheId)) {
            this.handleSuccess(this.fetchingAPIMap[fetchId], this.cacheMap[cacheId].result);
        }        
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
        return this.tmodelKeyMap[key] && this.tmodelKeyMap[key].resultCount === this.tmodelKeyMap[key].entryCount && this.tmodelKeyMap[key].errorCount === 0;
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
        const loadTargetName = this.getLoadTargetName(targetName);
        const targetValue = tmodel.val(loadTargetName);
        
        return modelEntry.errorCount === 0 && Array.isArray(targetValue) && TUtil.isDefined(targetValue[modelEntry.activeIndex]);        
    }
    
    getLoadingItemValue(tmodel, targetName) {
        const target = tmodel.targets[targetName];
        const key = this.getTModelKey(tmodel, targetName);
        const modelEntry = this.tmodelKeyMap[key];
        
        if (!modelEntry || !target) {
            return undefined;
        }
                
        const loadTargetName = this.getLoadTargetName(targetName);
        const targetValue = tmodel.val(loadTargetName);
        let result;
        
        if (targetValue) {
            if (target.fetchAction === 'onEnd') {
                result = targetValue.slice(modelEntry.accessIndex);
                modelEntry.accessIndex += result.length;
            } else {
                result = targetValue[modelEntry.accessIndex];   
                modelEntry.accessIndex++;            
            }
        }

        return result;
    }

    isFetching(fetchId) {
        return this.fetchingAPIMap[fetchId]?.fetchingFlag ?? false;
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

    handleSuccess(fetchStatus, result) {
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
            const loadTargetName = this.getLoadTargetName(targetName);

            if (!tmodelEntry) {
                return;
            } 
                 
            const fetchEntry = tmodelEntry.fetchMap[fetchId];
            this.callOnSuccessHandler(tmodel, targetName, { ...res, order: fetchEntry.order });

            let targetResults = tmodel.val(loadTargetName);
                        
            if (targetResults) {
                targetResults[fetchEntry.order] = res.result;
            }
            
            tmodel.val(targetName, targetResults?.length === 1 ? targetResults[0] : targetResults);
            
            tmodelEntry.resultCount++;
            
            if (tmodelEntry.errorCount === 0) {
                TargetUtil.shouldActivateNextTarget(tmodel, targetName);
            }
        });
        
        delete fetchMap[fetchId];
                
        if (cacheId) {
            this.cacheMap[cacheId] = res;
        }
        getRunScheduler().schedule(0, `api_success_${fetchId}`);
    }
    
    handleError(fetchStatus, error) {
        const fetchTime = TUtil.now();
        const { fetchId, cacheId, startTime, targets, fetchMap } = fetchStatus;

        targets.forEach(({ tmodel, targetName }) => {
            const key = `${tmodel.oid} ${targetName}`;
            const tmodelEntry = this.tmodelKeyMap[key];
            const loadTargetName = this.getLoadTargetName(targetName);

            if (!tmodelEntry) {
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
            
            targetResults[fetchEntry.order] = res;            
            
            tmodel.val(targetName, targetResults.length === 1 ? targetResults[0] : targetResults);

            tmodelEntry.resultCount++;
            tmodelEntry.errorCount++;

            this.callOnErrorHandler(tmodel, targetName);
            
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
                tmodel.setTargetMethodName(targetName, 'onSuccess');                        
                onError.call(tmodel, tmodel.val(targetName));
            } else if (Array.isArray(onError)) {
                onError.forEach(t => TargetUtil.activateSingleTarget(tmodel, t));
            } else {
                TargetUtil.activateSingleTarget(tmodel, onError);
            }
        }
    }

    ajaxAPI(url, query, fetchStatus) {
        const defaultQuery = {
            dataType: "json",
            type: "GET",
            success: dataList => this.handleSuccess(fetchStatus, dataList),
            error: textStatus => this.handleError(fetchStatus, textStatus)
        };
        
        if (query?.dataType) {
            defaultQuery.dataType = query.dataType;
            delete query.dataType;
        }

        if (query?.requestType) {
            defaultQuery.type = query.requestType;
            delete query.requestType;
        }        

        $Dom.ajax({ ...defaultQuery, url, ...{ data: query } });
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
}

export { LoadingManager };
