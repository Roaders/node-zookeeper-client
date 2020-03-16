/**
 * Copyright (c) 2013 Yahoo! Inc. All rights reserved.
 *
 * Copyrights licensed under the MIT License. See the accompanying LICENSE file
 * for terms.
 */

var assert = require('assert');

// Event types
export const TYPES = {
    NODE_CREATED : 1,
    NODE_DELETED : 2,
    NODE_DATA_CHANGED : 3,
    NODE_CHILDREN_CHANGED : 4
};

/**
 * Check if the given event type code is defined or not, throw an error if the
 * type is not defined.
 *
 * @method validateType
 * @param type {Number} The type.
 */
function validateType(type) {
    assert(typeof type === 'number', 'type must be a number.');

    var defined = Object.keys(TYPES).some(function (name) {
        return TYPES[name] === type;
    });

    if (!defined) {
        throw new Error('Unknown type: ' + type);
    }
}

/**
 * Watcher event.
 *
 * @class Event
 * @constructor
 * @private
 * @param type {Number} The type of the event.
 * @param name {String} The name of the event.
 * @param [path] {String} The node path of the event.
 */
export class Event{
    constructor (private type, private name: string, private path) {
        validateType(type);
        assert(
            name && typeof name === 'string',
            'name must be a non-empty string.'
        );
    }

        /**
     * Return the type of the event.
     *
     * @method getType
     * @return {String} The name.
     */
    private getType () {
        return this.type;
    };

    /**
     * Return the name of the event.
     *
     * @method getName
     * @return {String} The name.
     */
    private getName () {
        return this.name;
    };

    /**
     * Return the path of the event.
     *
     * @method getPath
     * @return {String} The path.
     */
    private getPath () {
        return this.path;
    };

    /**
     * Return a string representation of the event.
     *
     * @method toString
     * @return {String} The string representation.
     */
    private toString () {
        var result = this.name + '[' + this.type + ']';

        if (this.path) {
            result += '@' + this.path;
        }

        return result;
    };
}



/**
 * Factory method to crate an instance of event from an instance of
 * jute.WatcherEvent.
 *
 * @method create
 * @param watcherEvent {WatcherEvent} an instance of jute.WatcherEvent
 */
export function create(watcherEvent) {
    assert(watcherEvent, 'watcherEvent must be a valid object.');
    validateType(watcherEvent.type);

    var name,
        i = 0,
        keys = Object.keys(TYPES);

    while (i < keys.length) {
        if (TYPES[keys[i]] === watcherEvent.type) {
            name = keys[i];
            break;
        }

        i += 1;
    }

    return new Event(watcherEvent.type, name, watcherEvent.path);
}
