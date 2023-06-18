import Ajv, { type JSONSchemaType } from 'ajv';
import type { AnnFeatData } from '../sidebar/annotation/annFeat';
import type { ROIData, ROIInstance } from '../sidebar/annotation/annROI';

const roiInstance: JSONSchemaType<ROIInstance> = {
  type: 'object',
  properties: {
    type: { type: 'string', enum: ['Feature'] },
    geometry: {
      type: 'object',
      properties: {
        type: { type: 'string', enum: ['Polygon', 'Point', 'LineString'] },
        coordinates: {
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
        }
      },
      required: ['type', 'coordinates']
    },
    label: { type: 'string' },
    properties: { type: 'object', nullable: true }
  },
  required: ['label', 'type', 'geometry']
};

const roidata: JSONSchemaType<ROIData> = {
  type: 'object',
  properties: {
    type: { type: 'string', enum: ['FeatureCollection'] },
    sample: { type: 'string' },
    time: { type: 'string' },
    mPerPx: { type: 'number' },
    features: {
      type: 'array',
      items: roiInstance
    }
  },
  required: ['sample', 'type', 'features']
  //   additionalProperties: false
};

const annFeatData: JSONSchemaType<AnnFeatData> = {
  type: 'object',
  properties: {
    type: { type: 'string', enum: ['FeatureCollection'] },
    sample: { type: 'string' },
    time: { type: 'string' },
    mPerPx: { type: 'number' },
    features: {
      type: 'array',
      items: roiInstance
    },
    coordName: { type: 'string' }
  },
  required: ['sample', 'type', 'features', 'coordName']
  //   additionalProperties: false
};

const ajv = new Ajv();
export const valROIData = ajv.compile(roidata);
export const valAnnFeatData = ajv.compile(annFeatData);
