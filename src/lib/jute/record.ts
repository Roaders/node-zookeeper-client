
import { Argument, ArgumentType } from "./specification";
import { jute } from "./jute";

export type RecordConstructor = new (...args: any[]) => Record;

/**
 * The prototype class for all Zookeeper jute protocol classes.
 *
 * // TODO: Move it out
 *
 * @class Record
 * @constructor
 * @param specification {Array} The array of record attribute specification.
 * @param args {Array} The constructor array of the Record class.
 */
export class Record{
    private chrootPath: string | undefined;
    private path: string;

    constructor(private specification: Argument[], args: any[] = []) {
        if (!Array.isArray(specification)) {
            throw new Error('specification must be a valid Array.');
        }
    
        specification.forEach((attribute, index) => {
            switch (attribute.type) {
                case 'int':
                    if (typeof args[index] === 'number') {
                        this[attribute.name] = args[index];
                    } else {
                        this[attribute.name] = 0;
                    }
                    break;
                case 'long':
                    // Long is represented by a buffer of 8 bytes in big endian since
                    // Javascript does not support native 64 integer.
                    this[attribute.name] = Buffer.alloc(8);
        
                    if (Buffer.isBuffer(args[index])) {
                        args[index].copy(this[attribute.name]);
                    } else {
                        this[attribute.name].fill(0);
                    }
                    break;
                case 'buffer':
                    if (Buffer.isBuffer(args[index])) {
                        this[attribute.name] = Buffer.alloc(args[index].length);
                        args[index].copy(this[attribute.name]);
                    } else {
                        this[attribute.name] = undefined;
                    }
                    break;
                case 'ustring':
                    if (typeof args[index] === 'string') {
                        this[attribute.name] = args[index];
                    } else {
                        this[attribute.name] = undefined;
                    }
                    break;
                case 'boolean':
                    if (typeof args[index] === 'boolean') {
                        this[attribute.name] = args[index];
                    } else {
                        this[attribute.name] = false;
                    }
                    break;
                default:
                    let match: RegExpExecArray | null;
                    if ((match = /^vector<([\w.]+)>$/.exec(attribute.type)) !== null) {
                        if (Array.isArray(args[index])) {
                            this[attribute.name] = args[index];
                        } else {
                            this[attribute.name] = undefined;
                        }
                    } else if ((match = /^data\.(\w+)$/.exec(attribute.type)) !== null) {
                        if (args[index] instanceof Record) {
                            this[attribute.name] = args[index];
                        } else {
                            this[attribute.name] = new jute.data[match[1]]();
                        }
                    } else {
                        throw new Error('Unknown type: ' + attribute.type);
                    }
            }
        });
    }

    public setChrootPath (path?: string) {
        this.chrootPath = path;
    };

    /**
     * Calculate and return the size of the buffer which is need to serialize this
     * record.
     *
     * @method byteLength
     * @return {Number} The number of bytes.
     */
    public byteLength () {
        let size = 0;

        this.specification.forEach((attribute) => {
            var value = this[attribute.name];

            // Add the chroot path to calculate the real path.
            if (attribute.name === 'path') {
                value = this.prependChroot(value);
            }

            if ((attribute.name === 'dataWatches' ||
                attribute.name === 'existWatches' ||
                attribute.name === 'childWatches') &&
                    Array.isArray(value)) {

                value = value.map((path) => {
                    return this.prependChroot(path);
                });
            }

            size += this.byteLengthImpl(attribute.type, value);
        });

        return size;
    };

    /**
     * Serialize the record content to a buffer.
     *
     * @method serialize
     * @param buffer {Buffer} A buffer object.
     * @param offset {Number} The offset where the write starts.
     * @return {Number} The number of bytes written.
     */
    public serialize(buffer: Buffer, offset: number) {
        if (!Buffer.isBuffer(buffer)) {
            throw new Error('buffer must an instance of Node.js Buffer class.');
        }

        if (offset < 0 || offset >= buffer.length) {
            throw new Error('offset: ' + offset + ' is out of buffer range.');
        }

        let size = this.byteLength();

        if (offset + size > buffer.length) {
            throw new Error('buffer does not have enough space.');
        }

        this.specification.forEach((attribute) => {
            var value = this[attribute.name];

            // Add the chroot path to generate the real path.
            if (attribute.name === 'path') {
                value = this.prependChroot(value);
            }

            if ((attribute.name === 'dataWatches' ||
                attribute.name === 'existWatches' ||
                attribute.name === 'childWatches') &&
                    Array.isArray(value)) {

                value = value.map((path) => {
                    return this.prependChroot(path);
                });
            }

            offset += serialize(
                attribute.type,
                value,
                buffer,
                offset
            );
        });

        return size;
    };

    /**
     * De-serialize the record content from a buffer.
     *
     * @method deserialize
     * @param buffer {Buffer} A buffer object.
     * @param offset {Number} The offset where the read starts.
     * @return {Number} The number of bytes read.
     */
    public deserialize (buffer: Buffer, offset: number) {
        if (!Buffer.isBuffer(buffer)) {
            throw new Error('buffer must an instance of Node.js Buffer class.');
        }

        if (offset < 0 || offset >= buffer.length) {
            throw new Error('offset: ' + offset + ' is out of buffer range.');
        }

        let bytesRead = 0;

        this.specification.forEach((attribute) => {
            let result = deserialize(attribute.type, buffer, offset + bytesRead);
            this[attribute.name] = result.value;
            bytesRead += result.bytesRead;

            // Remove the chroot part from the real path.
            if (this.chrootPath && attribute.name === 'path') {
                if (this.path === this.chrootPath) {
                    this.path = '/';
                } else {
                    this.path = this.path.substring(this.chrootPath.length);
                }
            }
        });

        return bytesRead;
    };

    private prependChroot(path: string) {
        if (!this.chrootPath) {
            return path;
        }
    
        if (path === '/') {
            return this.chrootPath;
        }
    
        return this.chrootPath + path;
    }

    private byteLengthImpl(type: ArgumentType, value: any) {
        let size = 0;
    
        switch (type) {
            case 'int':
                size = 4;
                break;
            case 'long':
                size = 8;
                break;
            case 'buffer':
                // buffer length + buffer content
                size = 4;
                if (Buffer.isBuffer(value)) {
                    size += value.length;
                }
                break;
            case 'ustring':
                // string buffer length + content
                size = 4;
                if (typeof value === 'string') {
                    size += Buffer.byteLength(value);
                }
                break;
            case 'boolean':
                size = 1;
                break;
            default:
                let match: RegExpExecArray | null;
                if ((match = /^vector<([\w.]+)>$/.exec(type)) !== null) {
                    // vector size + vector content
                    size = 4;
                    if (Array.isArray(value)) {
                        value.forEach((item) => {
                            size += this.byteLengthImpl(match![1] as ArgumentType, item);
                        });
                    }
                } else if ((match = /^data\.(\w+)$/.exec(type)) !== null) {
                    size = value.byteLength();
                } else {
                    throw new Error('Unknown type: ' + type);
                }
        }
    
        return size;
    }


}

function serialize(type: ArgumentType, value: any, buffer: Buffer, offset: number) {
    let bytesWritten = 0;
    let length = 0;

    switch (type) {
        case 'int':
            buffer.writeInt32BE(value, offset);
            bytesWritten = 4;
            break;
        case 'long':
            // Long is represented by a buffer of 8 bytes in big endian since
            // Javascript does not support native 64 integer.
            value.copy(buffer, offset);
            bytesWritten = 8;
            break;
        case 'buffer':
            if (Buffer.isBuffer(value)) {
                buffer.writeInt32BE(value.length, offset);
                bytesWritten = 4;

                value.copy(buffer, offset + bytesWritten);
                bytesWritten += value.length;
            } else {
                buffer.writeInt32BE(-1, offset);
                bytesWritten = 4;
            }
            break;
        case 'ustring':
            if (typeof value === 'string') {
                length = Buffer.byteLength(value);
                buffer.writeInt32BE(length, offset);
                bytesWritten = 4;

                Buffer.from(value).copy(buffer, offset + bytesWritten);
                bytesWritten += length;
            } else {
                buffer.writeInt32BE(-1, offset);
                bytesWritten += 4;
            }
            break;
        case 'boolean':
            buffer.writeUInt8(value ? 1 : 0, offset);
            bytesWritten += 1;
            break;
        default:
            let match: RegExpExecArray | null;
            if ((match = /^vector<([\w.]+)>$/.exec(type)) !== null) {
                // vector size + vector content
                if (Array.isArray(value)) {
                    buffer.writeInt32BE(value.length, offset);
                    bytesWritten += 4;

                    value.forEach((item) => {
                        bytesWritten += serialize(
                            match![1] as ArgumentType,
                            item,
                            buffer,
                            offset + bytesWritten
                        );
                    });
                } else {
                    buffer.writeInt32BE(-1, offset);
                    bytesWritten += 4;
                }
            } else if ((match = /^data\.(\w+)$/.exec(type)) !== null) {
                bytesWritten += value.serialize(buffer, offset + bytesWritten);
            } else {
                throw new Error('Unknown type: ' + type);
            }
    }

    return bytesWritten;
}

function deserialize(type: ArgumentType, buffer: Buffer, offset: number) {
    let bytesRead = 0;
    let length = 0;
    let value: any;

    switch (type) {
        case 'int':
            value = buffer.readInt32BE(offset);
            bytesRead = 4;
            break;
        case 'long':
            // Long is represented by a buffer of 8 bytes in big endian since
            // Javascript does not support native 64 integer.
            value = Buffer.alloc(8);
            buffer.copy(value, 0, offset, offset + 8);
            bytesRead = 8;
            break;
        case 'buffer':
            length = buffer.readInt32BE(offset);
            bytesRead = 4;

            if (length === -1) {
                value = undefined;
            } else {
                value = Buffer.alloc(length);
                buffer.copy(
                    value,
                    0,
                    offset + bytesRead,
                    offset + bytesRead + length
                );

                bytesRead += length;
            }
            break;
        case 'ustring':
            length = buffer.readInt32BE(offset);
            bytesRead = 4;

            if (length === -1) {
                value = undefined;
            } else {
                value = buffer.toString(
                    'utf8',
                    offset + bytesRead,
                    offset + bytesRead + length
                );

                bytesRead += length;
            }
            break;
        case 'boolean':
            value = buffer.readUInt8(offset) === 1;
            bytesRead = 1;
            break;
        default:
            let match: RegExpExecArray | null;
            if ((match = /^vector<([\w.]+)>$/.exec(type)) !== null) {
                length = buffer.readInt32BE(offset);
                bytesRead = 4;

                if (length === -1) {
                    value = undefined;
                } else {
                    value = [];
                    while (length > 0) {
                        const result = deserialize(match[1] as ArgumentType, buffer, offset + bytesRead);
                        value.push(result.value);
                        bytesRead += result.bytesRead;
                        length -= 1;
                    }
                }
            } else if ((match = /^data\.(\w+)$/.exec(type)) !== null) {
                value = new jute.data[match[1]]();
                bytesRead = value.deserialize(buffer, offset);
            } else {
                throw new Error('Unknown type: ' + type);
            }
    }

    return {
        value : value,
        bytesRead : bytesRead
    };
}
