/**
 * Copyright (c) 2013 Yahoo! Inc. All rights reserved.
 *
 * Copyrights licensed under the MIT License. See the accompanying LICENSE file
 * for terms.
 */


var events = require('events');
var Path = require('./Path.js');
var ZkEventImport = require('./Event.js');

export class WatcherManager {
    public dataWatchers = {};
    public childWatchers = {};
    public existenceWatchers = {};

    public registerDataWatcher(path, watcher) {
        registerWatcher(this, 'data', path, watcher);
    };
    
    public getDataWatcherPaths () {
        return getWatcherPaths(this, 'data');
    };
    
    public registerChildWatcher (path, watcher) {
        registerWatcher(this, 'child', path, watcher);
    };
    
    public getChildWatcherPaths () {
        return getWatcherPaths(this, 'child');
    };
    
    public registerExistenceWatcher (path, watcher) {
        registerWatcher(this, 'existence', path, watcher);
    };
    
    public getExistenceWatcherPaths () {
        return getWatcherPaths(this, 'existence');
    };
    
    public emit (watcherEvent) {
        if (!watcherEvent) {
            throw new Error('watcherEvent must be a valid object.');
        }
    
        var emitters = [],
            event;
    
        switch (watcherEvent.type) {
        case ZkEventImport.NODE_DATA_CHANGED:
        case ZkEventImport.NODE_CREATED:
            if (this.dataWatchers[watcherEvent.path]) {
                emitters.push(this.dataWatchers[watcherEvent.path]);
                delete this.dataWatchers[watcherEvent.path];
            }
    
            if (this.existenceWatchers[watcherEvent.path]) {
                emitters.push(this.existenceWatchers[watcherEvent.path]);
                delete this.existenceWatchers[watcherEvent.path];
            }
            break;
        case ZkEventImport.NODE_CHILDREN_CHANGED:
            if (this.childWatchers[watcherEvent.path]) {
                emitters.push(this.childWatchers[watcherEvent.path]);
                delete this.childWatchers[watcherEvent.path];
            }
            break;
        case ZkEventImport.NODE_DELETED:
            if (this.dataWatchers[watcherEvent.path]) {
                emitters.push(this.dataWatchers[watcherEvent.path]);
                delete this.dataWatchers[watcherEvent.path];
            }
            if (this.childWatchers[watcherEvent.path]) {
                emitters.push(this.childWatchers[watcherEvent.path]);
                delete this.childWatchers[watcherEvent.path];
            }
            break;
        default:
            throw new Error('Unknown event type: ' + watcherEvent.type);
        }
    
        if (emitters.length < 1) {
            return;
        }
    
        event = ZkEventImport.create(watcherEvent);
    
        emitters.forEach(function (emitter) {
            emitter.emit('notification', event);
        });
    };
    
    public isEmpty () {
        var empty = true,
            watchers,
            paths,
            i,
            j;
    
        watchers = [this.dataWatchers, this.existenceWatchers, this.childWatchers];
    
        for (i = 0; i < watchers.length; i += 1) {
            paths = Object.keys(watchers[i]);
    
            for (j = 0; j < paths.length; j += 1) {
                if (watchers[i][paths[j]].listeners('notification').length > 0) {
                    empty = false;
                    break;
                }
            }
        }
    
        return empty;
    };
}

function registerWatcher(self, type, path, watcher) {
    var watchers = self[type + 'Watchers'],
        watcherExists = false;

    Path.validate(path);

    if (typeof watcher !== 'function') {
        throw new Error('watcher must be a valid function.');
    }

    watchers[path] = watchers[path] || new events.EventEmitter();
    watcherExists = watchers[path].listeners('notification').some(function (l) {
        // This is rather hacky since node.js wraps the listeners using an
        // internal function.
        return l === watcher || l.listener === watcher;
    });

    if (!watcherExists) {
        watchers[path].once('notification', watcher);
    }
}

function getWatcherPaths(self, type) {
    var watchers = self[type + 'Watchers'],
        result = [];

    Object.keys(watchers).forEach(function (path) {
        if (watchers[path].listeners('notification').length > 0) {
            result.push(path);
        }
    });

    return result;
}



