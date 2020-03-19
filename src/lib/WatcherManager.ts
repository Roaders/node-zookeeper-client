import { watcher } from "./contracts";
import { validate } from "./Path";
import { EventEmitter } from "events";
import { Event } from "./Event";

/**
 * Copyright (c) 2013 Yahoo! Inc. All rights reserved.
 *
 * Copyrights licensed under the MIT License. See the accompanying LICENSE file
 * for terms.
 */

type WatcherType = "data" | "child" | "existence";
type EmitterLookup = {[key: string]: EventEmitter | undefined};

export class WatcherManager {
    public dataWatchers: EmitterLookup = {};
    public childWatchers: EmitterLookup = {};
    public existenceWatchers: EmitterLookup = {};

    public registerDataWatcher(path: string, watcher: watcher) {
        this.registerWatcher('data', path, watcher);
    };
    
    public getDataWatcherPaths () {
        return this.getWatcherPaths('data');
    };
    
    public registerChildWatcher (path: string, watcher: watcher) {
        this.registerWatcher('child', path, watcher);
    };
    
    public getChildWatcherPaths () {
        return this.getWatcherPaths('child');
    };
    
    public registerExistenceWatcher (path: string, watcher: watcher) {
        this.registerWatcher('existence', path, watcher);
    };
    
    public getExistenceWatcherPaths () {
        return this.getWatcherPaths('existence');
    };
    
    public emit (watcherEvent: Event) {
        if (!watcherEvent) {
            throw new Error('watcherEvent must be a valid object.');
        }
    
        const emitters: EventEmitter[] = [];
    
        const childWatcher = this.childWatchers[watcherEvent.path];
        const dataWatcher = this.dataWatchers[watcherEvent.path];
        const existenceWatcher = this.existenceWatchers[watcherEvent.path];

        switch (watcherEvent.type) {
            case Event.NODE_DATA_CHANGED:
            case Event.NODE_CREATED:
                if (dataWatcher != null) {
                    emitters.push(dataWatcher);
                    delete this.dataWatchers[watcherEvent.path];
                }
        
                if (existenceWatcher != null) {
                    emitters.push(existenceWatcher);
                    delete this.existenceWatchers[watcherEvent.path];
                }
                break;
            case Event.NODE_CHILDREN_CHANGED:
                if (childWatcher != null) {
                    emitters.push(childWatcher);
                    delete this.childWatchers[watcherEvent.path];
                }
                break;
            case Event.NODE_DELETED:
                if (dataWatcher != null) {
                    emitters.push(dataWatcher);
                    delete this.dataWatchers[watcherEvent.path];
                }
                if (childWatcher != null) {
                    emitters.push(childWatcher);
                    delete this.childWatchers[watcherEvent.path];
                }
                break;
            default:
                throw new Error('Unknown event type: ' + watcherEvent.type);
        }
    
        if (emitters.length < 1) {
            return;
        }
    
        const event = Event.create(watcherEvent);
    
        emitters.forEach((emitter) => {
            emitter.emit('notification', event);
        });
    };
    
    public isEmpty () {
        let empty = true
    
        const watchers = [this.dataWatchers, this.existenceWatchers, this.childWatchers];
    
        for (let i = 0; i < watchers.length; i += 1) {
            const paths = Object.keys(watchers[i]);
            const lookup = watchers[i];
    
            for (let j = 0; j < paths.length; j += 1) {
                const emitter = lookup[paths[j]];
                if (emitter != null && emitter.listeners('notification').length > 0) {
                    empty = false;
                    break;
                }
            }
        }
    
        return empty;
    };

    private registerWatcher(type: WatcherType, path: string, watcher: watcher) {
        const emitters = this.getLookup(type);
        let watcherExists = false;
    
        validate(path);
    
        if (typeof watcher !== 'function') {
            throw new Error('watcher must be a valid function.');
        }
    
        const emitter = emitters[path] || new EventEmitter();
        emitters[path] = emitter;
        watcherExists = emitter.listeners('notification').some( (listener) => {
            // This is rather hacky since node.js wraps the listeners using an
            // internal function.
            return listener === watcher || (listener as any).listener === watcher;
        });
    
        if (!watcherExists) {
            emitter.once('notification', watcher);
        }
    }
    
    private getWatcherPaths(type: WatcherType) {
        const emitters = this.getLookup(type);
        const result: string[] = [];
    
        Object.keys(emitters).forEach( (path) => {
            const emitter = emitters[path];
            if (emitter != null && emitter.listeners('notification').length > 0) {
                result.push(path);
            }
        });
    
        return result;
    }

    private getLookup(type: WatcherType): EmitterLookup{
        switch(type){
            case "child":
                return this.childWatchers;
            case "data":
                return this.dataWatchers;
            case "existence":
                return this.existenceWatchers;
        }
    }
}





