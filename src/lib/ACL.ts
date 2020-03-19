/**
 * Copyright (c) 2013 Yahoo! Inc. All rights reserved.
 *
 * Copyrights licensed under the MIT License. See the accompanying LICENSE file
 * for terms.
 */

import { Id, fromRecord as idFromRecord } from "./Id";
import Permission from "./Permission"
var jute = require('./jute');


export class ACL{
    static OPEN_ACL_UNSAFE = [new ACL(Permission.ALL, Id.ANYONE_ID_UNSAFE)];
    static CREATOR_ALL_ACL = [new ACL(Permission.ALL, Id.AUTH_IDS)];
    static READ_ACL_UNSAFE = [new ACL(Permission.READ, Id.ANYONE_ID_UNSAFE)];

    constructor(public permission: number, public id: Id) {
        if (typeof permission !== 'number' || permission < 1 || permission > 31) {
            throw new Error('permission must be a valid integer.');
        }
    
        if (!(id instanceof Id)) {
            throw new Error('id must be an instance of Id class.');
        }
    }

    public toRecord  () {
        return new jute.data.ACL(
            this.permission,
            this.id.toRecord()
        );
    };
}





export function fromRecord(record) {
    if (!(record instanceof jute.data.ACL)) {
        throw new Error('record must be an instace of jute.data.ACL.');
    }

    return new ACL(record.perms, idFromRecord(record.id));
}


