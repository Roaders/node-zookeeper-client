/**
 * Copyright (c) 2013 Yahoo! Inc. All rights reserved.
 *
 * Copyrights licensed under the MIT License. See the accompanying LICENSE file
 * for terms.
 */

import { Client } from "./lib/client";

/**
 * Create a new ZooKeeper client.
 *
 * @method createClient
 * @for node-zookeeper-client
 */
export function createClient(connectionString, options) {
    return new Client(connectionString, options);
}
