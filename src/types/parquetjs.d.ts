declare module 'parquetjs' {
    export class ParquetReader {
        static openBuffer(buffer: Buffer): Promise<ParquetReader>;
        getCursor(): ParquetCursor;
        close(): Promise<void>;
    }

    export class ParquetCursor {
        next(): Promise<unknown>;
    }
}
