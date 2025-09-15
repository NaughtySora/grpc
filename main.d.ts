import { credentials, GrpcObject, ServerCredentials, ServerOptions } from "@grpc/grpc-js";
import { Options } from "@grpc/proto-loader";

type ErrBack = (error: Error | null, data: any | null) => void;
type AsyncFn = (...args: any[]) => Promise<any>;

type Callbackify = (fn: AsyncFn) => ErrBack;

type CallbackifyApi = (api: Record<string | number | symbol, AsyncFn>)
  => Record<string | number | symbol, ErrBack>;

type FileName<T extends string> =
  T extends `${infer _}${'/' | '\\'}${infer Rest}` ? FileName<Rest> :
  T extends `${infer Head}${'.'}${infer _}` ? Head : never;

type GRPCClientOptions = {
  proto: Record<string, GrpcObject>;
  port?: number;
  host?: string;
  ssl?: Parameters<typeof credentials['createSsl']>;
  promisify?: boolean;
};

type GRPCServerOptions = {
  port?: number;
  host?: string;
  logger?: Pick<Console, "log" | "error">;
  ssl?: Parameters<typeof ServerCredentials['createSsl']>;
  serverOptions?: ServerOptions;
};

type GRPCServer = (options?: GRPCServerOptions) => {
  start(services: ReturnType<typeof merge>): Promise<void>;
  stop(ms?: number): Promise<void>;
};

type GRPCClient = (options: GRPCClientOptions)
  => (key: string, schema: string) => Record<string, any>;

export const callbackify: Callbackify;
export const callbackifyApi: CallbackifyApi;
export const define: <T extends string>(routes: { path: T, options?: Options }[]) =>
  Record<FileName<T>, GrpcObject>;
export const merge: (proto: Record<string, GrpcObject>, api: Record<string, any>)
  => { signature: any, impl: any }[];
export const url: (host: string, port: number) => string;

export const server: GRPCServer;
export const client: GRPCClient; 