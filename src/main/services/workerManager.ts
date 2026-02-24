import { Worker } from 'node:worker_threads';
import path from 'node:path';
import { app } from 'electron';

export class WorkerManager {
    private worker: Worker | null = null;
    private pendingRequests = new Map<string, { resolve: Function; reject: Function }>();
    private onProgressCallback: ((payload: any) => void) | null = null;

    constructor(private modelCacheDir: string) {
        this.initWorker();
    }

    private initWorker() {
        // In production, the worker will be a .js file in the same directory or related
        const workerPath = app.isPackaged
            ? path.join(__dirname, 'aiWorker.js')
            : path.join(__dirname, 'aiWorker.js');

        this.worker = new Worker(workerPath, {
            workerData: { modelCacheDir: this.modelCacheDir }
        });

        this.worker.on('message', (message) => {
            const { id, type, payload } = message;

            if (type === 'progress') {
                this.onProgressCallback?.(payload);
                return;
            }

            const request = this.pendingRequests.get(id);
            if (!request) return;

            if (type === 'success') {
                request.resolve(payload);
            } else {
                request.reject(new Error(payload));
            }
            this.pendingRequests.delete(id);
        });

        this.worker.on('error', (err) => {
            console.error('AI Worker Error:', err);
            // Reject all pending
            for (const [id, request] of this.pendingRequests) {
                request.reject(err);
            }
            this.pendingRequests.clear();
            this.initWorker(); // Restart worker
        });
    }

    setOnProgress(callback: (payload: any) => void) {
        this.onProgressCallback = callback;
    }

    async runTask(type: string, payload: any): Promise<any> {
        const id = Math.random().toString(36).substring(7);
        return new Promise((resolve, reject) => {
            this.pendingRequests.set(id, { resolve, reject });
            this.worker?.postMessage({ id, type, payload });
        });
    }

    async runBatch(tasks: { type: string; payload: any }[]): Promise<any[]> {
        // Run all tasks in parallel for now, but we could add a concurrency limit here
        return Promise.all(tasks.map(task => this.runTask(task.type, task.payload)));
    }

    terminate() {
        this.worker?.terminate();
        this.worker = null;
    }
}
