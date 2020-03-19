// Constants.
export const PROTOCOL_VERSION = 0;

export enum OP_CODES {
    NOTIFICATION = 0,
    CREATE = 1,
    DELETE = 2,
    EXISTS = 3,
    GET_DATA = 4,
    SET_DATA = 5,
    GET_ACL = 6,
    SET_ACL = 7,
    GET_CHILDREN = 8,
    SYNC = 9,
    PING = 11,
    GET_CHILDREN2 = 12,
    CHECK = 13,
    MULTI = 14,
    AUTH = 100,
    SET_WATCHES = 101,
    SASL = 102,
    CREATE_SESSION = -10,
    CLOSE_SESSION = -11,
    ERROR = -1,
};

export const XID_NOTIFICATION = -1;
export const XID_PING = -2;
export const XID_AUTHENTICATION = -4;
export const XID_SET_WATCHES = -8;