/* eslint-disable @typescript-eslint/no-explicit-any */
import { getUiOptions, UiSchema } from '@rjsf/utils';
import { JSONSchema7 } from 'json-schema';
import * as _ from 'lodash';
import { DynamicFormSchemaError, UiSchemaOptionsWithDependency } from './types';

const unsupportedSchemaProperties = ['allOf', 'anyOf', 'oneOf'];

export const useSchemaLabel = (schema: JSONSchema7, uiSchema: UiSchema, defaultLabel?: string) => {
  const options = getUiOptions(uiSchema ?? {});
  const showLabel = options?.label ?? true;
  const label = (options?.title || schema?.title) as string;
  return [showLabel, label || defaultLabel] as [boolean, string];
};

export const useSchemaDescription = (schema: JSONSchema7, uiSchema: UiSchema, defaultDescription?: string) =>
  (getUiOptions(uiSchema ?? {})?.description || schema?.description || defaultDescription) as string;

export const getSchemaErrors = (schema: JSONSchema7): DynamicFormSchemaError[] => {
  return [
    ...(_.isEmpty(schema)
      ? [
          {
            title: 'Empty Schema',
            message: 'Schema is empty.'
          }
        ]
      : []),
    ..._.map(_.intersection(_.keys(schema), unsupportedSchemaProperties), unsupportedProperty => ({
      title: 'Unsupported Property',
      message: `Cannot generate form fields for JSON schema with ${unsupportedProperty} property.`
    }))
  ];
};

/**
 * For `ui:dependency` `matchMode: 'controlUnset'`: true when the control path under `spec` is
 * effectively unset: property missing, `null`/`undefined`, or an empty array.
 */
export const isDependencyControlUnset = (spec: unknown, path: string[]): boolean => {
  if (!path.length) {
    return true;
  }
  const parentPath = path.slice(0, -1);
  const fieldName = path[path.length - 1];
  const parent = parentPath.length > 0 ? _.get(spec, parentPath) : spec;
  if (!_.has(parent, fieldName)) {
    return true;
  }
  const value = _.get(parent, fieldName);
  if (value == null) {
    return true;
  }
  if (Array.isArray(value) && value.length === 0) {
    return true;
  }
  return false;
};

export const dependencyMatches = (
  formData: unknown,
  dependency: UiSchemaOptionsWithDependency['dependency'],
  fieldId?: string
): boolean => {
  if (!dependency) return true;
  const spec = _.get(formData ?? {}, 'spec', {});
  if (dependency.matchMode === 'controlUnset') return isDependencyControlUnset(spec, dependency.controlFieldPath);
  let value: unknown = spec;
  for (const path of dependency.controlFieldPath) {
    value = _.get(value, path, '');
    if (Array.isArray(value)) {
      const index = Number(fieldId?.replace(/\D/g, ''));
      value = Number.isInteger(index) && index >= 0 ? value[index] : value;
    }
  }
  return Array.isArray(dependency.controlFieldValue)
    ? dependency.controlFieldValue.includes(String(value))
    : dependency.controlFieldValue === String(value);
};

// Returns true if a value is not nil and is empty
export const definedAndEmpty = (value: any): boolean => !_.isNil(value) && _.isEmpty(value);

// Helper function for prune
export const pruneRecursive = (current: any, sample: any): any => {
  const valueIsEmpty = (value: any, key: string | number) =>
    _.isNil(value) ||
    _.isNaN(value) ||
    (_.isString(value) && _.isEmpty(value)) ||
    (_.isObject(value) && _.isEmpty(pruneRecursive(value, sample?.[key])));

  // Value should be pruned if it is empty and the correspondeing sample is not explicitly
  // defined as an empty value.
  const shouldPrune = (value: any, key: string) => valueIsEmpty(value, key) && !definedAndEmpty(sample?.[key]);

  // Prune each property of current value that meets the pruning criteria
  _.forOwn(current, (value, key) => {
    if (shouldPrune(value, key)) {
      delete current[key];
    }
  });

  // remove any leftover undefined values from the delete operation on an array
  if (_.isArray(current)) {
    _.pull(current, undefined);
  }

  return current;
};

// Deeply remove all empty, NaN, null, or undefined values from an object or array. If a value meets
// the above criteria, but the corresponding sample is explicitly defined as an empty vaolue, it
// will not be pruned.
// Based on https://stackoverflow.com/a/26202058/8895304
export const prune = (obj: any, sample?: any): any => {
  return pruneRecursive(_.cloneDeep(obj), sample);
};
