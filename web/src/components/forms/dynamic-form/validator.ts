import { customizeValidator } from '@rjsf/validator-ajv8';

export const SchemaValidator = customizeValidator({
  customFormats: {
    'not-empty': /.*\S.*/,
    'k8s-name': /^[a-z0-9\-]+$/
  }
});
