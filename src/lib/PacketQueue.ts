/**
 * Copyright (c) 2013 Yahoo! Inc. All rights reserved.
 *
 * Copyrights licensed under the MIT License. See the accompanying LICENSE file
 * for terms.
 */

import { EventEmitter } from "events";


/**
 * The package queue which emits events.
 */


export class PacketQueue extends EventEmitter {

    private queue = [];

    public push (packet) {
        if (typeof packet !== 'object') {
            throw new Error('packet must be a valid object.');
        }

        this.queue.push(packet);

        this.emit('readable');
    };


    public unshift (packet) {
        if (typeof packet !== 'object') {
            throw new Error('packet must be a valid object.');
        }

        this.queue.unshift(packet);
        this.emit('readable');
    };

    public shift () {
        return this.queue.shift();
    };
}






