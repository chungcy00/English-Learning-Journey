export function workerMessage<T>(worker: ServiceWorker, type: string): Promise<T> {
  return new Promise((resolve, reject) => {
    const channel = new MessageChannel();
    const timer = window.setTimeout(() => { channel.port1.close(); reject(new Error('Update worker timed out')); }, 10000);
    channel.port1.onmessage = event => {
      window.clearTimeout(timer); channel.port1.close(); resolve(event.data as T);
    };
    worker.postMessage({ type }, [channel.port2]);
  });
}
