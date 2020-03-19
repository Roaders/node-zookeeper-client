export interface Stat {
    czxid: number;
    mzxid: number;
    ctime: number;
    mtime: number;
    version: number;
    cversion: number;
    aversion: number;
    ephemeralOwner: number;
    dataLength: number;
    numChildren: number;
    pzxid: number;
}

export interface Option {
    sessionTimeout: number;
    spinDelay: number;
    retries: number;
}
