import { parentPort, workerData } from 'node:worker_threads';
import { pipeline, env, RawImage, SamModel, AutoProcessor } from '@huggingface/transformers';
import sharp from 'sharp';

// Configure environment for robust model loading
const { modelCacheDir } = workerData;
env.allowRemoteModels = true;
env.allowLocalModels = true;
env.cacheDir = modelCacheDir;

// Transformers.js specific browser cache disable for Electron stability
(env as any).useBrowserCache = false;
(env as any).useCustomCache = false;

const pipelines = new Map<string, any>();
let samModel: any = null;
let samProcessor: any = null;

async function getPipeline(task: string, modelId: string) {
  const key = `${task}:${modelId}`;
  if (pipelines.has(key)) return pipelines.get(key);

  const runner = await pipeline(task as any, modelId, {
    progress_callback: (update: any) => {
      parentPort?.postMessage({
        type: 'progress',
        payload: {
          modelId,
          status: update.status,
          progress: update.progress,
          file: update.file
        }
      });
    }
  });
  pipelines.set(key, runner);
  return runner;
}

async function getSamResources(modelId: string) {
  if (samModel && samProcessor) return { model: samModel, processor: samProcessor };

  const progress_callback = (update: any) => {
    parentPort?.postMessage({
      type: 'progress',
      payload: {
        modelId,
        status: update.status,
        progress: update.progress,
        file: update.file
      }
    });
  };

  [samModel, samProcessor] = await Promise.all([
    SamModel.from_pretrained(modelId, { progress_callback }),
    AutoProcessor.from_pretrained(modelId, { progress_callback })
  ]);

  return { model: samModel, processor: samProcessor };
}

parentPort?.on('message', async (message) => {
  const { id, type, payload } = message;

  try {
    switch (type) {
      case 'remove-background': {
        const { inputPath, modelId } = payload;
        const segmenter = await getPipeline('image-segmentation', modelId);
        const output = await segmenter(inputPath);
        // We return the raw data or a way to handle it. 
        // For simplicity, let's keep logic that involves complex object merging 
        // in a way that we can pass back.
        parentPort?.postMessage({ id, type: 'success', payload: output });
        break;
      }

      case 'upscale':
      case 'enhance-realworld': {
        const { inputPath, modelId } = payload;
        const runner = await getPipeline('image-to-image', modelId);
        const output = await runner(inputPath);
        parentPort?.postMessage({ id, type: 'success', payload: output });
        break;
      }

      case 'detect': {
        const { inputPath, modelId, threshold } = payload;
        const detector = await getPipeline('object-detection', modelId);
        const output = await detector(inputPath, { threshold });
        parentPort?.postMessage({ id, type: 'success', payload: output });
        break;
      }

      case 'sam-segment': {
        const { inputPath, modelId, points, labels } = payload;
        const { model, processor } = await getSamResources(modelId);
        const image = await RawImage.read(inputPath);

        const inputs = await processor(image, {
          input_points: [points],
          input_labels: [labels],
        });

        const outputs = await model(inputs);
        const masks = await processor.post_process_masks(
          outputs.pred_masks,
          inputs.original_sizes,
          inputs.reshaped_input_sizes
        );

        // Return mask data and IoU scores
        parentPort?.postMessage({
          id,
          type: 'success',
          payload: {
            masks: masks.map((m: any) => ({ dims: m.dims, data: m.data })),
            iou_scores: { data: Array.from(outputs.iou_scores.data) }
          }
        });
        break;
      }

      default:
        throw new Error(`Unknown task type: ${type}`);
    }
  } catch (error: any) {
    parentPort?.postMessage({ id, type: 'error', payload: error.message });
  }
});
