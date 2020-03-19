/**
 * Copyright (c) 2013 Yahoo! Inc. All rights reserved.
 *
 * Copyrights licensed under the MIT License. See the accompanying LICENSE file
 * for terms.
 */


var assert = require('assert');

/**
 * ZooKeeper client state class.
 *
 * @class State
 * @constructor
 * @private
 * @param name {String} The name of the state.
 * @param code {Number} The code of the state.
 */
export class State {

    static DISCONNECTED = new State('DISCONNECTED', 0);
    static SYNC_CONNECTED = new State('SYNC_CONNECTED', 3);
    static AUTH_FAILED = new State('AUTH_FAILED', 4);
    static CONNECTED_READ_ONLY = new State('CONNECTED_READ_ONLY', 5);
    static SASL_AUTHENTICATED = new State('SASL_AUTHENTICATED', 6);
    static EXPIRED = new State('EXPIRED', -122);

    constructor(private readonly name: string, public readonly code: number) {

        assert(
            name && typeof name === 'string',
            'name must be a non-empty string.'
        );
        assert(typeof code === 'number', 'type must be a number.');
    }

    /**
     * Return the name of the state.
     * @method getName
     * @return {String} The name o fhte state.
     */
    public getName  () {
        return this.name;
    };

    /**
     * Return the code of the state.
     * @method getCode
     * @return {Number} The code of the state.
     */
    public getCode  () {
        return this.code;
    };

    /**
     * Return a string representation of the state.
     *
     * @method toString
     * @return {String} The string representation of the state.
     */
    public toString  () {
        return this.name + '[' + this.code + ']';
    };
}


