import { TUtil } from "./TUtil.js";
import { tApp, App, getLocationManager, getEvents } from "./App.js";
import { DomInit } from "./DomInit.js";
import { TModelUtil } from "./TModelUtil.js";

/**
 * It enables opening new pages and managing history. It also provide page caching.
 * It is used to provide a single page app experience.
 */
class PageManager {
    constructor() {
        this.currentLink = TUtil.getFullLink(document.URL);
        this.lastCachedLink = undefined;
        this.initHistory();
    }
    
    initHistory() {
        if ("scrollRestoration" in history) {
            history.scrollRestoration = "manual";
        }

        const st = history.state;

        if (!st || (!st.link && !st.browserUrl)) {
            history.replaceState({ link: this.currentLink }, "", this.currentLink);
        }
    }
    
    initPage(html) {
        tApp.tRoot.$dom.outerHTML(html);
        tApp.tRoot.$dom = TModelUtil.getRootDom();
        if (tApp.tRoot.$dom.getTagName() !== 'body') {
            tApp.tRoot.$dom.attr('data-tj-no-slot', 'true');
        }

        DomInit.initPageDoms(tApp.tRoot.$dom);
    }

    async openLinkFromHistory(state) {
        const link = state.link || state.browserUrl;
        
        if (!link) {
            return;
        }

        if (state.browserUrl) {
            history.replaceState({ link }, "", link);
        }

        await this.openLink(link, false);
    }
    
    onPageClose() {        
        tApp.resizeLastUpdate = TUtil.now();
        getEvents().resizeRoot();
        tApp.manager.getAvailableDoms().forEach(tmodel => {
            getLocationManager().runEventTargets(tmodel, ['onPageClose']);             
        });          
    }

    async openLink(link, updateHistory = true) {
        link = TUtil.getFullLink(link);
        
        await this.storePage(this.currentLink);

        this.lastCachedLink = this.currentLink;

        if (updateHistory) {
            history.pushState({ link }, "", link);
        }

        this.currentLink = link;

        if (tApp.stateManager.has(this.getStateKey(link))) {
            await this.restorePage(link);
            return;
        }

        await tApp.stop();
        await tApp.reset();

        tApp.tRoot.$dom.innerHTML("");

        App.oids = {};
        App.tmodelIdMap = {};
        tApp.tRoot = tApp.tRootFactory();

        await tApp.start();
    }

    back() {
        return history.back();
    }
    
    getStateKey(link) {
        return `page:${TUtil.getFullLink(link)}`;
    }

    async storePage(link) {
        link = TUtil.getFullLink(link);

        this.onPageClose();

        const key = this.getStateKey(link);
        const checkpoint = await tApp.stateManager.store(key);

        return checkpoint;
    }

    async restorePage(link) {
        
        const key = this.getStateKey(link);
                
        if (tApp.stateManager.has(key)) {
            return tApp.stateManager.restore(key);
        }
        
        return false;
    }

}

export { PageManager };
