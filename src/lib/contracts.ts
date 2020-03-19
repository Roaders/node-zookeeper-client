import { Exception } from "./Exception";
import { ACL } from "./ACL";

export interface Option {
    sessionTimeout: number;
    spinDelay: number;
    retries: number;
}

export type pathCallback = (error: Error | Exception, path: string) => void
export type exceptionCallback = (error: Error | Exception) => void;
export type statCallback = (error: Error | Exception, stat: Stat) => void;
export type bufferCallback = (error: Error | Exception, data: Buffer, stat: Stat) => void;
export type aclCallback = (error: Error | Exception, acls: ACL[], stat: Stat) => void;
export type childrenCallback = (error: Error | Exception, children: string[], stat: Stat) => void;
export type watcher = (event: Event) => void
