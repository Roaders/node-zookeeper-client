import { Record } from "./record";
import assert = require("assert");
import { jute } from "./jute";
import { OP_CODES } from "./constants";
import { Stat } from "./specification";

type Result = {
    type: OP_CODES, 
    path?: string,
    stat?: Stat,
    err?: number
}

export class TransactionResponse {

    constructor(){
        if (!(this instanceof TransactionResponse)) {
            return new TransactionResponse();
        }
    }
    
    private results: Result[] = [];
    private chrootPath = undefined;

    public setChrootPath (path) {
        this.chrootPath = path;
    };
    
    public deserialize (buffer, offset) {
        assert(
            Buffer.isBuffer(buffer),
            'buffer must an instance of Node.js Buffer class.'
        );
    
        assert(
            offset >= 0 && offset < buffer.length,
            'offset: ' + offset + ' is out of buffer range.'
        );
    
        let bytesRead = 0;
    
        while (true) { // eslint-disable-line no-constant-condition
            const header = new jute.protocol.MultiHeader();
            bytesRead += header.deserialize(buffer, offset + bytesRead);
    
            if ((header as any).done) {
                break;
            }
    
            const type: OP_CODES = (header as any).type;
            let response: Record;

            switch (type) {
                case OP_CODES.CREATE:
                    response = new jute.protocol.CreateResponse();
                    response.setChrootPath(this.chrootPath);
                    bytesRead += response.deserialize(buffer, offset + bytesRead);
                    this.results.push({
                        type,
                        path : (response as any).path
                    });
                    break;
                case OP_CODES.DELETE:
                    this.results.push({
                        type
                    });
                    break;
                case OP_CODES.SET_DATA:
                    response = new jute.protocol.SetDataResponse();
                    response.setChrootPath(this.chrootPath);
                    bytesRead += response.deserialize(buffer, offset + bytesRead);
                    this.results.push({
                        type,
                        stat: (response as any).stat
                    });
                    break;
                case OP_CODES.CHECK:
                    this.results.push({
                        type
                    });
                    break;
                case OP_CODES.ERROR:
                    response = new jute.protocol.ErrorResponse();
                    response.setChrootPath(this.chrootPath);
                    bytesRead += response.deserialize(buffer, offset + bytesRead);
                    this.results.push({
                        type,
                        err : (response as any).err
                    });
                    break;
                default:
                    throw new Error(
                        'Unknown type: ' + type + ' in transaction response.'
                    );
            }
        }
    
        return bytesRead;
    };
}