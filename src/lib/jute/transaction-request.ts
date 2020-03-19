import assert = require("assert");
import { OP_CODES } from "./constants";
import { jute, } from "./jute";
import { Record } from "./record";

export class TransactionRequest{

    private ops: Array<any>;
    private records: Record[] = [];

    constructor(ops: Array<any>) {
        if (!(this instanceof TransactionRequest)) {
            return new TransactionRequest(ops);
        }

        assert(Array.isArray(ops), 'ops must be a valid array.');

        this.ops.forEach(op => {
            var mh = new jute.protocol.MultiHeader(op.type, false, -1),
                record;

            this.records.push(mh);

            switch (op.type) {
            case OP_CODES.CREATE:
                record = new jute.protocol.CreateRequest();
                record.path = op.path;
                record.data = op.data;
                record.acl = op.acls.map(function (item) {
                    return item.toRecord();
                });
                record.flags = op.mode;
                break;
            case OP_CODES.DELETE:
                record = new jute.protocol.DeleteRequest();
                record.path = op.path;
                record.version = op.version;
                break;
            case OP_CODES.SET_DATA:
                record = new jute.protocol.SetDataRequest();
                record.path = op.path;
                if (Buffer.isBuffer(op.data)) {
                    record.data = Buffer.alloc(op.data.length);
                    op.data.copy(record.data);
                }
                record.version = op.version;
                break;
            case OP_CODES.CHECK:
                record = new jute.protocol.CheckVersionRequest();
                record.path = op.path;
                record.version = op.version;
                break;
            default:
                throw new Error('Unknown op type: ' + op.type);
            }

            this.records.push(record);
        }, this);

        // Signal the end of the ops.
        this.records.push(new jute.protocol.MultiHeader(-1, true, -1));
    }

    public setChrootPath (path) {
        this.records.forEach(function (record) {
            record.setChrootPath(path);
        });
    };
    
    
    public byteLength  () {
        return this.records.reduce(function (length, record) {
            return length + record.byteLength();
        }, 0);
    };
    
    public serialize (buffer, offset) {
        assert(
            Buffer.isBuffer(buffer),
            'buffer must an instance of Node.js Buffer class.'
        );
    
        assert(
            offset >= 0 && offset < buffer.length,
            'offset: ' + offset + ' is out of buffer range.'
        );
    
        var size = this.byteLength();
    
        if (offset + size > buffer.length) {
            throw new Error('buffer does not have enough space.');
        }
    
        this.records.forEach(function (record) {
            offset += record.serialize(
                buffer,
                offset
            );
        });
    
        return size;
    };
}