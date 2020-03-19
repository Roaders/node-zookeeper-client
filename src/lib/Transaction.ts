/**
 * Copyright (c) 2013 Yahoo! Inc. All rights reserved.
 *
 * Copyrights licensed under the MIT License. See the accompanying LICENSE file
 * for terms.
 */

import { ConnectionManager } from "./ConnectionManager";
import { ACL } from "./ACL";
import { Exception } from "./Exception";
import { CreateMode } from "./CreateMode";
import { validate } from "./Path";


var assert            = require('assert');
var jute              = require('./jute');

/**
 * Transaction provides a builder interface that helps building an atomic set
 * of operations.
 *
 * @class Transaction
 * @constructor
 * @param connectionManager {ConnectionManager} an instance of ConnectionManager.
 */
export class Transaction {
    private ops = [];

    constructor(private connectionManager: ConnectionManager){
    
        assert(
            connectionManager instanceof ConnectionManager,
            'connectionManager must be an instance of ConnectionManager.'
        );
    }

    /**
     * Add a create operation with given path, data, acls and mode.
     *
     * @method create
     * @param path {String} The znode path.
     * @param [data=undefined] {Buffer} The data buffer.
     * @param [acls=ACL.OPEN_ACL_UNSAFE] {Array} An array of ACL object.
     * @param [mode=CreateMode.PERSISTENT] {CreateMode} The creation mode.
     * @return {Transaction} this transaction instance.
     */
    public create (path: string, data?: Buffer, acls?: ACL[], mode?: CreateMode): this {
        validate(path);

        acls = Array.isArray(acls) ? acls : ACL.OPEN_ACL_UNSAFE;
        mode = typeof mode === 'number' ? mode : CreateMode.PERSISTENT;

        assert(
            data === null || data === undefined || Buffer.isBuffer(data),
            'data must be a valid buffer, null or undefined.'
        );

        assert(acls.length > 0, 'acls must be a non-empty array.');

        this.ops.push({
            type : jute.OP_CODES.CREATE,
            path : path,
            data : data,
            acls : acls,
            mode : mode
        });

        return this;
    };

    /**
     * Add a check (existence) operation with given path and optional version.
     *
     * @method check
     * @param path {String} The znode path.
     * @param [version=-1] {Number} The version of the znode.
     * @return {Transaction} this transaction instance.
     */
    public check (path: string, version: number = -1): this {

        validate(path);
        assert(typeof version === 'number', 'version must be a number.');

        this.ops.push({
            type : jute.OP_CODES.CHECK,
            path : path,
            version : version
        });

        return this;
    };

    /**
     * Add a set-data operation with the given path, data and optional version.
     *
     * @method setData
     * @param path {String} The znode path.
     * @param data {Buffer} The data buffer.
     * @param [version=-1] {Number} The version of the znode.
     * @return {Transaction} this transaction instance.
     */
    public setData (path: string, data: Buffer | null, version: number = -1): this {
        validate(path);
        assert(
            data === null || data === undefined || Buffer.isBuffer(data),
            'data must be a valid buffer, null or undefined.'
        );
        assert(typeof version === 'number', 'version must be a number.');

        this.ops.push({
            type : jute.OP_CODES.SET_DATA,
            path : path,
            data : data,
            version : version
        });

        return this;
    };

    /**
     * Add a delete operation with the given path and optional version.
     *
     * @method delete
     * @param path {String} The znode path.
     * @param [version=-1] {Number} The version of the znode.
     * @return {Transaction} this transaction instance.
     */
    private (path: string, version: number = -1): this {

        validate(path);
        assert(typeof version === 'number', 'version must be a number.');

        this.ops.push({
            type : jute.OP_CODES.DELETE,
            path : path,
            version : version
        });

        return this;
    };

    /**
     * Execute the transaction atomically.
     *
     * @method commit
     * @param callback {Function} callback function.
     */
    public commit (callback: (error: Error | Exception, results?: any) => void): void {
        assert(typeof callback === 'function', 'callback must be a function');

        var header = new jute.protocol.RequestHeader(),
            payload = new jute.TransactionRequest(this.ops),
            request;

        header.type = jute.OP_CODES.MULTI;
        request = new jute.Request(header, payload);

        this.connectionManager.queue(request, function (error, response) {
            if (error) {
                callback(error);
                return;
            }

            var result,
                i;

            for (i = 0; i < response.payload.results.length; i += 1) {
                result = response.payload.results[i];

                // Find if there is an op which caused the transaction to fail.
                if (result.type === jute.OP_CODES.ERROR &&
                        result.err !== Exception.OK) {
                    error = Exception.create(result.err);
                    break;
                }
            }

            callback(error, response.payload.results);
        });
    };
}




