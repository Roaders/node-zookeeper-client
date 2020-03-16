/**
 * Copyright (c) 2013 Yahoo! Inc. All rights reserved.
 *
 * Copyrights licensed under the MIT License. See the accompanying LICENSE file
 * for terms.
 */


var jute = require('./jute');

export class Id{
    constructor(private scheme: string, private id: string) {
        if (!scheme || typeof scheme !== 'string') {
            throw new Error('scheme must be a non-empty string.');
        }
    
        if (typeof id !== 'string') {
            throw new Error('id must be a string.');
        }
    }
}

IdImport.prototype.toRecord = function () {
    return new jute.data.Id(
        this.scheme,
        this.id
    );
};

export const ANYONE_ID_UNSAFE = new IdImport('world', 'anyone');
export const AUTH_IDS = new IdImport('auth', '');


export function fromRecord(record) {
    if (!(record instanceof jute.data.Id)) {
        throw new Error('record must be an instace of jute.data.Id.');
    }

    return new IdImport(record.scheme, record.id);
}



