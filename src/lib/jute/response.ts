import { Record } from "./record";

/**
 * This class represent the response that ZooKeeper sends back to the client.
 *
 * @class Responsee
 * @constructor
 * @param header {Record} The request header record.
 * @param payload {payload} The request payload record.
 */
export class Response{
    constructor(public readonly header: Record, public readonly payload: Record){
    }
}