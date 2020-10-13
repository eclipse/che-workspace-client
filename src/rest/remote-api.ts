/*********************************************************************
 * Copyright (c) 2018 Red Hat, Inc.
 *
 * This program and the accompanying materials are made
 * available under the terms of the Eclipse Public License 2.0
 * which is available at https://www.eclipse.org/legal/epl-2.0/
 *
 * SPDX-License-Identifier: EPL-2.0
 **********************************************************************/

import { AxiosError, AxiosPromise, AxiosRequestConfig, AxiosResponse } from 'axios';
import {
    IResources,
    WorkspaceSettings,
    Preferences,
    User,
    KubernetesNamespace,
    IResourceQueryParams,
    IResourceCreateParams,
    FactoryResolver,
} from './resources';
import { che } from '@eclipse-che/api';

export enum METHOD {
    getAll,
    getAllByNamespace,
    fetchById,

    create,
    update,
    delete,
    start,
    startTemporary,
    stop,

    getSettings
}

export interface IRequestConfig extends AxiosRequestConfig { }

export interface IResponse<T> extends AxiosResponse<T> {
    data: T;
    status: number;
    statusText: string;
    headers: any;
    config: IRequestConfig;
    request?: any;
}

export interface IRequestError extends Error {
    status?: number;
    config: AxiosRequestConfig;
    request?: any;
    response?: IResponse<any>;
}

class RequestError implements IRequestError {

    status: number | undefined;
    name: string;
    message: string;
    config: AxiosRequestConfig;
    request: any;
    response: AxiosResponse | undefined;

    constructor(error: AxiosError) {
        if (error.code) {
            this.status = Number(error.code);
        }
        this.name = error.name;
        this.message = error.message;
        this.config = error.config;
        if (error.request) {
            this.request = error.request;
        }
        if (error.response) {
            this.response = error.response;
        }
    }
}

export interface IRemoteAPI {
    getAll<T = che.workspace.Workspace>(): Promise<T[]>;
    getAllByNamespace<T = che.workspace.Workspace>(namespace: string): Promise<T[]>;
    getById<T = che.workspace.Workspace>(workspaceKey: string): Promise<T>;
    /**
     * Creates a workspace from config.
     *
     * @param devfile workspace devfile.
     * @param params optional creating params.
     */
    create<T = che.workspace.Workspace>(devfile: che.workspace.devfile.Devfile, params: IResourceCreateParams | undefined): Promise<T>;
    update(workspaceId: string, workspace: che.workspace.Workspace): Promise<any>;
    delete(workspaceId: string): Promise<any>;
    /**
     * Starts a workspace.
     *
     * @param workspaceId a workspace ID.
     * @param params resource query params.
     */
    start(workspaceId: string, params?: IResourceQueryParams): Promise<any>;
    stop(workspaceId: string): Promise<any>;
    getSettings<T = WorkspaceSettings>(): Promise<T>;
    getFactoryResolver<T = che.workspace.devfile.Devfile>(url: string, headers?: { [name: string]: string }): Promise<T>;
    generateSshKey<T = che.ssh.SshPair>(service: string, name: string): Promise<T>;
    createSshKey(sshKeyPair: che.ssh.SshPair): Promise<void>;
    getSshKey<T = che.ssh.SshPair>(service: string, name: string): Promise<T>;
    getAllSshKey<T = che.ssh.SshPair>(service: string): Promise<T[]>;
    deleteSshKey(service: string, name: string): Promise<void>;
    /**
     * Return the current authenticated user
     */
    getCurrentUser(): Promise<User>;
    getUserPreferences(): Promise<Preferences>;
    getUserPreferences(filter: string | undefined): Promise<Preferences>;
    updateUserPreferences(update: Preferences): Promise<Preferences>;
    replaceUserPreferences(preferences: Preferences): Promise<Preferences>;
    deleteUserPreferences(): Promise<void>;
    deleteUserPreferences(list: string[] | undefined): Promise<void>;
    /**
     * Return registered oauth token.
     *
     * @param oAuthProvider oauth provider's name e.g. github.
     */
    getOAuthToken(oAuthProvider: string): Promise<string>;
    /**
     * Return list of registered oAuth providers.
     */
    getOAuthProviders(): Promise<string[]>;
    updateActivity(workspaceId: string): Promise<void>;
    /**
     * Returns list of kubernetes namespace.
     */
    getKubernetesNamespace<T = KubernetesNamespace[]>(): Promise<T>;
    /**
     * Returns a devfile schema object.
     */
    getDevfileSchema<T = Object>(): Promise<T>;
}

export class RemoteAPI implements IRemoteAPI {
    private promises: Map<string, AxiosPromise<any>> = new Map();

    private remoteAPI: IResources;

    constructor(remoteApi: IResources) {
        this.remoteAPI = remoteApi;
    }

    /**
     * Returns list of all user's workspaces.
     *
     * @returns {Promise<T[]>}
     */
    public getAll<T = che.workspace.Workspace>(): Promise<T[]> {
        const key = this.buildKey(METHOD.getAll);
        const promise = this.getRequestPromise(key);
        if (promise) {
            return promise;
        }

        const newPromise = new Promise<T[]>((resolve, reject) => {
            this.remoteAPI.getAll<T>()
                .then((response: AxiosResponse<T[]>) => {
                    resolve(response.data);
                })
                .catch((error: AxiosError) => {
                    reject(new RequestError(error));
                });
        });
        this.saveRequestPromise(key, newPromise);

        return newPromise;
    }

    /**
     * Returns list of workspaces in the namespace.
     *
     * @param {string} namespace
     * @returns {Promise<T[]>}
     */
    public getAllByNamespace<T = che.workspace.Workspace>(namespace: string): Promise<T[]> {
        const key = this.buildKey(METHOD.getAllByNamespace, namespace);
        const promise = this.getRequestPromise(key);
        if (promise) {
            return promise;
        }

        const newPromise = new Promise<T[]>((resolve, reject) => {
            this.remoteAPI.getAllByNamespace<T>(namespace)
                .then((response: AxiosResponse<T[]>) => {
                    resolve(response.data);
                })
                .catch((error: AxiosError) => {
                    reject(new RequestError(error));
                });
        });
        this.saveRequestPromise(key, newPromise);

        return newPromise;
    }

    /**
     * Returns a workspace by ID or key.
     *
     * @param {string} workspaceKey workspace ID or `namespace/workspaceName`
     * @returns {Promise<T>}
     */
    public getById<T = che.workspace.Workspace>(workspaceKey: string): Promise<T> {
        const key = this.buildKey(METHOD.getAllByNamespace, workspaceKey);
        const promise = this.getRequestPromise(key);
        if (promise) {
            return promise;
        }

        const newPromise = new Promise<T>((resolve, reject) => {
            this.remoteAPI.getById<T>(workspaceKey)
                .then((response: AxiosResponse<T>) => {
                    resolve(response.data);
                })
                .catch((error: AxiosError) => {
                    reject(new RequestError(error));
                });
        });
        this.saveRequestPromise(key, newPromise);

        return newPromise;
    }

    public create<T = che.workspace.Workspace>(devfile: che.workspace.devfile.Devfile, params: IResourceCreateParams | undefined): Promise<T> {
        return new Promise<T>((resolve, reject) => {
            this.remoteAPI.create(devfile, params)
                .then((response: AxiosResponse<any>) => {
                    resolve(response.data);
                })
                .catch((error: AxiosError) => {
                    reject(new RequestError(error));
                });
        });
    }

    /**
     * Updates a workspace.
     *
     * @param {string} workspaceId a workspace ID to update
     * @param {che.workspace.Workspace} workspace a new workspace data
     * @returns {Promise<any>}
     */
    public update(workspaceId: string, workspace: che.workspace.Workspace): Promise<any> {
        return new Promise<any>((resolve, reject) => {
            this.remoteAPI.update(workspaceId, workspace)
                .then((response: AxiosResponse<any>) => {
                    resolve(response.data);
                })
                .catch((error: AxiosError) => {
                    reject(new RequestError(error));
                });
        });
    }

    /**
     * Deletes a workspace.
     *
     * @param {string} workspaceId a workspace ID to delete
     * @returns {Promise<any>}
     */
    public delete(workspaceId: string): Promise<any> {
        return new Promise<any>((resolve, reject) => {
            this.remoteAPI.delete(workspaceId)
                .then((response: AxiosResponse<any>) => {
                    resolve(response.data);
                })
                .catch((error: AxiosError) => {
                    reject(new RequestError(error));
                });
        });
    }

    public start(workspaceId: string, params?: IResourceQueryParams): Promise<any> {
        return new Promise<any>((resolve, reject) => {
            this.remoteAPI.start(workspaceId, params)
                .then((response: AxiosResponse<any>) => {
                    resolve(response.data);
                })
                .catch((error: AxiosError) => {
                    reject(new RequestError(error));
                });
        });
    }

    /**
     * Stops a workspace.
     *
     * @param {string} workspaceId a workspace ID.
     * @returns {Promise<any>}
     */
    public stop(workspaceId: string): Promise<any> {
        return new Promise<any>((resolve, reject) => {
            this.remoteAPI.stop(workspaceId)
                .then((response: AxiosResponse<any>) => {
                    resolve(response.data);
                })
                .catch((error: AxiosError) => {
                    reject(new RequestError(error));
                });
        });
    }

    /**
     * Returns settings.
     *
     * @returns {Promise<T>}
     */
    public getSettings<T = WorkspaceSettings>(): Promise<T> {
        const key = this.buildKey(METHOD.getSettings);
        const promise = this.getRequestPromise(key);
        if (promise) {
            return promise;
        }

        const newPromise = new Promise<T>((resolve, reject) => {
            this.remoteAPI.getSettings<T>()
                .then((response: AxiosResponse<T>) => {
                    resolve(response.data);
                })
                .catch((error: AxiosError) => {
                    reject(new RequestError(error));
                });
        });
        this.saveRequestPromise(key, newPromise);

        return newPromise;
    }

    getFactoryResolver<T = FactoryResolver>(url: string, headers?: { [name: string]: string }): Promise<T> {
        return new Promise<T>((resolve, reject) => {
            this.remoteAPI.getFactoryResolver<T>(url, headers)
                .then((response: AxiosResponse<T>) => {
                    resolve(response.data);
                })
                .catch((error: AxiosError) => {
                    reject(new RequestError(error));
                });
        });
    }

    public generateSshKey<T = che.ssh.SshPair>(service: string, name: string): Promise<T> {
        return new Promise<T>((resolve, reject) => {
            this.remoteAPI.generateSshKey<T>(service, name)
                .then((response: AxiosResponse<T>) => {
                    resolve(response.data);
                })
                .catch((error: AxiosError) => {
                    reject(new RequestError(error));
                });
        });
    }
    public createSshKey(sshKeyPair: any): Promise<void> {
        return new Promise((resolve, reject) => {
            this.remoteAPI.createSshKey(sshKeyPair)
                .then((response: AxiosResponse<void>) => {
                    resolve(response.data);
                })
                .catch((error: AxiosError) => {
                    reject(new RequestError(error));
                });
        });
    }
    public getSshKey<T = che.ssh.SshPair>(service: string, name: string): Promise<T> {
        return new Promise<T>((resolve, reject) => {
            this.remoteAPI.getSshKey<T>(service, name)
                .then((response: AxiosResponse<T>) => {
                    resolve(response.data);
                })
                .catch((error: AxiosError) => {
                    reject(new RequestError(error));
                });
        });
    }

    public getAllSshKey<T = che.ssh.SshPair>(service: string): Promise<T[]> {
        return new Promise<T[]>((resolve, reject) => {
            this.remoteAPI.getAllSshKey<T>(service)
                .then((response: AxiosResponse<T[]>) => {
                    resolve(response.data);
                })
                .catch((error: AxiosError) => {
                    reject(new RequestError(error));
                });
        });
    }

    public deleteSshKey(service: string, name: string): Promise<void> {
        return new Promise((resolve, reject) => {
            this.remoteAPI.deleteSshKey(service, name)
                .then((response: AxiosResponse) => {
                    resolve(response.data);
                })
                .catch((error: AxiosError) => {
                    reject(new RequestError(error));
                });
        });
    }

    getCurrentUser(): Promise<User> {
        return new Promise((resolve, reject) => {
            this.remoteAPI.getCurrentUser()
                .then((response: AxiosResponse<User>) => {
                    resolve(response.data);
                })
                .catch((error: AxiosError) => {
                    reject(new RequestError(error));
                });
        });
    }

    public getUserPreferences(filter: string | undefined = undefined): Promise<Preferences> {
        return new Promise((resolve, reject) => {
            this.remoteAPI.getUserPreferences(filter)
                .then((response: AxiosResponse<Preferences>) => {
                    resolve(response.data);
                })
                .catch((error: AxiosError) => {
                    reject(new RequestError(error));
                });
        });
    }

    public updateUserPreferences(update: Preferences): Promise<Preferences> {
        return new Promise((resolve, reject) => {
            this.remoteAPI.updateUserPreferences(update)
                .then((response: AxiosResponse<Preferences>) => {
                    resolve(response.data);
                })
                .catch((error: AxiosError) => {
                    reject(new RequestError(error));
                });
        });
    }

    public replaceUserPreferences(preferences: Preferences): Promise<Preferences> {
         return new Promise((resolve, reject) => {
            this.remoteAPI.replaceUserPreferences(preferences)
                .then((response: AxiosResponse<Preferences>) => {
                    resolve(response.data);
                })
                .catch((error: AxiosError) => {
                    reject(new RequestError(error));
                });
        });
    }

    public deleteUserPreferences(list: string[] | undefined = undefined): Promise<void> {
         return new Promise((resolve, reject) => {
            this.remoteAPI.deleteUserPreferences(list)
                .then((response: AxiosResponse<void>) => {
                    resolve();
                })
                .catch((error: AxiosError) => {
                    reject(new RequestError(error));
                });
        });
    }

    getOAuthToken(oAuthProvider: string): Promise<string> {
        return new Promise((resolve, reject) => {
            this.remoteAPI.getOAuthToken(oAuthProvider)
                .then((response: AxiosResponse<{ token: string }>) => {
                    resolve(response.data.token);
                })
                .catch((error: AxiosError) => {
                    reject(new RequestError(error));
                });
        });
    }

    getOAuthProviders(): Promise<string[]> {
        return new Promise<string[]>((resolve, reject) => {
            this.remoteAPI.getOAuthProviders()
                .then((response: AxiosResponse<any[]>) => {
                    resolve(response.data.map(provider => provider.name));
                })
                .catch((error: AxiosError) => {
                    reject(new RequestError(error));
                });
        });
    }

    getKubernetesNamespace<T = KubernetesNamespace[]>(): Promise<T> {
        return new Promise<T>((resolve, reject) => {
            this.remoteAPI.getKubernetesNamespace<T>()
                .then((response: AxiosResponse<T>) => {
                    resolve(response.data);
                })
                .catch((error: AxiosError) => {
                    reject(new RequestError(error));
                });
        });
    }

    getDevfileSchema<T = Object>(): Promise<T> {
        return new Promise<T>((resolve, reject) => {
            this.remoteAPI.getDevfileSchema<T>()
                .then((response: AxiosResponse<T>) => {
                    resolve(response.data);
                })
                .catch((error: AxiosError) => {
                    reject(new RequestError(error));
                });
        });
    }

    /**
     * Updates workspace activity timestamp to prevent stop by timeout when workspace is running and using.
     *
     * @param {string} workspaceId a workspace ID to update activity timestamp
     * @returns {Promise<any>}
     */
    public updateActivity(workspaceId: string): Promise<void> {
        return new Promise<any>((resolve, reject) => {
            this.remoteAPI.updateActivity(workspaceId)
                .then((response: AxiosResponse<void>) => resolve())
                .catch((error: AxiosError) => {
                    reject(new RequestError(error));
                });
        });
    }

    /**
     * Returns a string key to identify the request.
     *
     * @param {METHOD} method a method name
     * @param {string} args
     * @returns {string}
     */
    protected buildKey(method: METHOD, ...args: string[]): string {
        args.unshift(method.toString());
        return args.join('-');
    }

    /**
     * Returns stored request promise by a string key.
     *
     * @param {string} key a key to identify the request promise
     * @returns {Promise<any> | undefined}
     */
    protected getRequestPromise(key: string): Promise<any> | undefined {
        return this.promises.get(key);
    }

    /**
     * Save the request promise.
     *
     * @param {string} key a key to identify the request promise.
     * @param {Promise<any>} promise a request promise
     */
    protected saveRequestPromise(key: string, promise: Promise<any>): void {
        this.promises.set(key, promise);
        promise.then(
            () => this.promises.delete(key),
            () => this.promises.delete(key)
        );
    }
}
