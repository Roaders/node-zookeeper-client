/**
 * Copyright (c) 2013 Yahoo! Inc. All rights reserved.
 *
 * Copyrights licensed under the MIT License. See the accompanying LICENSE file
 * for terms.
 */

import { Client } from "./lib/client";
import { Option } from "./lib/contracts";

/**
 * Create a new ZooKeeper client.
 *
 * @method createClient
 * @for node-zookeeper-client
 */
export function createClient(connectionString: string, options?: Partial<Option>): Client {
    return new Client(connectionString, options);
}
