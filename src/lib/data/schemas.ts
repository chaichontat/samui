import Ajv, { type JSONSchemaType } from 'ajv';
import type { ROIData, ROIInstance } from '../sidebar/annotation/annROI';

const roiInstance: JSONSchemaType<ROIInstance> = {
  type: 'object',
  properties: {
    label: { type: 'string' },
    type: { type: 'string', enum: ['Circle', 'Polygon', 'Point'] },
    coords: {
      oneOf: [
        { type: 'array', items: { type: 'number' } },
        {
          type: 'array',
          items: {
            type: 'array',
            items: {
              type: 'array',
              items: { type: 'number' }
            }
          }
        }
      ]
    },
    radius: { type: 'number', nullable: true },
    properties: { type: 'object', nullable: true }
  },
  required: ['label', 'type', 'coords'],
  additionalProperties: false
};

const roidata: JSONSchemaType<ROIData> = {
  type: 'object',
  properties: {
    sample: { type: 'string' },
    time: { type: 'string' },
    mPerPx: { type: 'number' },
    rois: {
      type: 'array',
      items: roiInstance
    }
  },
  required: ['sample', 'rois']
  //   additionalProperties: false
};

const ajv = new Ajv();
export const valROIData = ajv.compile(roidata);
