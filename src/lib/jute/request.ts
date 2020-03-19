import { Record } from "./record";

/**
 * This class represent the request the client sends over the wire to ZooKeeper
 * server.
 *
 * @class Request
 * @constructor
 * @param header {Record} The request header record.
 * @param payload {payload} The request payload record.
 */
export class Request {

    constructor(public readonly header: Record, public readonly payload: Record){
    }

    /**
     * Serialize the request to a buffer.
     * @method toBuffer
     * @return {Buffer} The buffer which contains the serialized request.
     */
    public toBuffer() {
        let size = 0;
        let offset = 0;

        if (this.header) {
            size += this.header.byteLength();
        }

        if (this.payload) {
            size += this.payload.byteLength();
        }

        // Needs 4 extra for the length field (Int32)
        const buffer = Buffer.alloc(size + 4);

        buffer.writeInt32BE(size, offset);
        offset += 4;

        if (this.header) {
            offset += this.header.serialize(buffer, offset);
        }

        if (this.payload) {
            offset += this.payload.serialize(buffer, offset);
        }

        return buffer;
    };
}