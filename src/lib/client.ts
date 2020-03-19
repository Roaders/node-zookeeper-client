import { Exception } from "./Exception";
import { EventEmitter } from "events";
import { ConnectionManager, STATES } from "./ConnectionManager";
import { State } from "./State";
import { validate } from "./Path";
import { ACL, fromRecord } from "./ACL";
import { CreateMode } from "./CreateMode"
import { Transaction } from "./Transaction";
import { Option, pathCallback, exceptionCallback, statCallback, bufferCallback, watcher, aclCallback, childrenCallback } from "./contracts"
import { CLIENT_DEFAULT_OPTIONS, DATA_SIZE_LIMIT } from "./constants";

var async = require('async');
var assert = require('assert');
var jute = require('./lib/jute');


/**
 * The ZooKeeper client constructor.
 *
 * @class Client
 * @constructor
 * @param connectionString {String} ZooKeeper server ensemble string.
 * @param [options] {Object} client options.
 */
export class Client extends EventEmitter {
    private connectionManager: ConnectionManager;
    private state: State = State.DISCONNECTED;
    private options: Option;

    constructor(connectionString, options: Partial<Option>) {
        super();

        if (!(this instanceof Client)) {
            return new Client(connectionString, options);
        }

        this.options = {
            ...CLIENT_DEFAULT_OPTIONS,
            ...options,
        }

        assert(
            connectionString && typeof connectionString === 'string',
            'connectionString must be an non-empty string.'
        );

        this.connectionManager = new ConnectionManager(
            connectionString,
            options,
            this.onConnectionManagerState.bind(this)
        );

        this.on('state', state => this.defaultStateListener(state));
    }

    public on(event: "state", cb: (state: State) => void): this;
    public on(event: "connected" | "connectedReadOnly" | "disconnected" | "expired" | "authenticationFailed" | string, cb: () => void): this;
    public on(event: string, listener: (...args: any[]) => void): this{
        return super.on(event, listener)
    }

    public once(event: "state", cb: (state: State) => void): this;
    public once(event: "connected" | "connectedReadOnly" | "disconnected" | "expired" | "authenticationFailed" | string, cb: () => void): this;
    public once(event: string, listener: (...args: any[]) => void): this{
        return super.once(event, listener)
    }

    public addListener(event: "state", cb: (state: State) => void): this;
    public addListener(event: "connected" | "connectedReadOnly" | "disconnected" | "expired" | "authenticationFailed" | string, cb: () => void): this;
    public addListener(event: string, listener: (...args: any[]) => void): this{
        return super.addListener(event, listener)
    }

    /**
     * Default state listener to emit user-friendly events.
     */
    private defaultStateListener(state: State) {
        switch (state) {
            case State.DISCONNECTED:
                this.emit('disconnected');
                break;
            case State.SYNC_CONNECTED:
                this.emit('connected');
                break;
            case State.CONNECTED_READ_ONLY:
                this.emit('connectedReadOnly');
                break;
            case State.EXPIRED:
                this.emit('expired');
                break;
            case State.AUTH_FAILED:
                this.emit('authenticationFailed');
                break;
            default:
                return;
        }
    }

    /**
     * Start the client and try to connect to the ensemble.
     *
     * @method connect
     */
    public connect() {
        this.connectionManager.connect();
    };

    /**
     * Shutdown the client.
     *
     * @method connect
     */
    public close() {
        this.connectionManager.close();
    };

    /**
     * Private method to translate connection manager state into client state.
     */
    private onConnectionManagerState(connectionManagerState: number) {
        var state;

        // Convert connection state to ZooKeeper state.
        switch (connectionManagerState) {
            case STATES.DISCONNECTED:
                state = State.DISCONNECTED;
                break;
            case STATES.CONNECTED:
                state = State.SYNC_CONNECTED;
                break;
            case STATES.CONNECTED_READ_ONLY:
                state = State.CONNECTED_READ_ONLY;
                break;
            case STATES.SESSION_EXPIRED:
                state = State.EXPIRED;
                break;
            case STATES.AUTHENTICATION_FAILED:
                state = State.AUTH_FAILED;
                break;
            default:
                // Not a event in which client is interested, so skip it.
                return;
        }

        if (this.state !== state) {
            this.state = state;
            this.emit('state', this.state);
        }
    };

    /**
     * Returns the state of the client.
     *
     * @method getState
     * @return {State} the state of the client.
     */
    public getState(): State {
        return this.state;
    };

    /**
     * Returns the session id for this client instance. The value returned is not
     * valid until the client connects to a server and may change after a
     * re-connect.
     *
     * @method getSessionId
     * @return {Buffer} the session id, 8 bytes long buffer.
     */
    public getSessionId(): Buffer {
        return this.connectionManager.getSessionId();
    };

    /**
     * Returns the session password for this client instance. The value returned
     * is not valid until the client connects to a server and may change after a
     * re-connect.
     *
     * @method getSessionPassword
     * @return {Buffer} the session password, 16 bytes buffer.
     */
    public getSessionPassword(): Buffer {
        return this.connectionManager.getSessionPassword();
    };

    /**
     * Returns the negotiated session timeout for this client instance. The value
     * returned is not valid until the client connects to a server and may change
     * after a re-connect.
     *
     * @method getSessionTimeout
     * @return {Integer} the session timeout value.
     */
    public getSessionTimeout(): number {
        return this.connectionManager.getSessionTimeout();
    };


    /**
     * Add the specified scheme:auth information to this client.
     *
     * @method addAuthInfo
     * @param scheme {String} The authentication scheme.
     * @param auth {Buffer} The authentication data buffer.
     */
    public addAuthInfo(scheme: string, auth: Buffer): void {
        assert(
            scheme || typeof scheme === 'string',
            'scheme must be a non-empty string.'
        );

        assert(
            Buffer.isBuffer(auth),
            'auth must be a valid instance of Buffer'
        );

        var buffer = Buffer.alloc(auth.length);

        auth.copy(buffer);
        this.connectionManager.addAuthInfo(scheme, buffer);
    };

    /**
     * Create a node with given path, data, acls and mode.
     *
     * @method create
     * @param path {String} The node path.
     * @param [data=undefined] {Buffer} The data buffer.
     * @param [acls=ACL.OPEN_ACL_UNSAFE] {Array} An array of ACL object.
     * @param [mode=CreateMode.PERSISTENT] {CreateMode} The creation mode.
     * @param callback {Function} The callback function.
     */
    public create(path: string, data: Buffer, acls: ACL[], mode: CreateMode, callback: pathCallback) {
        var header,
            payload,
            request;

        validate(path);

        assert(
            typeof callback === 'function',
            'callback must be a function.'
        );

        acls = Array.isArray(acls) ? acls : ACL.OPEN_ACL_UNSAFE;
        mode = typeof mode === 'number' ? mode : CreateMode.PERSISTENT;

        assert(
            data === null || data === undefined || Buffer.isBuffer(data),
            'data must be a valid buffer, null or undefined.'
        );

        if (Buffer.isBuffer(data)) {
            assert(
                data.length <= DATA_SIZE_LIMIT,
                'data must be equal of smaller than ' + DATA_SIZE_LIMIT + ' bytes.'
            );
        }

        assert(acls.length > 0, 'acls must be a non-empty array.');

        header = new jute.protocol.RequestHeader();
        header.type = jute.OP_CODES.CREATE;

        payload = new jute.protocol.CreateRequest();
        payload.path = path;
        payload.acl = acls.map(function (item) {
            return item.toRecord();
        });
        payload.flags = mode;

        if (Buffer.isBuffer(data)) {
            payload.data = Buffer.alloc(data.length);
            data.copy(payload.data);
        }

        request = new jute.Request(header, payload);

        this.attempt(
            (attempts, next) => {
                this.connectionManager.queue(request, function (error, response) {
                    if (error) {
                        next(error);
                        return;
                    }

                    next(null, response.payload.path);
                });
            },
            callback
        );
    };

    /**
     * Delete a node with the given path. If version is not -1, the request will
     * fail when the provided version does not match the server version.
     *
     * @method delete
     * @param path {String} The node path.
     * @param [version=-1] {Number} The version of the node.
     * @param callback {Function} The callback function.
     */
    public remove(path: string, callback: exceptionCallback): void;
    public remove(path: string, version: number, callback: exceptionCallback): void;
    public remove(path: string, versionOrCallback: number | exceptionCallback, callback?: exceptionCallback): void {
        const version = typeof versionOrCallback === "function" ? -1 : versionOrCallback;
        callback = typeof versionOrCallback === "function" ? versionOrCallback : callback as exceptionCallback;

        validate(path);

        assert(typeof callback === 'function', 'callback must be a function.');
        assert(typeof version === 'number', 'version must be a number.');


        var header = new jute.protocol.RequestHeader(),
            payload = new jute.protocol.DeleteRequest(),
            request;

        header.type = jute.OP_CODES.DELETE;

        payload.path = path;
        payload.version = version;

        request = new jute.Request(header, payload);

        this.attempt(
            (attempts, next) => {
                this.connectionManager.queue(request, function (error, response) {
                    next(error);
                });
            },
            callback
        );
    };

    /**
     * Deletes a node and all its children.
     *
     * @param path {String} The node path.
     * @param [version=-1] {Number} The version of the node.
     * @param callback {Function} The callback function.
     */
    public removeRecursive(path: string, callback: exceptionCallback): void;
    public removeRecursive(path: string, version: number, callback: exceptionCallback): void;
    public removeRecursive(path: string, versionOrCallback: number | exceptionCallback, optionalCallback?: exceptionCallback): void {
        const version = typeof versionOrCallback === "function" ? -1 : versionOrCallback;
        const callback = typeof versionOrCallback === "function" ? versionOrCallback : optionalCallback as exceptionCallback;

        validate(path);

        assert(typeof optionalCallback === 'function', 'callback must be a function.');
        assert(typeof version === 'number', 'version must be a number.');

        this.listSubTreeBFS(path, (error, children) => {
            if (error) {
                callback(error);
                return;
            }
            async.eachSeries(children.reverse(), (nodePath, next) => {
                this.remove(nodePath, version, function (err) {
                    // Skip NO_NODE exception
                    if (err instanceof Exception && err.getCode() === Exception.NO_NODE) {
                        next(null);
                        return;
                    }

                    next(err);
                });
            }, callback);
        });
    };

    /**
     * Set the data for the node of the given path if such a node exists and the
     * optional given version matches the version of the node (if the given
     * version is -1, it matches any node's versions).
     *
     * @method setData
     * @param path {String} The node path.
     * @param data {Buffer} The data buffer.
     * @param [version=-1] {Number} The version of the node.
     * @param callback {Function} The callback function.
     */
    public setData(path: string, data: Buffer | null, callback: statCallback): void;
    public setData(path: string, data: Buffer | null, version: number, callback: statCallback): void;
    public setData(path: string, data: Buffer | null, versionOrCallback: number | statCallback, optionalCallback?: statCallback): void {
        const version = typeof versionOrCallback === "function" ? -1 : versionOrCallback;
        const callback = typeof versionOrCallback === "function" ? versionOrCallback : optionalCallback as statCallback;

        validate(path);

        assert(typeof callback === 'function', 'callback must be a function.');
        assert(typeof version === 'number', 'version must be a number.');

        assert(
            data === null || data === undefined || Buffer.isBuffer(data),
            'data must be a valid buffer, null or undefined.'
        );
        if (Buffer.isBuffer(data)) {
            assert(
                data.length <= DATA_SIZE_LIMIT,
                'data must be equal of smaller than ' + DATA_SIZE_LIMIT + ' bytes.'
            );
        }

        var header = new jute.protocol.RequestHeader(),
            payload = new jute.protocol.SetDataRequest(),
            request;

        header.type = jute.OP_CODES.SET_DATA;

        payload.path = path;
        payload.data = Buffer.alloc(data.length);
        data.copy(payload.data);
        payload.version = version;

        request = new jute.Request(header, payload);

        this.attempt(
            (attempts, next) => {
                this.connectionManager.queue(request, function (error, response) {
                    if (error) {
                        next(error);
                        return;
                    }

                    next(null, response.payload.stat);
                });
            },
            callback
        );
    };

    /**
     *
     * Retrieve the data and the stat of the node of the given path.
     *
     * If the watcher is provided and the call is successful (no error), a watcher
     * will be left on the node with the given path.
     *
     * The watch will be triggered by a successful operation that sets data on
     * the node, or deletes the node.
     *
     * @method getData
     * @param path {String} The node path.
     * @param [watcher] {Function} The watcher function.
     * @param callback {Function} The callback function.
     */
    public getData(path: string, callback: bufferCallback): void;
    public getData(path: string, watcher: watcher, callback: bufferCallback): void;
    public getData(path: string, watcherOrCallback: watcher | bufferCallback, callback?: bufferCallback): void {
        let watcher: ((event: Event) => void) | undefined;
        if (callback == null) {
            callback = watcherOrCallback as bufferCallback;
            watcher = undefined;
        } else {
            watcher = watcherOrCallback as watcher;
        }

        validate(path);

        assert(typeof callback === 'function', 'callback must be a function.');

        var header = new jute.protocol.RequestHeader(),
            payload = new jute.protocol.GetDataRequest(),
            request;

        header.type = jute.OP_CODES.GET_DATA;

        payload.path = path;
        payload.watch = (typeof watcher === 'function');

        request = new jute.Request(header, payload);

        this.attempt(
            (attempts, next) => {
                this.connectionManager.queue(request, (error, response) => {
                    if (error) {
                        next(error);
                        return;
                    }

                    if (watcher) {
                        this.connectionManager.registerDataWatcher(path, watcher);
                    }

                    next(null, response.payload.data, response.payload.stat);
                });
            },
            callback
        );
    };

    /**
     * Set the ACL for the node of the given path if such a node exists and the
     * given version matches the version of the node (if the given version is -1,
     * it matches any node's versions).
     *
     *
     * @method setACL
     * @param path {String} The node path.
     * @param acls {Array} The array of ACL objects.
     * @param [version] {Number} The version of the node.
     * @param callback {Function} The callback function.
     */
    public setACL(path: string, acls: ACL[], callback: statCallback): void;
    public setACL(path: string, acls: ACL[], version: number, callback: statCallback): void;
    public setACL(path: string, acls: ACL[], versionOrCallback: number | statCallback, callback?: statCallback): void {
        const version = typeof versionOrCallback === "function" ? -1 : versionOrCallback;
        callback = typeof versionOrCallback === "function" ? versionOrCallback : callback as exceptionCallback;

        validate(path);
        assert(typeof callback === 'function', 'callback must be a function.');
        assert(
            Array.isArray(acls) && acls.length > 0,
            'acls must be a non-empty array.'
        );
        assert(typeof version === 'number', 'version must be a number.');

        var header = new jute.protocol.RequestHeader(),
            payload = new jute.protocol.SetACLRequest(),
            request;

        header.type = jute.OP_CODES.SET_ACL;

        payload.path = path;
        payload.acl = acls.map(function (item) {
            return item.toRecord();
        });

        payload.version = version;

        request = new jute.Request(header, payload);

        this.attempt(
            (attempts, next) => {
                this.connectionManager.queue(request, (error, response) => {
                    if (error) {
                        next(error);
                        return;
                    }

                    next(null, response.payload.stat);
                });
            },
            callback
        );
    };

    /**
     * Retrieve the ACL list and the stat of the node of the given path.
     *
     * @method getACL
     * @param path {String} The node path.
     * @param callback {Function} The callback function.
     */
    public getACL(path: string, callback: aclCallback): void {
        validate(path);
        assert(typeof callback === 'function', 'callback must be a function.');

        var header = new jute.protocol.RequestHeader(),
            payload = new jute.protocol.GetACLRequest(),
            request;

        header.type = jute.OP_CODES.GET_ACL;

        payload.path = path;
        request = new jute.Request(header, payload);

        this.attempt(
            (attempts, next) => {
                this.connectionManager.queue(request, (error, response) => {
                    if (error) {
                        next(error);
                        return;
                    }

                    var acls;

                    if (Array.isArray(response.payload.acl)) {
                        acls = response.payload.acl.map(function (item) {
                            return fromRecord(item);
                        });
                    }

                    next(null, acls, response.payload.stat);
                });
            },
            callback
        );
    };

    /**
     * Check the existence of a node. The callback will be invoked with the
     * stat of the given path, or null if node such node exists.
     *
     * If the watcher function is provided and the call is successful (no error
     * from callback), a watcher will be placed on the node with the given path.
     * The watcher will be triggered by a successful operation that creates/delete
     * the node or sets the data on the node.
     *
     * @method exists
     * @param path {String} The node path.
     * @param [watcher] {Function} The watcher function.
     * @param callback {Function} The callback function.
     */
    public exists(path: string, callback: statCallback): void;
    public exists(path: string, watcher: watcher, callback: statCallback): void;
    public exists(path: string, watcherOrCallback: watcher | statCallback, callback?: statCallback): void {
        let watcher: watcher | undefined;
        if (callback == null) {
            callback = watcherOrCallback as statCallback;
            watcher = undefined;
        } else {
            watcher = watcherOrCallback as watcher;
        }

        validate(path);
        assert(typeof callback === 'function', 'callback must be a function.');

        var header = new jute.protocol.RequestHeader(),
            payload = new jute.protocol.ExistsRequest(),
            request;

        header.type = jute.OP_CODES.EXISTS;

        payload.path = path;
        payload.watch = (typeof watcher === 'function');

        request = new jute.Request(header, payload);

        this.attempt(
            (attempts, next) => {
                this.connectionManager.queue(request, (error, response) => {
                    if (error && error.getCode() !== Exception.NO_NODE) {
                        next(error);
                        return;
                    }

                    var existence = response.header.err === Exception.OK;

                    if (watcher) {
                        if (existence) {
                            this.connectionManager.registerDataWatcher(
                                path,
                                watcher
                            );
                        } else {
                            this.connectionManager.registerExistenceWatcher(
                                path,
                                watcher
                            );
                        }
                    }

                    next(
                        null,
                        existence ? response.payload.stat : null
                    );
                });
            },
            callback
        );
    };

    /**
     * For the given node path, retrieve the children list and the stat.
     *
     * If the watcher callback is provided and the method completes successfully,
     * a watcher will be placed the given node. The watcher will be triggered
     * when an operation successfully deletes the given node or creates/deletes
     * the child under it.
     *
     * @method getChildren
     * @param path {String} The node path.
     * @param [watcher] {Function} The watcher function.
     * @param callback {Function} The callback function.
     */
    public getChildren(path: string, callback: childrenCallback): void;
    public getChildren(path: string, watcher: watcher, callback: childrenCallback): void;
    public getChildren(path: string, watcherOrCallback: watcher | childrenCallback, callback?: childrenCallback): void {
        let watcher: watcher | undefined;
        if (callback == null) {
            callback = watcherOrCallback as childrenCallback;
            watcher = undefined;
        } else {
            watcher = watcherOrCallback as watcher;
        }

        validate(path);
        assert(typeof callback === 'function', 'callback must be a function.');

        var header = new jute.protocol.RequestHeader(),
            payload = new jute.protocol.GetChildren2Request(),
            request;

        header.type = jute.OP_CODES.GET_CHILDREN2;

        payload.path = path;
        payload.watch = (typeof watcher === 'function');

        request = new jute.Request(header, payload);

        this.attempt(
            (attempts, next) => {
                this.connectionManager.queue(request, (error, response) => {
                    if (error) {
                        next(error);
                        return;
                    }

                    if (watcher) {
                        this.connectionManager.registerChildWatcher(path, watcher);
                    }

                    next(null, response.payload.children, response.payload.stat);
                });
            },
            callback
        );
    };

    /**
     * BFS list of the system under path. Note that this is not an atomic snapshot of
     * the tree, but the state as it exists across multiple RPCs from clients to the
     * ensemble.
     *
     * @method listSubTreeBFS
     * @param path {String} The node path.
     * @param callback {Function} The callback function.
     */
    public listSubTreeBFS(path: string, callback: (error: Error | Exception, children: string[]) => void) {
        validate(path);
        assert(typeof callback === 'function', 'callback must be a function.');

        var tree = [path];

        async.reduce(tree, tree, (memo, item, next) => {
            this.getChildren(item, (error, children) => {
                if (error) {
                    next(error);
                    return;
                }
                if (!children || !Array.isArray(children) || !children.length) {
                    next(null, tree);
                    return;
                }
                children.forEach(function (child) {
                    var childPath = item + '/' + child;

                    if (item === '/') {
                        childPath = item + child;
                    }
                    tree.push(childPath);
                });
                next(null, tree);
            });
        }, callback);
    };

    /**
     * Create node path in the similar way of `mkdir -p`
     *
     *
     * @method mkdirp
     * @param path {String} The node path.
     * @param [data=undefined] {Buffer} The data buffer.
     * @param [acls=ACL.OPEN_ACL_UNSAFE] {Array} The array of ACL object.
     * @param [mode=CreateMode.PERSISTENT] {CreateMode} The creation mode.
     * @param callback {Function} The callback function.
     */
    public mkdirp(path: string, dataOrCallback: Buffer | pathCallback, aclsOrCallback?: ACL[] | pathCallback, modeOrCallback?: CreateMode | pathCallback, callback?: pathCallback) {
        let data = typeof dataOrCallback === "function" ? undefined : dataOrCallback;
        let acls = typeof aclsOrCallback === "function" ? undefined : aclsOrCallback;
        let mode = typeof modeOrCallback === "function" ? undefined : modeOrCallback;

        [callback, modeOrCallback, aclsOrCallback, dataOrCallback].forEach(arg => {
            if (typeof arg === 'function') {
                callback = arg;
            }
        });

        validate(path);

        assert(
            typeof callback === 'function',
            'callback must be a function.'
        );

        acls = Array.isArray(acls) ? acls : ACL.OPEN_ACL_UNSAFE;
        mode = typeof mode === 'number' ? mode : CreateMode.PERSISTENT;

        let currentPath = "";

        assert(
            data === null || data === undefined || Buffer.isBuffer(data),
            'data must be a valid buffer, null or undefined.'
        );

        if (Buffer.isBuffer(data)) {
            assert(
                data.length <= DATA_SIZE_LIMIT,
                'data must be equal of smaller than ' + DATA_SIZE_LIMIT + ' bytes.'
            );
        }

        assert(acls.length > 0, 'acls must be a non-empty array.');

        // Remove the empty string
        const nodes: string[] = path.split('/').slice(1);

        async.eachSeries(nodes, (node, next) => {
            currentPath = currentPath + '/' + node;
            this.create(currentPath, data, acls, mode, function (error) {
                // Skip node exist error.
                if (error instanceof Exception && error.getCode() === Exception.NODE_EXISTS) {
                    next(null);
                    return;
                }

                next(error);
            });
        }, function (error) {
            callback(error, currentPath);
        });
    };

    /**
     * Create and return a new Transaction instance.
     *
     * @method transaction
     * @return {Transaction} an instance of Transaction.
     */
    public transaction(): Transaction {
        return new Transaction(this.connectionManager);
    };

    /**
     * Try to execute the given function 'fn'. If it fails to execute, retry for
     * 'self.options.retires' times. The duration between each retry starts at
     * 1000ms and grows exponentially as:
     *
     * duration = Math.min(1000 * Math.pow(2, attempts), sessionTimeout)
     *
     * When the given function is executed successfully or max retry has been
     * reached, an optional callback function will be invoked with the error (if
     * any) and the result.
     *
     * fn prototype:
     * function(attempts, next);
     * attempts: tells you what is the current execution attempts. It starts with 0.
     * next: You invoke the next function when complete or there is an error.
     *
     * next prototype:
     * function(error, ...);
     * error: The error you encounter in the operation.
     * other arguments: Will be passed to the optional callback
     *
     * callback prototype:
     * function(error, ...)
     *
     * @private
     * @method attempt
     * @param self {Client} an instance of zookeeper client.
     * @param fn {Function} the function to execute.
     * @param callback {Function} optional callback function.
     *
     */
    private attempt(fn: Function, callback: Function) {
        var count = 0,
            retry = true,
            retries = this.options.retries,
            results = {};

        assert(typeof fn === 'function', 'fn must be a function.');

        assert(
            typeof retries === 'number' && retries >= 0,
            'retries must be an integer greater or equal to 0.'
        );

        assert(typeof callback === 'function', 'callback must be a function.');

        async.whilst(
            () => {
                return count <= retries && retry;
            },
            next => {
                var attempts = count;

                count += 1;

                const connectionManager = this.connectionManager;

                fn(attempts, function (error) {
                    var args,
                        sessionTimeout;

                    results[attempts] = {};
                    results[attempts].error = error;

                    if (arguments.length > 1) {
                        args = Array.prototype.slice.apply(arguments);
                        results[attempts].args = args.slice(1);
                    }

                    if (error && error.code === Exception.CONNECTION_LOSS) {
                        retry = true;
                    } else {
                        retry = false;
                    }

                    if (!retry || count > retries) {
                        // call next so we can get out the loop without delay
                        next();
                    } else {
                        sessionTimeout = connectionManager.getSessionTimeout();

                        // Exponentially back-off
                        setTimeout(
                            next,
                            Math.min(1000 * Math.pow(2, attempts), sessionTimeout)
                        );
                    }
                });
            },
            error => {
                var args = [],
                    result = results[count - 1];

                if (callback) {
                    args.push(result.error);
                    Array.prototype.push.apply(args, result.args);

                    callback.apply(null, args);
                }
            }
        );
    }
}

