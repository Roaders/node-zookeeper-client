/**
 * Copyright (c) 2013 Yahoo! Inc. All rights reserved.
 *
 * Copyrights licensed under the MIT License. See the accompanying LICENSE file
 * for terms.
 */

var assert = require('assert');

// All error codes.
export const EXCEPTION_CODES = {
};

/**
 * Check if the given error code is a valid code, throw an error if the
 * code is not supported.
 *
 * @method validateCode
 * @param code {Number} The error code to be checked.
 */
function validateCode(code) {
    assert(typeof code === 'number', 'code must be a number.');

    var defined = Object.keys(EXCEPTION_CODES).some(function (name) {
        return EXCEPTION_CODES[name] === code;
    });

    if (!defined) {
        throw new Error('Unknown code: ' + code);
    }
}

/**
 * Exception class for all zookeeper errors.
 *
 * @class Exception
 * @constructor
 * @private
 * @param code {Number} Exception code.
 * @param name {String} Name of the exception.
 * @param [path] {String} Node path of the exception, optional.
 * @param ctor {Function} The function to start in stack trace.
 */
export class Exception extends Error{


    static OK = 0;
    static SYSTEM_ERROR = -1;
    static RUNTIME_INCONSISTENCY = -2;
    static DATA_INCONSISTENCY = -3;
    static CONNECTION_LOSS = -4;
    static MARSHALLING_ERROR = -5;
    static UNIMPLEMENTED = -6;
    static OPERATION_TIMEOUT = -7;
    static BAD_ARGUMENTS = -8;
    static API_ERROR = -100;
    static NO_NODE = -101;
    static NO_AUTH = -102;
    static BAD_VERSION = -103;
    static NO_CHILDREN_FOR_EPHEMERALS = -108;
    static NODE_EXISTS = -110;
    static NOT_EMPTY = -111;
    static SESSION_EXPIRED = -112;
    static INVALID_CALLBACK = -113;
    static INVALID_ACL = -114;
    static AUTH_FAILED = -115;

    /**
     * The factory method to create an instance of Exception.
     *
     * @method create
     * @param code {Number} Exception code.
     * @param path {String} Node path of the exception, optional.
     */
    static create(code, path?: string) {
        validateCode(code);

        var name,
            i = 0,
            keys = Object.keys(EXCEPTION_CODES);

        while (i < keys.length) {
            if (EXCEPTION_CODES[keys[i]] === code) {
                name = keys[i];
                break;
            }

            i += 1;
        }

        return new Exception(code, name, path, Exception.create);
    }

    constructor(private code, name, private path, ctor) {
        super();
        if (!ctor) {
            ctor = path;
            path = undefined;
        }
    
        validateCode(code);
        assert(
            name && typeof name === 'string',
            'name must be a non-empty string.'
        );
        assert(typeof ctor === 'function', 'ctor must be a function.');
    
        Error.captureStackTrace(this, ctor || Exception);
    
        this.message = 'Exception: ' + name + '[' + code + ']';
    
        this.name = name;

        if (path) {
            this.message += '@' + path;
        }
    }

    /**
     * Return the code of the Exception.
     *
     * @method getCode
     * @return {Number} The code.
     */
    public getCode() {
        return this.code;
    };

    /**
     * Return the name of the Exception.
     *
     * @method getName
     * @return {String} The name.
     */
    public getName() {
        return this.name;
    };

    /**
     * Return the path of the Exception.
     *
     * @method getPath
     * @return {String} The path.
     */
    public getPath() {
        return this.path;
    };

    /**
     *
     * @method toString
     * @return {String} The readable form of the exception.
     */
    public toString() {
        return this.message;
    };
}
