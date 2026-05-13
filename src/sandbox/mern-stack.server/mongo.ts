import type { Collection, Db, Filter, FindCursor, UpdateFilter } from "mongodb";
import { MongoClient } from "mongodb";
import { APPWEAVER_ENV_PREFIX } from "../../constants";

export const MONGO_URI_LOCALHOST =
    "mongodb://localhost:27017/?maxPoolSize=20&w=majority";
export const MONGO_DB_NAME = 'mernStackSandbox'

export enum MongodbEnvVars {
    CONN_URI = 'MONGODB_CONN_URI',
    CONN_JSON = 'MONGODB_CONN_JSON',
    DB_NAME = 'MONGODB_DB_NAME',
}

export type MongodbConnectionConfig = {
    username: string;
    password: string;
    engine: string;
    host: string;
    port: number;
    ssl: boolean;
    dbClusterIdentifier: string;
    connUrl?: string;
}

export const makeMongodbUriFromJson = (jsonStr: string): string => {
    const config = JSON.parse(jsonStr) as MongodbConnectionConfig;
    return `mongodb://${config.username}:${config.password}@${config.host}:${config.port}/?ssl=${config.ssl}&retryWrites=false`
}

export type MongodbConfig = { uri?: string; dbName: string };

export const getMongodbConfigFromEnvVars = (env: Record<string, string | undefined>) => {
    const uri = env[`${APPWEAVER_ENV_PREFIX}${MongodbEnvVars.CONN_URI}`];
    const json = env[`${APPWEAVER_ENV_PREFIX}${MongodbEnvVars.CONN_JSON}`];

    const config = {
        uri: MONGO_URI_LOCALHOST,
        dbName: process.env[`${APPWEAVER_ENV_PREFIX}${MongodbEnvVars.DB_NAME}`] ?? MONGO_DB_NAME
    } as MongodbConfig;

    if (uri) {
        config.uri = uri;
    } else if (json) {
        try {
            config.uri = makeMongodbUriFromJson(json);
        } catch (jsonParseError) {
            console.warn('getMongodbEnvVars(): failed to parse mongodb connection json', jsonParseError);
        }
    }
    
    return config;
}

export type MongodbWrapper = {
    setAfterFindListener: (
        listener: undefined | ((cursor: FindCursor) => void)
    ) => MongodbWrapper;
    getDb: () => Promise<Db>;
    getClient: () => MongoClient;
    getCollection: (
        collName: string,
    ) => Promise<Collection<Document>>;
    getDocsFrom: <DocType = unknown>(params: {
        collection: string;
        withFilter: Filter<Document>;
        validateDocsFn?: (docs: DocType[]) => void;
    }) => Promise<DocType[]>;
    mapDocsFrom: <DocType = unknown, EntityType = unknown>(params: {
        collection: string;
        withFilter: Filter<Document>;
        validateDocsFn?: (docs: DocType[]) => void;
        mapFn: (doc: DocType) => EntityType;
    }) => Promise<EntityType[]>;
    insertOne: <T = unknown>(params: {
        collection: string;
        record: T;
    }) => Promise<T>;
    insertOneValidated: <T = unknown>(params: {
        collection: string;
        validated: T;
        recordFn: (validated: T) => T;
    }) => Promise<T>;
    updateOne: <T = unknown>(params: {
        collection: string;
        withFilter: UpdateFilter<Document>;
        upsert?: boolean;
        record: T;
    }) => Promise<T>;
    updateOneValidated: <T = unknown>(params: {
        collection: string;
        withFilter: UpdateFilter<Document>;
        upsert?: boolean;
        validated: T;
        recordFn: (validated: T) => T;
    }) => Promise<T>;
};

export const getDbSuffix = () =>
    process.env.NODE_ENV == "test"
        ? "test"
        : process.env.UPTIM_ENV?.toLowerCase() ?? "local";

export const makeMongodbClientWrapper = (client: MongoClient, config: MongodbConfig): MongodbWrapper => {
    let connectedClient: MongoClient | null = null;
    let dbPtr: Db | null = null;

    const getConnectedClient = async () => {
        if (connectedClient) return connectedClient;
        connectedClient = await client.connect();
        return connectedClient;
    };

    const getDb = async () => {
        if (dbPtr) return dbPtr;
        dbPtr = (await getConnectedClient()).db(config.dbName);
        return dbPtr;
    };

    let afterFind: undefined | ((cursor: FindCursor, docs: Document[]) => void);
    const me: MongodbWrapper = {
        setAfterFindListener: (_after) => {
            afterFind = _after;
            return me;
        },
        getDb,
        getClient: () => client,
        getCollection: async (collName) =>
            (await getDb()).collection(collName),
        getDocsFrom: async <D = unknown>({
            collection,
            withFilter,
            validateDocsFn,
        }: {
            collection: string;
            withFilter: Filter<Document>;
            validateDocsFn?: (docs: D[]) => void;
        }): Promise<D[]> => {
            const cursor = await (
                await me.getCollection(collection)
            ).find(withFilter, { batchSize: 1 });
            const docs = await (cursor.toArray() as Promise<D[]>);
            validateDocsFn?.(docs);
            afterFind?.(cursor, docs as Document[]);
            return docs;
        },
        mapDocsFrom: async <D = unknown, T = unknown>({
            collection,
            withFilter,
            validateDocsFn,
            mapFn,
        }: {
            collection: string;
            withFilter: Filter<Document>;
            validateDocsFn?: (docs: D[]) => void;
            mapFn: (doc: D) => T;
        }) =>
            (
                await me.getDocsFrom<D>({
                    collection,
                    withFilter,
                    validateDocsFn,
                })
            ).map(mapFn) as T[],
        insertOne: async <T = unknown>({
            collection,
            record,
        }: {
            collection: string;
            record: T;
        }) => {
            const ack = await (
                await me.getCollection(collection)
            ).insertOne(record as any);
            if (ack.acknowledged && ack.insertedId) {
                return record;
            }
            throw new Error(
                `Failed to insert record: ack=${JSON.stringify(
                    ack
                )} ;; record=${JSON.stringify(record)}`
            );
        },
        insertOneValidated: async <T>({
            collection,
            validated,
            recordFn,
        }: {
            collection: string;
            validated: T;
            recordFn: (validated: T) => T;
        }) => {
            return await me.insertOne<T>({
                collection,
                record: recordFn(validated),
            });
        },
        updateOne: async <T>({
            collection,
            withFilter,
            record,
        }: {
            collection: string;
            withFilter: UpdateFilter<Document>;
            record: T;
        }) => {
            await (
                await me.getCollection(collection)
            ).updateOne(withFilter, {
                $set: record,
            } as any);
            return record;
        },
        updateOneValidated: async <T>({
            collection,
            withFilter,
            upsert,
            validated,
            recordFn,
        }: {
            collection: string;
            withFilter: UpdateFilter<Document>;
            upsert?: boolean;
            validated: T;
            recordFn: (validated: T) => T;
        }) => {
            const record = recordFn(validated);
            return await me.updateOne<T>({
                collection,
                withFilter,
                upsert,
                record,
            });
        },
    };
    return me;
};

